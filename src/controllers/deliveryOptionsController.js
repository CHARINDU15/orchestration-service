const crypto = require('crypto');
const Joi = require('joi');
const { StatusCodes } = require('http-status-codes');
const pino = require('pino');
const db = require('../../config/database');
const otpService = require('../services/otpService');
const { notifyDeliveryOptionChange } = require('../services/notificationService');
const { calculateDeliveryOptionsUntil, getAvailableDeliveryDates } = require('../utils/holidayCalendar');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const OTP_SESSION_TTL_MINUTES = parseInt(process.env.OTP_SESSION_TTL_MINUTES || '30', 10);
const DELIVERY_OPTION_WINDOW_DAYS = parseInt(process.env.DELIVERY_OPTION_WINDOW_DAYS || '10', 10);

const DELIVERY_OPTIONS = [
  'CHANGE_DELIVERY_DATE',
  'COLLECT_FROM_PARCELPOINT',
  'LEAVE_IN_SAFE_PLACE',
  'LEAVE_WITH_TRUSTED_PERSON',
  'ALTERNATE_ADDRESS',
  'HOLD_FOR_COLLECTION'
];

const DELIVERY_OPTION_LOG_CODES = {
  CHANGE_DELIVERY_DATE: 'CHANGE_DATE',
  COLLECT_FROM_PARCELPOINT: 'COLLECT_PP',
  LEAVE_IN_SAFE_PLACE: 'SAFE_PLACE',
  LEAVE_WITH_TRUSTED_PERSON: 'TRUSTED_PERSON',
  ALTERNATE_ADDRESS: 'ALT_ADDRESS',
  HOLD_FOR_COLLECTION: 'HOLD_COLLECTION'
};

const phoneRegex = /^\+?[1-9]\d{7,14}$/;

const alternateAddressSchema = Joi.object({
  address1: Joi.string().min(3).max(100).required(),
  address2: Joi.string().max(100).allow('', null),
  city: Joi.string().min(2).max(50).required(),
  suburb: Joi.string().min(2).max(50).required(),
  state: Joi.string().min(2).max(30).required(),
  country: Joi.string().length(2).required(),
  postcode: Joi.string().min(2).max(10).required()
});

const parcelPointSchema = Joi.object({
  id: Joi.string().min(1).max(50).required(),
  name: Joi.string().min(2).max(120).required(),
  code: Joi.string().max(50).allow('', null),
  branchCode: Joi.string().max(50).allow('', null)
});

const deliveryOptionSchema = Joi.object({
  option: Joi.string().valid(...DELIVERY_OPTIONS).required(),
  deliveryDate: Joi.string().isoDate().when('option', { is: 'CHANGE_DELIVERY_DATE', then: Joi.required(), otherwise: Joi.optional() }),
  additionalInfo: Joi.string().max(300).allow('', null),
  safeLocation: Joi.string().max(300).when('option', { is: 'LEAVE_IN_SAFE_PLACE', then: Joi.required(), otherwise: Joi.optional() }),
  trustedPersonName: Joi.string().min(2).max(100).when('option', { is: 'LEAVE_WITH_TRUSTED_PERSON', then: Joi.required(), otherwise: Joi.optional() }),
  trustedPersonMobile: Joi.string().pattern(phoneRegex).when('option', { is: 'LEAVE_WITH_TRUSTED_PERSON', then: Joi.required(), otherwise: Joi.optional() }),
  alternateAddress: alternateAddressSchema.when('option', { is: 'ALTERNATE_ADDRESS', then: Joi.required(), otherwise: Joi.optional() }),
  parcelPoint: parcelPointSchema.when('option', {
    is: Joi.valid('COLLECT_FROM_PARCELPOINT', 'HOLD_FOR_COLLECTION'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  collectionDate: Joi.string().isoDate().allow(null).optional()
});

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const requireToken = (req) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
};

const ensureOtpVerified = async (shipmentId, token) => {
  const tokenHash = hashToken(token);
  const latest = await db('otp_requests')
    .where('consignment_id', shipmentId)
    .where('token_hash', tokenHash)
    .where('is_verified', true)
    .orderBy('verified_at', 'desc')
    .first();

  if (!latest) {
    return { ok: false, error: 'OTP verification required', code: 'OTP_REQUIRED' };
  }

  if (latest.verified_at) {
    const verifiedAt = new Date(latest.verified_at);
    const expiresAt = new Date(verifiedAt.getTime() + OTP_SESSION_TTL_MINUTES * 60 * 1000);
    if (Date.now() > expiresAt.getTime()) {
      return { ok: false, error: 'OTP session expired', code: 'OTP_EXPIRED' };
    }
  }

  return { ok: true };
};

const mapDeliveryOptionPayload = (option, payload) => {
  const base = {
    preferred_delivery_option: option,
    address_1: null,
    address_2: null,
    city: null,
    suburb: null,
    state: null,
    country: null,
    postcode: null,
    pp_location_id: null,
    pp_location_name: null,
    delivery_date: null,
    additional_info: payload.additionalInfo || null,
    safe_location: null,
    trusted_person: null,
    trusted_person_name: null,
    trusted_person_mobile: null,
    branch_code: null,
    collection_date: null
  };

  if (option === 'CHANGE_DELIVERY_DATE') {
    base.delivery_date = new Date(payload.deliveryDate);
  }

  if (option === 'LEAVE_IN_SAFE_PLACE') {
    base.safe_location = payload.safeLocation;
  }

  if (option === 'LEAVE_WITH_TRUSTED_PERSON') {
    base.trusted_person = payload.trustedPersonName;
    base.trusted_person_name = payload.trustedPersonName;
    base.trusted_person_mobile = payload.trustedPersonMobile;
  }

  if (option === 'ALTERNATE_ADDRESS') {
    base.address_1 = payload.alternateAddress.address1;
    base.address_2 = payload.alternateAddress.address2 || null;
    base.city = payload.alternateAddress.city;
    base.suburb = payload.alternateAddress.suburb;
    base.state = payload.alternateAddress.state;
    base.country = payload.alternateAddress.country;
    base.postcode = payload.alternateAddress.postcode;
  }

  if (option === 'COLLECT_FROM_PARCELPOINT' || option === 'HOLD_FOR_COLLECTION') {
    base.pp_location_id = payload.parcelPoint.id;
    base.pp_location_name = payload.parcelPoint.name;
    base.branch_code = payload.parcelPoint.branchCode || null;
    if (payload.collectionDate) {
      base.collection_date = new Date(payload.collectionDate);
    }
  }

  return base;
};

exports.getAvailableDeliveryDates = async (req, res, next) => {
  try {
    const token = requireToken(req);
    if (!token) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: 'Missing or invalid Authorization header',
        code: 'MISSING_TOKEN'
      });
    }

    const validation = await otpService.validateAccessToken(token);
    if (!validation.valid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: validation.error,
        code: 'TOKEN_INVALID'
      });
    }

    const shipmentId = validation.shipmentId;
    const otpStatus = await ensureOtpVerified(shipmentId, token);
    if (!otpStatus.ok) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        error: otpStatus.error,
        code: otpStatus.code
      });
    }

    const consignment = await db('consignments')
      .where('consignment_id', shipmentId)
      .first();

    if (!consignment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'Consignment not found'
      });
    }

    const baseDate = consignment.delivery_date ? new Date(consignment.delivery_date) : null;
    if (!baseDate) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Delivery date is not set for this shipment'
      });
    }

    const availableDates = await getAvailableDeliveryDates(baseDate, DELIVERY_OPTION_WINDOW_DAYS);

    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        shipmentId,
        baseDeliveryDate: baseDate.toISOString(),
        availableDates
      }
    });
  } catch (error) {
    return next(error);
  }
};

exports.applyDeliveryOption = async (req, res, next) => {
  try {
    const token = requireToken(req);
    if (!token) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: 'Missing or invalid Authorization header',
        code: 'MISSING_TOKEN'
      });
    }

    const validation = await otpService.validateAccessToken(token);
    if (!validation.valid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: validation.error,
        code: 'TOKEN_INVALID'
      });
    }

    const shipmentId = validation.shipmentId;
    const otpStatus = await ensureOtpVerified(shipmentId, token);
    if (!otpStatus.ok) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        error: otpStatus.error,
        code: otpStatus.code
      });
    }

    const { error, value } = deliveryOptionSchema.validate(req.body || {}, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const consignment = await db('consignments')
      .where('consignment_id', shipmentId)
      .first();

    if (!consignment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: 'Consignment not found'
      });
    }

    const cutoff = await calculateDeliveryOptionsUntil(consignment.delivery_date || new Date());
    if (cutoff && Date.now() > new Date(cutoff).getTime()) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        error: 'Delivery options can no longer be changed for this shipment',
        code: 'DELIVERY_OPTION_WINDOW_CLOSED',
        deliveryOptionsUntil: cutoff
      });
    }

    if (value.option === 'CHANGE_DELIVERY_DATE') {
      const availableDates = await getAvailableDeliveryDates(
        new Date(consignment.delivery_date),
        DELIVERY_OPTION_WINDOW_DAYS
      );
      const requestedDate = new Date(value.deliveryDate).toISOString().slice(0, 10);
      const todayDate = new Date().toISOString().slice(0, 10);
      if (requestedDate < todayDate) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: 'Requested delivery date is in the past',
          code: 'DELIVERY_DATE_IN_PAST'
        });
      }
      const allowed = availableDates.some(date => date.slice(0, 10) === requestedDate);
      if (!allowed) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: 'Requested delivery date is not available',
          code: 'INVALID_DELIVERY_DATE'
        });
      }
    }

    const optionPayload = mapDeliveryOptionPayload(value.option, value);

    const responseData = await db.transaction(async trx => {
      const existing = await trx('delivery_options')
        .where('consignment_id', consignment.id)
        .first();

      let current;
      if (existing) {
        await trx('delivery_options')
          .where('consignment_id', consignment.id)
          .update({
            ...optionPayload,
            updated_by: 'customer',
            updated_date: new Date()
          });

        current = await trx('delivery_options')
          .where('consignment_id', consignment.id)
          .first();
      } else {
        const [inserted] = await trx('delivery_options')
          .insert({
            consignment_id: consignment.id,
            ...optionPayload,
            created_by: 'customer',
            updated_by: 'customer'
          })
          .returning('*');

        current = inserted;
      }

      await trx('consignments')
        .where('id', consignment.id)
        .update({
          preferred_delivery_option: value.option,
          delivery_date: value.option === 'CHANGE_DELIVERY_DATE'
            ? optionPayload.delivery_date
            : consignment.delivery_date,
          updated_by: 'customer',
          updated_date: new Date()
        });

      await trx('delivery_option_logs')
        .insert({
          consignment_id: consignment.id,
          preferred_delivery_option: value.option,
          address_1: optionPayload.address_1,
          address_2: optionPayload.address_2,
          city: optionPayload.city,
          suburb: optionPayload.suburb,
          state: optionPayload.state,
          country: optionPayload.country,
          postcode: optionPayload.postcode,
          pp_location_id: optionPayload.pp_location_id,
          pp_location_name: optionPayload.pp_location_name,
          delivery_date: optionPayload.delivery_date,
          additional_info: optionPayload.additional_info,
          safe_location: optionPayload.safe_location,
          trusted_person: optionPayload.trusted_person,
          trusted_person_name: optionPayload.trusted_person_name,
          trusted_person_mobile: optionPayload.trusted_person_mobile,
          operation: DELIVERY_OPTION_LOG_CODES[value.option] || value.option.slice(0, 20),
          branch_code: optionPayload.branch_code,
          verified_by: 'customer',
          collection_date: optionPayload.collection_date,
          created_by: 'customer'
        });

      return { existing, current };
    });

    const authHeader = req.headers.authorization;
    const notificationPayload = {
      type: 'DELIVERY_OPTION_CHANGE',
      shipmentId,
      recipientEmail: consignment.receiver_email,
      recipientName: consignment.receiver_contact_name || 'Customer',
      previousOption: responseData.existing?.preferred_delivery_option || null,
      currentOption: value.option,
      consignment: {
        shipmentId,
        deliveryDate: consignment.delivery_date,
        receiverName: consignment.receiver_contact_name,
        receiverAddress: {
          address1: consignment.receiver_address_1,
          address2: consignment.receiver_address_2,
          suburb: consignment.receiver_suburb,
          city: consignment.receiver_city,
          state: consignment.receiver_state,
          country: consignment.receiver_country,
          postcode: consignment.receiver_postcode
        }
      },
      optionDetails: responseData.current
    };

    await notifyDeliveryOptionChange(notificationPayload, authHeader);

    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        shipmentId,
        option: value.option,
        deliveryOption: responseData.current
      }
    });
  } catch (error) {
    logger.error(error, 'Failed to apply delivery option');
    return next(error);
  }
};

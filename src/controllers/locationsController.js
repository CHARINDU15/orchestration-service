const Joi = require('joi');
const { StatusCodes } = require('http-status-codes');
const db = require('../../config/database');

const nearbySchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  radiusKm: Joi.number().positive().max(500).optional()
});

const distanceSql = `(
  6371 * acos(
    cos(radians(:lat)) * cos(radians(u.latitude))
    * cos(radians(u.longitude) - radians(:lng))
    + sin(radians(:lat)) * sin(radians(u.latitude))
  )
)`;

const baseSelectSql = `
  SELECT
    u.id,
    u.name,
    u.code,
    u.location,
    u.address,
    u.mobile,
    u.hours,
    u.zip_code,
    u.latitude,
    u.longitude,
    s.name AS state_name,
    s.code AS state_code,
    s.id AS state_id,
    c.name AS country_name,
    c.code_2 AS country_code,
    ${distanceSql} AS distance_km
  FROM public.upslocations u
  JOIN public.states s ON u.state_id = s.id
  JOIN public.countries c ON s.country_id = c.id
  WHERE u.latitude IS NOT NULL
    AND u.longitude IS NOT NULL
`;

exports.getNearbyUpsLocations = async (req, res, next) => {
  try {
    const { error, value } = nearbySchema.validate(req.query || {}, {
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

    if (value.radiusKm) {
      const sql = `${baseSelectSql}
        AND ${distanceSql} <= :radius
        ORDER BY distance_km`;

      const result = await db.raw(sql, {
        lat: value.lat,
        lng: value.lng,
        radius: value.radiusKm
      });

      return res.status(StatusCodes.OK).json({
        success: true,
        data: result.rows || [],
        meta: {
          mode: 'radius',
          center: { lat: value.lat, lng: value.lng },
          radiusKm: value.radiusKm,
          count: result.rows?.length || 0
        }
      });
    }

    const nearestSql = `${baseSelectSql}
      ORDER BY distance_km
      LIMIT 1`;

    const nearestResult = await db.raw(nearestSql, {
      lat: value.lat,
      lng: value.lng
    });

    const nearest = nearestResult.rows?.[0];
    if (!nearest) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: [],
        meta: {
          mode: 'state',
          center: { lat: value.lat, lng: value.lng },
          count: 0
        }
      });
    }

    const stateSql = `${baseSelectSql}
      AND u.state_id = :stateId
      ORDER BY distance_km`;

    const stateResult = await db.raw(stateSql, {
      lat: value.lat,
      lng: value.lng,
      stateId: nearest.state_id
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      data: stateResult.rows || [],
      meta: {
        mode: 'state',
        center: { lat: value.lat, lng: value.lng },
        state: {
          id: nearest.state_id,
          name: nearest.state_name,
          code: nearest.state_code,
          country: {
            name: nearest.country_name,
            code: nearest.country_code
          }
        },
        count: stateResult.rows?.length || 0
      }
    });
  } catch (error) {
    return next(error);
  }
};

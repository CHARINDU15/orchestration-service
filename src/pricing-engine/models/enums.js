const SERVICE_TYPES = {
  GROUND: 'GROUND',
  EXPRESS: 'EXPRESS',
  SAME_DAY: 'SAME_DAY'
};

const SERVICE_TYPE_CODES = {
  GROUND: 112,
  EXPRESS: 113
};

const normalizeServiceType = (serviceType) => {
  if (serviceType === null || serviceType === undefined) return serviceType;

  const numeric = Number(serviceType);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const key = String(serviceType).toUpperCase();
  if (SERVICE_TYPE_CODES[key]) {
    return SERVICE_TYPE_CODES[key];
  }

  return serviceType;
};

const DELIVERY_OPTIONS = {
  CHANGE_DELIVERY_DATE: 'CHANGE_DELIVERY_DATE',
  COLLECT_FROM_PARCELPOINT: 'COLLECT_FROM_PARCELPOINT',
  LEAVE_IN_SAFE_PLACE: 'LEAVE_IN_SAFE_PLACE',
  LEAVE_WITH_TRUSTED_PERSON: 'LEAVE_WITH_TRUSTED_PERSON',
  ALTERNATE_ADDRESS: 'ALTERNATE_ADDRESS',
  HOLD_FOR_COLLECTION: 'HOLD_FOR_COLLECTION'
};

const ACCESSORIAL_CODE_MAP = {
  CHANGE_DELIVERY_DATE: ['RESCHEDULE_DELIVERY'],
  COLLECT_FROM_PARCELPOINT: ['PARCEL_POINT'],
  LEAVE_IN_SAFE_PLACE: ['SAFE_PLACE'],
  LEAVE_WITH_TRUSTED_PERSON: ['TRUSTED_PERSON'],
  ALTERNATE_ADDRESS: ['ADDRESS_CHANGE'],
  HOLD_FOR_COLLECTION: ['HOLD_COLLECTION']
};

module.exports = {
  SERVICE_TYPES,
  SERVICE_TYPE_CODES,
  normalizeServiceType,
  DELIVERY_OPTIONS,
  ACCESSORIAL_CODE_MAP
};

const pino = require('pino');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const HOLIDAYS_API_BASE_URL = process.env.HOLIDAYS_API_BASE_URL || 'https://date.nager.at/api/v3/PublicHolidays';
const HOLIDAY_CACHE_TTL_MS = parseInt(process.env.HOLIDAY_CACHE_TTL_MS || '86400000', 10);
const HOLIDAY_COUNTRY_CODE = process.env.HOLIDAY_COUNTRY_CODE || 'LK';
const HOLIDAY_TIMEZONE = process.env.HOLIDAY_TIMEZONE || 'Asia/Colombo';
const HOLIDAY_FALLBACK_DATES = (process.env.HOLIDAY_FALLBACK_DATES || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const holidayCache = new Map();

const fetchJson = (url) => {
  if (typeof fetch === 'function') {
    return fetch(url).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  }

  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
};

const getHolidayCacheKey = (year, countryCode) => `${countryCode}-${year}`;

const getHolidaysForYear = async (year) => {
  const cacheKey = getHolidayCacheKey(year, HOLIDAY_COUNTRY_CODE);
  const cached = holidayCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.dates;
  }

  const url = `${HOLIDAYS_API_BASE_URL}/${year}/${HOLIDAY_COUNTRY_CODE}`;
  try {
    const response = await fetchJson(url);
    const dates = new Set(
      (response || [])
        .map(entry => entry?.date)
        .filter(Boolean)
    );

    holidayCache.set(cacheKey, {
      dates,
      expiresAt: Date.now() + HOLIDAY_CACHE_TTL_MS
    });

    return dates;
  } catch (error) {
    const fallbackDates = new Set(HOLIDAY_FALLBACK_DATES);
    logger.warn(
      { err: error.message, year, fallbackCount: fallbackDates.size },
      'Failed to fetch holidays, using fallback dates if configured'
    );
    return fallbackDates;
  }
};

const formatColomboDateKey = (date) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: HOLIDAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
};

const getColomboWeekday = (date) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: HOLIDAY_TIMEZONE,
    weekday: 'short'
  });
  return formatter.format(date);
};

const isBusinessDay = (date, holidaySet) => {
  const weekday = getColomboWeekday(date);
  if (weekday === 'Sun') return false;
  const dateKey = formatColomboDateKey(date);
  return !holidaySet.has(dateKey);
};

const calculateDeliveryOptionsUntil = async (deliveryDate) => {
  if (!deliveryDate) return null;

  const base = new Date(deliveryDate);
  let candidate = new Date(base.getTime() - 48 * 60 * 60 * 1000);

  for (let guard = 0; guard < 370; guard += 1) {
    const colomboYear = new Intl.DateTimeFormat('en-US', {
      timeZone: HOLIDAY_TIMEZONE,
      year: 'numeric'
    }).format(candidate);
    const holidaySet = await getHolidaysForYear(colomboYear);

    if (isBusinessDay(candidate, holidaySet)) {
      return candidate.toISOString();
    }

    candidate = new Date(candidate.getTime() - 24 * 60 * 60 * 1000);
  }

  return candidate.toISOString();
};

const getAvailableDeliveryDates = async (startDate, businessDays) => {
  if (!startDate || !businessDays) return [];

  const results = [];
  let cursor = new Date(startDate.getTime());

  while (results.length < businessDays) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);

    const colomboYear = new Intl.DateTimeFormat('en-US', {
      timeZone: HOLIDAY_TIMEZONE,
      year: 'numeric'
    }).format(cursor);
    const holidaySet = await getHolidaysForYear(colomboYear);

    if (isBusinessDay(cursor, holidaySet)) {
      results.push(cursor.toISOString());
    }
  }

  return results;
};

module.exports = {
  HOLIDAY_TIMEZONE,
  calculateDeliveryOptionsUntil,
  getAvailableDeliveryDates,
  getColomboWeekday,
  isBusinessDay
};

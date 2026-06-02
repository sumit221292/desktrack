const axios = require('axios');
const { query } = require('../config/db');

// Fixed-date Indian national holidays (accurate every year) — used as a fallback
// when the public-holiday API is unreachable.
const fixedHolidays = (year) => [
  { date: `${year}-01-26`, name: 'Republic Day' },
  { date: `${year}-05-01`, name: 'May Day' },
  { date: `${year}-08-15`, name: 'Independence Day' },
  { date: `${year}-10-02`, name: 'Gandhi Jayanti' },
  { date: `${year}-12-25`, name: 'Christmas' },
];

// Fetch India's public holidays for a year (Nager.Date — free, no API key),
// with the fixed-date list as a fallback. Returns [{ date:'YYYY-MM-DD', name }].
async function fetchYearHolidays(year) {
  try {
    const res = await axios.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/IN`, { timeout: 8000 });
    const data = res.data;
    if (Array.isArray(data) && data.length) {
      const seen = new Set();
      const out = [];
      for (const h of data) {
        if (h.date && !seen.has(h.date)) { seen.add(h.date); out.push({ date: h.date, name: h.localName || h.name }); }
      }
      return out.sort((a, b) => a.date.localeCompare(b.date));
    }
    return fixedHolidays(year);
  } catch (e) {
    console.warn('[holidays] API fetch failed, using fallback:', e.message);
    return fixedHolidays(year);
  }
}

// The company's SELECTED holidays (stored in company_settings.holidays as [{date,name}]).
async function getCompanyHolidays(companyId) {
  try {
    const r = await query(
      `SELECT setting_value FROM company_settings WHERE company_id = $1 AND setting_key = 'holidays'`,
      [companyId]
    );
    if (!r.rows.length) return [];
    const val = r.rows[0].setting_value;
    const arr = typeof val === 'string' ? JSON.parse(val) : val;
    return Array.isArray(arr) ? arr.filter(h => h && h.date) : [];
  } catch (e) {
    return [];
  }
}

// Same, as a Set of 'YYYY-MM-DD' for quick lookups in attendance/payroll.
async function getCompanyHolidaySet(companyId) {
  const list = await getCompanyHolidays(companyId);
  return new Set(list.map(h => h.date));
}

module.exports = { fetchYearHolidays, getCompanyHolidays, getCompanyHolidaySet, fixedHolidays };

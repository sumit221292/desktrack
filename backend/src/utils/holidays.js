const { query } = require('../config/db');

// Fixed-date Indian national holidays — accurate for ANY year.
const fixedHolidays = (year) => [
  { date: `${year}-01-01`, name: "New Year's Day" },
  { date: `${year}-01-26`, name: 'Republic Day' },
  { date: `${year}-04-14`, name: 'Ambedkar Jayanti' },
  { date: `${year}-05-01`, name: 'May Day / Labour Day' },
  { date: `${year}-08-15`, name: 'Independence Day' },
  { date: `${year}-10-02`, name: 'Gandhi Jayanti' },
  { date: `${year}-12-25`, name: 'Christmas' },
];

// Movable / festival holidays per year (Nager.Date has no India data, so these
// are curated). Dates are best-effort — the admin can verify and add/correct via
// the "Add custom holiday" option in Settings.
const FESTIVALS = {
  2026: [
    { date: '2026-01-14', name: 'Makar Sankranti / Pongal' },
    { date: '2026-02-15', name: 'Maha Shivratri' },
    { date: '2026-03-04', name: 'Holi' },
    { date: '2026-03-21', name: 'Eid-ul-Fitr (Ramzan)' },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-05-28', name: 'Bakrid (Eid al-Adha)' },
    { date: '2026-08-26', name: 'Janmashtami' },
    { date: '2026-10-20', name: 'Dussehra (Vijayadashami)' },
    { date: '2026-11-08', name: 'Diwali (Deepavali)' },
    { date: '2026-11-24', name: 'Guru Nanak Jayanti' },
  ],
  2027: [
    { date: '2027-01-14', name: 'Makar Sankranti / Pongal' },
    { date: '2027-03-22', name: 'Holi' },
    { date: '2027-03-26', name: 'Good Friday' },
    { date: '2027-10-09', name: 'Dussehra (Vijayadashami)' },
    { date: '2027-10-29', name: 'Diwali (Deepavali)' },
  ],
};

// All known holidays for a year = fixed national + curated festivals, sorted.
async function fetchYearHolidays(year) {
  const y = parseInt(year);
  const list = [...fixedHolidays(y), ...(FESTIVALS[y] || [])];
  const seen = new Set();
  return list
    .filter(h => { if (seen.has(h.date)) return false; seen.add(h.date); return true; })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// The company's SELECTED holidays (company_settings.holidays = [{date,name}]).
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

async function getCompanyHolidaySet(companyId) {
  const list = await getCompanyHolidays(companyId);
  return new Set(list.map(h => h.date));
}

module.exports = { fetchYearHolidays, getCompanyHolidays, getCompanyHolidaySet, fixedHolidays };

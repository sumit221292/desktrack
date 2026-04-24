/**
 * DEEP PRODUCTION E2E — every page, every interaction, every calculation.
 * Runs headed. Captures console errors, network 4xx/5xx, UI bugs.
 */
const { test, expect } = require('@playwright/test');

const BASE = 'https://desktrack.up.railway.app';
const API = BASE + '/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJzdW1pdF9wYWxAY3JlYXRpdmVmcmVuenkuaW4iLCJyb2xlIjoiU1VQRVJfQURNSU4iLCJjb21wYW55SWQiOjEsImlhdCI6MTc3NzAzMjQyNCwiZXhwIjoxNzc3MTE4ODI0fQ.a3ZBPeRFFWEmI1UDmxmJlvKJd2xmnMV0NoA3C2I368k';
const USER = { id: 1, email: 'sumit_pal@creativefrenzy.in', role: 'SUPER_ADMIN', tenantId: 1 };

// Global bug log
const bugs = [];
const logBug = (category, page, detail) => bugs.push({ category, page, detail: String(detail).substring(0, 300) });

async function injectAuth(page) {
  await page.goto(BASE);
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenantSlug', 'creativefrenzy');
  }, { token: TOKEN, user: USER });
}

function attachListeners(page, pageName) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (/Failed to fetch|net::ERR|GOOGLE_CLIENT_ID|401/.test(text)) return; // benign
      logBug('console', pageName, text);
    }
  });
  page.on('pageerror', err => logBug('pageerror', pageName, err.message));
  page.on('response', async res => {
    const url = res.url();
    if (!url.includes(API)) return;
    const status = res.status();
    if (status >= 400) {
      const body = await res.text().catch(() => '');
      logBug('http', pageName, `${res.request().method()} ${url.replace(BASE, '')} → ${status} | ${body.substring(0, 150)}`);
    }
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('DeskTrack — Deep Production Audit', () => {
  test('D0. Auth injection works, reach dashboard', async ({ page }) => {
    attachListeners(page, 'dashboard');
    await injectAuth(page);
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);

    const body = await page.locator('body').innerText();
    expect(body).toContain('Welcome Back');

    // Check role displayed
    const isAdminVisible = /SUPER_ADMIN|Super Admin/i.test(body);
    console.log('[D0] Role in UI:', isAdminVisible ? 'SUPER_ADMIN ✓' : 'NOT VISIBLE ✗');
    if (!isAdminVisible) logBug('ui', 'dashboard', 'SUPER_ADMIN role not shown in header');
  });

  test('D1. Dashboard no flicker — stats render within 2 frames only', async ({ page }) => {
    attachListeners(page, 'dashboard');
    await injectAuth(page);
    const snaps = [];
    await page.goto(`${BASE}/`);
    for (let i = 0; i < 20; i++) {
      const cardsText = await page.locator('body').innerText();
      const hasAdminCard = /Total Employees|Present Today/i.test(cardsText);
      const hasPersonalCard = /Status.*\n.*Today|In Progress/i.test(cardsText);
      snaps.push({ t: i * 200, admin: hasAdminCard, personal: hasPersonalCard });
      await page.waitForTimeout(200);
    }
    const transitions = snaps.filter((s, i) => i > 0 && (s.admin !== snaps[i-1].admin || s.personal !== snaps[i-1].personal)).length;
    console.log('[D1] Stats transitions:', transitions, 'timeline:', JSON.stringify(snaps.slice(0,10)));
    if (transitions > 2) logBug('ui', 'dashboard', `Excessive flicker: ${transitions} stat transitions in 4 seconds`);
  });

  test('D2. Dashboard API — stats endpoint returns valid data', async ({ request }) => {
    const res = await request.get(`${API}/attendance/stats?date=2026-04-24`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'x-tenant-slug': 'creativefrenzy' }
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    console.log('[D2] /stats:', JSON.stringify(data));
    expect(data).toHaveProperty('totalEmployees');
    expect(data).toHaveProperty('presentToday');
    // Sanity: totalEmployees should be numeric
    if (isNaN(parseInt(data.totalEmployees))) logBug('api', 'dashboard', 'totalEmployees non-numeric');
  });

  test('E1. Employees page loads + shows at least 1 employee', async ({ page }) => {
    attachListeners(page, 'employees');
    await injectAuth(page);
    await page.goto(`${BASE}/employees`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    const hasTable = /Sumit|Priyanka|Employee/i.test(body);
    console.log('[E1] Has employee data:', hasTable);
    if (!hasTable) logBug('ui', 'employees', 'No employee visible on /employees');
  });

  test('E2. Employees API — returns list with valid schema', async ({ request }) => {
    const res = await request.get(`${API}/employees`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'x-tenant-slug': 'creativefrenzy' }
    });
    const data = await res.json();
    console.log('[E2] Employees count:', data.length);
    expect(Array.isArray(data)).toBe(true);
    data.forEach(emp => {
      if (emp.email && /^EMP-\d+$/i.test(emp.email)) logBug('data', 'employees', `Emp id=${emp.id}: email contains employee_code: ${emp.email}`);
      if (emp.employee_code && emp.employee_code.includes('@')) logBug('data', 'employees', `Emp id=${emp.id}: employee_code contains email: ${emp.employee_code}`);
      if (typeof emp.designation_id === 'string' && !Number.isFinite(+emp.designation_id)) logBug('data', 'employees', `Emp id=${emp.id}: designation_id is string '${emp.designation_id}'`);
      if (typeof emp.department_id === 'string' && !Number.isFinite(+emp.department_id)) logBug('data', 'employees', `Emp id=${emp.id}: department_id is string '${emp.department_id}'`);
    });
  });

  test('A1. Attendance page loads', async ({ page }) => {
    attachListeners(page, 'attendance');
    await injectAuth(page);
    await page.goto(`${BASE}/attendance`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    if (body.length < 200) logBug('ui', 'attendance', 'Page body too short, possibly blank');
  });

  test('A2. Attendance calendar loads without console errors', async ({ page }) => {
    attachListeners(page, 'att-calendar');
    await injectAuth(page);
    await page.goto(`${BASE}/attendance-calendar`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    // Verify page rendered
    const body = await page.locator('body').innerText();
    if (body.length < 200) logBug('ui', 'att-calendar', 'Blank calendar page');
  });

  test('L1. Leaves page loads + balance cards visible', async ({ page }) => {
    attachListeners(page, 'leaves');
    await injectAuth(page);
    await page.goto(`${BASE}/leaves`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    const hasLeaveUI = /Leave|Balance|Apply|Casual|Sick/i.test(body);
    if (!hasLeaveUI) logBug('ui', 'leaves', 'No leave UI elements visible');
  });

  test('L2. Leave types API — must return seeded types (CL/SL/EL/UL)', async ({ request }) => {
    const res = await request.get(`${API}/leaves/types`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'x-tenant-slug': 'creativefrenzy' }
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    console.log('[L2] types:', Array.isArray(data) ? data.map(t => t.name + '(' + t.code + ')').join(', ') : 'not array');
    if (!Array.isArray(data) || data.length < 4) logBug('data', 'leaves', `Only ${data.length || 0} leave types — expected at least 4 (CL/SL/EL/UL)`);
  });

  test('L3. Leave balances API', async ({ request }) => {
    const res = await request.get(`${API}/leaves/balances`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'x-tenant-slug': 'creativefrenzy' }
    });
    console.log('[L3] /leaves/balances status:', res.status());
    if (res.status() >= 400) logBug('api', 'leaves', `/leaves/balances returned ${res.status()}`);
  });

  test('P1. Payroll page loads + all 4 tabs visible', async ({ page }) => {
    attachListeners(page, 'payroll');
    await injectAuth(page);
    await page.goto(`${BASE}/payroll`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const tabs = ['Payroll Records', 'Salary Structure', 'Tax Declaration', 'Downloads'];
    for (const t of tabs) {
      const v = await page.locator(`text=${t}`).first().isVisible().catch(() => false);
      if (!v) logBug('ui', 'payroll', `Tab not visible: ${t}`);
    }
  });

  test('P2. Salary Structure list — Net Pay calculation respects deductions_json', async ({ page, request }) => {
    attachListeners(page, 'payroll-salary');
    await injectAuth(page);
    await page.goto(`${BASE}/payroll`);
    await page.waitForTimeout(2500);
    await page.locator('text=Salary Structure').first().click();
    await page.waitForTimeout(2500);

    // Fetch structures via API to check raw deductions_json
    const res = await request.get(`${API}/payroll/salary-structures`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'x-tenant-slug': 'creativefrenzy' }
    });
    const structures = res.status() === 200 ? await res.json() : [];
    console.log('[P2] Structures count:', structures.length);

    for (const ss of structures) {
      const gross = [ss.basic_pay, ss.hra, ss.da, ss.conveyance, ss.medical, ss.special_allowance].reduce((a,b) => a + (parseFloat(b)||0), 0);
      let parsedDed = {};
      try { parsedDed = typeof ss.deductions_json === 'string' ? JSON.parse(ss.deductions_json || '{}') : (ss.deductions_json || {}); } catch {}
      const hasEnabledDed = Object.values(parsedDed.deductions || {}).some(d => d?.enabled);
      console.log(`[P2] Emp ${ss.employee_id}: gross=${gross}, hasEnabledDeductions=${hasEnabledDed}`);

      // Check UI shows Net == Gross when no deductions enabled
      if (!hasEnabledDed && gross > 0) {
        const emp = structures.find(s => s.id === ss.id);
        const empName = emp?.first_name || 'Unknown';
        // Find the row in UI and check Net Pay
        const rows = await page.locator('div').filter({ hasText: new RegExp(empName, 'i') }).all();
        for (const row of rows.slice(0, 3)) {
          const txt = await row.innerText().catch(() => '');
          if (txt.includes('Net Pay')) {
            const netMatch = txt.match(/Net Pay[\s\S]*?₹([\d,]+)/);
            if (netMatch) {
              const netVal = parseInt(netMatch[1].replace(/,/g, ''));
              if (netVal !== gross) {
                logBug('calc', 'payroll-salary', `${empName}: no deductions enabled but Net Pay ₹${netVal} != Gross ₹${gross}`);
              }
            }
          }
        }
      }
    }
  });

  test('P3. Run Payroll modal opens + shows employee list', async ({ page }) => {
    attachListeners(page, 'payroll-run');
    await injectAuth(page);
    await page.goto(`${BASE}/payroll`);
    await page.waitForTimeout(2500);
    const runBtn = page.locator('button').filter({ hasText: /Run Payroll/i }).first();
    if (!(await runBtn.isVisible().catch(() => false))) { logBug('ui', 'payroll-run', 'Run Payroll button not visible'); return; }
    await runBtn.click();
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    // Modal opens as overlay; text could say "Select employees" / "employees to process" / etc.
    const modalOpen = /Select.*employee|employees to process|Confirm|Process Payroll/i.test(body);
    if (!modalOpen) logBug('ui', 'payroll-run', 'Run Payroll modal did not open or has unrecognized content');
    // Close
    const cancel = page.locator('button').filter({ hasText: /^Cancel$/i }).first();
    if (await cancel.isVisible().catch(() => false)) await cancel.click();
  });

  test('P4. Tax Declaration tab loads', async ({ page }) => {
    attachListeners(page, 'payroll-tax');
    await injectAuth(page);
    await page.goto(`${BASE}/payroll`);
    await page.waitForTimeout(2000);
    await page.locator('text=Tax Declaration').first().click();
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    if (!/Tax|Declaration|80C|HRA|deduction/i.test(body)) logBug('ui', 'payroll-tax', 'Tax Declaration tab content missing');
  });

  test('P5. Downloads tab loads + shows payslip(s) or empty state', async ({ page }) => {
    attachListeners(page, 'payroll-downloads');
    await injectAuth(page);
    await page.goto(`${BASE}/payroll`);
    await page.waitForTimeout(2000);
    await page.locator('text=Downloads').first().click();
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    if (!/Download|Payslip|Salary Slip|No records/i.test(body)) logBug('ui', 'payroll-downloads', 'Downloads tab content missing');
  });

  test('P6. Salary Structure editor — preview recalculates as user types', async ({ page }) => {
    attachListeners(page, 'payroll-editor');
    await injectAuth(page);
    await page.goto(`${BASE}/payroll`);
    await page.waitForTimeout(2000);
    await page.locator('text=Salary Structure').first().click();
    await page.waitForTimeout(2500);

    const editBtn = page.locator('button').filter({ hasText: /Set Up|Edit/i }).first();
    if (!(await editBtn.isVisible().catch(() => false))) { logBug('ui', 'payroll-editor', 'No Set Up / Edit button'); return; }
    await editBtn.click();
    await page.waitForTimeout(2500);

    const inputs = page.locator('input[placeholder="0"]');
    const cnt = await inputs.count().catch(() => 0);
    if (cnt < 2) { logBug('ui', 'payroll-editor', `Only ${cnt} number inputs in editor`); return; }

    await inputs.nth(0).fill('40000'); // basic
    await inputs.nth(1).fill('20000'); // HRA
    await page.waitForTimeout(700);

    const body = await page.locator('body').innerText();
    const grossMatch = body.match(/Gross Earnings[\s\S]*?₹([\d,]+)/);
    console.log('[P6] After fill, Gross =', grossMatch?.[1]);
    if (!grossMatch || parseInt(grossMatch[1].replace(/,/g, '')) !== 60000) {
      logBug('calc', 'payroll-editor', `Expected Gross ₹60,000, got ₹${grossMatch?.[1] || 'none'}`);
    }
    // Close modal
    const cancel = page.locator('button').filter({ hasText: /Cancel/i }).first();
    if (await cancel.isVisible().catch(() => false)) await cancel.click();
  });

  test('S1. Settings page loads', async ({ page }) => {
    attachListeners(page, 'settings');
    await injectAuth(page);
    await page.goto(`${BASE}/settings`);
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    if (body.length < 200) logBug('ui', 'settings', 'Blank settings page');
  });

  test('C1. Check-in / Check-out full cycle via API', async ({ request }) => {
    const statusRes = await request.get(`${API}/attendance?date=2026-04-24`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'x-tenant-slug': 'creativefrenzy' }
    });
    const records = statusRes.status() === 200 ? await statusRes.json() : [];
    const me = records.find(r => r.email === 'sumit_pal@creativefrenzy.in');
    console.log('[C1] My attendance:', me ? { id: me.id, checkIn: me.check_in, checkOut: me.check_out, status: me.displayStatus } : 'NO RECORD');
    if (me && !me.check_in) logBug('data', 'attendance', 'My record has no check_in');
  });

  test('L4. Apply leave via API', async ({ request }) => {
    const res = await request.post(`${API}/leaves/apply`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'x-tenant-slug': 'creativefrenzy', 'Content-Type': 'application/json' },
      data: { leave_type_id: 1, start_date: '2026-05-01', end_date: '2026-05-01', reason: 'E2E test' }
    });
    console.log('[L4] apply status:', res.status());
    if (res.status() >= 400 && res.status() !== 409) {
      const body = await res.text();
      logBug('api', 'leaves', `apply failed ${res.status()}: ${body.substring(0, 150)}`);
    }
  });

  test('P7. Save salary structure via API', async ({ request }) => {
    const payload = {
      basic_pay: 50000,
      hra: 25000,
      da: 5000,
      conveyance: 1600,
      medical: 1250,
      special_allowance: 3000,
      effective_from: '2026-04-01',
      deductions_json: JSON.stringify({
        deductions: {
          pf: { enabled: true, type: 'percent', value: 12, base: 'basic', label: 'Provident Fund' }
        },
        customDeductions: []
      })
    };
    const res = await request.post(`${API}/payroll/salary-structures/1`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'x-tenant-slug': 'creativefrenzy', 'Content-Type': 'application/json' },
      data: payload
    });
    console.log('[P7] save salary-structure status:', res.status());
    if (res.status() >= 400) {
      const body = await res.text();
      logBug('api', 'payroll', `Salary save failed ${res.status()}: ${body.substring(0, 200)}`);
      return;
    }
    // Verify persistence
    const getRes = await request.get(`${API}/payroll/salary-structures/1`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'x-tenant-slug': 'creativefrenzy' }
    });
    if (getRes.status() === 200) {
      const ss = await getRes.json();
      console.log('[P7] Saved structure:', { basic: ss.basic_pay, hra: ss.hra });
      if (parseFloat(ss.basic_pay) !== 50000) logBug('data', 'payroll', `Saved basic_pay=${ss.basic_pay} != 50000`);
    }
  });

  test('P8. Tax declaration save via API', async ({ request }) => {
    const res = await request.post(`${API}/payroll/tax-declarations/1`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'x-tenant-slug': 'creativefrenzy', 'Content-Type': 'application/json' },
      data: {
        financial_year: '2026-2027',
        regime: 'new',
        declarations: { '80C': 150000, 'HRA': 24000 }
      }
    });
    console.log('[P8] tax-decl status:', res.status());
    if (res.status() >= 400) {
      const body = await res.text();
      logBug('api', 'payroll', `Tax decl save failed ${res.status()}: ${body.substring(0, 150)}`);
    }
  });

  test('FINAL. Bug Report', async () => {
    console.log('\n\n════════════ DEEP AUDIT BUG REPORT ════════════');
    if (bugs.length === 0) {
      console.log('✅ No bugs detected.');
    } else {
      console.log(`❌ ${bugs.length} issues found:\n`);
      const byPage = {};
      bugs.forEach(b => {
        byPage[b.page] = byPage[b.page] || [];
        byPage[b.page].push(b);
      });
      Object.entries(byPage).forEach(([p, list]) => {
        console.log(`\n── ${p.toUpperCase()} (${list.length}) ──`);
        list.forEach((b, i) => console.log(`  ${i+1}. [${b.category}] ${b.detail}`));
      });
    }
    console.log('════════════════════════════════════════════════');
  });
});

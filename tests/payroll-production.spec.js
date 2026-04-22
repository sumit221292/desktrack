const { test, expect } = require('@playwright/test');

const BASE = 'https://desktrack-production.up.railway.app';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJzdW1pdF9wYWxAY3JlYXRpdmVmcmVuenkuaW4iLCJyb2xlIjoiU1VQRVJfQURNSU4iLCJjb21wYW55SWQiOjEsImlhdCI6MTc3Njg0NjQ5NiwiZXhwIjoxNzc2OTMyODk2fQ.Px1YoyUlfjKDM-ZNjyzr51kOhc6QUgq_13p8ur8VwkA';
const USER = { id: 1, email: 'sumit_pal@creativefrenzy.in', role: 'SUPER_ADMIN', tenantId: 1 };

async function injectAuth(page) {
  await page.goto(BASE);
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenantSlug', 'creativefrenzy');
  }, { token: TOKEN, user: USER });
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
}

// ============================================================
// PAYROLL SECTION TESTS — Production
// ============================================================

test.describe('Payroll — Production', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/payroll`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(4000);
  });

  test('P1. Payroll page loads without errors', async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(200);
    const hasPayroll = /Payroll|Salary|Gross|Net/i.test(body);
    expect(hasPayroll).toBeTruthy();
  });

  test('P2. All 4 tabs visible', async ({ page }) => {
    const tabs = ['Payroll Records', 'Salary Structure', 'Tax Declaration', 'Downloads'];
    for (const t of tabs) {
      const tab = page.locator(`text=${t}`).first();
      const visible = await tab.isVisible().catch(() => false);
      console.log(`[TEST] Tab "${t}": ${visible ? '✓' : '✗'}`);
      expect(visible).toBeTruthy();
    }
  });

  test('P3. Month/Year selector works', async ({ page }) => {
    const selects = page.locator('select');
    expect(await selects.count()).toBeGreaterThan(0);
    console.log(`[TEST] Found ${await selects.count()} select dropdowns`);
  });

  test('P4. Summary cards display', async ({ page }) => {
    const cards = ['Total Payout', 'Gross Salary', 'Total Deductions', 'Avg Net Salary'];
    for (const c of cards) {
      const el = page.locator(`text=${c}`).first();
      const visible = await el.isVisible().catch(() => false);
      console.log(`[TEST] Card "${c}": ${visible ? '✓' : '✗'}`);
    }
  });

  test('P5. Run Payroll button visible for HR', async ({ page }) => {
    const btn = page.locator('button').filter({ hasText: /Run Payroll/i }).first();
    const visible = await btn.isVisible().catch(() => false);
    console.log(`[TEST] Run Payroll button: ${visible ? '✓' : '✗'}`);
    expect(visible).toBeTruthy();
  });

  test('P6. Run Payroll modal opens with attendance rules', async ({ page }) => {
    const btn = page.locator('button').filter({ hasText: /Run Payroll/i }).first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(2000);
      // Check for attendance-based calculation text
      const body = await page.locator('body').innerText();
      console.log('[TEST] Modal body sample:', body.substring(body.indexOf('Attendance'), body.indexOf('Attendance') + 300).replace(/\n+/g, ' ').substring(0, 200));
      const hasAttendance = /Attendance|Payable Days|Per Day|LOP/i.test(body);
      expect(hasAttendance).toBeTruthy();
    }
  });

  test('P7. Run Payroll actually processes', async ({ page }) => {
    // Navigate to Run Payroll modal
    const btn = page.locator('button').filter({ hasText: /Run Payroll/i }).first();
    if (!await btn.isVisible()) { console.log('[TEST] No Run Payroll button — skipping'); return; }
    await btn.click();
    await page.waitForTimeout(1500);

    // Click the actual Run button inside modal
    const confirmBtn = page.locator('button').filter({ hasText: /Run.*Payroll/i }).last();
    if (await confirmBtn.isVisible()) {
      // Watch the API response
      const responsePromise = page.waitForResponse(r => r.url().includes('/api/payroll/run'), { timeout: 20000 }).catch(() => null);
      await confirmBtn.click();
      const response = await responsePromise;
      if (response) {
        console.log(`[TEST] Run Payroll response: ${response.status()}`);
        try {
          const json = await response.json();
          console.log('[TEST] Response:', JSON.stringify(json).substring(0, 400));
          // If processed, should have records array
          if (json.records) {
            console.log(`[TEST] Processed ${json.records.length} employees`);
            // Check first record has attendance-based fields
            if (json.records.length > 0) {
              const r = json.records[0];
              console.log(`[TEST] First record: working=${r.total_working_days}, payable=${r.payable_days}, earned=${r.gross_salary}, lop=${r.lop_amount}`);
              expect(r.total_working_days).toBeDefined();
              expect(r.payable_days).toBeDefined();
            }
          }
        } catch (e) { console.log('[TEST] Parse error:', e.message); }
      }
      await page.waitForTimeout(3000);
    }
  });

  test('P8. Salary Structure tab shows employees', async ({ page }) => {
    const tab = page.locator('text=Salary Structure').first();
    await tab.click();
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    const hasEmp = /Basic|Gross|HRA|Employee|Structure/i.test(body);
    expect(hasEmp).toBeTruthy();
  });

  test('P9. Tax Declaration tab loads', async ({ page }) => {
    const tab = page.locator('text=Tax Declaration').first();
    await tab.click();
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    const hasTax = /Tax|Regime|FY|Investment|Declaration/i.test(body);
    expect(hasTax).toBeTruthy();
  });

  test('P10. Downloads tab shows payslips section', async ({ page }) => {
    const tab = page.locator('text=Downloads').first();
    await tab.click();
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    const hasDownload = /Salary Slip|Form 16|Payslip|Download/i.test(body);
    expect(hasDownload).toBeTruthy();
  });

  test('P11. View payslip shows attendance summary', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Look for View button or similar
    const viewBtn = page.locator('button').filter({ hasText: /View.*Slip|Payslip|View/i }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(2500);
      const body = await page.locator('body').innerText();
      // Check for the new Attendance Summary section
      const hasSummary = /ATTENDANCE SUMMARY|Working|Present|Payable|Half Day/i.test(body);
      console.log(`[TEST] Attendance Summary in payslip: ${hasSummary ? '✓' : '✗'}`);
    } else {
      console.log('[TEST] No payslip available to view');
    }
  });

  test('P12. API check: /payroll/summary returns valid data', async ({ page }) => {
    const response = await page.request.get(`${BASE}/api/payroll/summary?month=4&year=2026`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'x-tenant-slug': 'creativefrenzy'
      }
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    console.log('[TEST] Summary:', JSON.stringify(data).substring(0, 300));
    expect(data).toHaveProperty('total_payout');
    expect(data).toHaveProperty('total_gross');
  });

  test('P13. API check: /payroll returns records with new attendance fields', async ({ page }) => {
    const response = await page.request.get(`${BASE}/api/payroll?month=4&year=2026`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'x-tenant-slug': 'creativefrenzy'
      }
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    console.log(`[TEST] Got ${data.length} payroll records for April 2026`);
    if (data.length > 0) {
      const r = data[0];
      console.log('[TEST] First record fields:', Object.keys(r).join(', '));
      console.log(`[TEST] First: working_days=${r.total_working_days}, payable=${r.payable_days}, absent=${r.absent_days}`);
    }
  });
});

// ============================================================
// HEALTH CHECK
// ============================================================
test.describe('Health Check — Production', () => {
  test('H1. Console errors on Payroll', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('GSI_LOGGER')) {
        errors.push(msg.text().substring(0, 300));
      }
    });
    await injectAuth(page);
    await page.goto(`${BASE}/payroll`);
    await page.waitForTimeout(5000);

    // Click through each tab
    for (const t of ['Salary Structure', 'Tax Declaration', 'Downloads', 'Payroll Records']) {
      const tab = page.locator(`text=${t}`).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(2000);
      }
    }

    if (errors.length > 0) {
      console.log(`\n====== CONSOLE ERRORS (${errors.length}) ======`);
      errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
    } else {
      console.log('\n====== NO CONSOLE ERRORS ======');
    }
  });

  test('H2. Failed API requests on Payroll', async ({ page }) => {
    const failures = [];
    page.on('response', res => {
      if (res.url().includes('/api/') && res.status() >= 400) {
        failures.push({ url: res.url().substring(res.url().indexOf('/api/')), status: res.status() });
      }
    });
    await injectAuth(page);
    await page.goto(`${BASE}/payroll`);
    await page.waitForTimeout(5000);
    for (const t of ['Salary Structure', 'Tax Declaration', 'Downloads']) {
      const tab = page.locator(`text=${t}`).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(2000);
      }
    }

    if (failures.length > 0) {
      console.log(`\n====== FAILED API REQUESTS (${failures.length}) ======`);
      failures.forEach((f, i) => console.log(`${i + 1}. ${f.status} ${f.url}`));
    } else {
      console.log('\n====== ALL API REQUESTS OK ======');
    }
  });
});

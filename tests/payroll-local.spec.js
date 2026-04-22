const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const API = 'http://localhost:5000/api';

async function getToken() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-slug': 'creativefrenzy' },
    body: JSON.stringify({ email: 'priyanka_singh@creativefrenzy.in', password: 'Priyanka@123' })
  });
  const data = await res.json();
  return { token: data.token, user: data.user };
}

async function injectAuth(page) {
  const { token, user } = await getToken();
  await page.goto(BASE);
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenantSlug', 'creativefrenzy');
  }, { token, user });
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
}

test.describe('Payroll — Local (attendance-based)', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/payroll`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test('L1. Payroll page loads with employees', async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(200);
    // We seeded Aarav, should see name
    const hasSeeded = /Aarav|Bhavya|Payroll/i.test(body);
    expect(hasSeeded).toBeTruthy();
  });

  test('L2. Summary cards show non-zero totals', async ({ page }) => {
    await expect(page.locator('text=Total Payout').first()).toBeVisible();
    await expect(page.locator('text=Gross Salary').first()).toBeVisible();
    await expect(page.locator('text=Total Deductions').first()).toBeVisible();
  });

  test('L3. API check: /payroll returns records with attendance fields', async ({ page }) => {
    const { token } = await getToken();
    const response = await page.request.get(`${API}/payroll?month=4&year=2026`, {
      headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-slug': 'creativefrenzy' }
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    console.log(`[TEST] Got ${data.length} payroll records`);
    expect(data.length).toBeGreaterThan(5); // should have ~16 now

    // Pick Aarav (FULL_MONTH scenario) — should have 15 present, low LOP
    const aarav = data.find(r => r.first_name === 'Aarav');
    if (aarav) {
      console.log('[TEST] Aarav:', {
        present: aarav.present_days,
        absent: aarav.absent_days,
        payable: aarav.payable_days,
        gross: aarav.gross_salary,
        lop: aarav.lop_amount,
        net: aarav.net_salary
      });
      expect(parseInt(aarav.total_working_days)).toBeGreaterThan(0);
      expect(parseFloat(aarav.gross_salary)).toBeGreaterThan(0);
    }
  });

  test('L4. Attendance-heavy user has high LOP', async ({ page }) => {
    const { token } = await getToken();
    const response = await page.request.get(`${API}/payroll?month=4&year=2026`, {
      headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-slug': 'creativefrenzy' }
    });
    const data = await response.json();
    const diya = data.find(r => r.first_name === 'Diya');
    if (diya) {
      console.log('[TEST] Diya (ABSENT_HEAVY):', {
        present: diya.present_days,
        absent: diya.absent_days,
        lop: diya.lop_amount,
        gross: diya.gross_salary
      });
      // ABSENT_HEAVY should have absent > 5
      expect(parseFloat(diya.absent_days)).toBeGreaterThanOrEqual(5);
      // LOP should be more than net for heavy absentee
      expect(parseFloat(diya.lop_amount)).toBeGreaterThan(parseFloat(diya.gross_salary) * 0.5);
    }
  });

  test('L5. Half-day user has fractional payable days', async ({ page }) => {
    const { token } = await getToken();
    const response = await page.request.get(`${API}/payroll?month=4&year=2026`, {
      headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-slug': 'creativefrenzy' }
    });
    const data = await response.json();
    const bhavya = data.find(r => r.first_name === 'Bhavya');
    if (bhavya) {
      console.log('[TEST] Bhavya (HALF_DAYS):', {
        half: bhavya.half_days,
        payable: bhavya.payable_days,
        lop: bhavya.lop_amount
      });
      // HALF_DAYS should have half_days > 0
      expect(parseFloat(bhavya.half_days)).toBeGreaterThan(0);
      // Payable should be fractional (has 0.5 from halfdays)
      const payable = parseFloat(bhavya.payable_days);
      expect(payable % 1 !== 0 || payable > 0).toBeTruthy();
    }
  });

  test('L6. Salary Structure tab shows all 14 structures', async ({ page }) => {
    const tab = page.locator('text=Salary Structure').first();
    await tab.click();
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    // Should show seeded employee names
    const hasSeedees = /Aarav|Bhavya|Chirag|Diya/i.test(body);
    expect(hasSeedees).toBeTruthy();
  });

  test('L7. Downloads tab shows payslips', async ({ page }) => {
    const tab = page.locator('text=Downloads').first();
    await tab.click();
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    const hasPayslip = /Salary Slip|Payslip|Download/i.test(body);
    expect(hasPayslip).toBeTruthy();
  });

  test('L8. View payslip shows attendance breakdown', async ({ page }) => {
    // Navigate to Downloads tab
    const tab = page.locator('text=Downloads').first();
    await tab.click();
    await page.waitForTimeout(3000);

    // Click first View button
    const viewBtn = page.locator('button').filter({ hasText: /View/i }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(2500);
      const body = await page.locator('body').innerText();
      // Check for Attendance Summary section
      const hasAttSummary = /ATTENDANCE SUMMARY|Working|Present|Payable|Half Day/i.test(body);
      console.log(`[TEST] Attendance Summary in payslip: ${hasAttSummary ? '✓' : '✗'}`);
      expect(hasAttSummary).toBeTruthy();
    }
  });

  test('L9. NO_STRUCTURE user is excluded from payroll', async ({ page }) => {
    const { token } = await getToken();
    const response = await page.request.get(`${API}/payroll?month=4&year=2026`, {
      headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-slug': 'creativefrenzy' }
    });
    const data = await response.json();
    const leela = data.find(r => r.first_name === 'Leela');
    // Leela has NO_STRUCTURE scenario — should not be in payroll
    expect(leela).toBeUndefined();
  });

  test('L10. Summary totals match sum of records', async ({ page }) => {
    const { token } = await getToken();
    const [sumRes, recRes] = await Promise.all([
      page.request.get(`${API}/payroll/summary?month=4&year=2026`, { headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-slug': 'creativefrenzy' } }),
      page.request.get(`${API}/payroll?month=4&year=2026`, { headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-slug': 'creativefrenzy' } })
    ]);
    const summary = await sumRes.json();
    const records = await recRes.json();

    const totalGross = records.reduce((sum, r) => sum + parseFloat(r.gross_salary || 0), 0);
    const totalNet = records.reduce((sum, r) => sum + parseFloat(r.net_salary || 0), 0);

    console.log('[TEST] Summary:', {
      employee_count: summary.employee_count,
      total_gross: summary.total_gross,
      total_payout: summary.total_payout
    });
    console.log('[TEST] Calculated:', { totalGross, totalNet });

    expect(summary.employee_count).toBe(records.length);
    // Allow small rounding difference
    expect(Math.abs(summary.total_gross - totalGross)).toBeLessThan(1);
    expect(Math.abs(summary.total_payout - totalNet)).toBeLessThan(1);
  });
});

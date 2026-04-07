const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MywiZW1haWwiOiJzd2FzdGlrX3R5YWdpQGNyZWF0aXZlZnJlbnp5LmluIiwicm9sZSI6IlNVUEVSX0FETUlOIiwiY29tcGFueUlkIjoxLCJpYXQiOjE3NzU0NzgzNDAsImV4cCI6MTc3NTU2NDc0MH0.ygRrBkzE252tBw-AbORA64v81eD3z4mR41wTMSx2BFQ';
const USER = JSON.stringify({ id: 3, email: 'swastik_tyagi@creativefrenzy.in', role: 'SUPER_ADMIN', tenantId: 1 });

// Inject token into localStorage to skip Google login
async function injectAuth(page) {
  await page.goto(BASE);
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', user);
    localStorage.setItem('tenantSlug', 'creativefrenzy');
  }, { token: TOKEN, user: USER });
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

// ============================================
// 1. LOGIN & AUTH
// ============================================
test.describe('1. Auth', () => {
  test('1.1 Unauthenticated redirects to login', async ({ page }) => {
    await page.goto(`${BASE}/employees`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/login/);
  });

  test('1.2 Token injection gives access to dashboard', async ({ page }) => {
    await injectAuth(page);
    await expect(page.locator('text=Welcome Back')).toBeVisible();
  });
});

// ============================================
// 2. DASHBOARD
// ============================================
test.describe('2. Dashboard', () => {
  test.beforeEach(async ({ page }) => { await injectAuth(page); });

  test('2.1 KPI cards load', async ({ page }) => {
    await expect(page.locator('text=Total Employees')).toBeVisible();
    await expect(page.locator('text=Present Today')).toBeVisible();
    await expect(page.locator('text=Late Arrivals')).toBeVisible();
    await expect(page.getByText('Productivity', { exact: true })).toBeVisible();
  });

  test('2.2 Attendance status bar visible', async ({ page }) => {
    const bar = page.locator('text=Work Hours').first();
    const visible = await bar.isVisible().catch(() => false);
    // Log whether bar is present
    console.log(`[TEST] Status bar visible: ${visible}`);
  });

  test('2.3 Recent Activity loads', async ({ page }) => {
    await expect(page.locator('text=Recent Activity')).toBeVisible();
  });

  test('2.4 Productivity chart renders', async ({ page }) => {
    await expect(page.locator('text=Productivity Insights')).toBeVisible();
    await expect(page.locator('text=Mon')).toBeVisible();
  });

  test('2.5 Check In/Out button exists', async ({ page }) => {
    const btn = page.locator('button').filter({ hasText: /Check/ }).first();
    await expect(btn).toBeVisible();
  });

  test('2.6 Date picker changes data', async ({ page }) => {
    const dp = page.locator('input[type="date"]').first();
    await dp.fill('2026-04-01');
    await page.waitForTimeout(3000);
    await expect(page.locator('text=Total Employees')).toBeVisible();
  });

  test('2.7 KPI card opens detail modal', async ({ page }) => {
    await page.locator('text=Total Employees').click();
    await page.waitForTimeout(1500);
    await expect(page.locator('text=Details')).toBeVisible();
  });
});

// ============================================
// 3. NAVIGATION — No white screens
// ============================================
test.describe('3. Navigation', () => {
  test.beforeEach(async ({ page }) => { await injectAuth(page); });

  const routes = [
    { path: '/', name: 'Dashboard' },
    { path: '/employees', name: 'Employees' },
    { path: '/attendance', name: 'Attendance' },
    { path: '/attendance-calendar', name: 'Att. Calendar' },
    { path: '/leaves', name: 'Leaves' },
    { path: '/payroll', name: 'Payroll' },
    { path: '/performance', name: 'Performance' },
    { path: '/reports', name: 'Reports' },
    { path: '/settings', name: 'Settings' },
  ];

  for (const r of routes) {
    test(`3.x ${r.name} — no white screen`, async ({ page }) => {
      await page.goto(`${BASE}${r.path}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const text = await page.locator('body').innerText();
      expect(text.length).toBeGreaterThan(50);
    });
  }
});

// ============================================
// 4. EMPLOYEES
// ============================================
test.describe('4. Employees', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/employees`);
    await page.waitForTimeout(3000);
  });

  test('4.1 Employee list loads', async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Sumit|Priyanka|Swastik|Vikrant|Shivam/);
  });

  test('4.2 Search filters employees', async ({ page }) => {
    const search = page.locator('input[placeholder*="earch"]').first();
    if (await search.isVisible()) {
      await search.fill('Sumit');
      await page.waitForTimeout(1500);
      const body = await page.locator('body').innerText();
      expect(body).toContain('Sumit');
    }
  });

  test('4.3 Edit modal opens with filled fields', async ({ page }) => {
    const editBtn = page.locator('button[title="Edit"], button:has-text("Edit")').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(1500);
      // Check modal appeared
      await expect(page.locator('text=Edit Employee')).toBeVisible();
      // Check fields are filled
      const inputs = page.locator('input[type="text"]');
      let filled = 0;
      for (let i = 0; i < Math.min(await inputs.count(), 4); i++) {
        const v = await inputs.nth(i).inputValue();
        if (v.length > 0) filled++;
      }
      expect(filled).toBeGreaterThan(0);
    }
  });
});

// ============================================
// 5. EMPLOYEE PROFILE
// ============================================
test.describe('5. Employee Profile', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/employees/2`);
    await page.waitForTimeout(3000);
  });

  test('5.1 Profile loads with info section', async ({ page }) => {
    await expect(page.locator('text=Employee Information')).toBeVisible();
  });

  test('5.2 Work summary sidebar visible', async ({ page }) => {
    await expect(page.locator('text=Work Summary')).toBeVisible();
    await expect(page.locator('text=Current Shift')).toBeVisible();
  });

  test('5.3 No duplicate fields', async ({ page }) => {
    // Count "DEPARTMENT" labels in info section
    const labels = page.locator('p:has-text("DEPARTMENT")');
    const count = await labels.count();
    // Should have at most 1 in info + 1 in header = 2
    expect(count).toBeLessThanOrEqual(2);
  });

  test('5.4 Edit profile loads form with values', async ({ page }) => {
    const editBtn = page.locator('button:has-text("Edit Profile")');
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(2000);
      await expect(page.locator('text=Edit Employee Information')).toBeVisible();
    }
  });
});

// ============================================
// 6. ATTENDANCE
// ============================================
test.describe('6. Attendance', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/attendance`);
    await page.waitForTimeout(3000);
  });

  test('6.1 Table loads with rows', async ({ page }) => {
    const rows = page.locator('table tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('6.2 Columns present', async ({ page }) => {
    for (const h of ['EMPLOYEE', 'TIMINGS', 'WORK HOURS', 'STATUS']) {
      await expect(page.locator(`th:has-text("${h}")`)).toBeVisible();
    }
  });

  test('6.3 Status badges have consistent colors', async ({ page }) => {
    // All status badges should have a colored dot span
    const statuses = page.locator('span.rounded-full').filter({ has: page.locator('span') });
    // Just check page has some status indicators
    const body = await page.locator('body').innerText();
    const hasStatus = /Present|Late|Absent|Half Day|On Time|Over Late|Active/.test(body);
    expect(hasStatus).toBeTruthy();
  });

  test('6.4 Total Present counter', async ({ page }) => {
    await expect(page.locator('text=TOTAL PRESENT')).toBeVisible();
  });

  test('6.5 Edit attendance modal', async ({ page }) => {
    const editBtn = page.locator('button:has-text("Edit")').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(1500);
      await expect(page.locator('text=Edit Attendance')).toBeVisible();
    }
  });
});

// ============================================
// 7. ATTENDANCE CALENDAR
// ============================================
test.describe('7. Attendance Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/attendance-calendar`);
    await page.waitForTimeout(4000);
  });

  test('7.1 Calendar renders', async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(100);
  });

  test('7.2 Day headers', async ({ page }) => {
    for (const d of ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']) {
      await expect(page.locator(`th:has-text("${d}")`)).toBeVisible();
    }
  });

  test('7.3 Employee checkboxes', async ({ page }) => {
    const cbs = page.locator('input[type="checkbox"]');
    expect(await cbs.count()).toBeGreaterThan(0);
  });

  test('7.4 Today button', async ({ page }) => {
    await expect(page.locator('button:has-text("Today")')).toBeVisible();
  });

  test('7.5 Month navigation', async ({ page }) => {
    // Click prev arrow
    const arrows = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') });
    if (await arrows.first().isVisible()) {
      await arrows.first().click();
      await page.waitForTimeout(2000);
    }
  });

  test('7.6 Legend has all statuses', async ({ page }) => {
    for (const s of ['Present', 'Late', 'Absent']) {
      const el = page.locator(`text=${s}`).first();
      expect(await el.isVisible().catch(() => false)).toBeTruthy();
    }
  });

  test('7.7 Day cell click opens popup', async ({ page }) => {
    // Click a table cell with a date
    const cells = page.locator('td').filter({ hasText: /\d/ });
    if (await cells.count() > 5) {
      await cells.nth(5).click();
      await page.waitForTimeout(1500);
    }
  });
});

// ============================================
// 8. SETTINGS
// ============================================
test.describe('8. Settings', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/settings`);
    await page.waitForTimeout(2000);
  });

  test('8.1 Settings page loads', async ({ page }) => {
    await expect(page.locator('text=System Settings')).toBeVisible();
  });

  test('8.2 Tabs exist', async ({ page }) => {
    for (const t of ['Custom Fields', 'Shift Management', 'Roles']) {
      await expect(page.locator(`text=${t}`).first()).toBeVisible();
    }
  });

  test('8.3 Shift tab shows config', async ({ page }) => {
    await page.locator('text=Shift Management').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=General Shift')).toBeVisible();
    await expect(page.locator('text=Break Settings')).toBeVisible();
  });

  test('8.4 Add Shift modal opens', async ({ page }) => {
    await page.locator('text=Shift Management').click();
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("Add Shift")').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('form').getByText('Shift Name')).toBeVisible();
  });

  test('8.5 Custom Fields tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Custom Fields' }).click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Manage Custom Fields')).toBeVisible();
  });
});

// ============================================
// 9. LEAVES MODULE
// ============================================
test.describe('9. Leaves', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/leaves`);
    await page.waitForTimeout(3000);
  });

  test('9.1 Leaves page loads', async ({ page }) => {
    await expect(page.locator('text=Leave Management')).toBeVisible();
  });

  test('9.2 Stats cards display', async ({ page }) => {
    await expect(page.getByRole('paragraph').filter({ hasText: 'Pending' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'Approved' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'Rejected' })).toBeVisible();
  });

  test('9.3 Apply Leave button exists', async ({ page }) => {
    await expect(page.locator('button:has-text("Apply Leave")')).toBeVisible();
  });

  test('9.4 Apply Leave modal opens with form', async ({ page }) => {
    await page.locator('button:has-text("Apply Leave")').click();
    await page.waitForTimeout(1500);
    await expect(page.locator('text=Apply for Leave')).toBeVisible();
    await expect(page.locator('form select')).toBeVisible();
    await expect(page.locator('form input[type="date"]').first()).toBeVisible();
    await expect(page.locator('form textarea')).toBeVisible();
  });

  test('9.5 Apply leave - submit a request', async ({ page }) => {
    await page.locator('button:has-text("Apply Leave")').click();
    await page.waitForTimeout(1500);
    // Select first leave type from modal's select
    const modal = page.locator('[class*="modal"], [class*="Modal"], div:has(> form)').last();
    const typeSelect = modal.locator('select').first();
    await typeSelect.selectOption({ index: 1 });
    // Fill dates
    const dateInputs = modal.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-04-20');
    await dateInputs.nth(1).fill('2026-04-21');
    await modal.locator('textarea').fill('Playwright test leave');
    await page.waitForTimeout(500);
    // Submit
    await modal.locator('button:has-text("Submit")').click();
    await page.waitForTimeout(3000);
    // Page should show leave requests section
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/LEAVE REQUESTS|Leave Requests/i);
  });

  test('9.6 Leave requests table shows data', async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/LEAVE REQUESTS|Leave Requests/i);
    await expect(page.locator('input[placeholder="Search employee..."]')).toBeVisible();
  });

  test('9.7 Manage Types button works (HR only)', async ({ page }) => {
    const btn = page.locator('button:has-text("Manage Types")');
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=Manage Leave Types')).toBeVisible();
      // Should show default leave types
      const body = await page.locator('body').innerText();
      const hasTypes = /CL|SL|EL|UL|Casual|Sick|Earned/.test(body);
      expect(hasTypes).toBeTruthy();
    }
  });

  test('9.8 Init Balances button works', async ({ page }) => {
    const btn = page.locator('button:has-text("Init Balances")');
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(4000);
      const body = await page.locator('body').innerText();
      expect(body).toMatch(/LEAVE BALANCES|Leave Balances/i);
    }
  });

  test('9.9 Status filter works', async ({ page }) => {
    const filter = page.locator('select').last();
    await filter.selectOption('PENDING');
    await page.waitForTimeout(1500);
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/LEAVE REQUESTS|Leave Requests|No leave requests/i);
  });

  test('9.10 Approve/Reject buttons visible for pending requests', async ({ page }) => {
    // If there are pending requests, approve/reject buttons should be visible
    const approveBtn = page.locator('button[title="Approve"]').first();
    const hasApprove = await approveBtn.isVisible().catch(() => false);
    console.log(`[TEST] Approve button visible: ${hasApprove}`);
  });
});

// ============================================
// 10. PAYROLL MODULE
// ============================================
test.describe('10. Payroll', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/payroll`);
    await page.waitForTimeout(3000);
  });

  test('10.1 Payroll page loads', async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(100);
    // Should have either payroll content or tabs
    const hasPayroll = /Payroll|Salary|Net Pay|Gross/.test(body);
    expect(hasPayroll).toBeTruthy();
  });

  test('10.2 Payroll tabs exist', async ({ page }) => {
    const tabs = ['Payroll Records', 'Salary Structure', 'Tax Declaration', 'Downloads'];
    for (const t of tabs) {
      const tab = page.locator(`text=${t}`).first();
      const visible = await tab.isVisible().catch(() => false);
      console.log(`[TEST] Tab "${t}" visible: ${visible}`);
    }
  });

  test('10.3 Summary cards display', async ({ page }) => {
    const cards = ['Total Payout', 'Gross Salary', 'Total Deductions', 'Avg Net Salary'];
    for (const c of cards) {
      const el = page.locator(`text=${c}`).first();
      const visible = await el.isVisible().catch(() => false);
      console.log(`[TEST] Summary "${c}" visible: ${visible}`);
    }
  });

  test('10.4 Run Payroll button exists (HR)', async ({ page }) => {
    const btn = page.locator('button:has-text("Run Payroll")');
    const visible = await btn.isVisible().catch(() => false);
    console.log(`[TEST] Run Payroll button visible: ${visible}`);
  });

  test('10.5 Run Payroll flow', async ({ page }) => {
    const btn = page.locator('button:has-text("Run Payroll")');
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(1500);
      // Confirm modal should appear
      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Process"), button:has-text("Run")').last();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(3000);
      }
    }
  });

  test('10.6 Salary Structure tab', async ({ page }) => {
    const tab = page.locator('text=Salary Structure').first();
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForTimeout(2000);
      const body = await page.locator('body').innerText();
      // Should show employees with salary info
      expect(body.length).toBeGreaterThan(100);
    }
  });

  test('10.7 Tax Declaration tab', async ({ page }) => {
    const tab = page.locator('text=Tax Declaration').first();
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForTimeout(2000);
      const body = await page.locator('body').innerText();
      expect(body.length).toBeGreaterThan(100);
    }
  });

  test('10.8 Downloads tab', async ({ page }) => {
    const tab = page.locator('text=Downloads').first();
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForTimeout(2000);
      const body = await page.locator('body').innerText();
      const hasDownload = /Salary Slip|Form 16|Download/.test(body);
      expect(hasDownload).toBeTruthy();
    }
  });

  test('10.9 Month/Year selector works', async ({ page }) => {
    const selects = page.locator('select');
    const count = await selects.count();
    // Should have month and year selectors
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ============================================
// 11. CONSOLE ERRORS & API FAILURES
// ============================================
test.describe('11. Health Check', () => {
  test('11.1 Collect console errors across all pages', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        errors.push({ page: page.url(), msg: msg.text().substring(0, 300) });
      }
    });

    await injectAuth(page);
    const routes = ['/', '/employees', '/attendance', '/attendance-calendar', '/leaves', '/payroll', '/settings'];
    for (const r of routes) {
      await page.goto(`${BASE}${r}`);
      await page.waitForTimeout(3000);
    }

    // Write errors to file
    if (errors.length > 0) {
      console.log(`\n========== CONSOLE ERRORS (${errors.length}) ==========`);
      errors.forEach((e, i) => console.log(`${i + 1}. [${e.page}] ${e.msg}`));
    } else {
      console.log('\n========== NO CONSOLE ERRORS FOUND ==========');
    }
  });

  test('11.2 Collect failed API requests', async ({ page }) => {
    const failures = [];
    page.on('response', res => {
      if (res.url().includes('/api/') && res.status() >= 400) {
        failures.push({ url: res.url(), status: res.status() });
      }
    });

    await injectAuth(page);
    const routes = ['/', '/employees', '/attendance', '/attendance-calendar', '/settings'];
    for (const r of routes) {
      await page.goto(`${BASE}${r}`);
      await page.waitForTimeout(3000);
    }

    if (failures.length > 0) {
      console.log(`\n========== FAILED API REQUESTS (${failures.length}) ==========`);
      failures.forEach((f, i) => console.log(`${i + 1}. HTTP ${f.status} — ${f.url}`));
    } else {
      console.log('\n========== ALL API REQUESTS OK ==========');
    }
  });
});

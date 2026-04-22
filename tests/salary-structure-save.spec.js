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

test.describe('Salary Structure Save', () => {
  test('Full UI flow: Set Up → Fill → Save Structure', async ({ page }) => {
    // Capture API calls
    const requests = [];
    const responses = [];
    page.on('request', req => {
      if (req.url().includes('/salary-structures/')) requests.push({ method: req.method(), url: req.url(), body: req.postData() });
    });
    page.on('response', async res => {
      if (res.url().includes('/salary-structures/') && res.request().method() === 'POST') {
        try {
          const json = await res.json();
          responses.push({ status: res.status(), body: json });
        } catch { responses.push({ status: res.status(), body: 'parse error' }); }
      }
    });
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await injectAuth(page);
    await page.goto(`${BASE}/payroll`);
    await page.waitForTimeout(3000);

    // Click Salary Structure tab
    const tab = page.locator('text=Salary Structure').first();
    await tab.click();
    await page.waitForTimeout(2500);

    // Click Set Up or Edit on first employee
    const btn = page.locator('button').filter({ hasText: /Set Up|Edit/ }).first();
    console.log('[TEST] Button visible:', await btn.isVisible().catch(() => false));
    await btn.click();
    await page.waitForTimeout(2500);

    // Fill Basic Pay
    const basicInput = page.locator('input[placeholder="0"]').first();
    await basicInput.fill('55000');
    await page.waitForTimeout(500);

    // Fill HRA (second input)
    const inputs = page.locator('input[placeholder="0"]');
    const count = await inputs.count();
    console.log('[TEST] Salary inputs found:', count);
    if (count > 1) await inputs.nth(1).fill('22000');
    if (count > 2) await inputs.nth(2).fill('5500');

    // Click Save Structure
    const saveBtn = page.locator('button').filter({ hasText: /Save Structure/ }).first();
    console.log('[TEST] Save button visible:', await saveBtn.isVisible().catch(() => false));
    console.log('[TEST] Save button enabled:', await saveBtn.isEnabled().catch(() => false));

    await saveBtn.click();
    await page.waitForTimeout(5000);

    // Report
    console.log('[TEST] API Requests:', JSON.stringify(requests, null, 2));
    console.log('[TEST] API Responses:', JSON.stringify(responses, null, 2));
    if (consoleErrors.length) {
      console.log('[TEST] Console errors:');
      consoleErrors.forEach(e => console.log('  -', e.substring(0, 200)));
    }

    // Check if modal closed (save succeeded)
    const modalStillOpen = await page.locator('text=Save Structure').isVisible().catch(() => false);
    console.log('[TEST] Modal still open after save:', modalStillOpen);
  });
});

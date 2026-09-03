const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://www.secureexchange.co.za';
const OUT  = path.join(__dirname, '..', 'screenshots');

const BUYER_NAME  = 'Amina Fatou Clearwater';
const BUYER_EMAIL = 'amina.clearwater@example.com';
const BUYER_PHONE = '0821234567';
const BUYER_ID    = '0000000000000';

const SELLER_NAME  = 'Thomas Tom';
const SELLER_EMAIL = 'thomas.tom@example.com';
const SELLER_PHONE = '0834567890';

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log(`📸  ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx     = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page    = await ctx.newPage();

  // ── 01 Home ──────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/`);
  await page.waitForLoadState('networkidle');
  await shot(page, '01-home');

  // ── 02 Start Transaction (empty form) ────────────────────────────────────
  await page.goto(`${BASE}/start`);
  await page.waitForLoadState('networkidle');
  await shot(page, '02-start-empty');

  // ── 03 Fill Deal Basics ───────────────────────────────────────────────────
  await page.fill('[formcontrolname="itemTitle"]',       'iPhone 15 Pro');
  await page.fill('[formcontrolname="itemDescription"]', 'Phone has minor scratches on the back, screen is perfect.');
  await page.fill('[formcontrolname="itemValue"]',       '5000');
  await page.fill('[formcontrolname="sellerLocation"]',  'Sandton, Johannesburg');
  await shot(page, '03-deal-basics-filled');

  // ── 04 Financials ─────────────────────────────────────────────────────────
  // Standard + Buyer are default — just scroll to section and screenshot
  await page.evaluate(() => document.querySelector('[formcontrolname="sellerLocation"]')?.scrollIntoView());
  await shot(page, '04-financials');

  // ── 05 Buyer Details ──────────────────────────────────────────────────────
  const fillBtn = page.locator('button', { hasText: 'Fill test identity' });
  if (await fillBtn.isVisible()) {
    await fillBtn.click();
  } else {
    await page.fill('[formcontrolname="buyerFullName"]', BUYER_NAME);
    await page.fill('[formcontrolname="buyerEmail"]',    BUYER_EMAIL);
    await page.fill('[formcontrolname="buyerIdNumber"]', BUYER_ID);
  }
  await page.fill('[formcontrolname="buyerPhone"]', BUYER_PHONE);
  await shot(page, '05-buyer-details');

  // ── 06 Seller Details ─────────────────────────────────────────────────────
  await page.fill('[formcontrolname="sellerFullName"]', SELLER_NAME);
  await page.fill('[formcontrolname="sellerEmail"]',    SELLER_EMAIL);
  await page.fill('[formcontrolname="sellerPhone"]',    SELLER_PHONE);
  await shot(page, '06-seller-details');

  // ── 07 Consent + Fee Summary ──────────────────────────────────────────────
  await page.check('[formcontrolname="consent"]');
  await shot(page, '07-consent-fee-summary');

  // ── 08 Submit → KYC polling state ────────────────────────────────────────
  await page.click('button[type="submit"]');
  await page.waitForSelector('button:has-text("Verifying identity")', { timeout: 15000 }).catch(() => {});
  await shot(page, '08-kyc-verifying');

  // ── 09 Wait for payment step or Ozow redirect ────────────────────────────
  await Promise.race([
    page.waitForSelector('button:has-text("Preparing payment")', { timeout: 60000 }),
    page.waitForURL(/ozow|payment-return/, { timeout: 60000 }),
  ]).catch(() => {});
  await shot(page, '09-payment-step-or-redirect');

  // ── 10 Ozow payment page ──────────────────────────────────────────────────
  if (page.url().includes('ozow')) {
    await page.waitForLoadState('networkidle');
    await shot(page, '10-ozow-payment-page');

    const successBtn = page.locator('button, a').filter({ hasText: /success|pay|complete/i }).first();
    if (await successBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await successBtn.click();
      await page.waitForURL(/payment-return/, { timeout: 30000 }).catch(() => {});
    }
  }

  // ── 11 Payment Return ─────────────────────────────────────────────────────
  await page.waitForURL(/payment-return/, { timeout: 60000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  await shot(page, '11-payment-return');

  const sellerVerifUrl    = await page.locator('a:has-text("Continue to Seller Verification")').getAttribute('href').catch(() => null);
  const sellerPortalInput = await page.locator('input[readonly]').nth(0).inputValue().catch(() => null);
  const buyerPortalInput  = await page.locator('input[readonly]').nth(1).inputValue().catch(() => null);

  console.log('Seller verif URL:', sellerVerifUrl);
  console.log('Seller portal:',   sellerPortalInput);
  console.log('Buyer portal:',    buyerPortalInput);

  // ── 12 Seller Bank Details ────────────────────────────────────────────────
  if (sellerVerifUrl) {
    const bankUrl = sellerVerifUrl.startsWith('http') ? sellerVerifUrl : `${BASE}${sellerVerifUrl}`;
    await page.goto(bankUrl);
    await page.waitForLoadState('networkidle');
    await shot(page, '12-bank-details-form');

    await page.waitForSelector('select[formcontrolname="bankGroupId"]', { timeout: 10000 });
    const opts = await page.locator('select[formcontrolname="bankGroupId"] option').allTextContents();
    const fnbLabel = opts.find(o => /fnb|first national/i.test(o));
    if (fnbLabel) await page.selectOption('select[formcontrolname="bankGroupId"]', { label: fnbLabel.trim() });
    await page.fill('[formcontrolname="accountNumber"]', '62345678901');
    await page.fill('[formcontrolname="idNumber"]',      '0000000000000');
    await shot(page, '13-bank-details-filled');

    await page.click('button[type="submit"]');
    await page.waitForSelector('#smile-id-container, .text-green-700', { timeout: 15000 }).catch(() => {});
    await shot(page, '14-seller-kyc-widget');

    await page.waitForSelector('.text-green-700', { timeout: 60000 }).catch(() => {});
    await shot(page, '15-seller-verified');
  }

  // ── 13 Seller Portal ──────────────────────────────────────────────────────
  if (sellerPortalInput) {
    const sellerUrl = sellerPortalInput.startsWith('http') ? sellerPortalInput : `${BASE}${sellerPortalInput}`;
    await page.goto(sellerUrl);
    await page.waitForLoadState('networkidle');
    await shot(page, '16-seller-portal-auth');

    await page.fill('input[type="email"]', SELLER_EMAIL);
    await page.click('button:has-text("Access Transaction")');
    await page.waitForSelector('text=FundsSecured', { timeout: 15000 }).catch(() => {});
    await shot(page, '17-seller-funds-secured');

    await page.click('button:has-text("Confirm Logistics Arranged")');
    await page.waitForSelector('text=LogisticsPending', { timeout: 10000 }).catch(() => {});
    await shot(page, '18-seller-logistics-pending');

    await page.click('button:has-text("Mark as Delivered")');
    await page.waitForSelector('text=Marked as Delivered', { timeout: 10000 }).catch(() => {});
    await shot(page, '19-seller-marked-delivered');
  }

  // ── 14 Buyer Portal ───────────────────────────────────────────────────────
  if (buyerPortalInput) {
    const buyerUrl = buyerPortalInput.startsWith('http') ? buyerPortalInput : `${BASE}${buyerPortalInput}`;
    await page.goto(buyerUrl);
    await page.waitForLoadState('networkidle');
    await shot(page, '20-buyer-portal-auth');

    await page.fill('input[type="email"]', BUYER_EMAIL);
    await page.click('button:has-text("Access Transaction")');
    await page.waitForSelector('text=ItemDelivered', { timeout: 15000 }).catch(() => {});
    await shot(page, '21-buyer-item-delivered');

    await page.click('button:has-text("Accept & Release Payment")');
    await page.waitForSelector('text=Payment Released', { timeout: 10000 }).catch(() => {});
    await shot(page, '22-buyer-payment-released');
  }

  await browser.close();
  console.log('\n✅  All screenshots saved to:', OUT);
})();

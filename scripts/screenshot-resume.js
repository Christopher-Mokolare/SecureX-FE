const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://www.secureexchange.co.za';
const OUT  = path.join(__dirname, '..', 'screenshots');

const BUYER_EMAIL  = 'amina.clearwater@example.com';
const SELLER_EMAIL = 'thomas.tom@example.com';

// URLs captured from previous run
const SELLER_VERIF_PATH = '/bank-details/0606d4d3-2195-4f27-b8b7-74d3e81eeadd?email=thomas.tom%40example.com&ref=SX-2026-000112&txId=fe3cc784-6202-4b76-b358-294b177c8859';
const SELLER_PORTAL_URL = 'https://www.secureexchange.co.za/transaction/fe3cc784-6202-4b76-b358-294b177c8859/seller';
const BUYER_PORTAL_URL  = 'https://www.secureexchange.co.za/transaction/fe3cc784-6202-4b76-b358-294b177c8859/buyer';

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

  // ── 12 Seller Bank Details form ───────────────────────────────────────────
  await page.goto(`${BASE}${SELLER_VERIF_PATH}`);
  await page.waitForLoadState('networkidle');
  await shot(page, '12-bank-details-form');

  await page.waitForSelector('select[formcontrolname="bankGroupId"]', { timeout: 10000 });
  const options = await page.locator('select[formcontrolname="bankGroupId"] option').allTextContents();
  const fnbLabel = options.find(o => /fnb|first national/i.test(o));
  if (fnbLabel) await page.selectOption('select[formcontrolname="bankGroupId"]', { label: fnbLabel.trim() });
  await page.fill('[formcontrolname="accountNumber"]', '62345678901');
  await page.fill('[formcontrolname="idNumber"]',      '0000000000000');
  await shot(page, '13-bank-details-filled');

  await page.click('button[type="submit"]');
  // SmileID liveness simulated via webhook — just screenshot the widget loading state
  await page.waitForSelector('#smile-id-container', { timeout: 15000 }).catch(() => {});
  await shot(page, '14-seller-kyc-widget');
  // Seller KYC already approved via webhook simulation — skip liveness wait
  await shot(page, '15-seller-verified');

  // ── 13 Seller Portal ──────────────────────────────────────────────────────
  await page.goto(SELLER_PORTAL_URL);
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

  // ── 14 Buyer Portal ───────────────────────────────────────────────────────
  await page.goto(BUYER_PORTAL_URL);
  await page.waitForLoadState('networkidle');
  await shot(page, '20-buyer-portal-auth');

  await page.fill('input[type="email"]', BUYER_EMAIL);
  await page.click('button:has-text("Access Transaction")');
  await page.waitForSelector('text=ItemDelivered', { timeout: 15000 }).catch(() => {});
  await shot(page, '21-buyer-item-delivered');

  await page.click('button:has-text("Accept & Release Payment")');
  await page.waitForSelector('text=Payment Released', { timeout: 10000 }).catch(() => {});
  await shot(page, '22-buyer-payment-released');

  await browser.close();
  console.log('\n✅  All screenshots saved to:', OUT);
})();

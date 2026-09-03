const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://www.secureexchange.co.za';
const OUT  = path.join(__dirname, '..', 'screenshots');

const BUYER_EMAIL  = 'amina.clearwater@example.com';
const SELLER_EMAIL = 'thapelo.mokwena@example.com';

// URLs captured from previous run
const SELLER_VERIF_PATH = '/bank-details/e76c2b6c-684a-4222-8640-af3d092e9611?email=thapelo.mokwena%40example.com&ref=SX-2026-000109&txId=c935cfff-51c6-4031-8d55-77cf0a85f549';
const SELLER_PORTAL_URL = 'https://www.secureexchange.co.za/transaction/c935cfff-51c6-4031-8d55-77cf0a85f549/seller';
const BUYER_PORTAL_URL  = 'https://www.secureexchange.co.za/transaction/c935cfff-51c6-4031-8d55-77cf0a85f549/buyer';

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
  // Wait for SmileID widget to appear
  await page.waitForSelector('#smile-id-container', { timeout: 15000 }).catch(() => {});
  await shot(page, '14-seller-kyc-widget');

  // Wait for verified success state (manual liveness required — up to 120s)
  console.log('\n⚠️  Complete the SmileID liveness check in the browser window...\n');
  await page.waitForSelector('.text-green-700', { timeout: 120000 }).catch(() => {});
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

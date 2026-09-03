const https = require('https');

const TX_ID = 'fe3cc784-6202-4b76-b358-294b177c8859';
const TX_REF = 'SX-2026-000112';
const SELLER_EMAIL = 'thomas.tom@example.com';
const OZOW_TOKEN = '3LSEBxE5dG1La5ei1acb4jYm';

function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    }, res => { let s = ''; res.on('data', c => s += c); res.on('end', () => resolve(JSON.parse(s || '{}'))) });
    req.on('error', reject); req.write(data); req.end();
  });
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers }, res => {
      let s = ''; res.on('data', c => s += c); res.on('end', () => resolve(JSON.parse(s || '{}')));
    }).on('error', reject);
  });
}

(async () => {
  const { token } = await post('https://securex-api-vjf3.onrender.com/api/auth/token', { Email: SELLER_EMAIL });
  console.log('Token:', token ? 'OK' : 'FAILED');

  const tx = await get(`https://securex-api-vjf3.onrender.com/api/transactions/${TX_ID}`, { Authorization: `Bearer ${token}` });
  console.log('Status:', tx.Status, '| Version:', tx.Version, '| Seller:', tx.Seller?.FullName);

  if (tx.Status === 'PaymentPending') {
    console.log('Advancing to FundsSecured...');
    await post('https://securex-api-vjf3.onrender.com/securex/payment-notification',
      { TransactionReference: TX_REF, Status: 'Complete', SiteCode: 'SEC-SEC-004', SmartReference: '', Hash: 'dummy' },
      { Authorization: `Bearer ${OZOW_TOKEN}` });
  }

  if (tx.Status === 'FundsSecured' || tx.Status === 'PaymentPending') {
    console.log('Simulating seller liveness webhook...');
    await post('https://securex-api-vjf3.onrender.com/api/transactions/kyc-webhook', {
      status: 'clear',
      partner_params: { internal_reference: TX_ID, deal_reference: TX_REF, verification_type: 'seller_liveness' }
    });
  }

  const tx2 = await get(`https://securex-api-vjf3.onrender.com/api/transactions/${TX_ID}`, { Authorization: `Bearer ${token}` });
  console.log('Final Status:', tx2.Status, '| Seller Liveness:', tx2.Seller?.LivenessStatus, '| Seller KYC:', tx2.Seller?.IdCheckStatus);
})();

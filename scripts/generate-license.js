const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const privateKeyPath = path.join(__dirname, 'private_key.pem');
if (!fs.existsSync(privateKeyPath)) {
  console.error('private_key.pem not found. Run generate-keys.js first.');
  process.exit(1);
}
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

const [, , machineId, shopName, expiry] = process.argv;
if (!machineId || !shopName) {
  console.error('Usage: node scripts/generate-license.js <machineId> "<shopName>" [expiryDate]');
  process.exit(1);
}

const payload = {
  machineId,
  shopName,
  role: 'admin',
  expiry: expiry || null,
  issuedAt: new Date().toISOString(),
};

const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
const signature = crypto.sign(null, Buffer.from(payloadStr), privateKey).toString('base64url');
const licenseKey = `${payloadStr}.${signature}`;

console.log('\n=== LICENSE KEY ===\n');
console.log(licenseKey);
console.log('\n===================\n');
console.log('Give this string to the shop owner to activate their Admin PC.');
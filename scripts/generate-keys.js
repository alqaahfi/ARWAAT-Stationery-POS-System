const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const privatePath = path.join(__dirname, 'private_key.pem');
fs.writeFileSync(privatePath, privateKey);

console.log('Private key saved to:', privatePath);
console.log('KEEP THIS FILE SAFE. NEVER commit or ship it.\n');
console.log('Paste this PUBLIC key into src/main/license/publicKey.js:\n');
console.log(publicKey);
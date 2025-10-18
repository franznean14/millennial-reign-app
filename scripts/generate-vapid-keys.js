const crypto = require('crypto');

function generateVAPIDKeys() {
  const keyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' }
  });
  
  const publicKey = Buffer.from(keyPair.publicKey).toString('base64url');
  const privateKey = Buffer.from(keyPair.privateKey).toString('base64url');
  
  console.log('VAPID Keys Generated:');
  console.log('');
  console.log('Public Key (add to .env.local as NEXT_PUBLIC_VAPID_PUBLIC_KEY):');
  console.log(publicKey);
  console.log('');
  console.log('Private Key (add to Supabase Edge Function secrets as VAPID_PRIVATE_KEY):');
  console.log(privateKey);
  console.log('');
  console.log('Instructions:');
  console.log('1. Add the public key to your .env.local file');
  console.log('2. Add the private key to your Supabase Edge Function secrets');
  console.log('3. Keep the private key secure - never commit it to version control');
}

generateVAPIDKeys();

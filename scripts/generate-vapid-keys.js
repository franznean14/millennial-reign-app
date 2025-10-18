const crypto = require('crypto');

function generateVAPIDKeys() {
  // Generate P-256 key pair for Web Push VAPID
  const keyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { 
      type: 'spki', 
      format: 'der' 
    },
    privateKeyEncoding: { 
      type: 'pkcs8', 
      format: 'der' 
    }
  });
  
  // For Web Push API, we need the raw public key bytes (uncompressed)
  // Extract the raw public key from the SPKI format
  const publicKeyDer = keyPair.publicKey;
  
  // Parse the DER to get the raw public key (skip the first 26 bytes of SPKI header)
  const rawPublicKey = publicKeyDer.slice(26);
  
  // Convert to base64url format for Web Push
  const publicKey = Buffer.from(rawPublicKey).toString('base64url');
  const privateKey = Buffer.from(keyPair.privateKey).toString('base64url');
  
  console.log('VAPID Keys Generated for Web Push:');
  console.log('');
  console.log('Public Key (add to .env.local as NEXT_PUBLIC_VAPID_PUBLIC_KEY):');
  console.log(publicKey);
  console.log('');
  console.log('Private Key (add to Supabase Edge Function secrets as VAPID_PRIVATE_KEY):');
  console.log(privateKey);
  console.log('');
  console.log('Key Details:');
  console.log('- Curve: P-256 (prime256v1)');
  console.log('- Format: base64url (raw public key)');
  console.log('- Public Key Length:', publicKey.length);
  console.log('- Private Key Length:', privateKey.length);
  console.log('- Raw Public Key Length:', rawPublicKey.length, 'bytes');
  console.log('');
  console.log('Instructions:');
  console.log('1. Add the public key to your .env.local file');
  console.log('2. Add the private key to your Supabase Edge Function secrets');
  console.log('3. Keep the private key secure - never commit it to version control');
  console.log('4. Restart your development server after updating .env.local');
}

generateVAPIDKeys();

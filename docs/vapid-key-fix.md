# VAPID Key Format Fix for Web Push API

## Problem
Web Push API was rejecting VAPID keys with error:
```
InvalidAccessError: applicationServerKey must contain a valid P-256 public key
```

## Root Cause
The Web Push API expects the **raw public key** (65 bytes), not the SPKI format.

## Solution

### 1. Generate Raw Public Key
Instead of using the full SPKI format, extract the raw public key:

```javascript
// Generate P-256 key pair
const keyPair = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' }
});

// Extract raw public key (skip first 26 bytes of SPKI header)
const publicKeyDer = keyPair.publicKey;
const rawPublicKey = publicKeyDer.slice(26); // 65 bytes

// Convert to base64url for Web Push
const publicKey = Buffer.from(rawPublicKey).toString('base64url');
```

### 2. Key Format Requirements
- **Curve**: P-256 (prime256v1)
- **Format**: Raw public key (65 bytes)
- **Encoding**: base64url
- **Length**: 87 characters (65 bytes * 4/3 base64 ratio)

### 3. Environment Setup
```bash
# Generate keys
node scripts/generate-vapid-keys.js

# Add to .env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<87-character-base64url-key>
```

### 4. Verification
The key should be exactly 87 characters and work with:
```javascript
const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
// Should not throw InvalidAccessError
```

## Files Modified
- `scripts/generate-vapid-keys.js` - Extract raw public key
- `.env.local` - Updated with correct format
- `src/lib/hooks/usePushNotifications.ts` - Uses the key

## Testing
1. **iOS**: Requires PWA installation + HTTPS
2. **Android**: Works in all browsers
3. **Desktop**: Chrome, Firefox, Safari

## Key Differences
| Format | Length | Usage |
|--------|--------|-------|
| SPKI | 122+ chars | General crypto |
| Raw P-256 | 87 chars | Web Push API |

## Common Mistakes
1. ❌ Using full SPKI format (too long)
2. ❌ Wrong curve (must be P-256)
3. ❌ Wrong encoding (must be base64url)
4. ❌ Missing raw key extraction

## Success Indicators
- ✅ No `InvalidAccessError`
- ✅ Push subscription created
- ✅ Database record saved
- ✅ Console shows successful subscription

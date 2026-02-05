# Encryption Algorithm Documentation

## Encryption Algorithm Used

This project uses **PBKDF2 + AES-GCM** combination.

### Core Components

1. **PBKDF2 (Password-Based Key Derivation Function 2)**
   - Securely derives encryption keys from password/passphrase
   - Uses SHA-256 hash function
   - 100,000 iterations (KDF_ITERATIONS)
   - 16-byte random salt

2. **AES-GCM (Advanced Encryption Standard - Galois/Counter Mode)**
   - 256-bit key length
   - 12-byte random IV (Initialization Vector)
   - Provides Authenticated Encryption

## Detailed Encryption Logic

### 1. Key Generation Process

```typescript
// Step 1: Generate random key string (user-specified length and character set)
const keyString = generateKeyString(keyLength, { useNum, useLow, useUp });
// Example: "Ab3x" (4 chars, numbers+uppercase+lowercase)

// Step 2: Normalize key - keep only alphanumeric characters
const normalized = normalizeKey(keyString); // Remove special characters

// Step 3: Generate random salt (16 bytes)
const salt = crypto.getRandomValues(new Uint8Array(16));
```

### 2. Key Derivation

```typescript
async function deriveKeyFromPasscode(passcode, salt, usages, iterations = 100000) {
  // 1. Convert password to key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(normalizeKey(passcode)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // 2. Derive AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,           // 16-byte random salt
      iterations: 100000,   // 100,000 iterations (protects against brute-force)
      hash: 'SHA-256'       // SHA-256 hash function
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },  // 256-bit AES-GCM key
    false,
    usages  // ['encrypt'] or ['decrypt']
  );
}
```

**Why PBKDF2?**
- Safely generates strong encryption keys from short passwords/keys
- 100,000 iterations make brute-force attacks computationally expensive
- Salt ensures different keys are generated even for identical passwords (protects against rainbow table attacks)

### 3. Memo Encryption Process

```typescript
async function encryptWithKey(text, key) {
  // 1. Generate random IV (12 bytes)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // 2. Convert text to bytes
  const plaintext = textEncoder.encode(text);
  
  // 3. Encrypt with AES-GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  
  // 4. Return result (Base64 encoded)
  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv)
  };
}
```

### 4. Complete Encryption Flow

```typescript
// Actual usage example from App.tsx
async function shareMemo() {
  // 1. Generate key string (e.g., "Ab3x")
  const candidateKey = generateKeyString(keyLength, { useNum, useLow, useUp });
  
  // 2. Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // 3. Derive encryption key with PBKDF2
  const key = await deriveKeyFromPasscode(candidateKey, salt, ['encrypt']);
  
  // 4. Encrypt memo with AES-GCM
  const encrypted = await encryptWithKey(memoText, key);
  
  // 5. Construct ciphertext payload
  const payload = {
    ciphertext: encrypted.ciphertext,  // Encrypted memo (Base64)
    iv: encrypted.iv,                  // Initialization vector (Base64)
    salt: bufferToBase64(salt),        // Salt (Base64)
    kdf: {
      name: 'PBKDF2',
      iterations: 100000,
      hash: 'SHA-256'
    }
  };
  
  // 6. Store ciphertext on server (key only exists in URL hash)
  // Share link format: /{id}#{key}
  // Example: /a1b2c3d4#Ab3x
}
```

### 5. Decryption Process

```typescript
async function decryptPayload(data, passcode) {
  // 1. Extract salt from payload
  const salt = base64ToBytes(data.salt);
  
  // 2. Derive key with same parameters (generates identical key as encryption)
  const key = await deriveKeyFromPasscode(passcode, salt, ['decrypt'], data.kdf.iterations);
  
  // 3. Extract IV and ciphertext
  const iv = base64ToBytes(data.iv);
  const ciphertext = base64ToBytes(data.ciphertext);
  
  // 4. Decrypt with AES-GCM
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  
  // 5. Convert bytes to text
  return textDecoder.decode(decrypted);
}
```

## Security Features

### 1. Client-Side Encryption (End-to-End Encryption)
- Memos are encrypted in the browser before being sent to the server
- Server only stores encrypted data (no access to plaintext)
- Key only exists in URL hash (#) and is never sent to the server

### 2. Forward Secrecy
- New salt and IV generated for each encryption
- Same memo encrypted multiple times produces different ciphertexts

### 3. Authenticated Encryption
- AES-GCM provides both encryption and integrity verification
- Any tampering with ciphertext is detected during decryption

### 4. Key Derivation Strengthening
- PBKDF2 with 100,000 iterations protects against brute-force attacks
- Salt usage protects against dictionary attacks

### 5. One-Time Access (Burn After Reading)
- Memos are immediately deleted from server after being read once
- Automatic expiration after 30-minute TTL

## Data Flow

```
[Writer]
  ↓ Enter memo
[Browser]
  ↓ 1. Generate random key (e.g., "Ab3x")
  ↓ 2. Derive encryption key with PBKDF2 (100,000 iterations)
  ↓ 3. Encrypt memo with AES-GCM
[Cloudflare Worker]
  ↓ Store ciphertext (no access to plaintext)
[Durable Object (SQLite)]

Share link: https://example.com/{id}#{key}
              Sent to server ↑    ↑ Browser only (not sent to server)

[Reader]
  ↓ Click link
[Browser]
  ↓ 1. Extract key from URL
  ↓ 2. Fetch ciphertext from server
  ↓ 3. Derive same encryption key with PBKDF2
  ↓ 4. Decrypt with AES-GCM
  ↓ Display memo (plaintext)
[Server]
  ↓ Immediately delete ciphertext (one-time use)
```

## Technical Parameters

| Item | Value | Description |
|------|-------|-------------|
| KDF Algorithm | PBKDF2 | Key derivation function |
| KDF Hash | SHA-256 | Hash used in PBKDF2 |
| KDF Iterations | 100,000 | Protects against brute-force |
| Encryption Algorithm | AES-GCM | Authenticated encryption |
| Key Length | 256 bits | AES key size |
| IV Length | 12 bytes | Standard GCM IV size |
| Salt Length | 16 bytes | PBKDF2 salt |
| Max Memo Length | 2,000 chars | Client-side limit |
| TTL | 30 minutes | Auto-expiration time |

## Implementation Files

- `/src/lib/crypto.ts` - Core encryption/decryption logic
- `/src/lib/id.ts` - Key generation and normalization
- `/src/lib/constants.ts` - Encryption parameter constants
- `/src/App.tsx` - Encryption usage example

## Web Crypto API Usage

This implementation uses the browser's standard [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API):
- `crypto.subtle.importKey()` - Generate key material
- `crypto.subtle.deriveKey()` - PBKDF2 key derivation
- `crypto.subtle.encrypt()` - AES-GCM encryption
- `crypto.subtle.decrypt()` - AES-GCM decryption
- `crypto.getRandomValues()` - Cryptographically secure random number generation

All cryptographic operations leverage the browser's native implementation to ensure both performance and security.

## Why This Combination?

### PBKDF2 Benefits:
- Industry-standard key derivation function
- Configurable iteration count for adjustable security
- Well-tested and widely audited
- Supported natively in browsers via Web Crypto API

### AES-GCM Benefits:
- Provides both confidentiality (encryption) and authenticity (integrity)
- Single operation for encrypt + MAC (more efficient than separate operations)
- NIST-approved algorithm
- Hardware-accelerated in modern browsers
- Resistant to many attack vectors when used correctly

### Combined Security:
- Short memorable keys → Strong encryption keys via PBKDF2
- Strong encryption + tamper detection via AES-GCM
- No dependency on third-party crypto libraries
- Runs entirely in the browser (client-side encryption)

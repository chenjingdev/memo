# 암호화 알고리즘 설명 (Encryption Algorithm Documentation)

## 사용된 암호화 알고리즘

이 프로젝트는 **PBKDF2 + AES-GCM** 조합을 사용합니다.

### 핵심 구성 요소

1. **PBKDF2 (Password-Based Key Derivation Function 2)**
   - 패스워드/키로부터 암호화 키를 안전하게 유도
   - SHA-256 해시 함수 사용
   - 100,000회 반복 (KDF_ITERATIONS)
   - 16바이트 랜덤 솔트(salt) 사용

2. **AES-GCM (Advanced Encryption Standard - Galois/Counter Mode)**
   - 256비트 키 길이
   - 12바이트 랜덤 IV (Initialization Vector)
   - 인증된 암호화(Authenticated Encryption) 제공

## 암호화 로직 상세 설명

### 1. 키 생성 과정

```typescript
// 1단계: 랜덤 키 문자열 생성 (사용자가 지정한 길이와 문자 집합)
const keyString = generateKeyString(keyLength, { useNum, useLow, useUp });
// 예: "Ab3x" (4자리, 숫자+대문자+소문자)

// 2단계: 키 정규화 - 영숫자만 남김
const normalized = normalizeKey(keyString); // 특수문자 제거

// 3단계: 랜덤 솔트 생성 (16바이트)
const salt = crypto.getRandomValues(new Uint8Array(16));
```

### 2. 암호화 키 유도 (Key Derivation)

```typescript
async function deriveKeyFromPasscode(passcode, salt, usages, iterations = 100000) {
  // 1. 패스워드를 키 재료(key material)로 변환
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(normalizeKey(passcode)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // 2. PBKDF2를 사용하여 AES-GCM 키 유도
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,           // 16바이트 랜덤 솔트
      iterations: 100000,   // 100,000회 반복 (브루트포스 공격 방어)
      hash: 'SHA-256'       // SHA-256 해시 함수
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },  // 256비트 AES-GCM 키
    false,
    usages  // ['encrypt'] 또는 ['decrypt']
  );
}
```

**왜 PBKDF2를 사용하는가?**
- 짧은 패스워드/키로부터 강력한 암호화 키를 안전하게 생성
- 100,000회 반복으로 무차별 대입 공격(brute-force)을 어렵게 만듦
- 솔트를 사용하여 동일한 패스워드라도 다른 키가 생성됨 (레인보우 테이블 공격 방어)

### 3. 메모 암호화 과정

```typescript
async function encryptWithKey(text, key) {
  // 1. 랜덤 IV 생성 (12바이트)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // 2. 텍스트를 바이트로 변환
  const plaintext = textEncoder.encode(text);
  
  // 3. AES-GCM으로 암호화
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  
  // 4. 결과 반환 (Base64 인코딩)
  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv)
  };
}
```

### 4. 전체 암호화 플로우

```typescript
// App.tsx에서 실제 사용 예시
async function shareMemo() {
  // 1. 키 문자열 생성 (예: "Ab3x")
  const candidateKey = generateKeyString(keyLength, { useNum, useLow, useUp });
  
  // 2. 랜덤 솔트 생성
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // 3. PBKDF2로 암호화 키 유도
  const key = await deriveKeyFromPasscode(candidateKey, salt, ['encrypt']);
  
  // 4. AES-GCM으로 메모 암호화
  const encrypted = await encryptWithKey(memoText, key);
  
  // 5. 암호문 페이로드 구성
  const payload = {
    ciphertext: encrypted.ciphertext,  // 암호화된 메모 (Base64)
    iv: encrypted.iv,                  // 초기화 벡터 (Base64)
    salt: bufferToBase64(salt),        // 솔트 (Base64)
    kdf: {
      name: 'PBKDF2',
      iterations: 100000,
      hash: 'SHA-256'
    }
  };
  
  // 6. 서버에 암호문 저장 (키는 URL 해시에만 존재)
  // 공유 링크: /{id}#{key}
  // 예: /a1b2c3d4#Ab3x
}
```

### 5. 복호화 과정

```typescript
async function decryptPayload(data, passcode) {
  // 1. 페이로드에서 솔트 추출
  const salt = base64ToBytes(data.salt);
  
  // 2. 같은 파라미터로 키 유도 (암호화 시와 동일한 키 생성)
  const key = await deriveKeyFromPasscode(passcode, salt, ['decrypt'], data.kdf.iterations);
  
  // 3. IV와 암호문 추출
  const iv = base64ToBytes(data.iv);
  const ciphertext = base64ToBytes(data.ciphertext);
  
  // 4. AES-GCM으로 복호화
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  
  // 5. 바이트를 텍스트로 변환
  return textDecoder.decode(decrypted);
}
```

## 보안 특징

### 1. 클라이언트 측 암호화 (End-to-End Encryption)
- 메모는 브라우저에서 암호화된 후 서버로 전송됨
- 서버는 암호화된 데이터만 보관 (평문 접근 불가)
- 키는 URL 해시(#)에만 존재하여 서버로 전송되지 않음

### 2. Forward Secrecy
- 매 암호화마다 새로운 솔트와 IV 생성
- 같은 메모를 여러 번 암호화해도 다른 암호문 생성

### 3. 인증된 암호화 (Authenticated Encryption)
- AES-GCM은 암호화와 동시에 무결성 검증 제공
- 암호문 변조 시 복호화 실패로 감지

### 4. 키 유도 강화
- PBKDF2 100,000회 반복으로 무차별 대입 공격 방어
- 솔트 사용으로 사전 공격(dictionary attack) 방어

### 5. 1회성 접근 (Burn After Reading)
- 메모는 1회 열람 후 서버에서 즉시 삭제
- 30분 TTL 후 자동 만료

## 데이터 흐름

```
[작성자]
  ↓ 메모 입력
[브라우저]
  ↓ 1. 랜덤 키 생성 (예: "Ab3x")
  ↓ 2. PBKDF2로 암호화 키 유도 (100,000회 반복)
  ↓ 3. AES-GCM으로 메모 암호화
[Cloudflare Worker]
  ↓ 암호문 저장 (평문 접근 불가)
[Durable Object (SQLite)]

공유 링크: https://example.com/{id}#{key}
              서버로 전송 ↑    ↑ 브라우저만 보유 (서버 전송 안됨)

[독자]
  ↓ 링크 클릭
[브라우저]
  ↓ 1. URL에서 키 추출
  ↓ 2. 서버에서 암호문 가져옴
  ↓ 3. PBKDF2로 같은 암호화 키 유도
  ↓ 4. AES-GCM으로 복호화
  ↓ 메모 표시 (평문)
[서버]
  ↓ 암호문 즉시 삭제 (1회성)
```

## 기술적 매개변수

| 항목 | 값 | 설명 |
|------|-----|------|
| KDF 알고리즘 | PBKDF2 | 키 유도 함수 |
| KDF 해시 | SHA-256 | PBKDF2에 사용되는 해시 |
| KDF 반복 | 100,000 | 무차별 대입 공격 방어 |
| 암호화 알고리즘 | AES-GCM | 인증된 암호화 |
| 키 길이 | 256 bits | AES 키 크기 |
| IV 길이 | 12 bytes | GCM 표준 IV 크기 |
| 솔트 길이 | 16 bytes | PBKDF2 솔트 |
| 메모 최대 길이 | 2,000자 | 클라이언트 제한 |
| TTL | 30분 | 자동 만료 시간 |

## 구현 파일

- `/src/lib/crypto.ts` - 암호화/복호화 핵심 로직
- `/src/lib/id.ts` - 키 생성 및 정규화
- `/src/lib/constants.ts` - 암호화 파라미터 상수
- `/src/App.tsx` - 암호화 사용 예시

## Web Crypto API 사용

이 구현은 브라우저의 표준 [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)를 사용합니다:
- `crypto.subtle.importKey()` - 키 재료 생성
- `crypto.subtle.deriveKey()` - PBKDF2 키 유도
- `crypto.subtle.encrypt()` - AES-GCM 암호화
- `crypto.subtle.decrypt()` - AES-GCM 복호화
- `crypto.getRandomValues()` - 암호학적으로 안전한 난수 생성

모든 암호화 연산은 브라우저의 네이티브 구현을 활용하여 성능과 보안을 보장합니다.

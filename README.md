# Memo Relay

브라우저에서 암호화한 메모를 1회성으로 공유하는 도구입니다. 메모는 클라이언트에서 암호화되어 Cloudflare Durable Object에 저장되며, 읽거나 만료되면 자동으로 삭제됩니다.

## 주요 기능
- 클라이언트 측 암호화(PBKDF2 + AES-GCM), 키는 URL 해시에만 존재
- 1회 열람 후 즉시 파기(burn after GET)
- TTL 만료(기본 30분)
- 공유 상태 폴링
- 클라이언트 2000자 제한, 서버는 암호문 크기로 제한

## 기술 스택
- Vite + React + Tailwind CSS
- Cloudflare Workers + Durable Objects(SQLite 기반)

## 프로젝트 구조
- `src/` - React 앱
- `worker/` - Cloudflare Worker + Durable Object
- `public/` - 정적 에셋
- `wrangler.jsonc` - Worker 설정 및 라우트

## 로컬 개발
```bash
npm install

# 프론트만 실행(Vite)
npm run dev

# 워커만 실행(Wrangler)
npm run dev:worker

# 둘 다 실행
npm run dev:all
```

Vite가 `/api/*`를 워커로 프록시합니다. 필요 시 `VITE_API_PROXY_TARGET`로 변경하세요.

## 빌드
```bash
npm run build
```

## 배포
```bash
npm run deploy
```
`deploy`는 `vite build` 이후 `wrangler deploy`를 실행합니다.

## 설정 참고
- 커스텀 도메인 라우트는 `wrangler.jsonc`에서 설정합니다(예: `memo.example.com/*`).
- 커스텀 라우트 사용 시 `workers_dev`는 비활성화됩니다.
- 무료 플랜 호환을 위해 Durable Object 마이그레이션은 `new_sqlite_classes`를 사용합니다.

## 동작 참고
- 공유 링크 형식: `/{id}#{key}` (키는 서버로 전송되지 않음)
- 읽기 링크를 새로고침하면 파기 처리 및 파기 메시지 표시
- 만료된 링크는 만료 상태로 표시

## 라이선스
MIT

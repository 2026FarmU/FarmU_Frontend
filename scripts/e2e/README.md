# e2e 수동 검증

화면이 실제로 뜨고 동작하는지 빠르게 확인하는 스크립트입니다. (테스트 러너 아님 — 스크린샷+콘솔에러 확인용)

매 실행마다 데모 계정으로 **새로 로그인**해 세션을 심으므로 토큰을 하드코딩하지 않습니다.

## 사전 준비
- dev 서버 실행: `npm run dev`
- (최초 1회) `playwright-core`는 devDependencies에 포함됨. 시스템 Chrome 사용(브라우저 다운로드 없음).

## 사용
```bash
npm run verify -- /shipping            # 운영책임자(admin)로 출하 화면
npm run verify -- /lands member        # 조합원(member)로 필지 화면
HEADLESS=0 npm run verify -- /reports  # 창을 띄워서 직접 보기
```

스크린샷은 `scripts/e2e/out/`에 저장됩니다(깃 제외).

## 환경변수
| 변수 | 기본값 |
| --- | --- |
| `API_BASE` | `http://43.202.51.195` |
| `APP_BASE` | `http://localhost:3000` |
| `UNION_CODE` | `DEMO` |
| `PASSWORD` | `FarmU2026!` |
| `CHROME_PATH` | macOS Chrome 경로 |
| `HEADLESS` | `1`(헤드리스). `0`이면 창 표시 |

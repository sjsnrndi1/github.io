# delete-user Edge Function

회원탈퇴를 처리하는 Supabase Edge Function입니다.

## 배포

```bash
supabase functions deploy delete-user --no-verify-jwt
```

브라우저의 CORS preflight 요청도 함수까지 전달되어야 하므로 `--no-verify-jwt`
옵션이 필요합니다. 사용자 검증은 함수 내부에서 `Authorization` 헤더의 access
token으로 직접 처리합니다.

## 필요한 환경 변수

Supabase Edge Function 환경에는 아래 값이 필요합니다.

- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SERVICE_ROLE_KEY`: Supabase Dashboard에서 발급한 service role key

`SERVICE_ROLE_KEY`는 절대 프론트엔드에 노출하면 안 됩니다.

대시보드에서 `SUPABASE_` prefix가 막혀 있으면 `SERVICE_ROLE_KEY` 이름으로
등록하면 됩니다. 함수 코드는 `SERVICE_ROLE_KEY`와 `SUPABASE_SERVICE_ROLE_KEY`를
모두 확인합니다.

## CORS 확인

배포 후 브라우저 콘솔에 CORS 오류가 보이면 아래 항목을 먼저 확인하세요.

- `supabase/config.toml`에 `[functions.delete-user] verify_jwt = false`가 있는지
- 실제 배포 명령에 `--no-verify-jwt`가 포함됐는지
- 함수 환경 변수에 `SUPABASE_URL`과 `SERVICE_ROLE_KEY`가 등록됐는지
- 로그인 세션이 만료되어 빈 access token을 보내고 있지 않은지

# delete-user Edge Function

회원탈퇴를 처리하는 Supabase Edge Function입니다.

## 배포

```bash
supabase functions deploy delete-user --no-verify-jwt
```

브라우저의 CORS preflight 요청이 함수까지 도달해야 하므로 `--no-verify-jwt` 옵션이 필요합니다.
사용자 검증은 함수 내부에서 `Authorization` 헤더의 access token으로 직접 처리합니다.

## 필요한 환경 변수

Supabase Edge Function 환경에는 아래 값이 필요합니다.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY`는 절대 프론트엔드에 노출하면 안 됩니다.

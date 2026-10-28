# Gemini AI 대화 설정

기존 `board-comment` 함수의 CORS·토큰 검증·JSON 응답 구조와 마이페이지의 인증 방식을 참고했습니다. 별도 백엔드 서버 없이 Supabase Edge Function이 Gemini를 호출합니다.

## 최초 적용

1. Supabase **Edge Functions → Secrets**에 `GEMINI_API_KEY`를 등록합니다. 키는 코드·Git·채팅에 올리지 않습니다.
2. 사용자 확인 후 SQL Editor에서 최신 [gemini-chat-setup.sql](../../gemini-chat-setup.sql) 전체를 실행합니다. 호출 횟수·대화방·메시지 테이블, 제한·저장 함수, 변경 요약을 설정합니다. 기존 IP 설정이 적용된 프로젝트를 기준으로 합니다. 초기 버전을 적용한 경우에도 최신 파일을 다시 실행할 수 있습니다.
3. Supabase **Edge Functions → Deploy a new function → Via Editor**에서 함수 이름을 **`gemini-chat`**으로 정하고 이 폴더의 [index.ts](index.ts) 전체를 붙여 넣습니다.
4. 함수의 **Verify JWT / Enforce JWT Verification**을 끄고 배포합니다. 함수 내부에서 `auth.getUser(accessToken)`으로 실제 로그인 사용자를 검증합니다. 공개용 API 키와 사용자 JWT를 혼동하지 않습니다.
5. `/github.io/front/lab/chatbot.html`에서 로그인 후 대화합니다.

CLI를 사용할 수 있는 환경에서는 아래 명령으로 배포할 수도 있습니다.

```bash
supabase functions deploy gemini-chat --no-verify-jwt
```

GitHub 프론트 푸시만으로 Supabase 함수가 배포되지는 않습니다.

## 설정과 동작

- 필수 환경 변수: `GEMINI_API_KEY`, `SUPABASE_URL`, `SERVICE_ROLE_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY`. Supabase URL과 서비스 키는 기존 함수와 같은 방식을 사용합니다.
- 선택 환경 변수: `GEMINI_MODEL`. 기본 모델은 `gemini-3.8-flash`입니다. AI Studio에서 해당 프로젝트가 사용할 수 있는 모델·요금·한도를 확인하고, 필요하면 Secrets에 허용된 모델 ID를 지정합니다. 무료 이용을 보장하지 않습니다.
- 계정별 분당 5회·UTC 하루 50회, 사이트 전체 분당 30회·UTC 하루 200회로 제한합니다. 제한은 SQL 함수에 정의되어 있습니다. UTC 날짜는 한국 시간 오전 9시에 바뀝니다.
- Gemini 호출 직전에 횟수를 차감하므로 API 오류나 시간 초과도 횟수에 포함됩니다. 이 제한은 금액 기준의 결제 한도가 아닙니다.
- 질문은 최대 2,000자입니다. Gemini에는 DB에 저장된 최근 6회 문답과 현재 질문을 전달하며, 전체 32,000자를 넘으면 서버가 오래된 문답부터 제외합니다. 외부 API 응답 대기 시간은 90초이고 프론트 전송 요청은 110초입니다. 기다리는 동안 생성 중 표시와 경과 시간을 보여줍니다.
- 대화 목록은 최근 50개 대화방, 상세는 최근 100개 메시지를 표시합니다. 새로고침해도 이전 대화에서 다시 불러올 수 있습니다. 새 대화 버튼은 저장된 대화를 삭제하지 않습니다.
- `AI_CHAT_CONVERSATION`에 대화방·제목·소유자·최근 메시지 번호를, `AI_CHAT_MESSAGE`에 질문·답변·요청 번호를 저장합니다. 성공한 질문·답변 한 쌍을 같은 DB 트랜잭션에 저장합니다. 답변 생성에 실패한 질문은 저장하지 않습니다.
- 사용자 JWT를 서버에서 검증하고, 모든 대화 조회·저장에 그 사용자의 ID를 사용합니다. RLS에서도 본인 대화만 조회하도록 제한합니다. 브라우저에서 테이블 쓰기는 허용하지 않고 저장 RPC는 서비스 역할만 실행합니다. 사용자 계정이 삭제되면 해당 대화와 메시지도 삭제됩니다.
- 재시도 시 같은 요청 번호를 사용하여 중복 저장을 방지합니다. 다른 화면에서 먼저 대화를 수정하면 충돌 안내 후 이전 대화를 다시 불러오도록 합니다. 서버에서는 요청 번호에 해당하는 질문과 대화방도 함께 검사합니다.
- 질문과 답변이 DB에 저장되고 Google에도 전달되므로 화면에 개인정보 입력 주의 문구를 표시합니다. API 키·다른 회원 정보·비공개 설정은 Gemini에 전달하지 않습니다. 공개 메뉴 위치·경로 안내를 시스템 지침에 제공하며, 사이트의 계정이나 DB를 직접 수정하는 도구는 제공하지 않습니다.
- 답변은 `textContent`로 표시합니다. 모델이 반환한 HTML이나 JavaScript를 실행하지 않습니다. 모델의 내부 사고로 표시된 텍스트는 답변에서 제외합니다.
- 비로그인, 만료된 토큰, 잘못된 요청, 제한 설정 실패 시 Gemini를 호출하지 않습니다.

## 확인할 사항

로그인 전 전송 차단, 첫 질문과 후속 질문, 저장된 대화 불러오기, 본인 소유 확인, 중복 재시도, 새 대화, 오류 후 입력 유지, 호출 제한을 확인합니다. 실제 테스트 요청은 Gemini 사용량과 DB 저장을 발생시킵니다. 소스 검사와 모의 테스트는 실제 API 연결·과금·DB 경합 검증을 대신하지 않습니다.

설정 오류 메시지가 나오면 Secrets와 모델 이용 권한을, 연결 오류가 나오면 함수 이름·배포·JWT 설정·CORS를 확인합니다. 키나 사용자 토큰을 로그에 출력하지 않습니다.

이전의 ‘AI 응답이 지연되거나 연결이 끊겼습니다’ 메시지는 Gemini 호출의 시간 초과와 연결 실패를 함께 표시하던 문구입니다. 약 45초 후 발생했다면 기존 제한에 걸렸을 가능성이 있지만 실제 원인은 함수 로그로 확인해야 합니다. 최신 함수는 시간 초과와 연결·응답 오류를 구분하고 `Gemini request failed` 로그에 `kind`, `errorName`, `model`, `elapsedMs`만 기록합니다. 프론트 푸시와 별도로 최신 `index.ts`를 다시 배포해야 90초 제한과 진단 로그가 적용됩니다. 이 변경은 실제 응답 지연 원인의 해결을 보장하지 않습니다.

참고: [Gemini 모델](https://ai.google.dev/gemini-api/docs/models), [콘텐츠 생성 API](https://ai.google.dev/api/generate-content), [Supabase 함수 인증](https://supabase.com/docs/guides/functions/auth), [대시보드 배포](https://supabase.com/docs/guides/functions/quickstart-dashboard), [함수 시간 제한](https://supabase.com/docs/guides/functions/limits).

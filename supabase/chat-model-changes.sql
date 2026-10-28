-- AI 대화 무료 등급 모델 및 단계별 진단 개선의 변경 요약입니다. 사용자 확인 후 SQL Editor에서 실행합니다.
-- 목록 화면 변경에는 별도의 테이블·권한 설정 변경이 필요하지 않습니다.
begin;

do $$
declare
  admin_id uuid;
begin
  select id into strict admin_id
  from auth.users
  where lower(email) = 'sjsnrndi12@naver.com';

  insert into public."NOTE_CHANGED_TRACES"
    (date, content, created_at, created_user_id, created_ip, updated_at, updated_user_id, updated_ip)
  select
    date '2026-10-28', changes.content, now(), admin_id, public.content_request_ip(), now(), admin_id, public.content_request_ip()
  from (values
    ('AI 대화의 기본 모델을 무료 등급이 제공되는 Gemini Flash-Lite로 조정하고, 호출·응답 수신 단계별 진단 로그를 추가했습니다.')
  ) as changes(content)
  where not exists (
    select 1 from public."NOTE_CHANGED_TRACES" existing
    where existing.date::text = '2026-10-28' and existing.content = changes.content
  );
end;
$$;

commit;

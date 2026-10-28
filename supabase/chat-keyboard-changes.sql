-- AI 대화 키보드 입력 개선의 변경 요약입니다. 사용자 확인 후 SQL Editor에서 실행합니다.
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
    ('AI 대화 입력을 Enter로 보내고 Ctrl + Enter로 줄바꿈하도록 변경했습니다. 한글 조합 중에는 전송하지 않습니다.')
  ) as changes(content)
  where not exists (
    select 1 from public."NOTE_CHANGED_TRACES" existing
    where existing.date::text = '2026-10-28' and existing.content = changes.content
  );
end;
$$;

commit;

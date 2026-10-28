-- AI 대화 생성 중 표시 및 오류 구분의 변경 요약입니다. 사용자 확인 후 SQL Editor에서 실행합니다.
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
    ('AI 대화에 답변 생성 중 표시와 경과 시간을 추가하고, 응답 대기 시간을 늘리면서 시간 초과·연결 오류를 구분하도록 개선했습니다.')
  ) as changes(content)
  where not exists (
    select 1 from public."NOTE_CHANGED_TRACES" existing
    where existing.date::text = '2026-10-28' and existing.content = changes.content
  );
end;
$$;

commit;

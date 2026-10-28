-- 공지사항 추가 작업의 변경 요약입니다. 사용자 확인 후 SQL Editor에서 실행합니다.
-- 공지사항 화면 자체는 기존 BOARD 테이블과 관리자 권한 정책을 사용합니다.
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
    ('연습장 소개와 실험실 사이에 공지사항 메뉴를 추가했습니다. 관리자가 작성한 공지는 사용자 화면에서 목록과 상세로 확인할 수 있습니다.')
  ) as changes(content)
  where not exists (
    select 1 from public."NOTE_CHANGED_TRACES" existing
    where existing.date::text = '2026-10-28' and existing.content = changes.content
  );
end;
$$;

commit;

-- 기존 changed-traces-setup.sql 적용 후 Supabase SQL Editor에서 한 번 실행합니다.
-- 게시글 관리와 첨부파일 권한을 설정하고, 오늘 변경 기록 4건을 중복 없이 등록합니다.
-- 사용자가 승인한 작업이며, 이 파일 자체는 자동 실행하지 않습니다.
begin;

-- 기존 변경 기록 관리자와 동일한 계정만 게시글을 관리합니다.
create or replace function public.can_manage_board()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_changed_traces();
$$;
revoke all on function public.can_manage_board() from public;
grant execute on function public.can_manage_board() to anon, authenticated;

alter table public."BOARD"
  add column if not exists attachment_path text,
  add column if not exists attachment_original_name text;
alter table public."BOARD" enable row level security;
grant select on public."BOARD" to anon, authenticated;
grant insert, update, delete on public."BOARD" to authenticated;
revoke insert, update, delete on public."BOARD" from anon;

do $$
declare
  board_sequence text;
begin
  board_sequence := pg_get_serial_sequence('public."BOARD"', 'id');
  if board_sequence is not null then
    execute format('grant usage, select on sequence %s to authenticated', board_sequence);
  end if;
end;
$$;

drop policy if exists board_public_read on public."BOARD";
create policy board_public_read on public."BOARD"
  for select to anon, authenticated using (true);

drop policy if exists board_admin_write on public."BOARD";
create policy board_admin_write on public."BOARD"
  for all to authenticated
  using ((select public.can_manage_board()))
  with check ((select public.can_manage_board()));

drop policy if exists board_insert_guard on public."BOARD";
create policy board_insert_guard on public."BOARD"
  as restrictive for insert to anon, authenticated
  with check ((select public.can_manage_board()));

drop policy if exists board_update_guard on public."BOARD";
create policy board_update_guard on public."BOARD"
  as restrictive for update to anon, authenticated
  using ((select public.can_manage_board()))
  with check ((select public.can_manage_board()));

drop policy if exists board_delete_guard on public."BOARD";
create policy board_delete_guard on public."BOARD"
  as restrictive for delete to anon, authenticated
  using ((select public.can_manage_board()));

-- 첨부파일은 관리자 전용 비공개 버킷에 저장합니다. 다른 버킷은 변경하지 않습니다.
insert into storage.buckets (id, name, public, file_size_limit)
values ('board-attachments', 'board-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists board_files_admin_access on storage.objects;
create policy board_files_admin_access on storage.objects
  for all to authenticated
  using (bucket_id = 'board-attachments' and (select public.can_manage_board()))
  with check (bucket_id = 'board-attachments' and (select public.can_manage_board()));

-- 기존의 넓은 Storage 정책이 있더라도 이 버킷에는 관리자만 접근합니다.
drop policy if exists board_files_access_guard on storage.objects;
create policy board_files_access_guard on storage.objects
  as restrictive for all to anon, authenticated
  using (bucket_id <> 'board-attachments' or (select public.can_manage_board()))
  with check (bucket_id <> 'board-attachments' or (select public.can_manage_board()));

-- 소스에 있던 오늘 기록 3건과 이번 수정 요약 1건을 등록합니다.
-- 같은 날짜·내용의 기록이 있으면 다시 넣지 않습니다. 기존 기록은 수정하지 않습니다.
do $$
declare
  admin_id uuid;
begin
  select id into strict admin_id
  from auth.users
  where lower(email) = 'sjsnrndi12@naver.com';

  insert into public."NOTE_CHANGED_TRACES"
    (date, content, created_at, created_user_id, updated_at, updated_user_id)
  select
    date '2026-10-28', changes.content, now(), admin_id, now(), admin_id
  from (values
    ('공책·발자국·스크랩 메뉴를 정리하고, 실험실에 AI 대화·문서 내용 추출·방탈출 개발 노트 메뉴와 소개 화면을 추가했습니다.'),
    ('상단의 연습장 소개와 실험실 메뉴를 가운데 모으고 간격을 조정했습니다.'),
    ('별도 백엔드 없이 Supabase로 로그인하고 바뀐 흔적을 등록·수정·삭제할 수 있는 관리자 화면을 추가했습니다. 최초 관리자 권한 설정 후 이용할 수 있습니다.'),
    ('관리자 화면의 사용자 화면 보기 버튼을 정렬하고, 게시글 목록·상세·등록·수정·삭제와 첨부파일을 Supabase로 전환했습니다.')
  ) as changes(content)
  where not exists (
    select 1 from public."NOTE_CHANGED_TRACES" existing
    where existing.date::text = '2026-10-28' and existing.content = changes.content
  );
end;
$$;

commit;

-- 적용 후 오늘 기록이 들어갔는지 확인합니다.
select id, date, content
from public."NOTE_CHANGED_TRACES"
where date::text = '2026-10-28'
order by id;

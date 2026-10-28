-- Supabase SQL Editor에서 검토 후 실행합니다. 이 파일은 자동 실행하지 않습니다.
-- 참고 구조: 기존 NOTE_CHANGED_TRACES 테이블과 Supabase Auth 사용자.
-- 기존 기록은 유지하며, 지정 계정에 관리자 권한을 부여하고 접근 정책을 설정합니다.
begin;

-- API 요청은 전달된 IP 헤더를, SQL Editor 작업은 DB 연결 주소를 기록합니다.
-- 둘 다 확인할 수 없을 때의 0.0.0.0은 주소 미확인을 나타냅니다.
create or replace function public.content_request_ip()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  request_ip text;
begin
  request_ip := coalesce(
    nullif(btrim(headers ->> 'cf-connecting-ip'), ''),
    nullif(btrim(split_part(headers ->> 'x-forwarded-for', ',', 1)), '')
  );
  if request_ip is not null then
    begin
      return host(request_ip::inet);
    exception when invalid_text_representation then
      null;
    end;
  end if;
  return coalesce(host(inet_client_addr()), '0.0.0.0');
end;
$$;
revoke all on function public.content_request_ip() from public, anon, authenticated;

create or replace function public.set_content_audit_ip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_ip text := public.content_request_ip();
begin
  if tg_op = 'INSERT' then
    new.created_ip := request_ip;
  else
    new.created_ip := old.created_ip;
  end if;
  new.updated_ip := request_ip;
  return new;
end;
$$;
revoke all on function public.set_content_audit_ip() from public, anon, authenticated;

drop trigger if exists set_changed_traces_audit_ip on public."NOTE_CHANGED_TRACES";
create trigger set_changed_traces_audit_ip
  before insert or update on public."NOTE_CHANGED_TRACES"
  for each row execute function public.set_content_audit_ip();



-- 사용자가 수정할 수 없는 app_metadata로 관리자 권한을 관리합니다.
-- 지정 계정이 없거나 중복되면 전체 트랜잭션을 중단합니다.
do $$
begin
  if (select count(*) from auth.users where lower(email) = 'sjsnrndi12@naver.com') <> 1 then
    raise exception '관리자 계정 가입 여부를 확인하세요: sjsnrndi12@naver.com';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || '{"changed_traces_admin": true}'::jsonb
  where lower(email) = 'sjsnrndi12@naver.com';
end;
$$;

create or replace function public.can_manage_changed_traces()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and raw_app_meta_data ->> 'changed_traces_admin' = 'true'
  );
$$;

revoke all on function public.can_manage_changed_traces() from public, anon;
grant execute on function public.can_manage_changed_traces() to authenticated;

alter table public."NOTE_CHANGED_TRACES" enable row level security;
grant select on public."NOTE_CHANGED_TRACES" to anon, authenticated;
grant insert, update, delete on public."NOTE_CHANGED_TRACES" to authenticated;
revoke insert, update, delete on public."NOTE_CHANGED_TRACES" from anon;

-- 다른 테이블의 권한을 바꾸지 않고, 이 테이블의 ID 자동 채번만 허용합니다.
do $$
declare
  trace_sequence text;
begin
  trace_sequence := pg_get_serial_sequence('public."NOTE_CHANGED_TRACES"', 'id');
  if trace_sequence is not null then
    execute format('grant usage, select on sequence %s to authenticated', trace_sequence);
  end if;
end;
$$;

drop policy if exists changed_traces_public_read on public."NOTE_CHANGED_TRACES";
create policy changed_traces_public_read on public."NOTE_CHANGED_TRACES"
  for select to anon, authenticated using (true);

drop policy if exists changed_traces_admin_write on public."NOTE_CHANGED_TRACES";
create policy changed_traces_admin_write on public."NOTE_CHANGED_TRACES"
  for all to authenticated
  using ((select public.can_manage_changed_traces()))
  with check ((select public.can_manage_changed_traces()));

-- 기존의 허용 정책이 있더라도 비관리자의 쓰기를 차단합니다.
drop policy if exists changed_traces_insert_guard on public."NOTE_CHANGED_TRACES";
create policy changed_traces_insert_guard on public."NOTE_CHANGED_TRACES"
  as restrictive for insert to anon, authenticated
  with check ((select public.can_manage_changed_traces()));

drop policy if exists changed_traces_update_guard on public."NOTE_CHANGED_TRACES";
create policy changed_traces_update_guard on public."NOTE_CHANGED_TRACES"
  as restrictive for update to anon, authenticated
  using ((select public.can_manage_changed_traces()))
  with check ((select public.can_manage_changed_traces()));

drop policy if exists changed_traces_delete_guard on public."NOTE_CHANGED_TRACES";
create policy changed_traces_delete_guard on public."NOTE_CHANGED_TRACES"
  as restrictive for delete to anon, authenticated
  using ((select public.can_manage_changed_traces()));

commit;

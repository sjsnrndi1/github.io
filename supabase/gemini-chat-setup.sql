-- Supabase SQL Editor에서 사용자 확인 후 최초 1회 실행합니다.
-- 대화 내용 대신 호출 횟수만 저장합니다. 기존 게시글·회원·변경 기록은 삭제하지 않습니다.
begin;

create table if not exists public."AI_CHAT_USAGE" (
  scope_key text primary key,
  window_minute timestamptz not null default date_trunc('minute', now()),
  minute_count integer not null default 0 check (minute_count >= 0),
  window_day date not null default (now() at time zone 'UTC')::date,
  day_count integer not null default 0 check (day_count >= 0)
);
alter table public."AI_CHAT_USAGE" enable row level security;
revoke all on table public."AI_CHAT_USAGE" from public, anon, authenticated;
grant select, insert, update on table public."AI_CHAT_USAGE" to service_role;

create or replace function public.take_ai_chat_quota(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_minute timestamptz := date_trunc('minute', now());
  current_day date := (now() at time zone 'UTC')::date;
  user_key text := 'user:' || p_user_id::text;
  global_usage record;
  user_usage record;
  global_minute_count integer;
  global_day_count integer;
  user_minute_count integer;
  user_day_count integer;
begin
  if p_user_id is null then
    return false;
  end if;

  insert into public."AI_CHAT_USAGE" (scope_key) values ('global')
  on conflict (scope_key) do nothing;
  -- 모든 호출에서 전체 카운터부터 잠가 중복 요청과 인스턴스 간 경합을 제어합니다.
  select * into strict global_usage from public."AI_CHAT_USAGE"
  where scope_key = 'global' for update;
  global_minute_count := case when global_usage.window_minute = current_minute then global_usage.minute_count else 0 end;
  global_day_count := case when global_usage.window_day = current_day then global_usage.day_count else 0 end;
  if global_minute_count >= 30 or global_day_count >= 200 then
    return false;
  end if;

  insert into public."AI_CHAT_USAGE" (scope_key) values (user_key)
  on conflict (scope_key) do nothing;
  select * into strict user_usage from public."AI_CHAT_USAGE"
  where scope_key = user_key for update;
  user_minute_count := case when user_usage.window_minute = current_minute then user_usage.minute_count else 0 end;
  user_day_count := case when user_usage.window_day = current_day then user_usage.day_count else 0 end;
  if user_minute_count >= 5 or user_day_count >= 50 then
    return false;
  end if;

  update public."AI_CHAT_USAGE"
  set window_minute = current_minute, minute_count = global_minute_count + 1,
      window_day = current_day, day_count = global_day_count + 1
  where scope_key = 'global';
  update public."AI_CHAT_USAGE"
  set window_minute = current_minute, minute_count = user_minute_count + 1,
      window_day = current_day, day_count = user_day_count + 1
  where scope_key = user_key;
  return true;
end;
$$;
revoke all on function public.take_ai_chat_quota(uuid) from public, anon, authenticated;
grant execute on function public.take_ai_chat_quota(uuid) to service_role;

-- 기존 변경 기록 등록 방식과 같은 구조로 이번 요약을 중복 없이 추가합니다.
do $$
declare
  admin_id uuid;
begin
  select id into strict admin_id from auth.users
  where lower(email) = 'sjsnrndi12@naver.com';
  insert into public."NOTE_CHANGED_TRACES"
    (date, content, created_at, created_user_id, created_ip, updated_at, updated_user_id, updated_ip)
  select date '2026-10-28', changes.content, now(), admin_id, public.content_request_ip(), now(), admin_id, public.content_request_ip()
  from (values
    ('AI 대화에 Gemini 챗봇 화면과 로그인 인증·대화 문맥 유지·호출 횟수 제한을 추가했습니다. 최초 DB 설정과 함수 배포 후 이용할 수 있습니다.')
  ) as changes(content)
  where not exists (
    select 1 from public."NOTE_CHANGED_TRACES" existing
    where existing.date::text = '2026-10-28' and existing.content = changes.content
  );
end;
$$;

commit;

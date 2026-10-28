-- Supabase SQL Editor에서 사용자 확인 후 최초 1회 실행합니다.
-- 호출 횟수·대화방·질문과 답변을 저장합니다. 기존 데이터는 삭제하지 않습니다.
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

create table if not exists public."AI_CHAT_CONVERSATION" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  last_message_id bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create table if not exists public."AI_CHAT_MESSAGE" (
  id bigint generated always as identity primary key,
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  role text not null check (role in ('user', 'model')),
  content text not null check (char_length(content) between 1 and 12000),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id)
    references public."AI_CHAT_CONVERSATION" (id, user_id) on delete cascade,
  unique (user_id, request_id, role)
);
create index if not exists ai_chat_conversation_owner_idx
  on public."AI_CHAT_CONVERSATION" (user_id, updated_at desc);
create index if not exists ai_chat_message_conversation_idx
  on public."AI_CHAT_MESSAGE" (conversation_id, id desc);

alter table public."AI_CHAT_CONVERSATION" enable row level security;
alter table public."AI_CHAT_MESSAGE" enable row level security;
revoke all on table public."AI_CHAT_CONVERSATION", public."AI_CHAT_MESSAGE" from public, anon, authenticated;
grant select on table public."AI_CHAT_CONVERSATION", public."AI_CHAT_MESSAGE" to authenticated;
grant select, insert, update on table public."AI_CHAT_CONVERSATION" to service_role;
grant select, insert on table public."AI_CHAT_MESSAGE" to service_role;
do $$
declare
  message_sequence text;
begin
  message_sequence := pg_get_serial_sequence('public."AI_CHAT_MESSAGE"', 'id');
  if message_sequence is not null then
    execute format('grant usage, select on sequence %s to service_role', message_sequence);
  end if;
end;
$$;

drop policy if exists ai_chat_conversation_owner_read on public."AI_CHAT_CONVERSATION";
create policy ai_chat_conversation_owner_read on public."AI_CHAT_CONVERSATION"
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists ai_chat_message_owner_read on public."AI_CHAT_MESSAGE";
create policy ai_chat_message_owner_read on public."AI_CHAT_MESSAGE"
  for select to authenticated using (user_id = (select auth.uid()));

-- 질문·답변을 같은 트랜잭션에서 저장합니다. 동일 요청 재시도는 중복 저장하지 않습니다.
create or replace function public.save_ai_chat_turn(
  p_user_id uuid, p_conversation_id uuid, p_request_id uuid,
  p_expected_last_id bigint, p_question text, p_reply text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  conversation public."AI_CHAT_CONVERSATION"%rowtype;
  saved_reply public."AI_CHAT_MESSAGE"%rowtype;
  saved_question text;
  reply_id bigint;
begin
  if p_user_id is null or p_request_id is null or p_expected_last_id is null
    or p_expected_last_id < 0 or p_question is null or p_reply is null
    or char_length(btrim(p_question)) not between 1 and 2000
    or char_length(btrim(p_reply)) not between 1 and 12000 then
    raise exception 'invalid chat turn';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('chat:' || p_user_id::text, 0));
  select * into saved_reply from public."AI_CHAT_MESSAGE"
  where user_id = p_user_id and request_id = p_request_id and role = 'model';
  if found then
    select content into saved_question from public."AI_CHAT_MESSAGE"
    where user_id = p_user_id and request_id = p_request_id and role = 'user';
    if saved_question is distinct from p_question
      or (p_conversation_id is not null and saved_reply.conversation_id <> p_conversation_id) then
      raise exception 'request reused' using errcode = 'P0001';
    end if;
    return jsonb_build_object('conversationId', saved_reply.conversation_id,
      'lastMessageId', saved_reply.id, 'reply', saved_reply.content);
  end if;

  if p_conversation_id is null then
    if p_expected_last_id <> 0 then
      raise exception 'conversation changed' using errcode = 'P0001';
    end if;
    insert into public."AI_CHAT_CONVERSATION" (user_id, title)
    values (p_user_id, left(p_question, 80)) returning * into conversation;
  else
    select * into conversation from public."AI_CHAT_CONVERSATION"
    where id = p_conversation_id and user_id = p_user_id for update;
    if not found or conversation.last_message_id <> p_expected_last_id then
      raise exception 'conversation changed' using errcode = 'P0001';
    end if;
  end if;
  insert into public."AI_CHAT_MESSAGE" (conversation_id, user_id, request_id, role, content)
  values (conversation.id, p_user_id, p_request_id, 'user', p_question);
  insert into public."AI_CHAT_MESSAGE" (conversation_id, user_id, request_id, role, content)
  values (conversation.id, p_user_id, p_request_id, 'model', p_reply) returning id into reply_id;
  update public."AI_CHAT_CONVERSATION"
  set last_message_id = reply_id, updated_at = now() where id = conversation.id;
  return jsonb_build_object('conversationId', conversation.id, 'lastMessageId', reply_id, 'reply', p_reply);
end;
$$;
revoke all on function public.save_ai_chat_turn(uuid, uuid, uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.save_ai_chat_turn(uuid, uuid, uuid, bigint, text, text) to service_role;

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
    ('AI 대화에 Gemini 챗봇 화면과 로그인 인증·대화 문맥 유지·호출 횟수 제한을 추가했습니다. 최초 DB 설정과 함수 배포 후 이용할 수 있습니다.'),
    ('AI 대화 저장·불러오기와 공개 메뉴 안내를 추가하고, 개인정보·AI 정확성 안내 및 Powered by Gemini API 문구를 반영했습니다.')
  ) as changes(content)
  where not exists (
    select 1 from public."NOTE_CHANGED_TRACES" existing
    where existing.date::text = '2026-10-28' and existing.content = changes.content
  );
end;
$$;

commit;

-- 기존 관리자 권한 함수와 AI_CHAT_CONVERSATION / AI_CHAT_MESSAGE 구조를 사용합니다.
-- Supabase SQL Editor에서 실행합니다. 기존 회원·대화 데이터는 변경하지 않습니다.
begin;

-- 이름·이메일 원문은 브라우저로 반환하지 않습니다. 비밀번호·토큰·IP는 조회하지 않습니다.
create or replace function public.admin_list_members(p_offset integer default 0)
returns table (
  member_id uuid, masked_name text, masked_email text,
  created_at timestamptz, last_sign_in_at timestamptz, conversation_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_changed_traces() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'invalid offset' using errcode = '22023';
  end if;
  return query
  select u.id,
    case
      when n.name = '' then '미등록'
      when char_length(n.name) = 1 then '*'
      when char_length(n.name) = 2 then left(n.name, 1) || '*'
      else left(n.name, 1) || repeat('*', char_length(n.name) - 2) || right(n.name, 1)
    end,
    case
      when u.email is null or position('@' in u.email) = 0 then '미등록'
      else case when char_length(split_part(u.email, '@', 1)) < 2 then '*'
        when char_length(split_part(u.email, '@', 1)) = 2 then left(u.email, 1)
        else left(u.email, 2) end || '***@' || split_part(u.email, '@', 2)
    end,
    u.created_at, u.last_sign_in_at,
    (select count(*) from public."AI_CHAT_CONVERSATION" c where c.user_id = u.id)
  from auth.users u
  cross join lateral (select left(btrim(coalesce(u.raw_user_meta_data ->> 'name', '')), 80) as name) n
  order by u.created_at desc, u.id desc
  limit 51 offset p_offset;
end;
$$;
revoke all on function public.admin_list_members(integer) from public, anon, authenticated;
grant execute on function public.admin_list_members(integer) to authenticated;

create or replace function public.admin_list_member_conversations(p_user_id uuid, p_offset integer default 0)
returns table (conversation_id uuid, created_at timestamptz, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_changed_traces() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_user_id is null or p_offset is null or p_offset < 0 then
    raise exception 'invalid parameters' using errcode = '22023';
  end if;
  -- 첫 질문에서 만들어진 대화 제목은 회원 목록에 노출하지 않습니다.
  return query
  select c.id, c.created_at, c.updated_at
  from public."AI_CHAT_CONVERSATION" c
  where c.user_id = p_user_id
  order by c.updated_at desc, c.id desc
  limit 31 offset p_offset;
end;
$$;
revoke all on function public.admin_list_member_conversations(uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_list_member_conversations(uuid, integer) to authenticated;

create or replace function public.admin_list_member_messages(
  p_user_id uuid, p_conversation_id uuid, p_before_id bigint default null
)
returns table (message_id text, role text, content text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_changed_traces() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_user_id is null or p_conversation_id is null or p_before_id <= 0 then
    raise exception 'invalid parameters' using errcode = '22023';
  end if;
  return query
  select m.id::text, m.role, m.content, m.created_at
  from public."AI_CHAT_MESSAGE" m
  join public."AI_CHAT_CONVERSATION" c on c.id = m.conversation_id and c.user_id = m.user_id
  where m.user_id = p_user_id and m.conversation_id = p_conversation_id
    and (p_before_id is null or m.id < p_before_id)
  order by m.id desc
  limit 51;
end;
$$;
revoke all on function public.admin_list_member_messages(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.admin_list_member_messages(uuid, uuid, bigint) to authenticated;

-- 별도 백엔드 배포 없이 위 관리자 전용 조회 함수로 접근합니다.
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
    date '2026-10-30', changes.content, now(), admin_id, public.content_request_ip(), now(), admin_id, public.content_request_ip()
  from (values
    ('관리자 회원관리에 이름·이메일 마스킹과 회원별 Gemini 대화 조회를 추가하고, 사용자 화면에 관리자 대화 열람 안내를 반영했습니다.')
  ) as changes(content)
  where not exists (
    select 1 from public."NOTE_CHANGED_TRACES" existing
    where existing.date::text = '2026-10-30' and existing.content = changes.content
  );
end;
$$;

commit;

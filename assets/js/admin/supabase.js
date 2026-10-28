// 관리자 인증과 DB 접근은 Supabase에서 처리합니다.
const ADMIN_SUPABASE_URL = "https://nrlkhbgeynmiqesglhgt.supabase.co";
const ADMIN_SUPABASE_KEY = "sb_publishable_xoEN2afiedAx0kZBd2022w_KFeCqecX";

let adminSupabaseClient = null;

function getAdminSupabaseClient() {
  if (!window.supabase) {
    throw new Error("인증 기능을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.");
  }

  if (!adminSupabaseClient) {
    adminSupabaseClient = window.supabase.createClient(
      ADMIN_SUPABASE_URL,
      ADMIN_SUPABASE_KEY,
    );
  }

  return adminSupabaseClient;
}

async function requireAdmin() {
  const client = getAdminSupabaseClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error("관리자 계정으로 로그인해주세요.");
  }

  // 화면이나 localStorage의 값이 아닌 DB에서 관리자 권한을 확인합니다.
  const { data: isAdmin, error: roleError } = await client.rpc(
    "can_manage_changed_traces",
  );

  if (roleError) {
    throw new Error("관리자 권한 설정을 확인할 수 없습니다. Supabase 설정을 확인하세요.");
  }

  if (isAdmin !== true) {
    throw new Error("관리자 권한이 없는 계정입니다.");
  }

  return { client, user: data.user };
}

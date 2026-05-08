import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return createJsonResponse({ message: "허용되지 않는 요청입니다." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization") || "";
  const accessToken = authHeader.replace("Bearer ", "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return createJsonResponse(
      { message: "서버 환경 변수가 설정되지 않았습니다." },
      500,
    );
  }

  if (!accessToken) {
    return createJsonResponse({ message: "로그인 정보가 없습니다." }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !user) {
    return createJsonResponse(
      {
        message:
          "사용자 정보를 확인할 수 없습니다. 다시 로그인한 뒤 시도해주세요.",
      },
      401,
    );
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
    user.id,
  );

  if (deleteError) {
    return createJsonResponse(
      {
        message: deleteError.message || "회원탈퇴 처리 중 오류가 발생했습니다.",
      },
      500,
    );
  }

  return createJsonResponse({ message: "회원탈퇴가 완료되었습니다." });
});

function createJsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

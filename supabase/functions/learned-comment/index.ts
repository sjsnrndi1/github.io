import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin, Access-Control-Request-Headers",
};

Deno.serve(async (request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return createJsonResponse({ message: "허용되지 않는 요청입니다." }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return createJsonResponse(
        { message: "서버 환경 변수가 설정되지 않았습니다." },
        500,
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    const accessToken = getAccessToken(request, body);

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
        { message: "사용자 정보를 확인할 수 없습니다. 다시 로그인해주세요." },
        401,
      );
    }

    const clientIp = getClientIp(request);

    if (action === "create") {
      return await createComment(supabaseAdmin, body, user.id, clientIp);
    }

    if (action === "update") {
      return await updateComment(supabaseAdmin, body, user.id, clientIp);
    }

    if (action === "delete") {
      return await deleteComment(supabaseAdmin, body, user.id);
    }

    if (action === "like") {
      return await updateLike(supabaseAdmin, body);
    }

    return createJsonResponse({ message: "알 수 없는 요청입니다." }, 400);
  } catch (err) {
    console.error("LEARNED_COMMENT FUNCTION ERROR:", err);
    return createJsonResponse(
      { message: err instanceof Error ? err.message : "알 수 없는 오류" },
      500,
    );
  }
});

function getAccessToken(request: Request, body: Record<string, unknown>) {
  const authHeader = request.headers.get("Authorization") || "";
  const headerToken = authHeader.replace("Bearer ", "").trim();
  const bodyToken =
    typeof body.accessToken === "string" ? body.accessToken.trim() : "";

  return headerToken || bodyToken;
}

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

function requirePositiveNumber(value: unknown, name: string) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${name} 값이 올바르지 않습니다.`);
  }

  return numberValue;
}

async function createComment(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  userId: string,
  clientIp: string,
) {
  const learnedId = requirePositiveNumber(body.learnedId, "learnedId");
  const content = String(body.content || "").trim();

  if (!content) {
    return createJsonResponse({ message: "댓글을 입력해주세요." }, 400);
  }

  const { data: lastComments, error: lastError } = await supabaseAdmin
    .from("LEARNED_COMMENT")
    .select("id")
    .eq("learned_id", learnedId)
    .order("id", { ascending: false })
    .limit(1);

  if (lastError) throw lastError;

  const nextId = Number(lastComments?.[0]?.id || 0) + 1;
  const { data, error } = await supabaseAdmin
    .from("LEARNED_COMMENT")
    .insert({
      id: nextId,
      learned_id: learnedId,
      content,
      reg_user_id: userId,
      created_user_id: userId,
      created_ip: clientIp,
      updated_user_id: userId,
      updated_ip: clientIp,
      num_like_cnt: 0,
    })
    .select("id,learned_id")
    .single();

  if (error) throw error;

  return createJsonResponse({ data });
}

async function updateComment(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  userId: string,
  clientIp: string,
) {
  const learnedId = requirePositiveNumber(body.learnedId, "learnedId");
  const commentId = requirePositiveNumber(body.commentId, "commentId");
  const content = String(body.content || "").trim();

  if (!content) {
    return createJsonResponse({ message: "댓글을 입력해주세요." }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from("LEARNED_COMMENT")
    .update({
      content,
      updated_at: new Date().toISOString(),
      updated_user_id: userId,
      updated_ip: clientIp,
    })
    .eq("learned_id", learnedId)
    .eq("id", commentId)
    .eq("reg_user_id", userId)
    .select("id,learned_id")
    .single();

  if (error) throw error;

  return createJsonResponse({ data });
}

async function deleteComment(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  userId: string,
) {
  const learnedId = requirePositiveNumber(body.learnedId, "learnedId");
  const commentId = requirePositiveNumber(body.commentId, "commentId");

  const { error } = await supabaseAdmin
    .from("LEARNED_COMMENT")
    .delete()
    .eq("learned_id", learnedId)
    .eq("id", commentId)
    .eq("reg_user_id", userId);

  if (error) throw error;

  return createJsonResponse({ message: "댓글이 삭제되었습니다." });
}

async function updateLike(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const learnedId = requirePositiveNumber(body.learnedId, "learnedId");
  const commentId = requirePositiveNumber(body.commentId, "commentId");
  const shouldLike = Boolean(body.shouldLike);

  const { data: comment, error: selectError } = await supabaseAdmin
    .from("LEARNED_COMMENT")
    .select("num_like_cnt")
    .eq("learned_id", learnedId)
    .eq("id", commentId)
    .single();

  if (selectError) throw selectError;

  const nextLikeCount = Math.max(
    0,
    Number(comment?.num_like_cnt || 0) + (shouldLike ? 1 : -1),
  );

  const { data, error } = await supabaseAdmin
    .from("LEARNED_COMMENT")
    .update({ num_like_cnt: nextLikeCount })
    .eq("learned_id", learnedId)
    .eq("id", commentId)
    .select("id,learned_id,num_like_cnt")
    .single();

  if (error) throw error;

  return createJsonResponse({ data });
}

function createJsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

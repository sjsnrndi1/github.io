import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 기존 board-comment 함수의 CORS, 사용자 검증, JSON 응답 구조를 사용합니다.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin, Access-Control-Request-Headers",
};

type ChatMessage = { role: "user" | "model"; text: string };
const CONVERSATION_TABLE = "AI_CHAT_CONVERSATION";
const MESSAGE_TABLE = "AI_CHAT_MESSAGE";
const PUBLIC_SITE_GUIDE = `공개 메뉴 안내:
상단 메뉴는 왼쪽부터 연습장 소개, 공지사항, 실험실입니다. 우측에는 로그인·가입이 있고 로그인 후 회원 메뉴에서 마이페이지로 이동합니다.
연습장 소개 하위 메뉴: 처음 펼친 이유(/github.io/front/about/first-reason.html), 자주 꺼내두는 것들(/github.io/front/about/frequent-thing.html), 바뀐 흔적(/github.io/front/about/changed-traces.html).
공지사항 목록: /github.io/front/notice/index.html. 일반 사용자는 목록과 상세를 읽을 수 있습니다.
실험실 하위 메뉴: AI 대화(/github.io/front/lab/chatbot.html), 문서 내용 추출(/github.io/front/lab/document-extract.html), 방탈출 개발 노트(/github.io/front/lab/escape-room.html).
마이페이지: /github.io/front/mypage.html. 이름·프로필 이미지·비밀번호 수정과 회원탈퇴 안내가 있습니다. 로그인이 필요합니다.
현재 AI 대화는 본인의 질문과 답변을 저장합니다. 이전 대화 선택과 새 대화 버튼을 사용할 수 있습니다.
문서 내용 추출은 준비 중이며, 방탈출 개발 노트는 개발 중인 게임의 소개 공간입니다.
이 안내에 없는 기능이나 위치를 지어내지 마세요. 다른 회원 정보, 비밀번호, API 키, 관리자 설정, 비공개 대화는 제공받지 않았고 조회할 수도 없습니다.
사이트 이용 안내와 일반 질문에는 답변하되, 계정이나 DB를 실제로 변경했다고 말하지 마세요.`;

Deno.serve(async (request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return createJsonResponse({ message: "허용되지 않는 요청입니다." }, 405);
    }

    const accessToken = (request.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return createJsonResponse({ message: "로그인 후 이용해주세요." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
    if (!supabaseUrl || !serviceRoleKey) {
      return createJsonResponse({ message: "AI 대화 설정이 완료되지 않았습니다." }, 503);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !user || user.is_anonymous) {
      return createJsonResponse({ message: "로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요." }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await readChatBody(request);
    } catch {
      return createJsonResponse({ message: "요청 내용을 확인하세요." }, 400);
    }

    if (body.action === "list") {
      const { data, error } = await supabaseAdmin.from(CONVERSATION_TABLE)
        .select("id,title,last_message_id,updated_at").eq("user_id", user.id)
        .order("updated_at", { ascending: false }).limit(50);
      if (error) return createJsonResponse({ message: "대화 저장소 설정을 확인해야 합니다." }, 503);
      return createJsonResponse({ conversations: data || [] });
    }
    const conversationId = body.conversationId == null ? null : String(body.conversationId);
    if (conversationId !== null && !isUuid(conversationId)) {
      return createJsonResponse({ message: "대화방 정보를 확인하세요." }, 400);
    }
    if (body.action === "history") {
      if (!conversationId) return createJsonResponse({ message: "대화를 선택하세요." }, 400);
      const { data: conversation, error: conversationError } = await supabaseAdmin.from(CONVERSATION_TABLE)
        .select("id,title,last_message_id").eq("id", conversationId).eq("user_id", user.id).maybeSingle();
      if (conversationError) return createJsonResponse({ message: "대화를 불러오지 못했습니다." }, 503);
      if (!conversation) return createJsonResponse({ message: "대화를 찾을 수 없습니다." }, 404);
      const { data, error } = await supabaseAdmin.from(MESSAGE_TABLE)
        .select("id,role,content").eq("conversation_id", conversationId).eq("user_id", user.id)
        .order("id", { ascending: false }).limit(100);
      if (error) return createJsonResponse({ message: "대화를 불러오지 못했습니다." }, 503);
      return createJsonResponse({ conversation, messages: (data || []).reverse() });
    }
    const question = typeof body.message === "string" ? body.message.trim() : "";
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const expectedLastId = body.lastMessageId;
    if (body.action !== "send" || !question || question.length > 2000 || !isUuid(requestId)
      || typeof expectedLastId !== "number" || !Number.isSafeInteger(expectedLastId) || expectedLastId < 0) {
      return createJsonResponse({ message: "질문과 대화 정보를 확인하세요. 질문은 최대 2,000자입니다." }, 400);
    }
    // 응답을 받기 전에 연결이 끊긴 요청도 같은 요청 번호로 재시도하면 중복 저장하지 않습니다.
    const { data: previousTurn, error: previousError } = await supabaseAdmin.from(MESSAGE_TABLE)
      .select("id,role,content,conversation_id").eq("user_id", user.id).eq("request_id", requestId);
    if (previousError) return createJsonResponse({ message: "대화 저장소 설정을 확인해야 합니다." }, 503);
    if (previousTurn?.length) {
      const savedQuestion = previousTurn.find((item) => item.role === "user");
      const savedReply = previousTurn.find((item) => item.role === "model");
      if (!savedReply || savedQuestion?.content !== question
        || (conversationId && savedReply.conversation_id !== conversationId)) {
        return createJsonResponse({ message: "대화 요청이 변경되었습니다. 대화를 다시 불러오세요." }, 409);
      }
      return createJsonResponse({ conversationId: savedReply.conversation_id, lastMessageId: savedReply.id, reply: savedReply.content });
    }

    let messages: ChatMessage[] = [];
    if (conversationId) {
      const { data: conversation, error: conversationError } = await supabaseAdmin.from(CONVERSATION_TABLE)
        .select("id,last_message_id").eq("id", conversationId).eq("user_id", user.id).maybeSingle();
      if (conversationError) return createJsonResponse({ message: "대화를 불러오지 못했습니다." }, 503);
      if (!conversation) return createJsonResponse({ message: "대화를 찾을 수 없습니다." }, 404);
      if (conversation.last_message_id !== expectedLastId) {
        return createJsonResponse({ message: "다른 화면에서 대화가 변경되었습니다. 이전 대화에서 다시 불러오세요." }, 409);
      }
      const { data, error } = await supabaseAdmin.from(MESSAGE_TABLE)
        .select("role,content").eq("conversation_id", conversationId).eq("user_id", user.id)
        .order("id", { ascending: false }).limit(12);
      if (error) return createJsonResponse({ message: "대화 문맥을 불러오지 못했습니다." }, 503);
      messages = (data || []).reverse().map((item) => ({ role: item.role, text: item.content }));
    } else if (expectedLastId !== 0) {
      return createJsonResponse({ message: "새 대화 정보를 확인하세요." }, 400);
    }
    messages.push({ role: "user", text: question });
    while (messages.reduce((length, message) => length + message.text.length, 0) > 32000) messages.splice(0, 2);
    try {
      messages = validateMessages(messages);
    } catch {
      return createJsonResponse({ message: "저장된 대화 형식을 확인해야 합니다. 새 대화로 다시 시도하세요." }, 409);
    }

    if (!geminiKey || !/^[a-zA-Z0-9.-]+$/.test(model)) {
      return createJsonResponse({ message: "AI 대화 설정이 완료되지 않았습니다." }, 503);
    }
    // 인스턴스가 바뀌어도 같은 DB 카운터로 제한합니다.
    const { data: allowed, error: quotaError } = await supabaseAdmin.rpc("take_ai_chat_quota", {
      p_user_id: user.id,
    });
    if (quotaError) {
      console.error("AI chat quota unavailable:", quotaError.code);
      return createJsonResponse({ message: "AI 대화 이용 설정이 준비되지 않았습니다." }, 503);
    }
    if (allowed !== true) {
      return createJsonResponse({ message: "AI 대화 호출 한도에 도달했습니다. 잠시 후 또는 다음 날 다시 이용해주세요." }, 429);
    }

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: "당신은 개인 학습 공간 '연습장'의 대화 도우미입니다. 사용자의 언어에 맞춰 명확하게 답변하고, 기본적으로 한글을 사용하세요. 모르는 내용은 모른다고 설명하세요.\n" + PUBLIC_SITE_GUIDE }],
            },
            contents: messages.map((message) => ({
              role: message.role,
              parts: [{ text: message.text }],
            })),
            generationConfig: { maxOutputTokens: 2048 },
          }),
          signal: AbortSignal.timeout(45000),
        },
      );
    } catch {
      return createJsonResponse({ message: "AI 응답이 지연되거나 연결이 끊겼습니다. 잠시 후 다시 시도하세요." }, 504);
    }

    if (!response.ok) {
      // 외부 오류 원문에 설정 정보가 포함될 수 있어 상태 코드만 기록합니다.
      console.error("Gemini status:", response.status);
      if (response.status === 429) {
        return createJsonResponse({ message: "Gemini 사용 한도에 도달했습니다. 잠시 후 다시 시도하세요." }, 429);
      }
      if ([400, 401, 403, 404].includes(response.status)) {
        return createJsonResponse({ message: "Gemini API 키·모델·이용 권한 설정을 확인해야 합니다." }, 502);
      }
      return createJsonResponse({ message: "Gemini가 응답하지 못했습니다. 잠시 후 다시 시도하세요." }, 502);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];
    const reply = (candidate?.content?.parts || [])
      .filter((part: { text?: unknown; thought?: boolean }) => typeof part.text === "string" && !part.thought)
      .map((part: { text: string }) => part.text)
      .join("").trim();
    if (!reply) {
      return createJsonResponse({ message: "답변을 생성하지 못했습니다. 질문을 바꾸어 다시 시도하세요." }, 422);
    }
    if (reply.length > 12000) {
      return createJsonResponse({ message: "답변이 너무 깁니다. 질문 범위를 좁혀 다시 시도하세요." }, 422);
    }
    const { data: saved, error: saveError } = await supabaseAdmin.rpc("save_ai_chat_turn", {
      p_user_id: user.id, p_conversation_id: conversationId, p_request_id: requestId,
      p_expected_last_id: expectedLastId, p_question: question, p_reply: reply,
    });
    if (saveError) {
      const conflict = saveError.code === "P0001";
      return createJsonResponse({ message: conflict
        ? "다른 화면에서 대화가 변경되었습니다. 이전 대화에서 다시 불러오세요."
        : "답변 저장을 확인하지 못했습니다. 같은 질문으로 다시 시도하면 중복 저장을 확인합니다." }, conflict ? 409 : 503);
    }
    return createJsonResponse(saved);
  } catch {
    console.error("Gemini chat request failed.");
    return createJsonResponse({ message: "AI 대화 처리 중 오류가 발생했습니다." }, 500);
  }
});

async function readChatBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty body");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 100000) {
        await reader.cancel();
        throw new Error("body too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid body");
    return body;
  } finally {
    reader.releaseLock();
  }
}

function validateMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 13 || value.length % 2 !== 1) {
    throw new Error("invalid message count");
  }
  let totalLength = 0;
  return value.map((item, index) => {
    const role = index % 2 === 0 ? "user" : "model";
    if (!item || item.role !== role || typeof item.text !== "string") {
      throw new Error("invalid message");
    }
    const text = item.text.trim();
    if (!text || text.length > (role === "user" ? 2000 : 12000)) {
      throw new Error("invalid message length");
    }
    totalLength += text.length;
    if (totalLength > 32000) throw new Error("conversation too long");
    return { role, text };
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function createJsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

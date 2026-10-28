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
    if (!supabaseUrl || !serviceRoleKey || !geminiKey || !/^[a-zA-Z0-9.-]+$/.test(model)) {
      return createJsonResponse({ message: "AI 대화 설정이 완료되지 않았습니다." }, 503);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !user || user.is_anonymous) {
      return createJsonResponse({ message: "로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요." }, 401);
    }

    let messages: ChatMessage[];
    try {
      const body = await readChatBody(request);
      messages = validateMessages(body.messages);
    } catch {
      return createJsonResponse({ message: "질문과 대화 길이를 확인하세요. 질문은 최대 2,000자입니다." }, 400);
    }

    // 인스턴스가 바뀌어도 같은 DB 카운터로 제한합니다. 대화 내용은 저장하지 않습니다.
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
              parts: [{ text: "당신은 개인 학습 공간 '연습장'의 대화 도우미입니다. 사용자의 언어에 맞춰 명확하게 답변하고, 기본적으로 한글을 사용하세요. 모르는 내용은 모른다고 설명하세요. 사이트 계정이나 DB를 직접 조회하거나 변경할 수 있다고 말하지 마세요." }],
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
    return createJsonResponse({ reply });
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
    return JSON.parse(text);
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

function createJsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

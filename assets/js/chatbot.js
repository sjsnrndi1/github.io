// 기존 마이페이지 인증과 댓글 Edge Function 호출 방식을 사용합니다.
document.addEventListener("DOMContentLoaded", initChatbot);

async function initChatbot() {
  const form = document.querySelector("[data-chat-form]");
  if (!form) return;
  const input = document.getElementById("chat-message");
  const sendButton = document.querySelector("[data-chat-send]");
  const resetButton = document.querySelector("[data-chat-reset]");
  const loginCallout = document.querySelector("[data-chat-login]");
  const messages = document.querySelector("[data-chat-messages]");
  const status = document.querySelector("[data-chat-status]");
  const historySelect = document.querySelector("[data-chat-history]");
  const reloadButton = document.querySelector("[data-chat-reload]");
  let conversationId = null;
  let lastMessageId = 0;
  let pendingRequest = null;
  let currentUserId = null;
  let sending = false;

  function setEnabled(enabled) {
    input.disabled = !enabled;
    sendButton.disabled = !enabled;
    resetButton.disabled = !enabled;
    historySelect.disabled = !enabled;
    reloadButton.disabled = !enabled;
    messages.setAttribute("aria-busy", sending ? "true" : "false");
  }

  function addMessage(role, text) {
    messages.querySelector("[data-chat-empty]")?.remove();
    const article = document.createElement("article");
    article.className = `chatbot-message${role === "user" ? " is-user" : ""}`;
    const author = document.createElement("strong");
    author.textContent = role === "user" ? "나" : "Gemini";
    const content = document.createElement("p");
    content.textContent = text;
    article.append(author, content);
    messages.appendChild(article);
    messages.scrollTop = messages.scrollHeight;
    return article;
  }

  function startGeneratingMessage() {
    const article = addMessage("model", "답변을 생성하고 있습니다");
    article.classList.add("is-generating");
    const dots = document.createElement("span");
    dots.className = "chatbot-dots";
    dots.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 3; index += 1) {
      const dot = document.createElement("span");
      dot.textContent = ".";
      dots.appendChild(dot);
    }
    article.querySelector("p").appendChild(dots);
    const elapsed = document.createElement("small");
    elapsed.className = "chatbot-elapsed";
    elapsed.setAttribute("aria-hidden", "true");
    elapsed.textContent = "0초 경과";
    article.appendChild(elapsed);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      elapsed.textContent = `${Math.floor((Date.now() - startedAt) / 1000)}초 경과`;
    }, 1000);
    return {
      remove() {
        clearInterval(timer);
        article.remove();
      },
    };
  }

  async function callChat(payload) {
    const client = await getAuthedSupabaseClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user || userData.user.id !== currentUserId) {
      messages.replaceChildren();
      conversationId = null;
      lastMessageId = 0;
      pendingRequest = null;
      historySelect.replaceChildren();
      currentUserId = null;
      loginCallout.hidden = false;
      throw new Error("로그인 계정이 변경되었거나 세션이 만료되었습니다. 다시 로그인 후 화면을 새로고침하세요.");
    }
    const { data: sessionData, error } = await client.auth.getSession();
    if (error || !sessionData.session?.access_token) {
      throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
    }
    const response = await fetch(`${APP_SUPABASE_URL}/functions/v1/gemini-chat`, {
      method: "POST",
      headers: {
        apikey: APP_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${sessionData.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(payload.action === "send" ? 110000 : 55000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fallback = response.status === 404
        ? "AI 대화 연결이 준비되지 않았습니다. 잠시 후 다시 시도하세요."
        : "답변을 받지 못했습니다. 잠시 후 다시 시도하세요.";
      throw new Error(result.message || fallback);
    }
    return result;
  }

  async function loadConversationList() {
    const result = await callChat({ action: "list" });
    historySelect.replaceChildren();
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "새 대화";
    historySelect.appendChild(emptyOption);
    (result.conversations || []).forEach((conversation) => {
      const option = document.createElement("option");
      option.value = conversation.id;
      option.textContent = conversation.title;
      historySelect.appendChild(option);
    });
    historySelect.value = conversationId || "";
  }

  function startNewConversation() {
    conversationId = null;
    lastMessageId = 0;
    pendingRequest = null;
    historySelect.value = "";
    messages.replaceChildren();
    input.value = "";
    setPageMessage(status, "새 대화를 시작합니다. 기존 대화는 이전 대화 목록에 보관됩니다.");
    input.focus();
  }

  const user = await getValidStoredUser();
  if (!user) {
    loginCallout.hidden = false;
    setPageMessage(status, "로그인 후 질문을 보낼 수 있습니다.");
    return;
  }
  currentUserId = user.id;
  try {
    await loadConversationList();
    setPageMessage(status, "질문을 입력하거나 이전 대화를 선택해주세요.");
  } catch (error) {
    setPageMessage(status, error.message || "대화 목록을 불러오지 못했습니다.", true);
  }
  setEnabled(Boolean(currentUserId));

  resetButton.addEventListener("click", () => {
    if (sending) return;
    startNewConversation();
  });

  reloadButton.addEventListener("click", async () => {
    if (sending) return;
    sending = true;
    setEnabled(false);
    try {
      await loadConversationList();
      setPageMessage(status, "대화 목록을 새로 불러왔습니다.");
    } catch (error) {
      setPageMessage(status, error.message || "대화 목록을 불러오지 못했습니다.", true);
    } finally {
      sending = false;
      setEnabled(Boolean(currentUserId));
    }
  });

  historySelect.addEventListener("change", async () => {
    if (sending) return;
    const selectedId = historySelect.value;
    if (!selectedId) {
      startNewConversation();
      return;
    }
    sending = true;
    setEnabled(false);
    try {
      const result = await callChat({ action: "history", conversationId: selectedId });
      conversationId = result.conversation.id;
      lastMessageId = result.conversation.last_message_id;
      pendingRequest = null;
      messages.replaceChildren();
      (result.messages || []).forEach((message) => addMessage(message.role, message.content));
      input.value = "";
      setPageMessage(status, "저장된 대화를 불러왔습니다. 최근 100개 메시지까지 표시합니다.");
    } catch (error) {
      historySelect.value = conversationId || "";
      setPageMessage(status, error.message || "대화를 불러오지 못했습니다.", true);
    } finally {
      sending = false;
      setEnabled(Boolean(currentUserId));
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (sending || input.disabled || event.repeat) return;
    if (event.ctrlKey) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      if (input.maxLength > 0 && input.value.length - (end - start) >= input.maxLength) return;
      input.setRangeText("\n", start, end, "end");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    form.requestSubmit();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    const text = input.value.trim();
    if (!text || text.length > 2000) {
      setPageMessage(status, "질문을 1~2,000자로 입력해주세요.", true);
      return;
    }

    sending = true;
    setEnabled(false);
    setPageMessage(status, "답변을 생성하고 있습니다.");
    let pendingMessage = null;
    let generatingMessage = null;
    try {
      if (!pendingRequest || pendingRequest.message !== text
        || pendingRequest.conversationId !== conversationId || pendingRequest.lastMessageId !== lastMessageId) {
        pendingRequest = { action: "send", message: text, conversationId, lastMessageId, requestId: crypto.randomUUID() };
      }
      pendingMessage = addMessage("user", text);
      generatingMessage = startGeneratingMessage();
      const result = await callChat(pendingRequest);
      if (typeof result.reply !== "string" || !result.reply.trim()) {
        throw new Error("답변이 비어 있습니다. 질문을 바꾸어 다시 시도하세요.");
      }
      generatingMessage.remove();
      generatingMessage = null;
      addMessage("model", result.reply);
      conversationId = result.conversationId;
      lastMessageId = result.lastMessageId;
      pendingRequest = null;
      input.value = "";
      setPageMessage(status, "답변이 도착했습니다.");
      try {
        await loadConversationList();
      } catch {
        setPageMessage(status, "답변은 저장됐지만 목록을 갱신하지 못했습니다. 목록 새로고침으로 확인하세요.");
      }
    } catch (error) {
      pendingMessage?.remove();
      const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
      const networkError = error instanceof TypeError;
      setPageMessage(status, timedOut
        ? "응답 시간이 길어 연결을 종료했습니다. 잠시 후 다시 시도하세요."
        : networkError ? "AI 대화에 연결하지 못했습니다. 네트워크와 함수 배포 상태를 확인하세요."
        : error.message || "AI 대화 연결에 실패했습니다.", true);
    } finally {
      generatingMessage?.remove();
      sending = false;
      setEnabled(Boolean(currentUserId));
      if (currentUserId) input.focus();
    }
  });
}

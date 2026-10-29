// 게시글 목록과 같은 관리자 인증·DOM 생성 방식으로 조회 전용 화면을 구성합니다.
const memberTableBody = document.getElementById("memberTableBody");
const memberTable = document.getElementById("memberTable");
const memberStatus = document.getElementById("memberStatus");
const previousMembers = document.getElementById("previousMembers");
const nextMembers = document.getElementById("nextMembers");
const refreshMembers = document.getElementById("refreshMembers");
const memberChats = document.getElementById("memberChats");
const conversationList = document.getElementById("conversationList");
const conversationStatus = document.getElementById("conversationStatus");
const moreConversations = document.getElementById("moreConversations");
const messagePanel = document.getElementById("messagePanel");
const messageList = document.getElementById("messageList");
const messageStatus = document.getElementById("messageStatus");
const olderMessages = document.getElementById("olderMessages");
let memberPage = 0;
let memberRequest = 0;
let chatRequest = 0;
let messageRequest = 0;
let selectedMemberId = null;
let selectedConversationId = null;
let conversationOffset = 0;
let beforeMessageId = null;

async function memberRpc(name, parameters) {
  const admin = await window.adminReady;
  if (!admin) throw new Error("관리자 계정으로 로그인해주세요.");
  await requireAdmin();
  const { data, error } = await admin.client.rpc(name, parameters);
  if (error) {
    if (error.code === "42501") throw new Error("관리자 조회 권한이 없습니다.");
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error("회원관리 DB 설정이 필요합니다. 관리자에게 설정 상태를 확인하세요.");
    }
    throw new Error("조회하지 못했습니다. 연결 상태와 회원관리 DB 설정을 확인하세요.");
  }
  return data || [];
}

function resetMemberChats() {
  chatRequest += 1;
  messageRequest += 1;
  selectedMemberId = null;
  selectedConversationId = null;
  memberChats.hidden = true;
  messagePanel.hidden = true;
  conversationList.replaceChildren();
  messageList.replaceChildren();
  moreConversations.hidden = true;
  olderMessages.hidden = true;
}

function memberDate(value) {
  return value ? formatDate(value) : "-";
}

async function loadMembers(page = 0) {
  const request = ++memberRequest;
  resetMemberChats();
  memberTableBody.replaceChildren();
  memberTable.hidden = true;
  previousMembers.disabled = true;
  nextMembers.disabled = true;
  refreshMembers.disabled = true;
  memberStatus.textContent = "회원을 불러오는 중입니다.";
  try {
    const rows = await memberRpc("admin_list_members", { p_offset: page * 50 });
    if (request !== memberRequest) return;
    memberPage = page;
    document.getElementById("memberPage").textContent = `${page + 1}페이지`;
    rows.slice(0, 50).forEach((member) => {
      const row = document.createElement("tr");
      [member.masked_name, member.masked_email, memberDate(member.created_at),
        memberDate(member.last_sign_in_at), member.conversation_count].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value ?? "-";
        row.appendChild(cell);
      });
      const cell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-btn";
      button.textContent = "대화 보기";
      button.addEventListener("click", () => openMemberChats(member));
      cell.appendChild(button);
      row.appendChild(cell);
      memberTableBody.appendChild(row);
    });
    memberTable.hidden = rows.length === 0;
    memberStatus.textContent = rows.length ? "" : "등록된 회원이 없습니다.";
    previousMembers.disabled = page === 0;
    nextMembers.disabled = rows.length <= 50;
  } catch (error) {
    if (request !== memberRequest) return;
    memberStatus.textContent = error.message;
    previousMembers.disabled = memberPage === 0;
  } finally {
    if (request === memberRequest) refreshMembers.disabled = false;
  }
}

function openMemberChats(member) {
  resetMemberChats();
  selectedMemberId = member.member_id;
  conversationOffset = 0;
  document.getElementById("chatMemberHeading").textContent =
    `${member.masked_name} · ${member.masked_email} 대화 내역`;
  memberChats.hidden = false;
  memberChats.scrollIntoView({ behavior: "smooth", block: "start" });
  loadConversations();
}

async function loadConversations() {
  const request = ++chatRequest;
  const memberId = selectedMemberId;
  moreConversations.disabled = true;
  conversationStatus.textContent = "대화를 불러오는 중입니다.";
  try {
    const rows = await memberRpc("admin_list_member_conversations", {
      p_user_id: memberId, p_offset: conversationOffset,
    });
    if (request !== chatRequest || selectedMemberId !== memberId) return;
    rows.slice(0, 30).forEach((conversation) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "member-conversation";
      button.setAttribute("aria-pressed", "false");
      button.textContent = `시작 ${memberDate(conversation.created_at)} · 최근 ${memberDate(conversation.updated_at)}`;
      button.addEventListener("click", () => {
        messageRequest += 1;
        selectedConversationId = conversation.conversation_id;
        beforeMessageId = null;
        messageList.replaceChildren();
        olderMessages.hidden = true;
        messagePanel.hidden = false;
        conversationList.querySelectorAll("button").forEach((item) => {
          item.setAttribute("aria-pressed", String(item === button));
        });
        loadMessages();
      });
      conversationList.appendChild(button);
    });
    conversationOffset += Math.min(rows.length, 30);
    moreConversations.hidden = rows.length <= 30;
    conversationStatus.textContent = conversationOffset ? "" : "저장된 대화가 없습니다.";
  } catch (error) {
    if (request === chatRequest) conversationStatus.textContent = error.message;
  } finally {
    if (request === chatRequest) moreConversations.disabled = false;
  }
}

async function loadMessages() {
  const request = ++messageRequest;
  const memberId = selectedMemberId;
  const conversationId = selectedConversationId;
  olderMessages.disabled = true;
  messageStatus.textContent = "질문과 답변을 불러오는 중입니다.";
  try {
    const rows = await memberRpc("admin_list_member_messages", {
      p_user_id: memberId, p_conversation_id: conversationId, p_before_id: beforeMessageId,
    });
    if (request !== messageRequest || selectedMemberId !== memberId ||
      selectedConversationId !== conversationId) return;
    const visibleRows = rows.slice(0, 50);
    const fragment = document.createDocumentFragment();
    visibleRows.reverse().forEach((message) => {
      const article = document.createElement("article");
      article.className = `member-message${message.role === "model" ? " is-model" : ""}`;
      const label = document.createElement("strong");
      label.textContent = `${message.role === "model" ? "Gemini 답변" : "회원 질문"} · ${memberDate(message.created_at)}`;
      const content = document.createElement("p");
      content.textContent = message.content;
      article.append(label, content);
      fragment.appendChild(article);
    });
    messageList.prepend(fragment);
    if (visibleRows.length) beforeMessageId = visibleRows[0].message_id;
    olderMessages.hidden = rows.length <= 50;
    messageStatus.textContent = visibleRows.length ? "" : "저장된 메시지가 없습니다.";
  } catch (error) {
    if (request === messageRequest) messageStatus.textContent = error.message;
  } finally {
    if (request === messageRequest) olderMessages.disabled = false;
  }
}

previousMembers.addEventListener("click", () => loadMembers(Math.max(0, memberPage - 1)));
nextMembers.addEventListener("click", () => loadMembers(memberPage + 1));
refreshMembers.addEventListener("click", () => loadMembers(0));
moreConversations.addEventListener("click", loadConversations);
olderMessages.addEventListener("click", loadMessages);
document.getElementById("closeMemberChats").addEventListener("click", resetMemberChats);

window.adminReady.then((admin) => {
  if (!admin) return;
  admin.client.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" ||
      (event === "SIGNED_IN" && session?.user?.id === admin.user.id)) return;
    memberRequest += 1;
    resetMemberChats();
    memberTableBody.replaceChildren();
    memberTable.hidden = true;
    previousMembers.disabled = true;
    nextMembers.disabled = true;
    memberStatus.textContent = "로그인 상태가 변경되었습니다. 새로고침 후 다시 조회하세요.";
    refreshMembers.disabled = false;
  });
  loadMembers();
});

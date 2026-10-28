// 기존 게시글 관리 화면과 같은 폼·목록 구조를 사용합니다.
const traceForm = document.getElementById("traceForm");
const traceDateInput = document.getElementById("traceDate");
const traceContentInput = document.getElementById("content");
const traceSaveButton = document.getElementById("saveBtn");
const traceCancelButton = document.getElementById("cancelBtn");
const traceRefreshButton = document.getElementById("refreshBtn");
const traceMessage = document.getElementById("traceMessage");
const traceTableBody = document.getElementById("traceTableBody");
const traceEmptyMessage = document.getElementById("emptyMessage");

let traceAdmin = null;
let traceRecords = [];
let editingTraceId = null;
let traceBusy = false;

function setTraceBusy(busy) {
  traceBusy = busy;
  traceForm.querySelectorAll("input, textarea, button").forEach((control) => {
    control.disabled = busy || !traceAdmin;
  });
  traceRefreshButton.disabled = busy || !traceAdmin;
  traceTableBody.querySelectorAll("button").forEach((button) => {
    button.disabled = busy || !traceAdmin;
  });
}

function resetTraceForm() {
  editingTraceId = null;
  traceForm.reset();
  const now = new Date();
  traceDateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  document.getElementById("formTitle").textContent = "새 기록 등록";
  traceSaveButton.textContent = "등록";
  traceCancelButton.hidden = true;
}

function renderTraces() {
  traceTableBody.replaceChildren();
  traceEmptyMessage.hidden = traceRecords.length > 0;

  traceRecords.forEach((record) => {
    const row = document.createElement("tr");
    const dateCell = document.createElement("td");
    dateCell.textContent = String(record.date || "");
    const contentCell = document.createElement("td");
    contentCell.textContent = record.content;
    const actionCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "btn-group";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "수정";
    editButton.addEventListener("click", () => {
      if (traceBusy) return;
      editingTraceId = record.id;
      const date = String(record.date || "");
      traceDateInput.value = date.includes("-")
        ? date.slice(0, 10)
        : `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
      traceContentInput.value = record.content;
      document.getElementById("formTitle").textContent = "기록 수정";
      traceSaveButton.textContent = "수정 저장";
      traceCancelButton.hidden = false;
      traceMessage.textContent = "내용을 변경한 뒤 수정 저장을 눌러주세요.";
      traceContentInput.focus();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", () => deleteTrace(record));

    actions.append(editButton, deleteButton);
    actionCell.appendChild(actions);
    row.append(dateCell, contentCell, actionCell);
    traceTableBody.appendChild(row);
  });
}

async function loadTraces() {
  const { data, error } = await traceAdmin.client
    .from("NOTE_CHANGED_TRACES")
    .select("id, date, content, updated_at")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  traceRecords = data || [];
  renderTraces();
}

function traceErrorMessage(error) {
  console.error(error);
  if (error?.code === "42501" || error?.code === "PGRST301") {
    return "저장 권한이 없습니다. 다시 로그인하거나 관리자 권한 설정을 확인하세요.";
  }
  return "처리하지 못했습니다. 로그인 상태와 Supabase 테이블 설정을 확인한 뒤 다시 시도하세요.";
}

async function refreshTraces() {
  if (traceBusy || !traceAdmin) return;
  setTraceBusy(true);
  try {
    await loadTraces();
    traceMessage.textContent = "변경 기록을 불러왔습니다.";
  } catch (error) {
    traceMessage.textContent = traceErrorMessage(error);
  } finally {
    setTraceBusy(false);
  }
}

traceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (traceBusy || !traceAdmin || !traceForm.reportValidity()) return;
  const content = traceContentInput.value.trim();
  if (!content) {
    traceMessage.textContent = "변경 요약을 입력하세요.";
    traceContentInput.focus();
    return;
  }
  const isEditing = editingTraceId !== null;
  if (!window.confirm(isEditing ? "변경 기록을 수정할까요?" : "변경 기록을 DB에 등록할까요?")) return;

  setTraceBusy(true);
  let saved = false;
  try {
    const { client, user } = await requireAdmin();
    const values = {
      date: traceDateInput.value,
      content,
      updated_at: new Date().toISOString(),
      updated_user_id: user.id,
    };
    let query;
    if (isEditing) {
      const original = traceRecords.find((record) => record.id === editingTraceId);
      if (!original) throw new Error("수정할 기록이 없습니다.");
      query = client.from("NOTE_CHANGED_TRACES").update(values).eq("id", editingTraceId);
      query = original.updated_at == null
        ? query.is("updated_at", null)
        : query.eq("updated_at", original.updated_at);
    } else {
      query = client.from("NOTE_CHANGED_TRACES").insert({
        ...values,
        created_at: values.updated_at,
        created_user_id: user.id,
      });
    }
    const { data, error } = await query.select("id");
    if (error) throw error;
    if (!data || data.length !== 1) {
      traceMessage.textContent = "기록이 변경되었거나 처리 권한이 없습니다. 새로고침 후 다시 확인하세요.";
      return;
    }
    saved = true;
    resetTraceForm();
    await loadTraces();
    traceMessage.textContent = isEditing ? "수정되었습니다." : "등록되었습니다.";
  } catch (error) {
    traceMessage.textContent = saved
      ? "저장은 완료됐지만 목록을 불러오지 못했습니다. 새로고침으로 확인하세요."
      : traceErrorMessage(error);
  } finally {
    setTraceBusy(false);
  }
});

async function deleteTrace(record) {
  if (traceBusy || !traceAdmin) return;
  if (!window.confirm(`${record.date} 기록을 삭제할까요? 삭제한 내용은 복구할 수 없습니다.`)) return;
  setTraceBusy(true);
  let deleted = false;
  try {
    const { client } = await requireAdmin();
    let query = client.from("NOTE_CHANGED_TRACES").delete().eq("id", record.id);
    query = record.updated_at == null
      ? query.is("updated_at", null)
      : query.eq("updated_at", record.updated_at);
    const { data, error } = await query.select("id");
    if (error) throw error;
    if (!data || data.length !== 1) {
      traceMessage.textContent = "기록이 변경되었거나 처리 권한이 없습니다. 새로고침 후 다시 확인하세요.";
      return;
    }
    deleted = true;
    if (editingTraceId === record.id) resetTraceForm();
    await loadTraces();
    traceMessage.textContent = "삭제되었습니다.";
  } catch (error) {
    traceMessage.textContent = deleted
      ? "삭제는 완료됐지만 목록을 불러오지 못했습니다. 새로고침으로 확인하세요."
      : traceErrorMessage(error);
  } finally {
    setTraceBusy(false);
  }
}

traceCancelButton.addEventListener("click", () => {
  if (traceBusy) return;
  resetTraceForm();
  traceMessage.textContent = "수정을 취소했습니다.";
});
traceRefreshButton.addEventListener("click", refreshTraces);

window.adminReady.then(async (admin) => {
  if (!admin) return;
  traceAdmin = admin;
  resetTraceForm();
  await refreshTraces();
});

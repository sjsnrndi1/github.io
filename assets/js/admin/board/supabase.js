// 기존 관리자 Supabase 인증과 사용자 화면의 BOARD 테이블을 사용합니다.
const ADMIN_BOARD_TABLE = "BOARD";
const ADMIN_BOARD_BUCKET = "board-attachments";
const ADMIN_BOARD_MAX_FILE_SIZE = 10 * 1024 * 1024;

function normalizeAdminBoardPost(post) {
  return {
    ...post,
    createdAt: post.created_at,
    attachmentOriginalName: post.attachment_original_name,
    attachmentPath: post.attachment_path,
  };
}

async function fetchAdminBoardPosts() {
  const admin = await window.adminReady;
  if (!admin) return null;
  const { data, error } = await admin.client
    .from(ADMIN_BOARD_TABLE)
    .select("id,title,board_dcd,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeAdminBoardPost);
}

async function fetchAdminBoardPost(id) {
  const admin = await window.adminReady;
  if (!admin) return null;
  if (!/^\d+$/.test(String(id || ""))) throw new Error("잘못된 게시글 번호입니다.");
  const { data, error } = await admin.client
    .from(ADMIN_BOARD_TABLE)
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return normalizeAdminBoardPost(data);
}

async function requireBoardAdmin() {
  const admin = await requireAdmin();
  const { data, error } = await admin.client.rpc("can_manage_board");
  if (error || data !== true) {
    throw new Error("게시글 관리 DB 설정이 필요합니다. Supabase에서 frontend-db-setup.sql을 적용하세요.");
  }
  return admin;
}

function getAdminBoardValues(title, content, summary, boardDcd, user) {
  if (!title.trim() || !content.trim()) throw new Error("제목과 내용을 입력하세요.");
  if (!["notice", "learned", "blocked", "review"].includes(boardDcd)) throw new Error("게시글 분류를 선택하세요.");
  return {
    title: title.trim(),
    content: content.trim(),
    summary: summary.trim(),
    board_dcd: boardDcd,
    updated_at: new Date().toISOString(),
    updated_user_id: user.id,
  };
}

async function uploadAdminBoardFile(client, user, file) {
  if (!file) return null;
  if (file.size > ADMIN_BOARD_MAX_FILE_SIZE) throw new Error("첨부파일은 10MB 이하만 등록할 수 있습니다.");
  const extension = String(file.name).split(".").pop();
  const suffix = /^[a-zA-Z0-9]{1,16}$/.test(extension) ? `.${extension}` : "";
  const filePath = `${user.id}/${crypto.randomUUID()}${suffix}`;
  const { error } = await client.storage.from(ADMIN_BOARD_BUCKET).upload(filePath, file, {
    upsert: false,
  });
  if (error) throw new Error("첨부파일 업로드에 실패했습니다. 파일 용량과 Storage 설정을 확인하세요.");
  return { attachment_path: filePath, attachment_original_name: file.name };
}

async function cleanupAdminBoardFile(client, filePath) {
  if (!filePath) return false;
  try {
    const { error } = await client.storage.from(ADMIN_BOARD_BUCKET).remove([filePath]);
    if (error) console.error(error);
    return Boolean(error);
  } catch (error) {
    console.error(error);
    return true;
  }
}

async function saveAdminBoardPost({ id, original, title, content, summary, boardDcd, file }) {
  const { client, user } = await requireBoardAdmin();
  const values = getAdminBoardValues(title, content, summary, boardDcd, user);
  if (id != null && !original) throw new Error("원본 게시글을 불러온 뒤 수정하세요.");
  const attachment = await uploadAdminBoardFile(client, user, file);
  if (attachment) Object.assign(values, attachment);
  let query;
  if (id != null) {
    query = client.from(ADMIN_BOARD_TABLE).update(values).eq("id", id);
    query = original.updated_at == null
      ? query.is("updated_at", null)
      : query.eq("updated_at", original.updated_at);
  } else {
    query = client.from(ADMIN_BOARD_TABLE).insert({
      ...values,
      created_at: values.updated_at,
      created_user_id: user.id,
    });
  }
  const { data, error } = await query.select("id");
  if (error || !data || data.length !== 1) {
    // 네트워크 오류는 DB에 반영됐을 가능성이 있으므로 새 파일을 지우지 않습니다.
    if (attachment && (!error || (error.code && !error.code.startsWith("PGRST")))) {
      await cleanupAdminBoardFile(client, attachment.attachment_path);
    }
    if (error) {
      console.error(error);
      throw new Error("저장 결과를 확인하지 못했습니다. 목록을 확인한 뒤 다시 시도하세요.");
    }
    throw new Error("다른 곳에서 변경된 게시글입니다. 새로고침 후 다시 확인하세요.");
  }
  const cleanupWarning = attachment && original?.attachmentPath
    ? await cleanupAdminBoardFile(client, original.attachmentPath)
    : false;
  return { id: data[0].id, cleanupWarning };
}

async function deleteAdminBoardPost(post) {
  const { client } = await requireBoardAdmin();
  let query = client.from(ADMIN_BOARD_TABLE).delete().eq("id", post.id);
  query = post.updated_at == null
    ? query.is("updated_at", null)
    : query.eq("updated_at", post.updated_at);
  const { data, error } = await query.select("id");
  if (error) {
    console.error(error);
    throw new Error("삭제하지 못했습니다. 연결된 댓글·태그·참조와 DB 권한을 확인하세요.");
  }
  if (!data || data.length !== 1) throw new Error("다른 곳에서 변경된 게시글입니다. 새로고침 후 다시 확인하세요.");
  return { cleanupWarning: await cleanupAdminBoardFile(client, post.attachmentPath) };
}

async function downloadAdminBoardFile(post) {
  const { client } = await requireAdmin();
  const { data, error } = await client.storage.from(ADMIN_BOARD_BUCKET).download(post.attachmentPath);
  if (error) throw new Error("첨부파일을 내려받지 못했습니다.");
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = post.attachmentOriginalName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

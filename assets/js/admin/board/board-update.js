const params = new URLSearchParams(window.location.search);
const postId = params.get("id");

const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const fileInput = document.getElementById("file");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const summaryInput = document.getElementById("summary");
const boardDcdInput = document.getElementById("boardDcd");
let originalPost = null;
let savingPost = false;
saveBtn.disabled = true;

if (!postId) {
  alert("잘못된 접근입니다.");
  location.href = "/github.io/admin/board/list.html";
}

fetchAdminBoardPost(postId)
  .then((post) => {
    if (!post) return;
    originalPost = post;
    titleInput.value = post.title || "";
    contentInput.value = post.content || "";
    summaryInput.value = post.summary || "";
    boardDcdInput.value = post.board_dcd || "learned";
    saveBtn.disabled = false;
  })
  .catch((error) => {
    console.error(error);
    alert("게시글을 불러오지 못했습니다.");
    location.href = "/github.io/admin/board/list.html";
  });

saveBtn.addEventListener("click", async () => {
  if (savingPost || !originalPost) return;
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const file = fileInput.files[0];

  if (!title) {
    alert("제목을 입력하세요.");
    titleInput.focus();
    return;
  }

  if (!content) {
    alert("내용을 입력하세요.");
    contentInput.focus();
    return;
  }

  if (!confirm("게시글을 수정할까요?")) return;
  savingPost = true;
  saveBtn.disabled = true;
  try {
    const result = await saveAdminBoardPost({
      id: postId,
      original: originalPost,
      title,
      content,
      summary: summaryInput.value,
      boardDcd: boardDcdInput.value,
      file,
    });
    alert(result.cleanupWarning ? "수정되었습니다. 이전 첨부파일 정리는 Storage에서 확인하세요." : "수정되었습니다.");
    location.href = `/github.io/admin/board/detail.html?id=${postId}`;
  } catch (error) {
    console.error(error);
    alert(error.message || "수정 중 오류가 발생했습니다.");
  } finally {
    savingPost = false;
    saveBtn.disabled = false;
  }
});

cancelBtn.addEventListener("click", () => {
  location.href = `/github.io/admin/board/detail.html?id=${postId}`;
});

const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const fileInput = document.getElementById("file");
const saveBtn = document.getElementById("saveBtn");
const summaryInput = document.getElementById("summary");
const boardDcdInput = document.getElementById("boardDcd");
let savingPost = false;

saveBtn.disabled = true;
window.adminReady.then((admin) => {
  if (admin) saveBtn.disabled = false;
});

saveBtn.addEventListener("click", async () => {
  if (savingPost) return;
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

  if (!confirm("게시글을 등록할까요?")) return;
  savingPost = true;
  saveBtn.disabled = true;
  try {
    await saveAdminBoardPost({
      title,
      content,
      summary: summaryInput.value,
      boardDcd: boardDcdInput.value,
      file,
    });
    alert("저장되었습니다.");
    window.location.href = "/github.io/admin/board/list.html";
  } catch (err) {
    console.error(err);
    alert(err.message || "저장에 실패했습니다.");
  } finally {
    savingPost = false;
    saveBtn.disabled = false;
  }
});

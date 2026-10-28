const params = new URLSearchParams(window.location.search);
const postId = params.get("id");

const titleEl = document.getElementById("post-title");
const dateEl = document.getElementById("post-date");
const contentEl = document.getElementById("post-content");
const attachmentEl = document.getElementById("post-attachment");
const listBtn = document.getElementById("list-btn");
const editBtn = document.getElementById("edit-btn");
const deleteBtn = document.getElementById("delete-btn");
const attachmentWrapper = document.getElementById("attachment-wrapper");
let loadedPost = null;
let deletingPost = false;
editBtn.disabled = true;
deleteBtn.disabled = true;

if (!postId) {
  alert("잘못된 접근입니다.");
  location.href = "/github.io/admin/board/list.html";
}

fetchAdminBoardPost(postId)
  .then((post) => {
    if (!post) return;
    loadedPost = post;
    editBtn.disabled = false;
    deleteBtn.disabled = false;
    titleEl.textContent = post.title || "제목 없음";
    contentEl.textContent = post.content || "내용 없음";

    if (post.createdAt) {
      dateEl.textContent = formatDate(post.createdAt);
    } else {
      dateEl.textContent = "";
    }

    if (post.attachmentPath && post.attachmentOriginalName) {
      const fileBox = document.createElement("div");
      fileBox.className = "file-box";
      const fileName = document.createElement("span");
      fileName.className = "file-name";
      fileName.textContent = post.attachmentOriginalName;
      const downloadButton = document.createElement("button");
      downloadButton.className = "download-btn";
      downloadButton.id = "download-btn";
      downloadButton.textContent = "다운로드";
      fileBox.append(fileName, downloadButton);
      attachmentEl.replaceChildren(fileBox);

      downloadButton.addEventListener("click", async () => {
        downloadButton.disabled = true;
        try {
          await downloadAdminBoardFile(post);
        } catch (err) {
          console.error(err);
          alert("다운로드에 실패했습니다.");
        } finally {
          downloadButton.disabled = false;
        }
      });
    } else {
      attachmentWrapper.style.display = "none";
    }
  })
  .catch((error) => {
    console.error(error);
    alert("게시글을 불러오지 못했습니다.");
    location.href = "/github.io/admin/board/list.html";
  });

listBtn.addEventListener("click", () => {
  location.href = "/github.io/admin/board/list.html";
});

editBtn.addEventListener("click", () => {
  location.href = `/github.io/admin/board/update.html?id=${postId}`;
});

deleteBtn.addEventListener("click", async () => {
  if (deletingPost || !loadedPost) return;
  const confirmed = confirm("정말 삭제하시겠습니까?");
  if (!confirmed) return;

  deletingPost = true;
  deleteBtn.disabled = true;
  editBtn.disabled = true;
  try {
    const result = await deleteAdminBoardPost(loadedPost);
    alert(result.cleanupWarning ? "삭제되었습니다. 첨부파일 정리는 Storage에서 확인하세요." : "삭제되었습니다.");
    location.href = "/github.io/admin/board/list.html";
  } catch (error) {
    console.error(error);
    alert(error.message || "삭제 중 오류가 발생했습니다.");
  } finally {
    deletingPost = false;
    deleteBtn.disabled = false;
    editBtn.disabled = false;
  }
});

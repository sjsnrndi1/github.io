const API_BASE = "http://localhost:8081";

const params = new URLSearchParams(window.location.search);
const postId = params.get("id");

const titleEl = document.getElementById("post-title");
const dateEl = document.getElementById("post-date");
const contentEl = document.getElementById("post-content");
const attachmentEl = document.getElementById("post-attachment");

const listBtn = document.getElementById("list-btn");
const editBtn = document.getElementById("edit-btn");
const deleteBtn = document.getElementById("delete-btn");

if (!postId) {
  alert("잘못된 접근입니다.");
  location.href = "/github.io/admin/board/list.html";
}

fetch(`${API_BASE}/posts/${postId}`)
  .then((response) => {
    if (!response.ok) {
      throw new Error("게시글 조회 실패");
    }
    return response.json();
  })
  .then((post) => {
    titleEl.textContent = post.title || "제목 없음";
    contentEl.textContent = post.content || "내용 없음";

    if (post.createdAt) {
      dateEl.textContent = post.createdAt;
    } else {
      dateEl.textContent = "";
    }

    if (post.attachmentUrl && post.attachmentOriginalName) {
      attachmentEl.innerHTML = `
        <a href="${post.attachmentUrl}" download="${post.attachmentOriginalName}" target="_blank">
          ${post.attachmentOriginalName}
        </a>
      `;
    } else {
      attachmentEl.textContent = "첨부파일 없음";
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

deleteBtn.addEventListener("click", () => {
  const confirmed = confirm("정말 삭제하시겠습니까?");
  if (!confirmed) return;

  fetch(`${API_BASE}/posts/${postId}`, {
    method: "DELETE",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("삭제 실패");
      }
      alert("삭제되었습니다.");
      location.href = "/github.io/admin/baord/list.html";
    })
    .catch((error) => {
      console.error(error);
      alert("삭제 중 오류가 발생했습니다.");
    });
});

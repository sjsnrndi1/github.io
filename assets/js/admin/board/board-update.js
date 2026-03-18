const API_BASE = "http://localhost:8081";

const params = new URLSearchParams(window.location.search);
const postId = params.get("id");

const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const fileInput = document.getElementById("file");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");

if (!postId) {
  alert("잘못된 접근입니다.");
  location.href = "/github.io/admin/board/list.html";
}

// 기존 글 조회
fetch(`${API_BASE}/posts/${postId}`)
  .then((response) => {
    if (!response.ok) {
      throw new Error("게시글 조회 실패");
    }
    return response.json();
  })
  .then((post) => {
    titleInput.value = post.title || "";
    contentInput.value = post.content || "";
  })
  .catch((error) => {
    console.error(error);
    alert("게시글을 불러오지 못했습니다.");
    location.href = "/github.io/admin/board/list.html";
  });

// 수정 저장
saveBtn.addEventListener("click", () => {
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

  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);

  if (file) {
    formData.append("file", file);
  }

  fetch(`${API_BASE}/posts/${postId}`, {
    method: "PUT",
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("게시글 수정 실패");
      }
      return response.json();
    })
    .then(() => {
      alert("수정되었습니다.");
      location.href = `/github.io/admin/board/detail.html?id=${postId}`;
    })
    .catch((error) => {
      console.error(error);
      alert("수정 중 오류가 발생했습니다.");
    });
});

// 취소
cancelBtn.addEventListener("click", () => {
  location.href = `/github.io/admin/board/detail.html?id=${postId}`;
});

const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const saveBtn = document.getElementById("saveBtn");

saveBtn.addEventListener("click", () => {
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title) {
    alert("제목을 입력하세요.");
    return;
  }

  if (!content) {
    alert("내용을 입력하세요.");
    return;
  }

  const posts = JSON.parse(localStorage.getItem("posts") || "[]");

  const newPost = {
    title,
    content,
    date: new Date().toLocaleDateString(),
  };

  posts.unshift(newPost); // 최신글 위로

  fetch("http://localhost:8081/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: title,
      content: content,
    }),
  })
    .then((res) => res.json())
    .then(() => {
      alert("저장되었습니다.");
      window.location.href = "/github.io/admin/board/list.html";
    });
});

const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const fileInput = document.getElementById("file");
const saveBtn = document.getElementById("saveBtn");

saveBtn.addEventListener("click", () => {
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const file = fileInput.files[0];

  if (!title) {
    alert("제목을 입력하세요.");
    return;
  }

  if (!content) {
    alert("내용을 입력하세요.");
    return;
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);

  if (file) {
    formData.append("file", file);
  }

  fetch("http://localhost:8081/posts", {
    method: "POST",
    body: formData,
  })
    .then((res) => res.json())
    .then(() => {
      alert("저장되었습니다.");
      window.location.href = "/github.io/admin/board/list.html";
    })
    .catch((err) => {
      console.error(err);
      alert("저장 실패");
    });
});

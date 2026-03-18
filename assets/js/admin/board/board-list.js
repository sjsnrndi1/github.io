const tbody = document.getElementById("postTableBody");
const emptyMessage = document.getElementById("emptyMessage");
const table = document.querySelector(".admin-table");

function renderPosts(posts) {
  tbody.innerHTML = "";

  if (!posts || posts.length === 0) {
    table.style.display = "none";
    emptyMessage.style.display = "block";
    return;
  }

  table.style.display = "table";
  emptyMessage.style.display = "none";

  posts.forEach((post) => {
    const row = `
      <tr>
        <td>${post.id}</td>
        <td>
          <a href="/github.io/admin/board/detail.html?id=${post.id}">${post.title}</a>
        </td>
        <td>${post.createdAt ? post.createdAt.replace("T", " ").substring(0, 16) : ""}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}

fetch("http://localhost:8081/posts")
  .then((res) => res.json())
  .then((data) => {
    renderPosts(data);
  })
  .catch((err) => {
    console.error("게시글 조회 실패:", err);
    table.style.display = "none";
    emptyMessage.style.display = "block";
    emptyMessage.innerText = "게시글을 불러오지 못했습니다.";
  });

document.getElementById("writeBtn").addEventListener("click", () => {
  window.location.href = "/github.io/admin/board/insert.html";
});

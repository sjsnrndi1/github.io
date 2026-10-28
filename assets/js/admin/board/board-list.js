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

  const categoryLabels = {
    notice: "공지사항",
    learned: "배운 것들",
    blocked: "막혔던 부분",
    review: "다시 보기",
  };

  posts.forEach((post) => {
    const row = document.createElement("tr");
    const idCell = document.createElement("td");
    idCell.textContent = post.id;
    const categoryCell = document.createElement("td");
    categoryCell.textContent = Object.hasOwn(categoryLabels, post.board_dcd)
      ? categoryLabels[post.board_dcd]
      : post.board_dcd || "-";
    const titleCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = `/github.io/admin/board/detail.html?id=${encodeURIComponent(post.id)}`;
    link.textContent = post.title;
    titleCell.appendChild(link);
    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(post.createdAt);
    row.append(idCell, categoryCell, titleCell, dateCell);
    tbody.appendChild(row);
  });
}

fetchAdminBoardPosts()
  .then((data) => {
    if (!data) return;
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

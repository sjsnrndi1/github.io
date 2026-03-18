// 게시글 불러오기
const posts = JSON.parse(localStorage.getItem("posts") || "[]");

const tbody = document.getElementById("postTableBody");

function renderPosts() {
  tbody.innerHTML = "";

  posts.forEach((post, index) => {
    const row = `
      <tr>
        <td>${index + 1}</td>
        <td>${post.title}</td>
        <td>${post.date}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}

renderPosts();

// 글 작성 버튼
document.getElementById("writeBtn").addEventListener("click", () => {
  window.location.href = "./write.html";
});

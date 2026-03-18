const posts = JSON.parse(localStorage.getItem("posts") || "[]");

const tbody = document.getElementById("postTableBody");
const emptyMessage = document.getElementById("emptyMessage");

function renderPosts() {
  tbody.innerHTML = "";

  if (posts.length === 0) {
    document.querySelector(".admin-table").style.display = "none";
    emptyMessage.style.display = "block";
    return;
  }

  document.querySelector(".admin-table").style.display = "table";
  emptyMessage.style.display = "none";

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

document.getElementById("writeBtn").addEventListener("click", () => {
  window.location.href = "./write.html";
});

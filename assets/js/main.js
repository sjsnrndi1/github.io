const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");
const postList = document.getElementById("post-list");

function formatPostDate(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}.${mm}.${dd}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPosts(posts) {
  const latestPosts = Array.isArray(posts) ? posts.slice(0, 3) : [];

  if (latestPosts.length === 0) {
    postList.innerHTML = `
      <article class="post-card">
        <span>Empty</span>
        <h3>아직 등록된 게시글이 없습니다.</h3>
        <p>관리자 페이지에서 첫 게시글을 등록해 보세요.</p>
      </article>
    `;
    return;
  }

  postList.innerHTML = latestPosts
    .map((post) => {
      const title = escapeHtml(post.title || "제목 없음");
      const content = escapeHtml(post.content ? post.content.slice(0, 80) : "내용 없음");

      return `
        <article class="post-card">
          <div>
            <span>Post</span>
            <h3>${title}</h3>
            <p>${content}</p>
          </div>
          <time>${formatPostDate(post.createdAt)}</time>
        </article>
      `;
    })
    .join("");
}

menuToggle.addEventListener("click", () => {
  const isActive = navLinks.classList.toggle("active");
  menuToggle.setAttribute("aria-expanded", String(isActive));
});

navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("active");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

fetch("http://localhost:8081/posts")
  .then((res) => res.json())
  .then((posts) => {
    renderPosts(posts);
  })
  .catch((err) => {
    console.error("게시글 조회 실패:", err);
    postList.innerHTML = `
      <article class="post-card">
        <span>Offline</span>
        <h3>게시글을 불러오지 못했습니다.</h3>
        <p>서버 연결 상태를 확인한 뒤 다시 시도해 주세요.</p>
      </article>
    `;
  });

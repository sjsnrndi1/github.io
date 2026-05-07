const isLoggedIn = localStorage.getItem("isAdminLoggedIn");

if (isLoggedIn !== "true") {
  alert("로그인이 필요합니다.");
  window.location.href = "/github.io/admin/admin.html";
}

fetch("/github.io/admin/header.html")
  .then((res) => res.text())
  .then((data) => {
    document.getElementById("header-container").innerHTML = data;

    document.getElementById("logoutBtn").addEventListener("click", () => {
      localStorage.removeItem("isAdminLoggedIn");
      alert("로그아웃되었습니다.");
      location.href = "/github.io/admin/admin.html";
    });

    const currentPath = window.location.pathname;
    let currentPage = "";

    if (currentPath.includes("dashboard")) currentPage = "dashboard";
    else if (currentPath.includes("board")) currentPage = "board";

    document.querySelectorAll(".admin-nav a").forEach((menu) => {
      if (menu.dataset.page === currentPage) {
        menu.classList.add("active");
      }
    });
  });

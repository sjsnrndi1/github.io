// 기존 관리자 화면에서도 같은 인증 코드를 사용합니다.
function loadAdminScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error("관리자 인증 기능을 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

window.adminReady = (async () => {
  try {
    if (!window.supabase) {
      await loadAdminScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    }
    if (typeof requireAdmin !== "function") {
      await loadAdminScript("/github.io/assets/js/admin/supabase.js");
    }

    const admin = await requireAdmin();
    const response = await fetch("/github.io/admin/header.html");
    if (!response.ok) throw new Error("관리자 메뉴를 불러오지 못했습니다.");
    const data = await response.text();
    document.getElementById("header-container").innerHTML = data;

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      const { error } = await admin.client.auth.signOut();
      if (error) {
        alert("로그아웃에 실패했습니다. 다시 시도하세요.");
        return;
      }
      localStorage.removeItem("isAdminLoggedIn");
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      alert("로그아웃되었습니다.");
      location.href = "/github.io/admin/admin.html";
    });

    const currentPath = window.location.pathname;
    let currentPage = "";

    if (currentPath.includes("dashboard")) currentPage = "dashboard";
    else if (currentPath.includes("board")) currentPage = "board";
    else if (currentPath.includes("changed-traces")) currentPage = "changed-traces";

    document.querySelectorAll(".admin-nav a").forEach((menu) => {
      if (menu.dataset.page === currentPage) {
        menu.classList.add("active");
      }
    });
    return admin;
  } catch (error) {
    alert(error.message || "관리자 인증에 실패했습니다.");
    window.location.replace("/github.io/admin/admin.html");
    return null;
  }
})();

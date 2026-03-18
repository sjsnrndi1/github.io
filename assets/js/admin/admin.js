const form = document.getElementById("login-form");
const message = document.getElementById("login-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const response = await fetch("http://localhost:8081/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      message.textContent = "로그인 성공";
      window.location.href = "admin/admin-dashboard.html";
    } else {
      message.textContent = "아이디 또는 비밀번호가 틀렸습니다.";
    }
  } catch (error) {
    message.textContent = "서버 연결 실패";
    console.error(error);
  }
});

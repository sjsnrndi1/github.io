const form = document.getElementById("login-form");
const message = document.getElementById("login-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const submitButton = form.querySelector('button[type="submit"]');

  try {
    submitButton.disabled = true;
    message.textContent = "로그인 중입니다.";
    const client = getAdminSupabaseClient();
    const { error } = await client.auth.signInWithPassword({
      email: username.trim(),
      password,
    });

    if (error) {
      message.textContent = "이메일 또는 비밀번호를 확인하세요. 이메일 인증도 완료해야 합니다.";
      return;
    }

    await requireAdmin();
    localStorage.removeItem("isAdminLoggedIn");
    window.location.href = "/github.io/admin/admin-dashboard.html";
  } catch (error) {
    message.textContent = error.message || "로그인에 실패했습니다. 잠시 후 다시 시도하세요.";
    console.error(error);
  } finally {
    submitButton.disabled = false;
  }
});

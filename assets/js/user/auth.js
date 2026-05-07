const authForm = document.querySelector("[data-auth-form]");
const authMessage = document.querySelector("[data-auth-message]");
const AUTH_BASE_URL = "http://localhost:8081/auth";

function setMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("is-error", isError);
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const authType = authForm.dataset.authType;
  const formData = new FormData(authForm);

  if (authType === "signup") {
    const password = formData.get("password");
    const passwordConfirm = formData.get("passwordConfirm");

    if (password !== passwordConfirm) {
      setMessage("비밀번호가 서로 일치하지 않습니다.", true);
      return;
    }

    try {
      setMessage("회원가입을 처리하고 있습니다.");

      const response = await fetch(`${AUTH_BASE_URL}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "회원가입에 실패했습니다.");
      }

      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      setMessage("회원가입이 완료되었습니다.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "회원가입 중 오류가 발생했습니다.", true);
    }

    return;
  }

  setMessage("로그인 API 연결 전입니다. 화면 확인용 메시지입니다.");
});

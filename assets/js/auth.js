const authForm = document.querySelector("[data-auth-form]");
const authMessage = document.querySelector("[data-auth-message]");

authForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const authType = authForm.dataset.authType;
  const formData = new FormData(authForm);

  if (authType === "signup") {
    const password = formData.get("password");
    const passwordConfirm = formData.get("passwordConfirm");

    if (password !== passwordConfirm) {
      authMessage.textContent = "비밀번호가 서로 일치하지 않습니다.";
      authMessage.classList.add("is-error");
      return;
    }
  }

  authMessage.classList.remove("is-error");
  authMessage.textContent =
    authType === "login"
      ? "로그인 API 연결 전입니다. 화면 확인용 메시지입니다."
      : "회원가입 API 연결 전입니다. 화면 확인용 메시지입니다.";
});

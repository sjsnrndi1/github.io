const authForm = document.querySelector("[data-auth-form]");
const authMessage = document.querySelector("[data-auth-message]");
const AUTH_BASE_URL = "http://localhost:8081/auth";

function setMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("is-error", isError);
}

function saveAuth(data) {
  if (!data.token || !data.user) {
    throw new Error("인증 응답 형식이 올바르지 않습니다.");
  }

  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
}

async function requestAuth(path, body) {
  const response = await fetch(`${AUTH_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "요청을 처리하지 못했습니다.");
  }

  return data;
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

      const data = await requestAuth("/signup", {
        name: formData.get("name"),
        email: formData.get("email"),
        password,
      });

      saveAuth(data);
      setMessage("회원가입이 완료되었습니다.");
      window.location.href = "/github.io/user/login.html";
    } catch (error) {
      console.error(error);
      setMessage(error.message || "회원가입 중 오류가 발생했습니다.", true);
    }

    return;
  }

  try {
    setMessage("로그인 중입니다.");

    const data = await requestAuth("/login", {
      email: formData.get("email"),
      password: formData.get("password"),
    });

    saveAuth(data);
    setMessage("로그인되었습니다.");
    window.location.href = "/github.io/index.html";
  } catch (error) {
    console.error(error);
    setMessage(error.message || "로그인 중 오류가 발생했습니다.", true);
  }
});

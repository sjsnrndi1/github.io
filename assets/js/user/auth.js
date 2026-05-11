const authForm = document.querySelector("[data-auth-form]");
const authMessage = document.querySelector("[data-auth-message]");
const resendButton = document.querySelector("[data-resend-email]");
const resendTimer = document.querySelector("[data-resend-timer]");
const SUPABASE_URL = "https://nrlkhbgeynmiqesglhgt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xoEN2afiedAx0kZBd2022w_KFeCqecX";
const RESEND_WAIT_SECONDS = 300;

let resendIntervalId = null;

function setMessage(message, isError = false) {
  if (!authMessage) return;

  authMessage.textContent = message;
  authMessage.classList.toggle("is-error", isError);
}

function translateSupabaseMessage(error, fallbackMessage) {
  const rawMessage = String(error?.message || error || "").trim();
  const lowerMessage = rawMessage.toLowerCase();

  if (!rawMessage) return fallbackMessage;

  const messageMap = [
    {
      test: () => lowerMessage.includes("invalid login credentials"),
      message: "이메일 또는 비밀번호가 올바르지 않습니다.",
    },
    {
      test: () => lowerMessage.includes("email not confirmed") || lowerMessage.includes("email_not_confirmed"),
      message: "이메일 인증이 아직 완료되지 않았습니다. 메일함에서 인증을 먼저 진행해주세요.",
    },
    {
      test: () => lowerMessage.includes("user already registered") || lowerMessage.includes("already registered"),
      message: "이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해주세요.",
    },
    {
      test: () => lowerMessage.includes("password") && lowerMessage.includes("characters"),
      message: "비밀번호는 안내된 조건에 맞게 입력해주세요.",
    },
    {
      test: () =>
        lowerMessage.includes("unable to validate email") ||
        lowerMessage.includes("invalid email") ||
        lowerMessage.includes("email address is invalid"),
      message: "이메일 형식이 올바르지 않습니다.",
    },
    {
      test: () =>
        lowerMessage.includes("rate limit") ||
        lowerMessage.includes("too many") ||
        lowerMessage.includes("only request this after"),
      message: "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.",
    },
    {
      test: () =>
        lowerMessage.includes("token has expired") ||
        lowerMessage.includes("expired") ||
        lowerMessage.includes("invalid token"),
      message: "인증 링크가 만료되었거나 올바르지 않습니다. 인증 메일을 다시 요청해주세요.",
    },
    {
      test: () => lowerMessage.includes("auth session missing") || lowerMessage.includes("session"),
      message: "로그인 세션을 확인할 수 없습니다. 다시 로그인해주세요.",
    },
    {
      test: () => lowerMessage.includes("user not found"),
      message: "가입 정보를 찾을 수 없습니다.",
    },
    {
      test: () => lowerMessage.includes("failed to fetch") || lowerMessage.includes("network"),
      message: "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
    },
    {
      test: () => lowerMessage.includes("database error"),
      message: "회원 정보를 저장하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
    },
  ];

  const matchedMessage = messageMap.find((item) => item.test());
  return matchedMessage ? matchedMessage.message : fallbackMessage;
}

function getSupabaseClient() {
  if (!window.supabase) {
    throw new Error("Supabase 클라이언트를 불러오지 못했습니다.");
  }

  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isStrongPassword(password) {
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  return password.length >= 8 && hasLetter && hasNumber && hasSpecial;
}

function validateSignupForm(formData) {
  const name = normalizeText(formData.get("name"));
  const email = normalizeText(formData.get("email")).toLowerCase();
  const password = String(formData.get("password") || "");
  const passwordConfirm = String(formData.get("passwordConfirm") || "");

  if (!name) {
    throw new Error("이름은 공백 없이 입력해주세요.");
  }

  if (!email) {
    throw new Error("이메일을 입력해주세요.");
  }

  if (!isStrongPassword(password)) {
    throw new Error("비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.");
  }

  if (password !== passwordConfirm) {
    throw new Error("비밀번호가 서로 일치하지 않습니다.");
  }

  return { name, email, password };
}

function saveSupabaseAuth(data) {
  const token = data.session?.access_token;
  const refreshToken = data.session?.refresh_token;
  const user = data.user;

  if (!token || !user) {
    throw new Error("인증 응답 형식이 올바르지 않습니다.");
  }

  localStorage.setItem("token", token);
  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
  }
  localStorage.setItem("user", JSON.stringify(user));
}

async function signUpWithSupabase({ name, email, password }) {
  const supabaseClient = getSupabaseClient();

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

async function signInWithSupabase(formData) {
  const supabaseClient = getSupabaseClient();
  const email = normalizeText(formData.get("email")).toLowerCase();
  const password = String(formData.get("password") || "");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

async function resendVerificationEmail(email) {
  const supabaseClient = getSupabaseClient();

  const { error } = await supabaseClient.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    throw error;
  }
}

function formatTime(seconds) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainSeconds = String(seconds % 60).padStart(2, "0");

  return `${minutes}:${remainSeconds}`;
}

function startResendTimer() {
  if (!resendButton || !resendTimer) return;

  let remainingSeconds = RESEND_WAIT_SECONDS;

  window.clearInterval(resendIntervalId);
  resendButton.disabled = true;
  resendTimer.textContent = formatTime(remainingSeconds);

  resendIntervalId = window.setInterval(() => {
    remainingSeconds -= 1;
    resendTimer.textContent = formatTime(Math.max(remainingSeconds, 0));

    if (remainingSeconds <= 0) {
      window.clearInterval(resendIntervalId);
      resendButton.disabled = false;
    }
  }, 1000);
}

function getPendingVerifyEmail() {
  const params = new URLSearchParams(window.location.search);
  return normalizeText(params.get("email") || localStorage.getItem("pendingVerifyEmail")).toLowerCase();
}

function getLoginRedirectUrl() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");

  if (!redirect) return "../../index.html";

  try {
    const url = new URL(redirect, window.location.origin);
    if (url.origin !== window.location.origin) return "../../index.html";

    return `${url.pathname}${url.search}${url.hash}`;
  } catch (error) {
    console.error(error);
    return "../../index.html";
  }
}

if (resendButton) {
  const pendingEmail = getPendingVerifyEmail();
  startResendTimer();

  resendButton.addEventListener("click", async () => {
    if (!pendingEmail) {
      setMessage("재전송할 이메일 정보가 없습니다. 회원가입을 다시 진행해주세요.", true);
      return;
    }

    try {
      resendButton.disabled = true;
      setMessage("인증 메일을 다시 보내고 있습니다.");

      await resendVerificationEmail(pendingEmail);

      setMessage("인증 메일을 다시 보냈습니다.");
      startResendTimer();
    } catch (error) {
      console.error(error);
      setMessage(translateSupabaseMessage(error, "인증 메일 재전송 중 오류가 발생했습니다."), true);
      resendButton.disabled = false;
    }
  });
}

if (authForm) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const authType = authForm.dataset.authType;
    const formData = new FormData(authForm);

    if (authType === "signup") {
      try {
        const signupData = validateSignupForm(formData);

        setMessage("회원가입을 등록하고 있습니다.");

        const data = await signUpWithSupabase(signupData);

        if (data.session) {
          localStorage.removeItem("pendingVerifyEmail");
          setMessage("회원가입이 완료되었습니다. 로그인 화면으로 이동합니다.");
          window.setTimeout(() => {
            window.location.href = "login.html";
          }, 800);
          return;
        }

        localStorage.setItem("pendingVerifyEmail", signupData.email);
        setMessage("이메일 인증이 필요합니다. 인증 안내 화면으로 이동합니다.");
        window.setTimeout(() => {
          window.location.href = `verify-email.html?email=${encodeURIComponent(signupData.email)}`;
        }, 800);
      } catch (error) {
        console.error(error);
        setMessage(translateSupabaseMessage(error, "회원가입 중 오류가 발생했습니다."), true);
      }

      return;
    }

    try {
      setMessage("로그인 중입니다.");

      const data = await signInWithSupabase(formData);

      saveSupabaseAuth(data);
      setMessage("로그인되었습니다.");
      window.location.href = getLoginRedirectUrl();
    } catch (error) {
      console.error(error);
      setMessage(translateSupabaseMessage(error, "로그인 중 오류가 발생했습니다."), true);
    }
  });
}

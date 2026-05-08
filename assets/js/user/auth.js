const authForm = document.querySelector("[data-auth-form]");
const authMessage = document.querySelector("[data-auth-message]");
const resendButton = document.querySelector("[data-resend-email]");
const resendTimer = document.querySelector("[data-resend-timer]");
const SUPABASE_URL = "https://nrlkhbgeynmiqesglhgt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xoEN2afiedAx0kZBd2022w_KFeCqecX";
const RESEND_WAIT_SECONDS = 120;

let resendIntervalId = null;

function setMessage(message, isError = false) {
  if (!authMessage) return;

  authMessage.textContent = message;
  authMessage.classList.toggle("is-error", isError);
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
    throw new Error("이름을 공백 없이 입력해주세요.");
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
  const user = data.user;

  if (!token || !user) {
    throw new Error("인증 응답 형식이 올바르지 않습니다.");
  }

  localStorage.setItem("token", token);
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
      setMessage(error.message || "인증 메일 재전송 중 오류가 발생했습니다.", true);
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

        setMessage("Supabase에 회원가입을 등록하고 있습니다.");

        const data = await signUpWithSupabase(signupData);

        if (data.session) {
          saveSupabaseAuth(data);
        }

        localStorage.setItem("pendingVerifyEmail", signupData.email);
        setMessage("회원가입이 완료되었습니다. 이메일 인증 안내 화면으로 이동합니다.");
        window.setTimeout(() => {
          window.location.href = `verify-email.html?email=${encodeURIComponent(signupData.email)}`;
        }, 800);
      } catch (error) {
        console.error(error);
        setMessage(error.message || "회원가입 중 오류가 발생했습니다.", true);
      }

      return;
    }

    try {
      setMessage("로그인 중입니다.");

      const data = await signInWithSupabase(formData);

      saveSupabaseAuth(data);
      setMessage("로그인되었습니다.");
      window.location.href = "../../index.html";
    } catch (error) {
      console.error(error);
      setMessage(error.message || "로그인 중 오류가 발생했습니다.", true);
    }
  });
}

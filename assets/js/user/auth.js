const authForm = document.querySelector("[data-auth-form]");
const authMessage = document.querySelector("[data-auth-message]");
const emailCheckButton = document.querySelector("[data-email-check]");
const SUPABASE_URL = "https://nrlkhbgeynmiqesglhgt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xoEN2afiedAx0kZBd2022w_KFeCqecX";

let checkedEmail = "";
let isEmailAvailable = false;

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

  if (!isEmailAvailable || checkedEmail !== email) {
    throw new Error("이메일 중복 확인을 먼저 완료해주세요.");
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

async function checkEmailDuplicate(email) {
  const supabaseClient = getSupabaseClient();

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
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

if (emailCheckButton) {
  emailCheckButton.addEventListener("click", async () => {
    const emailInput = authForm?.querySelector('input[name="email"]');
    const email = normalizeText(emailInput?.value).toLowerCase();

    isEmailAvailable = false;
    checkedEmail = "";

    if (!emailInput?.checkValidity()) {
      setMessage("올바른 이메일을 입력한 뒤 중복 확인을 눌러주세요.", true);
      emailInput?.reportValidity();
      return;
    }

    try {
      emailCheckButton.disabled = true;
      setMessage("이메일 중복 여부를 확인하고 있습니다.");

      const isDuplicate = await checkEmailDuplicate(email);

      if (isDuplicate) {
        setMessage("이미 사용 중인 이메일입니다.", true);
        return;
      }

      checkedEmail = email;
      isEmailAvailable = true;
      setMessage("사용 가능한 이메일입니다.");
    } catch (error) {
      console.error(error);
      setMessage("이메일 중복 확인을 사용할 수 없습니다. Supabase profiles 테이블 권한을 확인해주세요.", true);
    } finally {
      emailCheckButton.disabled = false;
    }
  });
}

if (authForm) {
  authForm.addEventListener("input", (event) => {
    if (event.target?.name === "email") {
      isEmailAvailable = false;
      checkedEmail = "";
    }
  });

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

        setMessage("회원가입이 완료되었습니다. 로그인 화면으로 이동합니다.");
        window.setTimeout(() => {
          window.location.href = "login.html";
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

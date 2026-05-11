// Common layout

const isFrontPage = window.location.pathname.includes("/front/");
const componentBase = isFrontPage ? "../" : "";
const APP_SUPABASE_URL = "https://nrlkhbgeynmiqesglhgt.supabase.co";
const APP_SUPABASE_ANON_KEY = "sb_publishable_xoEN2afiedAx0kZBd2022w_KFeCqecX";
const SUPABASE_SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

document.addEventListener("DOMContentLoaded", () => {
  renderAuthCallbackResult();
  loadHeader();
  loadFooter();
  initMyPage();
  initLearnedPages();
});

function translateSupabaseMessage(message, fallbackMessage) {
  const rawMessage = String(message || "").trim();
  const lowerMessage = rawMessage.toLowerCase();

  if (!rawMessage) return fallbackMessage;

  const messageMap = [
    {
      test: () => lowerMessage.includes("invalid login credentials"),
      message: "이메일 또는 비밀번호가 올바르지 않습니다.",
    },
    {
      test: () =>
        lowerMessage.includes("email not confirmed") ||
        lowerMessage.includes("email_not_confirmed"),
      message:
        "이메일 인증이 아직 완료되지 않았습니다. 메일함에서 인증을 먼저 진행해주세요.",
    },
    {
      test: () => lowerMessage.includes("already registered"),
      message:
        "이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해주세요.",
    },
    {
      test: () =>
        lowerMessage.includes("unable to validate email") ||
        lowerMessage.includes("invalid email"),
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
      message:
        "인증 링크가 만료되었거나 올바르지 않습니다. 인증 메일을 다시 요청해주세요.",
    },
    {
      test: () => lowerMessage.includes("access_denied"),
      message: "인증 요청이 거부되었습니다. 다시 시도해주세요.",
    },
    {
      test: () =>
        lowerMessage.includes("failed to fetch") ||
        lowerMessage.includes("network"),
      message: "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
    },
  ];

  const matchedMessage = messageMap.find((item) => item.test());
  return matchedMessage ? matchedMessage.message : fallbackMessage;
}

function renderAuthCallbackResult() {
  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, ""),
  );
  const isSignupCallback = hashParams.get("type") === "signup";
  const hasAccessToken = hashParams.has("access_token");
  const error = hashParams.get("error");
  const errorDescription = hashParams.get("error_description");

  if (!isSignupCallback && !hasAccessToken && !error) return;

  const main = document.querySelector("main");
  if (!main) return;

  if (error) {
    main.innerHTML = createAuthResultMarkup({
      isSuccess: false,
      title: "이메일 인증에 실패했습니다.",
      description: translateSupabaseMessage(
        decodeURIComponent(errorDescription || error),
        "인증 링크가 만료되었거나 올바르지 않습니다. 다시 시도해주세요.",
      ),
    });
  } else {
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken) {
      localStorage.setItem("token", accessToken);
    }

    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }

    main.innerHTML = createAuthResultMarkup({
      isSuccess: true,
      title: "이메일 인증이 완료되었습니다.",
      description: "이제 로그인해서 연습장을 사용할 수 있습니다.",
    });
  }

  window.history.replaceState(null, document.title, window.location.pathname);
}

function createAuthResultMarkup({ isSuccess, title, description }) {
  return `
    <section class="auth-result-shell" aria-label="${title}">
      <div class="auth-result-card ${isSuccess ? "is-success" : "is-error"}">
        <p class="eyebrow">${isSuccess ? "Verified" : "Verification Failed"}</p>
        <h1>${title}</h1>
        <p>${description}</p>
        <a class="member-submit auth-result-button" href="front/login/login.html">로그인</a>
      </div>
    </section>
  `;
}

async function loadHeader() {
  const headerRoot = document.getElementById("header");
  if (!headerRoot) return;

  const response = await fetch(`${componentBase}header.html`);
  const html = await response.text();

  headerRoot.innerHTML = html;
  applyHeaderLinks(headerRoot);
  renderHeaderAuth(headerRoot);
  initMenu();
}

async function loadFooter() {
  const footerRoot = document.getElementById("footer");
  if (!footerRoot) return;

  const response = await fetch(`${componentBase}footer.html`);
  const html = await response.text();

  footerRoot.innerHTML = html;
}

function applyHeaderLinks(headerRoot) {
  headerRoot.querySelectorAll("[data-path]").forEach((link) => {
    link.href = `${componentBase}${link.dataset.path}`;
    const linkUrl = new URL(link.href, window.location.href);
    const isSamePage =
      linkUrl.pathname === window.location.pathname &&
      linkUrl.hash === window.location.hash;

    if (isSamePage) {
      link.classList.add("is-current");
    }
  });
}

function getStoredUser() {
  const rawUser = localStorage.getItem("user");
  const token = localStorage.getItem("token");

  if (!rawUser || !token) return null;

  try {
    return JSON.parse(rawUser);
  } catch (error) {
    console.error(error);
    localStorage.removeItem("user");
    return null;
  }
}

function getUserDisplayName(user) {
  const metadataName = user?.user_metadata?.name;
  const email = user?.email;

  if (metadataName) return metadataName;
  if (email) return email.split("@")[0];
  return "연습장";
}

function getUserAvatarUrl(user) {
  return user?.user_metadata?.avatar_url || "";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadSupabaseSdk() {
  if (window.supabase) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[src="${SUPABASE_SDK_URL}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SUPABASE_SDK_URL;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function signOutSupabaseSession() {
  await loadSupabaseSdk();

  const supabaseClient = window.supabase.createClient(
    APP_SUPABASE_URL,
    APP_SUPABASE_ANON_KEY,
  );
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    throw error;
  }
}

async function getAuthedSupabaseClient() {
  await loadSupabaseSdk();

  const supabaseClient = window.supabase.createClient(
    APP_SUPABASE_URL,
    APP_SUPABASE_ANON_KEY,
  );
  const accessToken = localStorage.getItem("token");
  const refreshToken = localStorage.getItem("refreshToken");

  if (accessToken && refreshToken) {
    const { data, error } = await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      clearStoredAuth();
      throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
    }

    if (data.session?.access_token) {
      localStorage.setItem("token", data.session.access_token);
    }

    if (data.session?.refresh_token) {
      localStorage.setItem("refreshToken", data.session.refresh_token);
    }
  }

  return supabaseClient;
}

function clearStoredAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("pendingVerifyEmail");
}

function renderHeaderAuth(headerRoot) {
  const authActions = headerRoot.querySelector(".auth-actions");
  if (!authActions) return;

  const user = getStoredUser();

  if (!user) {
    authActions.innerHTML = `
      <a data-path="front/login/login.html" href="${componentBase}front/login/login.html" class="auth-link auth-login">로그인</a>
      <a data-path="front/login/signup.html" href="${componentBase}front/login/signup.html" class="auth-link auth-join">가입</a>
    `;
    return;
  }

  const displayName = getUserDisplayName(user);
  const safeDisplayName = escapeHtml(displayName);

  authActions.innerHTML = `
    <a class="user-summary" href="${componentBase}front/mypage.html" aria-label="마이페이지로 이동">
      <span class="user-avatar ${getUserAvatarUrl(user) ? "has-image" : ""}" aria-hidden="true">${createAvatarContent(user, displayName)}</span>
      <span class="user-name">${safeDisplayName}</span>
    </a>
    <button type="button" class="auth-link logout-button" data-logout>로그아웃</button>
  `;

  const logoutButton = authActions.querySelector("[data-logout]");
  logoutButton?.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "로그아웃 중";

    try {
      await signOutSupabaseSession();
    } catch (error) {
      console.error(error);
    } finally {
      clearStoredAuth();
    }

    window.location.href = `${componentBase}index.html`;
  });
}

function isStrongPassword(password) {
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  return password.length >= 8 && hasLetter && hasNumber && hasSpecial;
}

function setPageMessage(element, message, isError = false) {
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function updateStoredUser(user) {
  if (!user) return;

  localStorage.setItem("user", JSON.stringify(user));
}

function createAvatarContent(user, fallbackName) {
  const avatarUrl = getUserAvatarUrl(user);
  const initial = escapeHtml(String(fallbackName || "연").slice(0, 1));

  if (avatarUrl) {
    return `<img src="${escapeHtml(avatarUrl)}" alt="" />`;
  }

  return initial;
}

function renderAvatarElement(element, user, fallbackName) {
  if (!element) return;

  element.innerHTML = createAvatarContent(user, fallbackName);
  element.classList.toggle("has-image", Boolean(getUserAvatarUrl(user)));
}

function renderMyPageProfile(user) {
  const displayName = getUserDisplayName(user);
  const nameText = document.querySelector("[data-mypage-name]");
  const emailText = document.querySelector("[data-mypage-email]");
  const avatar = document.querySelector("[data-mypage-avatar]");
  const preview = document.querySelector("[data-profile-preview]");
  const nameInput = document.getElementById("profile-name");

  if (nameText) nameText.textContent = displayName;
  if (emailText)
    emailText.textContent = user?.email || "이메일 정보가 없습니다.";
  renderAvatarElement(avatar, user, displayName);
  renderAvatarElement(preview, user, displayName);
  if (nameInput) nameInput.value = user?.user_metadata?.name || "";
}

function resizeProfileImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("이미지 파일만 등록할 수 있습니다."));
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      reject(new Error("프로필 이미지는 3MB 이하로 등록해주세요."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const size = 240;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        const cropSize = Math.min(image.width, image.height);
        const cropX = (image.width - cropSize) / 2;
        const cropY = (image.height - cropSize) / 2;

        canvas.width = size;
        canvas.height = size;
        context.drawImage(
          image,
          cropX,
          cropY,
          cropSize,
          cropSize,
          0,
          0,
          size,
          size,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };

      image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      image.src = reader.result;
    };

    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

async function initMyPage() {
  const profileForm = document.querySelector("[data-profile-form]");
  const withdrawButton = document.querySelector("[data-withdraw-button]");
  const storedUser = getStoredUser();

  if (!profileForm && !withdrawButton) return;

  if (!storedUser) {
    window.location.href = `${componentBase}front/login/login.html`;
    return;
  }

  renderMyPageProfile(storedUser);

  const profileImageInput = document.getElementById("profile-image");
  profileImageInput?.addEventListener("change", async () => {
    const message = document.querySelector("[data-profile-message]");
    const file = profileImageInput.files?.[0];
    const preview = document.querySelector("[data-profile-preview]");

    if (!file) return;

    try {
      const previewUrl = await resizeProfileImage(file);
      if (preview) {
        preview.innerHTML = `<img src="${previewUrl}" alt="" />`;
        preview.classList.add("has-image");
      }
      setPageMessage(message, "");
    } catch (error) {
      console.error(error);
      profileImageInput.value = "";
      setPageMessage(
        message,
        error.message || "프로필 이미지를 확인해주세요.",
        true,
      );
    }
  });

  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.querySelector("[data-profile-message]");
    const formData = new FormData(profileForm);
    const name = String(formData.get("name") || "").trim();
    const password = String(formData.get("password") || "");
    const avatarFile = formData.get("avatar");
    const currentUser = getStoredUser() || storedUser;
    const updatePayload = {
      data: {
        ...(currentUser?.user_metadata || {}),
        name,
      },
    };

    if (!name) {
      setPageMessage(message, "이름은 공백 없이 입력해주세요.", true);
      return;
    }

    if (password) {
      if (!isStrongPassword(password)) {
        setPageMessage(
          message,
          "비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.",
          true,
        );
        return;
      }

      updatePayload.password = password;
    }

    try {
      setPageMessage(message, "회원정보를 수정하고 있습니다.");

      if (avatarFile?.size) {
        updatePayload.data.avatar_url = await resizeProfileImage(avatarFile);
      }

      const supabaseClient = await getAuthedSupabaseClient();
      const { data, error } =
        await supabaseClient.auth.updateUser(updatePayload);

      if (error) {
        throw error;
      }

      updateStoredUser(data.user);
      renderMyPageProfile(data.user);
      profileForm.reset();
      document.getElementById("profile-name").value = name;
      setPageMessage(message, "회원정보가 수정되었습니다.");
      loadHeader();
    } catch (error) {
      console.error(error);
      setPageMessage(
        message,
        translateSupabaseMessage(
          error?.message || error,
          "회원정보 수정 중 오류가 발생했습니다.",
        ),
        true,
      );
    }
  });

  withdrawButton?.addEventListener("click", async () => {
    const message = document.querySelector("[data-withdraw-message]");
    const confirmInput = document.querySelector("[data-withdraw-confirm]");

    if (!confirmInput?.checked) {
      setPageMessage(message, "회원탈퇴 안내를 먼저 확인해주세요.", true);
      return;
    }

    try {
      withdrawButton.disabled = true;
      setPageMessage(message, "회원탈퇴를 요청하고 있습니다.");

      const supabaseClient = await getAuthedSupabaseClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabaseClient.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = session?.access_token || "";

      if (!accessToken) {
        throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
      }

      if (session?.access_token) {
        localStorage.setItem("token", session.access_token);
      }

      if (session?.refresh_token) {
        localStorage.setItem("refreshToken", session.refresh_token);
      }

      const response = await fetch(
        `${APP_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: "POST",
          headers: {
            apikey: APP_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accessToken }),
        },
      );
      const responseText = await response.text();
      let result = {};
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (error) {
        console.error("delete-user response is not JSON:", responseText);
      }

      if (!response.ok) {
        throw new Error(
          result.message ||
            result.error ||
            "회원탈퇴 처리 중 오류가 발생했습니다.",
        );
      }

      clearStoredAuth();
      setPageMessage(
        message,
        "회원탈퇴가 완료되었습니다. 메인 화면으로 이동합니다.",
      );
      window.setTimeout(() => {
        window.location.href = `${componentBase}index.html`;
      }, 900);
    } catch (error) {
      console.error(error);
      withdrawButton.disabled = false;
      const isFetchFailed = String(error?.message || "")
        .toLowerCase()
        .includes("failed to fetch");
      if (isFetchFailed) {
        console.warn(
          "delete-user Edge Function request failed. Check function deployment, verify_jwt=false, and CORS preflight settings.",
        );
      }
      setPageMessage(
        message,
        isFetchFailed
          ? "회원탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해주세요."
          : error.message ||
              "회원탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        true,
      );
    }
  });
}

function initMenu() {
  const menuToggle = document.getElementById("menu-toggle");
  const navLinks = document.getElementById("nav-links");
  if (!menuToggle || !navLinks) return;

  menuToggle.addEventListener("click", () => {
    const isActive = navLinks.classList.toggle("active");
    menuToggle.setAttribute("aria-expanded", String(isActive));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// Learned posts page

const LEARNED_POSTS = [
  {
    id: "supabase-edge-cors",
    title: "Supabase Edge Function에서 CORS가 막힐 때",
    summary:
      "브라우저의 CORS 오류가 항상 프론트 문제는 아니라는 점을 정리했습니다.",
    tags: ["Supabase", "CORS", "Edge Function"],
    date: "2026-05-11",
    detail: [
      "회원탈퇴 기능을 만들면서 OPTIONS 요청, CORS 헤더, JWT verification 설정이 서로 어떻게 영향을 주는지 확인했습니다.",
      "특히 브라우저 콘솔에는 CORS처럼 보이지만 실제로는 함수 실행 전 게이트웨이 단계에서 막히는 경우가 있었습니다. 그래서 preflight 응답과 실제 POST 응답을 따로 확인하는 습관이 중요했습니다.",
      "이번 기록의 결론은 간단합니다. 함수가 직접 인증 로직을 처리한다면 CORS 응답은 모든 경로에서 붙이고, 요청 방식도 게이트웨이와 충돌하지 않게 최대한 단순하게 가져가는 편이 좋습니다.",
    ],
  },
  {
    id: "localstorage-session",
    title: "localStorage에 저장한 세션을 너무 믿지 않기",
    summary:
      "저장된 토큰이 남아 있어도 실제 세션은 만료될 수 있다는 점을 배웠습니다.",
    tags: ["Auth", "localStorage", "Session"],
    date: "2026-05-10",
    detail: [
      "로그인 상태를 화면에 표시하려고 localStorage를 사용했지만, 저장된 값이 있다는 사실과 현재 세션이 유효하다는 사실은 다릅니다.",
      "세션을 사용하는 기능에서는 SDK로 현재 세션을 다시 확인하고, 갱신 실패 시 저장된 인증 정보를 지우는 흐름이 더 안전했습니다.",
      "사용자에게는 복잡한 원인을 보여주기보다 다시 로그인하면 해결되는 상태인지 명확하게 안내하는 것이 좋았습니다.",
    ],
  },
  {
    id: "favicon-small-detail",
    title: "favicon도 사용자 경험의 일부",
    summary:
      "작은 아이콘 하나가 콘솔의 404와 브라우저 탭의 빈 느낌을 같이 줄여줬습니다.",
    tags: ["HTML", "Favicon", "UX"],
    date: "2026-05-09",
    detail: [
      "사이트에 favicon이 없으면 기능에는 문제가 없지만 브라우저는 기본적으로 /favicon.ico를 요청하고 404를 남깁니다.",
      "헤더 로고와 같은 시각 언어를 favicon으로 옮기면 작은 탭에서도 프로젝트의 정체성이 이어집니다.",
      "SVG favicon을 연결하고, 오래된 브라우저나 기본 요청을 위해 ico 파일도 함께 두는 방식으로 정리했습니다.",
    ],
  },
  {
    id: "html-structure",
    title: "목록과 상세는 역할을 나누면 편하다",
    summary:
      "게시글 목록은 훑기 좋게, 상세는 읽고 반응하기 좋게 나누는 게 자연스러웠습니다.",
    tags: ["HTML", "UI", "게시글"],
    date: "2026-05-08",
    detail: [
      "목록에서는 제목, 요약, 해시태그만 보여줘도 사용자가 읽을 글을 고르는 데 충분했습니다.",
      "상세 화면에서는 같은 정보에 본문과 댓글을 더해 맥락과 반응이 이어지게 만들었습니다.",
      "처음부터 복잡한 게시판보다 필요한 화면 단위부터 작게 만드는 방식이 구현과 유지보수 모두 편했습니다.",
    ],
  },
  {
    id: "css-paper-tone",
    title: "연습장 분위기를 만드는 CSS",
    summary:
      "선, 종이색, 작은 그림자만으로도 기록장 같은 느낌을 만들 수 있었습니다.",
    tags: ["CSS", "Design", "연습장"],
    date: "2026-05-07",
    detail: [
      "프로젝트의 시각 분위기는 강한 장식보다 종이색 배경, 얇은 선, 손글씨 느낌의 문장으로 만들어졌습니다.",
      "카드는 둥글게 과장하지 않고 8px 정도로 유지하니 기존 화면과 자연스럽게 이어졌습니다.",
      "해시태그와 버튼 색은 초록과 흙빛 계열을 섞어 단조롭지 않게 조정했습니다.",
    ],
  },
  {
    id: "comments-local-first",
    title: "댓글 기능을 localStorage로 먼저 만들기",
    summary:
      "백엔드 없이도 댓글 작성과 좋아요 흐름을 화면에서 먼저 검증할 수 있었습니다.",
    tags: ["JavaScript", "댓글", "localStorage"],
    date: "2026-05-06",
    detail: [
      "댓글 기능은 서버와 연결되기 전에 localStorage로 먼저 화면 흐름을 만들 수 있습니다.",
      "이름과 내용을 저장하고, 댓글별 좋아요 수를 올리는 정도라면 브라우저 저장소만으로도 충분히 동작을 확인할 수 있습니다.",
      "나중에 API가 붙으면 저장하고 불러오는 함수만 교체하면 되도록 렌더링과 저장 로직을 분리하는 편이 좋습니다.",
    ],
  },
  {
    id: "small-copy",
    title: "문구는 기능의 분위기를 정한다",
    summary:
      "딱딱한 설명보다 '가볍게 남겨둔다'는 말이 화면의 온도를 맞춰줬습니다.",
    tags: ["Writing", "UX Writing", "Tone"],
    date: "2026-05-05",
    detail: [
      "개인 기록 공간에서는 거창한 설명보다 사용자가 부담 없이 쓰고 읽을 수 있는 문장이 어울렸습니다.",
      "배운 것들을 완성된 지식처럼 보여주기보다, 새롭게 알게 된 것을 가볍게 남겨둔다는 방향이 프로젝트 이름과도 잘 맞았습니다.",
      "화면 문구는 기능 설명을 넘어서 사용자의 행동을 편하게 만드는 역할을 한다는 점을 다시 느꼈습니다.",
    ],
  },
];

const LEARNED_PAGE_SIZE = 4;
const LEARNED_COMMENT_KEY = "learnedPostComments";

function getLearnedPostById(id) {
  return LEARNED_POSTS.find((post) => post.id === id) || null;
}

function getLearnedComments() {
  try {
    return JSON.parse(localStorage.getItem(LEARNED_COMMENT_KEY) || "{}");
  } catch (error) {
    console.error(error);
    return {};
  }
}

function saveLearnedComments(comments) {
  localStorage.setItem(LEARNED_COMMENT_KEY, JSON.stringify(comments));
}

function formatLearnedDate(date) {
  return String(date || "").replaceAll("-", ".");
}

function createTagMarkup(tags) {
  return tags
    .map((tag) => `<span class="learned-tag">#${escapeHtml(tag)}</span>`)
    .join("");
}

function initLearnedPages() {
  renderLearnedListPage();
  renderLearnedDetailPage();
}

function renderLearnedListPage() {
  const list = document.querySelector("[data-learned-list]");
  if (!list) return;

  const count = document.querySelector("[data-learned-count]");
  const pagination = document.querySelector("[data-learned-pagination]");
  const params = new URLSearchParams(window.location.search);
  const totalPages = Math.ceil(LEARNED_POSTS.length / LEARNED_PAGE_SIZE);
  const requestedPage = Number(params.get("page") || "1");
  const currentPage = Math.min(Math.max(requestedPage || 1, 1), totalPages);
  const pageStart = (currentPage - 1) * LEARNED_PAGE_SIZE;
  const posts = LEARNED_POSTS.slice(pageStart, pageStart + LEARNED_PAGE_SIZE);

  if (count) {
    count.textContent = `총 ${LEARNED_POSTS.length}개의 기록`;
  }

  list.innerHTML = posts
    .map(
      (post) => `
        <article class="learned-card">
          <div class="learned-card-main">
            <time datetime="${post.date}">${formatLearnedDate(post.date)}</time>
            <h2>
              <a href="learned-detail.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a>
            </h2>
            <p>${escapeHtml(post.summary)}</p>
          </div>
          <div class="learned-tags">${createTagMarkup(post.tags)}</div>
        </article>
      `,
    )
    .join("");

  if (!pagination) return;

  pagination.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const isCurrent = page === currentPage;
    return `
      <a href="learned.html?page=${page}" class="${isCurrent ? "is-current" : ""}" aria-label="${page}페이지"${isCurrent ? ' aria-current="page"' : ""}>
        ${page}
      </a>
    `;
  }).join("");
}

function renderLearnedDetailPage() {
  const detail = document.querySelector("[data-learned-detail]");
  if (!detail) return;

  const params = new URLSearchParams(window.location.search);
  const post = getLearnedPostById(params.get("id")) || LEARNED_POSTS[0];

  document.title = `${post.title} | 연습장`;
  detail.innerHTML = `
    <nav class="detail-back" aria-label="이전 화면">
      <a href="learned.html">배운 것들 목록</a>
    </nav>
    <header class="learned-detail-head">
      <time datetime="${post.date}">${formatLearnedDate(post.date)}</time>
      <h1>${escapeHtml(post.title)}</h1>
      <p>${escapeHtml(post.summary)}</p>
      <div class="learned-tags">${createTagMarkup(post.tags)}</div>
    </header>
    <div class="learned-detail-body">
      ${post.detail.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    </div>
  `;

  initCommentPanel(post.id);
}

function initCommentPanel(postId) {
  const form = document.querySelector("[data-comment-form]");
  const list = document.querySelector("[data-comment-list]");
  if (!form || !list) return;

  renderComments(postId);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const message = document.querySelector("[data-comment-message]");
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const content = String(formData.get("content") || "").trim();

    if (!name || !content) {
      setPageMessage(message, "이름과 댓글을 모두 입력해주세요.", true);
      return;
    }

    const comments = getLearnedComments();
    const postComments = comments[postId] || [];
    postComments.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      content,
      likes: 0,
      createdAt: new Date().toISOString(),
    });
    comments[postId] = postComments;
    saveLearnedComments(comments);
    form.reset();
    setPageMessage(message, "댓글이 남겨졌습니다.");
    renderComments(postId);
  });
}

function renderComments(postId) {
  const list = document.querySelector("[data-comment-list]");
  const count = document.querySelector("[data-comment-count]");
  if (!list) return;

  const comments = getLearnedComments();
  const postComments = comments[postId] || [];

  if (count) {
    count.textContent = `${postComments.length}개`;
  }

  if (postComments.length === 0) {
    list.innerHTML = `<p class="comment-empty">아직 댓글이 없습니다. 첫 생각을 남겨주세요.</p>`;
    return;
  }

  list.innerHTML = postComments
    .map(
      (comment) => `
        <article class="comment-item">
          <div>
            <strong>${escapeHtml(comment.name)}</strong>
            <time datetime="${comment.createdAt}">${formatLearnedDate(comment.createdAt.slice(0, 10))}</time>
          </div>
          <p>${escapeHtml(comment.content)}</p>
          <button type="button" class="comment-like" data-comment-like="${escapeHtml(comment.id)}">
            좋아요 <span>${comment.likes}</span>
          </button>
        </article>
      `,
    )
    .join("");

  list.querySelectorAll("[data-comment-like]").forEach((button) => {
    button.addEventListener("click", () => {
      const comments = getLearnedComments();
      const target = (comments[postId] || []).find(
        (comment) => comment.id === button.dataset.commentLike,
      );
      if (!target) return;

      target.likes += 1;
      saveLearnedComments(comments);
      renderComments(postId);
    });
  });
}

// Changed traces page

const supabaseUrl = "https://nrlkhbgeynmiqesglhgt.supabase.co";
const supabaseKey = "sb_publishable_xoEN2afiedAx0kZBd2022w_KFeCqecX";

document.addEventListener("DOMContentLoaded", loadChangedTraces);

async function loadChangedTraces() {
  const traceBoard = document.getElementById("traceBoard");
  if (!traceBoard) return;

  if (!window.supabase) {
    console.error("Supabase client is not loaded.");
    return;
  }

  const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabaseClient
    .from("NOTE_CHANGED_TRACES")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const groupedByYear = data.reduce((acc, item) => {
    const rawDate = String(item.date);
    const year = rawDate.slice(0, 4);

    if (!acc[year]) acc[year] = [];
    acc[year].push(item);

    return acc;
  }, {});

  traceBoard.innerHTML = Object.entries(groupedByYear)
    .map(([year, items]) => {
      return `
      <section class="timeline-year" aria-labelledby="year-${year}">
        <h2 class="year-label" id="year-${year}">${year}</h2>

        <div class="trace-list">
          ${items
            .map((item) => {
              const rawDate = String(item.date);
              const isHyphenDate = rawDate.includes("-");
              const itemYear = rawDate.slice(0, 4);
              const month = isHyphenDate
                ? rawDate.slice(5, 7)
                : rawDate.slice(4, 6);
              const day = isHyphenDate
                ? rawDate.slice(8, 10)
                : rawDate.slice(6, 8);

              return `
                <article class="trace-item">
                  <time class="trace-date" datetime="${itemYear}-${month}-${day}">
                    ${month}.${day}
                  </time>

                  <p class="trace-text">
                    ${item.content}
                  </p>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
    })
    .join("");
}

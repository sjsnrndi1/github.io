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
    await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
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
    Deno.serve(async (request) => {
      console.log("FUNCTION START");

      try {
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
          } = await supabaseClient.auth.getSession();
          const accessToken =
            session?.access_token || localStorage.getItem("token") || "";

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
                Authorization: `Bearer ${accessToken}`,
                apikey: APP_SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            },
          );
          const result = await response.json().catch(() => ({}));

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
      } catch (err) {
        console.error("FUNCTION ERROR:", err);

        return new Response(
          JSON.stringify({
            error: String(err),
            message: err?.message || "Unknown error",
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }
    });
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

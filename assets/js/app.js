// Common layout

const pathSegments = window.location.pathname.split("/").filter(Boolean);
const frontSegmentIndex = pathSegments.indexOf("front");
const componentBase =
  frontSegmentIndex === -1
    ? ""
    : "../".repeat(pathSegments.length - frontSegmentIndex - 1);
const APP_SUPABASE_URL = "https://nrlkhbgeynmiqesglhgt.supabase.co";
const APP_SUPABASE_ANON_KEY = "sb_publishable_xoEN2afiedAx0kZBd2022w_KFeCqecX";
const SUPABASE_SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

document.addEventListener("DOMContentLoaded", () => {
  renderAuthCallbackResult();
  loadHeader();
  loadFooter();
  initMyPage();
  initLearnedPages();
  initBlockedPages();
  initReviewPages();
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
        <a class="member-submit auth-result-button" href="${componentBase}front/login/login.html">로그인</a>
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
  await renderHeaderAuth(headerRoot);
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

async function getValidStoredUser() {
  const storedUser = getStoredUser();
  if (!storedUser) return null;

  try {
    const supabaseClient = await getAuthedSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw sessionError || new Error("로그인 세션이 만료되었습니다.");
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw userError || new Error("사용자 정보를 확인할 수 없습니다.");
    }

    updateStoredUser(user);
    return user;
  } catch (error) {
    console.error(error);
    clearStoredAuth();
    return null;
  }
}

function clearStoredAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("pendingVerifyEmail");
}

async function renderHeaderAuth(headerRoot) {
  const authActions = headerRoot.querySelector(".auth-actions");
  if (!authActions) return;

  const user = await getValidStoredUser();

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

  if (!profileForm && !withdrawButton) return;

  const storedUser = await getValidStoredUser();

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

const LEARNED_PAGE_SIZE = 4;
const LEARNED_COMMENT_LIKE_KEY = "learnedCommentLikes";
const BLOCKED_COMMENT_LIKE_KEY = "blockedCommentLikes";
const REVIEW_COMMENT_LIKE_KEY = "reviewCommentLikes";
const BOARD_TABLE = "BOARD";
const BOARD_HASHTAG_TABLE = "BOARD_HASHTAG";
const BOARD_REF_TABLE = "BOARD_REF";
const BOARD_DCD_LEARNED = "learned";
const BOARD_DCD_BLOCKED = "blocked";
const BOARD_DCD_REVIEW = "review";

function formatLearnedDate(date) {
  return String(date || "").replaceAll("-", ".");
}

function createTagMarkup(tags) {
  return tags
    .map((tag) => `<span class="learned-tag">#${escapeHtml(tag)}</span>`)
    .join("");
}

function normalizeLearnedPost(post, hashtags = []) {
  return {
    id: String(post.id),
    title: post.title || "제목 없는 기록",
    summary: post.summary || "",
    content: post.content || "",
    date: String(post.created_at || "").slice(0, 10),
    tags: hashtags,
  };
}

async function getPublicSupabaseClient() {
  await loadSupabaseSdk();
  return window.supabase.createClient(APP_SUPABASE_URL, APP_SUPABASE_ANON_KEY);
}

async function fetchBoardPosts(boardDcd) {
  const supabaseClient = await getPublicSupabaseClient();
  const { data: posts, error: postsError } = await supabaseClient
    .from(BOARD_TABLE)
    .select("id,title,summary,created_at")
    .eq("board_dcd", boardDcd)
    .order("created_at", { ascending: false });

  if (postsError) throw postsError;
  if (!posts?.length) return [];

  const boardIds = posts.map((post) => post.id);
  const { data: hashtags, error: hashtagsError } = await supabaseClient
    .from(BOARD_HASHTAG_TABLE)
    .select("board_id,content")
    .in("board_id", boardIds)
    .order("id", { ascending: true });

  if (hashtagsError) throw hashtagsError;

  const groupedHashtags = (hashtags || []).reduce((acc, tag) => {
    const boardId = String(tag.board_id);
    if (!acc[boardId]) acc[boardId] = [];
    if (tag.content) acc[boardId].push(tag.content);
    return acc;
  }, {});

  return posts.map((post) =>
    normalizeLearnedPost(post, groupedHashtags[String(post.id)] || []),
  );
}

async function fetchBoardPost(id, boardDcd) {
  const supabaseClient = await getPublicSupabaseClient();
  const { data: post, error: postError } = await supabaseClient
    .from(BOARD_TABLE)
    .select("id,title,summary,content,created_at")
    .eq("id", id)
    .eq("board_dcd", boardDcd)
    .single();

  if (postError) throw postError;

  const { data: hashtags, error: hashtagsError } = await supabaseClient
    .from(BOARD_HASHTAG_TABLE)
    .select("content")
    .eq("board_id", id)
    .order("id", { ascending: true });

  if (hashtagsError) throw hashtagsError;

  return normalizeLearnedPost(
    post,
    (hashtags || []).map((tag) => tag.content).filter(Boolean),
  );
}

async function fetchLearnedPosts() {
  return fetchBoardPosts(BOARD_DCD_LEARNED);
}

async function fetchLearnedPost(id) {
  return fetchBoardPost(id, BOARD_DCD_LEARNED);
}

async function fetchBlockedPosts() {
  return fetchBoardPosts(BOARD_DCD_BLOCKED);
}

async function fetchBlockedPost(id) {
  return fetchBoardPost(id, BOARD_DCD_BLOCKED);
}

async function fetchReviewPosts() {
  return fetchBoardPosts(BOARD_DCD_REVIEW);
}

async function fetchReviewPost(id) {
  return fetchBoardPost(id, BOARD_DCD_REVIEW);
}

async function fetchReviewReferences(boardId) {
  const supabaseClient = await getPublicSupabaseClient();
  const { data: refs, error: refsError } = await supabaseClient
    .from(BOARD_REF_TABLE)
    .select("reference_id")
    .eq("board_id", boardId)
    .order("id", { ascending: true });

  if (refsError) throw refsError;

  const referenceIds = (refs || [])
    .map((ref) => ref.reference_id)
    .filter(Boolean);

  if (!referenceIds.length) return [];

  const { data: posts, error: postsError } = await supabaseClient
    .from(BOARD_TABLE)
    .select("id,title,summary,content,created_at,board_dcd")
    .in("id", referenceIds)
    .in("board_dcd", [BOARD_DCD_LEARNED, BOARD_DCD_BLOCKED]);

  if (postsError) throw postsError;

  const { data: hashtags, error: hashtagsError } = await supabaseClient
    .from(BOARD_HASHTAG_TABLE)
    .select("board_id,content")
    .in("board_id", referenceIds)
    .order("id", { ascending: true });

  if (hashtagsError) throw hashtagsError;

  const groupedHashtags = (hashtags || []).reduce((acc, tag) => {
    const tagBoardId = String(tag.board_id);
    if (!acc[tagBoardId]) acc[tagBoardId] = [];
    if (tag.content) acc[tagBoardId].push(tag.content);
    return acc;
  }, {});
  const postMap = new Map(
    (posts || []).map((post) => [
      String(post.id),
      {
        ...normalizeLearnedPost(post, groupedHashtags[String(post.id)] || []),
        boardDcd: post.board_dcd || "",
      },
    ]),
  );

  return referenceIds
    .map((referenceId) => postMap.get(String(referenceId)))
    .filter(Boolean);
}

function createContentParagraphs(content) {
  return String(content || "")
    .split(/\n{2,}|\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function getCurrentUserId() {
  return getStoredUser()?.id || "";
}

function getCommentLikeKey(postType, postId, commentId, userId) {
  return `${postType}:${postId}:${commentId}:${userId}`;
}

function getStoredCommentLikes(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch (error) {
    console.error(error);
    return {};
  }
}

function hasLikedComment(postType, storageKey, postId, commentId, userId) {
  const likes = getStoredCommentLikes(storageKey);
  return Boolean(likes[getCommentLikeKey(postType, postId, commentId, userId)]);
}

function setLikedComment(postType, storageKey, postId, commentId, userId, isLiked) {
  const likes = getStoredCommentLikes(storageKey);
  const key = getCommentLikeKey(postType, postId, commentId, userId);

  if (isLiked) {
    likes[key] = true;
  } else {
    delete likes[key];
  }

  localStorage.setItem(storageKey, JSON.stringify(likes));
}

function getCommentAuthorName(comment) {
  return String(comment.name || "회원").trim() || "회원";
}

async function callBoardCommentFunction(payload) {
  const supabaseClient = await getAuthedSupabaseClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabaseClient.auth.getSession();

  if (sessionError) throw sessionError;

  const accessToken = session?.access_token || localStorage.getItem("token");

  if (!accessToken) {
    throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
  }

  let response;
  try {
    response = await fetch(`${APP_SUPABASE_URL}/functions/v1/board-comment`, {
      method: "POST",
      headers: {
        apikey: APP_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        accessToken,
      }),
    });
  } catch (error) {
    console.error(error);
    throw new Error(
      "댓글 함수에 연결하지 못했습니다. board-comment 함수 배포 상태를 확인해주세요.",
    );
  }
  const responseText = await response.text();
  const result = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    throw new Error(
      result.message || result.error || "댓글 요청 처리에 실패했습니다.",
    );
  }

  return result.data;
}

async function fetchBoardComments(postId) {
  let response;
  try {
    response = await fetch(`${APP_SUPABASE_URL}/functions/v1/board-comment`, {
      method: "POST",
      headers: {
        apikey: APP_SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "list",
        boardId: Number(postId),
      }),
    });
  } catch (error) {
    console.error(error);
    throw new Error(
      "댓글 목록을 불러오지 못했습니다. board-comment 함수 배포 상태를 확인해주세요.",
    );
  }

  const responseText = await response.text();
  const result = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    throw new Error(
      result.message || result.error || "댓글 목록을 불러오지 못했습니다.",
    );
  }

  return result.data || [];
}

async function fetchLearnedComments(postId) {
  return fetchBoardComments(postId);
}

async function fetchBlockedComments(postId) {
  return fetchBoardComments(postId);
}

async function createLearnedComment(postId, content) {
  return callBoardCommentFunction({
    action: "create",
    boardId: Number(postId),
    content,
  });
}

async function updateLearnedComment(postId, commentId, content) {
  return callBoardCommentFunction({
    action: "update",
    boardId: Number(postId),
    commentId: Number(commentId),
    content,
  });
}

async function deleteLearnedComment(postId, commentId) {
  return callBoardCommentFunction({
    action: "delete",
    boardId: Number(postId),
    commentId: Number(commentId),
  });
}

async function updateLearnedCommentLike(postId, comment, shouldLike) {
  const data = await callBoardCommentFunction({
    action: "like",
    boardId: Number(postId),
    commentId: Number(comment.id),
    shouldLike,
  });
  setLikedComment(
    "learned",
    LEARNED_COMMENT_LIKE_KEY,
    postId,
    comment.id,
    getCurrentUserId(),
    shouldLike,
  );
  return data;
}

async function createBlockedComment(postId, content) {
  return callBoardCommentFunction({
    action: "create",
    boardId: Number(postId),
    content,
  });
}

async function updateBlockedComment(postId, commentId, content) {
  return callBoardCommentFunction({
    action: "update",
    boardId: Number(postId),
    commentId: Number(commentId),
    content,
  });
}

async function deleteBlockedComment(postId, commentId) {
  return callBoardCommentFunction({
    action: "delete",
    boardId: Number(postId),
    commentId: Number(commentId),
  });
}

async function updateBlockedCommentLike(postId, comment, shouldLike) {
  const data = await callBoardCommentFunction({
    action: "like",
    boardId: Number(postId),
    commentId: Number(comment.id),
    shouldLike,
  });
  setLikedComment(
    "blocked",
    BLOCKED_COMMENT_LIKE_KEY,
    postId,
    comment.id,
    getCurrentUserId(),
    shouldLike,
  );
  return data;
}

async function createReviewComment(postId, content) {
  return callBoardCommentFunction({
    action: "create",
    boardId: Number(postId),
    content,
  });
}

async function updateReviewComment(postId, commentId, content) {
  return callBoardCommentFunction({
    action: "update",
    boardId: Number(postId),
    commentId: Number(commentId),
    content,
  });
}

async function deleteReviewComment(postId, commentId) {
  return callBoardCommentFunction({
    action: "delete",
    boardId: Number(postId),
    commentId: Number(commentId),
  });
}

async function updateReviewCommentLike(postId, comment, shouldLike) {
  const data = await callBoardCommentFunction({
    action: "like",
    boardId: Number(postId),
    commentId: Number(comment.id),
    shouldLike,
  });
  setLikedComment(
    "review",
    REVIEW_COMMENT_LIKE_KEY,
    postId,
    comment.id,
    getCurrentUserId(),
    shouldLike,
  );
  return data;
}

const learnedCommentApi = {
  postType: "learned",
  likeStorageKey: LEARNED_COMMENT_LIKE_KEY,
  fetchComments: fetchLearnedComments,
  createComment: createLearnedComment,
  updateComment: updateLearnedComment,
  deleteComment: deleteLearnedComment,
  updateLike: updateLearnedCommentLike,
};

const blockedCommentApi = {
  postType: "blocked",
  likeStorageKey: BLOCKED_COMMENT_LIKE_KEY,
  fetchComments: fetchBlockedComments,
  createComment: createBlockedComment,
  updateComment: updateBlockedComment,
  deleteComment: deleteBlockedComment,
  updateLike: updateBlockedCommentLike,
};

const reviewCommentApi = {
  postType: "review",
  likeStorageKey: REVIEW_COMMENT_LIKE_KEY,
  fetchComments: fetchBoardComments,
  createComment: createReviewComment,
  updateComment: updateReviewComment,
  deleteComment: deleteReviewComment,
  updateLike: updateReviewCommentLike,
};

function createNotebookTabsMarkup(current) {
  return `
    <nav class="sub-tabs" aria-label="공책 2차 메뉴">
      <a href="learned.html" class="${current === "learned" ? "is-current" : ""}">배운 것들</a>
      <a href="blocked.html" class="${current === "blocked" ? "is-current" : ""}">막혔던 부분</a>
      <a href="review.html" class="${current === "review" ? "is-current" : ""}">다시 보기</a>
    </nav>
  `;
}

function initLearnedPages() {
  renderLearnedListPage();
  renderLearnedDetailPage();
}

function initBlockedPages() {
  renderBlockedListPage();
  renderBlockedDetailPage();
}

function initReviewPages() {
  renderReviewListPage();
  renderReviewDetailPage();
}

async function renderLearnedListPage() {
  const list = document.querySelector("[data-learned-list]");
  if (!list) return;

  const count = document.querySelector("[data-learned-count]");
  const pagination = document.querySelector("[data-learned-pagination]");

  list.innerHTML = `<p class="learned-empty">배운 것들을 불러오고 있습니다.</p>`;
  if (pagination) pagination.innerHTML = "";

  try {
    const learnedPosts = await fetchLearnedPosts();
    const totalPages = Math.max(
      Math.ceil(learnedPosts.length / LEARNED_PAGE_SIZE),
      1,
    );
    const params = new URLSearchParams(window.location.search);
    const requestedPage = Number(params.get("page") || "1");
    const currentPage = Math.min(Math.max(requestedPage || 1, 1), totalPages);
    const pageStart = (currentPage - 1) * LEARNED_PAGE_SIZE;
    const posts = learnedPosts.slice(pageStart, pageStart + LEARNED_PAGE_SIZE);

    if (count) {
      count.textContent = `총 ${learnedPosts.length}개의 기록`;
    }

    if (!posts.length) {
      list.innerHTML = `<p class="learned-empty">아직 남겨진 기록이 없습니다.</p>`;
      return;
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

    if (!pagination || totalPages <= 1) return;

    pagination.innerHTML = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      const isCurrent = page === currentPage;
      return `
        <a href="learned.html?page=${page}" class="${isCurrent ? "is-current" : ""}" aria-label="${page}페이지"${isCurrent ? ' aria-current="page"' : ""}>
          ${page}
        </a>
      `;
    }).join("");
  } catch (error) {
    console.error(error);
    list.innerHTML = `<p class="learned-empty is-error">배운 것들을 불러오지 못했습니다.</p>`;
    if (count) count.textContent = "";
  }
}

async function renderLearnedDetailPage() {
  const detail = document.querySelector("[data-learned-detail]");
  if (!detail) return;

  const params = new URLSearchParams(window.location.search);
  const learnedId = params.get("id");

  if (!learnedId) {
    detail.innerHTML = `<p class="learned-empty is-error">게시글을 찾을 수 없습니다.</p>`;
    return;
  }

  detail.innerHTML = `<p class="learned-empty">게시글을 불러오고 있습니다.</p>`;

  try {
    const post = await fetchLearnedPost(learnedId);

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
        ${createContentParagraphs(post.content)}
      </div>
    `;

    initCommentPanel(post.id, learnedCommentApi);
  } catch (error) {
    console.error(error);
    detail.innerHTML = `<p class="learned-empty is-error">게시글을 불러오지 못했습니다.</p>`;
  }
}

async function renderBlockedListPage() {
  const list = document.querySelector("[data-blocked-list]");
  if (!list) return;

  const count = document.querySelector("[data-blocked-count]");
  const pagination = document.querySelector("[data-blocked-pagination]");

  list.innerHTML = `<p class="learned-empty">막혔던 부분을 불러오고 있습니다.</p>`;
  if (pagination) pagination.innerHTML = "";

  try {
    const blockedPosts = await fetchBlockedPosts();
    const totalPages = Math.max(
      Math.ceil(blockedPosts.length / LEARNED_PAGE_SIZE),
      1,
    );
    const params = new URLSearchParams(window.location.search);
    const requestedPage = Number(params.get("page") || "1");
    const currentPage = Math.min(Math.max(requestedPage || 1, 1), totalPages);
    const pageStart = (currentPage - 1) * LEARNED_PAGE_SIZE;
    const posts = blockedPosts.slice(pageStart, pageStart + LEARNED_PAGE_SIZE);

    if (count) {
      count.textContent = `총 ${blockedPosts.length}개의 기록`;
    }

    if (!posts.length) {
      list.innerHTML = `<p class="learned-empty">아직 남겨진 기록이 없습니다.</p>`;
      return;
    }

    list.innerHTML = posts
      .map(
        (post) => `
          <article class="learned-card">
            <div class="learned-card-main">
              <time datetime="${post.date}">${formatLearnedDate(post.date)}</time>
              <h2>
                <a href="blocked-detail.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a>
              </h2>
              <p>${escapeHtml(post.summary)}</p>
            </div>
            <div class="learned-tags">${createTagMarkup(post.tags)}</div>
          </article>
        `,
      )
      .join("");

    if (!pagination || totalPages <= 1) return;

    pagination.innerHTML = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      const isCurrent = page === currentPage;
      return `
        <a href="blocked.html?page=${page}" class="${isCurrent ? "is-current" : ""}" aria-label="${page}페이지"${isCurrent ? ' aria-current="page"' : ""}>
          ${page}
        </a>
      `;
    }).join("");
  } catch (error) {
    console.error(error);
    list.innerHTML = `<p class="learned-empty is-error">막혔던 부분을 불러오지 못했습니다.</p>`;
    if (count) count.textContent = "";
  }
}

async function renderBlockedDetailPage() {
  const detail = document.querySelector("[data-blocked-detail]");
  if (!detail) return;

  const params = new URLSearchParams(window.location.search);
  const blockedId = params.get("id");

  if (!blockedId) {
    detail.innerHTML = `<p class="learned-empty is-error">게시글을 찾을 수 없습니다.</p>`;
    return;
  }

  detail.innerHTML = `<p class="learned-empty">게시글을 불러오고 있습니다.</p>`;

  try {
    const post = await fetchBlockedPost(blockedId);

    document.title = `${post.title} | 연습장`;
    detail.innerHTML = `
      <nav class="detail-back" aria-label="이전 화면">
        <a href="blocked.html">막혔던 부분 목록</a>
      </nav>
      <header class="learned-detail-head">
        <time datetime="${post.date}">${formatLearnedDate(post.date)}</time>
        <h1>${escapeHtml(post.title)}</h1>
        <p>${escapeHtml(post.summary)}</p>
        <div class="learned-tags">${createTagMarkup(post.tags)}</div>
      </header>
      <div class="learned-detail-body">
        ${createContentParagraphs(post.content)}
      </div>
    `;

    initCommentPanel(post.id, blockedCommentApi);
  } catch (error) {
    console.error(error);
    detail.innerHTML = `<p class="learned-empty is-error">게시글을 불러오지 못했습니다.</p>`;
  }
}

async function renderReviewListPage() {
  const list = document.querySelector("[data-review-list]");
  if (!list) return;

  const count = document.querySelector("[data-review-count]");
  const pagination = document.querySelector("[data-review-pagination]");

  list.innerHTML = `<p class="learned-empty">다시 보기 기록을 불러오고 있습니다.</p>`;
  if (pagination) pagination.innerHTML = "";

  try {
    const reviewPosts = await fetchReviewPosts();
    const totalPages = Math.max(
      Math.ceil(reviewPosts.length / LEARNED_PAGE_SIZE),
      1,
    );
    const params = new URLSearchParams(window.location.search);
    const requestedPage = Number(params.get("page") || "1");
    const currentPage = Math.min(Math.max(requestedPage || 1, 1), totalPages);
    const pageStart = (currentPage - 1) * LEARNED_PAGE_SIZE;
    const posts = reviewPosts.slice(pageStart, pageStart + LEARNED_PAGE_SIZE);

    if (count) {
      count.textContent = `총 ${reviewPosts.length}개의 기록`;
    }

    if (!posts.length) {
      list.innerHTML = `<p class="learned-empty">아직 남겨진 기록이 없습니다.</p>`;
      return;
    }

    list.innerHTML = posts
      .map(
        (post) => `
          <article class="learned-card">
            <div class="learned-card-main">
              <time datetime="${post.date}">${formatLearnedDate(post.date)}</time>
              <h2>
                <a href="review-detail.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a>
              </h2>
              <p>${escapeHtml(post.summary)}</p>
            </div>
            <div class="learned-tags">${createTagMarkup(post.tags)}</div>
          </article>
        `,
      )
      .join("");

    if (!pagination || totalPages <= 1) return;

    pagination.innerHTML = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      const isCurrent = page === currentPage;
      return `
        <a href="review.html?page=${page}" class="${isCurrent ? "is-current" : ""}" aria-label="${page}페이지"${isCurrent ? ' aria-current="page"' : ""}>
          ${page}
        </a>
      `;
    }).join("");
  } catch (error) {
    console.error(error);
    list.innerHTML = `<p class="learned-empty is-error">다시 보기 기록을 불러오지 못했습니다.</p>`;
    if (count) count.textContent = "";
  }
}

function createReviewReferencesMarkup(references) {
  if (!references.length) return "";

  return `
    <section class="review-references" aria-label="참조">
      <div class="review-references-head">
        <p class="eyebrow">References</p>
        <h2>참조</h2>
      </div>
      <div class="review-reference-list">
        ${references
          .map(
            (reference) => `
              <button type="button" class="review-reference-item" data-review-reference="${escapeHtml(reference.id)}">
                <span>${escapeHtml(getBoardDcdLabel(reference.boardDcd))}</span>
                <strong>${escapeHtml(reference.title)}</strong>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function getBoardDcdLabel(boardDcd) {
  if (boardDcd === BOARD_DCD_LEARNED) return "배운 것들";
  if (boardDcd === BOARD_DCD_BLOCKED) return "막혔던 부분";
  if (boardDcd === BOARD_DCD_REVIEW) return "다시 보기";
  return "참조";
}

async function renderReviewDetailPage() {
  const detail = document.querySelector("[data-review-detail]");
  if (!detail) return;

  const params = new URLSearchParams(window.location.search);
  const reviewId = params.get("id");

  if (!reviewId) {
    detail.innerHTML = `<p class="learned-empty is-error">게시글을 찾을 수 없습니다.</p>`;
    return;
  }

  detail.innerHTML = `<p class="learned-empty">게시글을 불러오고 있습니다.</p>`;

  try {
    const [post, references] = await Promise.all([
      fetchReviewPost(reviewId),
      fetchReviewReferences(reviewId),
    ]);

    document.title = `${post.title} | 연습장`;
    detail.innerHTML = `
      <nav class="detail-back" aria-label="이전 화면">
        <a href="review.html">다시 보기 목록</a>
      </nav>
      <header class="learned-detail-head">
        <time datetime="${post.date}">${formatLearnedDate(post.date)}</time>
        <h1>${escapeHtml(post.title)}</h1>
        <p>${escapeHtml(post.summary)}</p>
        <div class="learned-tags">${createTagMarkup(post.tags)}</div>
      </header>
      <div class="learned-detail-body">
        ${createContentParagraphs(post.content)}
      </div>
      ${createReviewReferencesMarkup(references)}
    `;

    detail.querySelectorAll("[data-review-reference]").forEach((button) => {
      button.addEventListener("click", () => {
        const reference = references.find(
          (item) => String(item.id) === button.dataset.reviewReference,
        );
        if (reference) {
          openReviewReferenceModal(reference);
        }
      });
    });

    initCommentPanel(post.id, reviewCommentApi);
  } catch (error) {
    console.error(error);
    detail.innerHTML = `<p class="learned-empty is-error">게시글을 불러오지 못했습니다.</p>`;
  }
}

function getReviewReferenceModal() {
  let modal = document.querySelector("[data-review-reference-modal]");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.className = "review-reference-modal";
  modal.dataset.reviewReferenceModal = "";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="review-reference-backdrop" data-review-reference-close></div>
    <article class="review-reference-dialog" role="dialog" aria-modal="true" aria-labelledby="review-reference-title">
      <button type="button" class="review-reference-close" data-review-reference-close aria-label="닫기">×</button>
      <div data-review-reference-content></div>
    </article>
  `;
  document.body.appendChild(modal);
  return modal;
}

function openReviewReferenceModal(reference) {
  const modal = getReviewReferenceModal();
  const content = modal.querySelector("[data-review-reference-content]");
  if (!content) return;

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove("has-comment-modal");
    modal.onkeydown = null;
  };

  modal.querySelectorAll("[data-review-reference-close]").forEach((button) => {
    button.onclick = closeModal;
  });

  modal.onkeydown = (event) => {
    if (event.key === "Escape") closeModal();
  };

  content.innerHTML = `
    <header class="learned-detail-head">
      <p class="eyebrow">${escapeHtml(getBoardDcdLabel(reference.boardDcd))}</p>
      <time datetime="${reference.date}">${formatLearnedDate(reference.date)}</time>
      <h1 id="review-reference-title">${escapeHtml(reference.title)}</h1>
      <p>${escapeHtml(reference.summary)}</p>
      <div class="learned-tags">${createTagMarkup(reference.tags)}</div>
    </header>
    <div class="learned-detail-body">
      ${createContentParagraphs(reference.content)}
    </div>
  `;

  modal.hidden = false;
  document.body.classList.add("has-comment-modal");
}

async function initCommentPanel(postId, commentApi = learnedCommentApi) {
  const form = document.querySelector("[data-comment-form]");
  const list = document.querySelector("[data-comment-list]");
  const loginCallout = document.querySelector("[data-comment-login-callout]");
  if (!form || !list) return;

  const storedUser = await getValidStoredUser();
  await renderComments(postId, commentApi);

  if (!storedUser) {
    form.hidden = true;
    if (loginCallout) {
      loginCallout.hidden = false;
      const loginLink = loginCallout.querySelector("a");
      if (loginLink) {
        const redirectUrl = `${window.location.pathname}${window.location.search}`;
        loginLink.href = `${componentBase}front/login/login.html?redirect=${encodeURIComponent(redirectUrl)}`;
      }
    }
    return;
  }

  form.hidden = false;
  if (loginCallout) {
    loginCallout.hidden = true;
  }

  const nameInput = form.querySelector('input[name="name"]');
  if (nameInput && !nameInput.value.trim()) {
    nameInput.value = getUserDisplayName(storedUser);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.querySelector("[data-comment-message]");
    const formData = new FormData(form);
    const content = String(formData.get("content") || "").trim();

    if (!content) {
      setPageMessage(message, "댓글을 입력해주세요.", true);
      return;
    }

    try {
      await commentApi.createComment(postId, content);
      form.reset();
      if (nameInput) {
        nameInput.value = getUserDisplayName(storedUser);
      }
      setPageMessage(message, "댓글이 남겨졌습니다.");
      await renderComments(postId, commentApi);
    } catch (error) {
      console.error(error);
      setPageMessage(
        message,
        error?.message || "댓글 등록에 실패했습니다.",
        true,
      );
    }
  });
}

function getCommentEditModal() {
  let modal = document.querySelector("[data-comment-edit-modal]");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.className = "comment-modal";
  modal.dataset.commentEditModal = "";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="comment-modal-backdrop" data-comment-edit-close></div>
    <section class="comment-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="comment-edit-title">
      <form class="comment-modal-form" data-comment-edit-form>
        <div class="comment-modal-head">
          <h2 id="comment-edit-title">댓글 수정</h2>
          <button type="button" class="comment-modal-close" data-comment-edit-close aria-label="닫기">×</button>
        </div>
        <label>
          댓글
          <textarea name="content" rows="5" required></textarea>
        </label>
        <p class="member-message" data-comment-edit-message role="alert" aria-live="polite"></p>
        <div class="comment-modal-actions">
          <button type="button" class="comment-action-button" data-comment-edit-close>취소</button>
          <button type="submit" class="comment-action-button">저장</button>
        </div>
      </form>
    </section>
  `;
  document.body.appendChild(modal);

  return modal;
}

function openCommentEditModal(comment, onSave) {
  const modal = getCommentEditModal();
  const form = modal.querySelector("[data-comment-edit-form]");
  const textarea = form?.querySelector('textarea[name="content"]');
  const message = modal.querySelector("[data-comment-edit-message]");
  const submitButton = form?.querySelector('button[type="submit"]');

  if (!form || !textarea || !submitButton) return;

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove("has-comment-modal");
    form.onsubmit = null;
    modal.onkeydown = null;
  };

  modal.querySelectorAll("[data-comment-edit-close]").forEach((button) => {
    button.onclick = closeModal;
  });

  form.onsubmit = async (event) => {
    event.preventDefault();

    const nextContent = textarea.value.trim();
    if (!nextContent) {
      setPageMessage(message, "댓글을 입력해주세요.", true);
      textarea.focus();
      return;
    }

    try {
      submitButton.disabled = true;
      setPageMessage(message, "댓글을 수정하고 있습니다.");
      await onSave(nextContent);
      closeModal();
    } catch (error) {
      console.error(error);
      setPageMessage(
        message,
        error?.message || "댓글 수정에 실패했습니다.",
        true,
      );
    } finally {
      submitButton.disabled = false;
    }
  };

  modal.onkeydown = (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  };

  textarea.value = comment.content || "";
  setPageMessage(message, "");
  modal.hidden = false;
  document.body.classList.add("has-comment-modal");
  window.setTimeout(() => textarea.focus(), 0);
}

async function renderComments(postId, commentApi = learnedCommentApi) {
  const list = document.querySelector("[data-comment-list]");
  const count = document.querySelector("[data-comment-count]");
  if (!list) return;

  list.innerHTML = `<p class="comment-empty">댓글을 불러오고 있습니다.</p>`;

  let postComments = [];
  try {
    postComments = await commentApi.fetchComments(postId);
  } catch (error) {
    console.error(error);
    list.innerHTML = `<p class="comment-empty is-error">댓글을 불러오지 못했습니다.</p>`;
    if (count) {
      count.textContent = "";
    }
    return;
  }

  if (count) {
    count.textContent = `${postComments.length}개`;
  }

  if (postComments.length === 0) {
    list.innerHTML = `<p class="comment-empty">아직 댓글이 없습니다. 첫 생각을 남겨주세요.</p>`;
    return;
  }

  list.innerHTML = postComments
    .map(
      (comment) => {
        const userId = getCurrentUserId();
        const isOwner = Boolean(userId && comment.reg_user_id === userId);
        const isLiked = Boolean(
          userId &&
            hasLikedComment(
              commentApi.postType,
              commentApi.likeStorageKey,
              postId,
              comment.id,
              userId,
            ),
        );

        return `
        <article class="comment-item">
          <div class="comment-meta">
            <div class="comment-author">
              <strong>${escapeHtml(getCommentAuthorName(comment))}</strong>
            </div>
            <time datetime="${comment.created_at}">${formatLearnedDate(String(comment.created_at || "").slice(0, 10))}</time>
          </div>
          <p>${escapeHtml(comment.content)}</p>
          <div class="comment-actions">
            <button type="button" class="comment-like ${isLiked ? "is-liked" : ""}" data-comment-like="${escapeHtml(comment.id)}" aria-pressed="${isLiked ? "true" : "false"}">
              좋아요 <span>${Number(comment.num_like_cnt || 0)}</span>
            </button>
            <div class="comment-owner-actions">
              ${
                isOwner
                  ? `
                    <button type="button" class="comment-action-button" data-comment-edit="${escapeHtml(comment.id)}">수정</button>
                    <button type="button" class="comment-action-button is-danger" data-comment-delete="${escapeHtml(comment.id)}">삭제</button>
                  `
                  : ""
              }
            </div>
          </div>
        </article>
      `;
      },
    )
    .join("");

  list.querySelectorAll("[data-comment-like]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = getCurrentUserId();
      if (!userId) {
        alert("로그인해야 좋아요를 누를 수 있습니다.");
        return;
      }

      const target = postComments.find(
        (comment) => String(comment.id) === button.dataset.commentLike,
      );
      if (!target) return;

      try {
        button.disabled = true;
        const shouldLike = !hasLikedComment(
          commentApi.postType,
          commentApi.likeStorageKey,
          postId,
          target.id,
          userId,
        );
        const updatedComment = await commentApi.updateLike(
          postId,
          target,
          shouldLike,
        );
        const nextLikeCount = Number(
          updatedComment?.num_like_cnt ?? target.num_like_cnt ?? 0,
        );
        target.num_like_cnt = nextLikeCount;
        button.classList.toggle("is-liked", shouldLike);
        button.setAttribute("aria-pressed", shouldLike ? "true" : "false");
        const countLabel = button.querySelector("span");
        if (countLabel) {
          countLabel.textContent = String(nextLikeCount);
        }
      } catch (error) {
        console.error(error);
        alert("좋아요 처리에 실패했습니다.");
      } finally {
        button.disabled = false;
      }
    });
  });

  list.querySelectorAll("[data-comment-edit]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = postComments.find(
        (comment) => String(comment.id) === button.dataset.commentEdit,
      );
      if (!target) return;
      openCommentEditModal(target, async (trimmedContent) => {
        await commentApi.updateComment(postId, target.id, trimmedContent);
        await renderComments(postId, commentApi);
      });
    });
  });

  list.querySelectorAll("[data-comment-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const isConfirmed = window.confirm("댓글을 삭제할까요?");
      if (!isConfirmed) return;

      try {
        await commentApi.deleteComment(postId, button.dataset.commentDelete);
        await renderComments(postId, commentApi);
      } catch (error) {
        console.error(error);
        alert("댓글 삭제에 실패했습니다.");
      }
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

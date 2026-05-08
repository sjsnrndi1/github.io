// Common layout

const isFrontPage = window.location.pathname.includes("/front/");
const componentBase = isFrontPage ? "../" : "";

document.addEventListener("DOMContentLoaded", () => {
  renderAuthCallbackResult();
  loadHeader();
  loadFooter();
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
      test: () => lowerMessage.includes("email not confirmed") || lowerMessage.includes("email_not_confirmed"),
      message: "이메일 인증이 아직 완료되지 않았습니다. 메일함에서 인증을 먼저 진행해주세요.",
    },
    {
      test: () => lowerMessage.includes("already registered"),
      message: "이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해주세요.",
    },
    {
      test: () => lowerMessage.includes("unable to validate email") || lowerMessage.includes("invalid email"),
      message: "이메일 형식이 올바르지 않습니다.",
    },
    {
      test: () => lowerMessage.includes("rate limit") || lowerMessage.includes("too many") || lowerMessage.includes("only request this after"),
      message: "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.",
    },
    {
      test: () => lowerMessage.includes("token has expired") || lowerMessage.includes("expired") || lowerMessage.includes("invalid token"),
      message: "인증 링크가 만료되었거나 올바르지 않습니다. 인증 메일을 다시 요청해주세요.",
    },
    {
      test: () => lowerMessage.includes("access_denied"),
      message: "인증 요청이 거부되었습니다. 다시 시도해주세요.",
    },
    {
      test: () => lowerMessage.includes("failed to fetch") || lowerMessage.includes("network"),
      message: "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
    },
  ];

  const matchedMessage = messageMap.find((item) => item.test());
  return matchedMessage ? matchedMessage.message : fallbackMessage;
}

function renderAuthCallbackResult() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
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
        "인증 링크가 만료되었거나 올바르지 않습니다. 다시 시도해주세요."
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
    const isSamePage = linkUrl.pathname === window.location.pathname && linkUrl.hash === window.location.hash;

    if (isSamePage) {
      link.classList.add("is-current");
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
              const month = isHyphenDate ? rawDate.slice(5, 7) : rawDate.slice(4, 6);
              const day = isHyphenDate ? rawDate.slice(8, 10) : rawDate.slice(6, 8);

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



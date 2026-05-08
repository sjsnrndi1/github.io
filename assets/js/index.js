async function loadHeader() {
  const response = await fetch("header.html");
  const html = await response.text();

  document.getElementById("header").innerHTML = html;

  initMenu();
}

loadHeader();

async function loadFooter() {
  const response = await fetch("footer.html");
  const html = await response.text();

  document.getElementById("footer").innerHTML = html;
}

loadFooter();

function initMenu() {
  const menuToggle = document.getElementById("menu-toggle");
  const navLinks = document.getElementById("nav-links");

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

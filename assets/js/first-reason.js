const menuToggle = document.getElementById("menu-toggle");
      const navLinks = document.getElementById("nav-links");

      menuToggle.addEventListener("click", () => {
        const isActive = navLinks.classList.toggle("active");
        menuToggle.setAttribute("aria-expanded", String(isActive));
      });

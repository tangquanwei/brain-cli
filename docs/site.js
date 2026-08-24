const menuButton = document.querySelector("[data-menu-button]");
const siteNav = document.querySelector("[data-site-nav]");

if (menuButton && siteNav) {
  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    siteNav.toggleAttribute("data-open", !isOpen);
  });

  siteNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      menuButton.setAttribute("aria-expanded", "false");
      siteNav.removeAttribute("data-open");
    }
  });
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.getAttribute("data-copy");
    const original = button.textContent;

    try {
      await navigator.clipboard.writeText(value);
      button.textContent = button.getAttribute("data-copied") || "Copied";
      button.classList.add("is-copied");
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove("is-copied");
      }, 1600);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      const code = button.closest(".install-command")?.querySelector("code");
      if (code && selection) {
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  });
});

document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = new Date().getFullYear();
});

document.querySelectorAll("[data-image-stack]").forEach((stack) => {
  const cards = [...stack.querySelectorAll("[data-stack-card]")];

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const selectedPosition = Number(card.dataset.position);

      if (selectedPosition === 0) {
        cards.forEach((item) => {
          const position = Number(item.dataset.position);
          item.dataset.position = String(
            position === 0 ? cards.length - 1 : position - 1,
          );
        });
      } else {
        const frontCard = cards.find((item) => item.dataset.position === "0");
        if (frontCard) frontCard.dataset.position = String(selectedPosition);
        card.dataset.position = "0";
      }

      cards.forEach((item) => {
        item.setAttribute(
          "aria-pressed",
          String(item.dataset.position === "0"),
        );
      });
    });
  });
});

if (
  "IntersectionObserver" in window &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );

  document
    .querySelectorAll("[data-reveal]")
    .forEach((node) => observer.observe(node));
} else {
  document
    .querySelectorAll("[data-reveal]")
    .forEach((node) => node.classList.add("is-visible"));
}

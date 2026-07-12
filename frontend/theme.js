(function () {
  const STORAGE_KEY = "calsync-theme";
  const THEMES = new Set(["light", "dark"]);

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function getInitialTheme() {
    const stored = getStoredTheme();
    return THEMES.has(stored) ? stored : getSystemTheme();
  }

  function applyTheme(theme) {
    const nextTheme = THEMES.has(theme) ? theme : "light";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const isDark = nextTheme === "dark";
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
      const label = button.querySelector("[data-theme-label]");
      if (label) {
        label.textContent = isDark ? "Light" : "Dark";
      }
    });
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (err) {
      // Ignore storage failures. The active page still receives the theme.
    }
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const nextTheme = current === "dark" ? "light" : "dark";
    saveTheme(nextTheme);
    applyTheme(nextTheme);
  }

  applyTheme(getInitialTheme());

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(document.documentElement.dataset.theme || getInitialTheme());
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", toggleTheme);
    });
  });
})();

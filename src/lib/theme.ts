export type ThemePref = "system" | "light" | "dark";

const KEY = "estimo:theme";

export function getTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // Storage blocked; fall back to system.
  }
  return "system";
}

export function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Ignore.
  }
  applyTheme(pref);
}

window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => applyTheme(getTheme()));

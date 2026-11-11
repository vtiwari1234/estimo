import { useState } from "react";
import { getTheme, setTheme, type ThemePref } from "../lib/theme";

const NEXT: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemePref, string> = { system: "Theme: match system", light: "Theme: light", dark: "Theme: dark" };

function Icon({ pref }: { pref: ThemePref }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (pref === "light")
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  if (pref === "dark")
    return (
      <svg {...common} aria-hidden>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  return (
    <svg {...common} aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(getTheme);
  return (
    <button
      onClick={() => {
        const next = NEXT[pref];
        setPref(next);
        setTheme(next);
      }}
      title={LABEL[pref]}
      aria-label={LABEL[pref]}
      className="grid size-9 place-items-center rounded-xl border border-line bg-surface text-ink-2 hover:bg-surface-2"
    >
      <Icon pref={pref} />
    </button>
  );
}

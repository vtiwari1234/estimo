import { useEffect, useState } from "react";
import { OWNER } from "../brand";

/** The current year, re-checked every minute so an open tab rolls over at New Year. */
export function useCurrentYear(): number {
  const [year, setYear] = useState(() => new Date().getFullYear());
  useEffect(() => {
    const t = setInterval(() => setYear(new Date().getFullYear()), 60_000);
    return () => clearInterval(t);
  }, []);
  return year;
}

export function Footer() {
  const year = useCurrentYear();
  return (
    <footer className="border-t border-line px-4 py-8 text-center">
      <blockquote className="font-display text-lg font-semibold text-ink-2 italic">
        “Coz it's {year} and simple things should be free.”
      </blockquote>
      <p className="mt-1 text-sm text-ink-3">— {OWNER}, who got tired of paying $5 a month to flip cards</p>
      <p className="mt-4 text-xs text-ink-3">Made with ♥ by {OWNER} · no tracking, no ads</p>
    </footer>
  );
}

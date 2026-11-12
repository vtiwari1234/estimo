import { useEffect, useState } from "react";
import { APP_NAME, OWNER } from "../brand";

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
  if (!OWNER) {
    return (
      <footer className="border-t border-line px-4 py-8 text-center">
        <p className="text-base font-semibold text-ink-2">No tracking · No ads</p>
        <p className="mt-2 text-sm text-ink-3">
          © {year} {APP_NAME}
        </p>
      </footer>
    );
  }
  return (
    <footer className="border-t border-line px-4 py-8 text-center">
      <blockquote className="font-display text-lg font-semibold text-ink-2 italic">
        “Coz it's {year} and simple things should be free.”
      </blockquote>
      <p className="mt-1 text-sm text-ink-3">— {OWNER}</p>
      <p className="mt-5 text-base font-semibold text-ink-2">No tracking · No ads</p>
    </footer>
  );
}

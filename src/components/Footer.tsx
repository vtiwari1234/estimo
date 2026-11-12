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
    <footer className="mx-4 mt-20 border-t border-line py-14 text-center sm:mx-16">
      <blockquote className="font-display text-3xl leading-tight italic sm:text-4xl">
        “Coz it's {year} and simple things should be free.”
      </blockquote>
      {OWNER && <p className="mt-2 eyebrow">— {OWNER}</p>}
      <p className="mt-8 text-base font-semibold text-ink-2">No tracking · No ads</p>
    </footer>
  );
}

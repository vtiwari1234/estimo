import { APP_NAME, OWNER } from "../brand";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a href="/" className="flex items-center gap-2" aria-label={`${OWNER}'s ${APP_NAME} home`}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect x="5" y="3" width="18" height="24" rx="4" fill="var(--brand)" transform="rotate(-10 14 15)" />
        <rect x="10" y="5" width="18" height="24" rx="4" fill="var(--accent)" />
        <text x="19" y="22" fontFamily="Bricolage Grotesque, system-ui" fontSize="12" fontWeight="800" textAnchor="middle" fill="#1c1917">
          5
        </text>
      </svg>
      {!compact && (
        <span className="font-display text-xl font-extrabold tracking-tight">
          <span className="text-brand">{OWNER}'s</span> {APP_NAME}
        </span>
      )}
    </a>
  );
}

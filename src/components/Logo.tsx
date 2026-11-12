import { APP_NAME, OWNER } from "../brand";

/** Serif wordmark with a red pip, like the corner of a playing card. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a href="/" className="group flex items-baseline gap-1.5" aria-label={`${OWNER ? `${OWNER}'s ` : ""}${APP_NAME} home`}>
      {compact ? (
        <span className="grid h-9 w-7 -rotate-6 place-items-center rounded-[5px] border border-[#e3dac9] bg-paper font-display text-xl leading-none text-[#1b1814] shadow-[0_6px_14px_-8px_rgb(0_0_0/0.5)] transition group-hover:rotate-0">
          5
        </span>
      ) : (
        <span className="font-display text-[28px] leading-none tracking-[-0.01em]">
          {OWNER && <em className="text-ink-2">{OWNER}'s </em>}
          {APP_NAME}
        </span>
      )}
      <span className="inline-block size-2.5 -translate-y-0.5 rounded-full bg-brand" aria-hidden />
    </a>
  );
}

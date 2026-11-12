import { useEffect, type ReactNode } from "react";

export function Modal({ title, onClose, children }: { title: string; onClose?: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-[28px] border border-line bg-surface p-6 shadow-2xl sm:max-w-md sm:rounded-[28px]"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-[32px] leading-none">{title}</h2>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2">
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

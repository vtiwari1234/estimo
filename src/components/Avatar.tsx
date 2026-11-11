export function Avatar({ name, color, size = 32, dim = false }: { name: string; color: string; size?: number; dim?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ background: color, width: size, height: size, fontSize: size * 0.38, opacity: dim ? 0.45 : 1 }}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

import type { CSSProperties } from "react";
import { cardValue } from "../../shared/decks";

type Size = "xs" | "sm" | "md" | "lg";

const SIZES: Record<Size, { box: string; value: string; corner: string; frame: string }> = {
  xs: { box: "h-[60px] w-[42px] rounded-md", value: "text-2xl", corner: "hidden", frame: "hidden" },
  sm: { box: "h-[88px] w-[62px] rounded-lg", value: "text-[34px]", corner: "text-[13px]", frame: "inset-x-2.5 inset-y-3.5" },
  md: { box: "h-[118px] w-[84px] rounded-[10px] sm:h-[136px] sm:w-[96px]", value: "text-[50px] sm:text-[60px]", corner: "text-base sm:text-lg", frame: "inset-x-3.5 inset-y-5" },
  lg: { box: "h-[212px] w-[150px] rounded-[14px]", value: "text-[96px]", corner: "text-[26px]", frame: "inset-x-7 inset-y-8" },
};

/** Big cards and the scary ones are printed in red, like hearts and diamonds. */
function isRed(value: string): boolean {
  const n = cardValue(value);
  return value === "?" || (n !== null && n >= 13) || value === "½" || value === "XL" || value === "XXL";
}

/** A printed playing card: corner indices, a thin inner frame and a serif numeral. */
export function PlayingCard({
  value,
  size = "md",
  className = "",
  style,
  testId,
  label,
}: {
  value: string;
  size?: Size;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  label?: string;
}) {
  const s = SIZES[size];
  const red = isRed(value);
  const long = value.length > 2;
  return (
    <div
      data-testid={testId}
      aria-label={label}
      className={`${className.includes("absolute") ? "" : "relative"} shrink-0 border border-[#e3dac9] bg-paper text-[#1b1814] shadow-[0_1px_0_#fff_inset,0_18px_36px_-20px_rgb(40_30_20/0.55),0_2px_5px_rgb(40_30_20/0.1)] ${s.box} ${className}`}
      style={style}
    >
      <div className={`absolute rounded-md border border-[#eadfcc] ${s.frame}`} />
      <span className={`absolute top-1.5 left-2 font-display leading-none ${s.corner} ${red ? "text-brand" : ""}`}>
        {value}
        <span className="block text-[0.5em] text-brand">♦</span>
      </span>
      <span className={`absolute right-2 bottom-1.5 rotate-180 font-display leading-none ${s.corner} ${red ? "text-brand" : ""}`}>
        {value}
        <span className="block text-[0.5em] text-brand">♦</span>
      </span>
      <span
        className={`absolute inset-0 grid place-items-center font-display leading-none ${s.value} ${red ? "text-brand" : ""}`}
      >
        <span className={long ? "text-[0.6em]" : ""}>{value}</span>
      </span>
    </div>
  );
}

export function CardBack({ size = "md", className = "", label }: { size?: Size; className?: string; label?: string }) {
  const s = SIZES[size];
  return (
    <div aria-label={label} className={`card-back relative shrink-0 border border-[#163829] shadow-[0_18px_36px_-20px_rgb(0_0_0/0.7)] ${s.box} ${className}`}>
      <div className={`absolute rounded-md border border-white/25 ${size === "xs" ? "inset-1.5" : s.frame}`} />
    </div>
  );
}

export function EmptySeat({ size = "md", label }: { size?: Size; label?: string }) {
  return <div aria-label={label} className={`shrink-0 border-[1.5px] border-dashed border-[#e9e1cf]/40 ${SIZES[size].box}`} />;
}

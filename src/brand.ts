/**
 * Branding for this build. One codebase runs as two sites:
 * - "personal" (default): Vedant's free Estimo, with his name and footer quote.
 * - "pro": the paid product, with a neutral brand and no personal references.
 * Pick one at build time with `vite build --mode pro` (see .env.pro).
 */
export type Edition = "personal" | "pro";

export const EDITION: Edition = import.meta.env.VITE_EDITION === "pro" ? "pro" : "personal";

/** The product name, e.g. "Estimo". */
export const APP_NAME: string = import.meta.env.VITE_APP_NAME || "Estimo";

/** Who runs this copy. Only the personal site shows an owner. */
export const OWNER: string | null = EDITION === "personal" ? import.meta.env.VITE_OWNER || "Vedant" : null;

/** Full name used in titles and copy, e.g. "Vedant's Estimo". */
export const BRAND = OWNER ? `${OWNER}'s ${APP_NAME}` : APP_NAME;

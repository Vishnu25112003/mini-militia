/**
 * How many canvas pixels to render per CSS pixel: the screen's pixel density, capped at 2 (a 3x phone screen would
 * cost 2.25x more fill rate for hardly any visible gain).
 */
export function devicePixelScale(): number {
  return Math.min(2, Math.max(1, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
}

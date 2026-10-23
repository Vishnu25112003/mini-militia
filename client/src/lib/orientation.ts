/**
 * Landscape-only rule (Game Flow, Sections 1 and 13): on a phone or tablet held in portrait, the whole game is
 * covered by a "rotate your phone" message. Desktops are never blocked, whatever shape the window is.
 */
export function isPortraitOnMobile(coarsePointer: boolean, width: number, height: number): boolean {
  return coarsePointer && height > width;
}

/** Is the main pointer a finger? (`?forcemobile=1` pretends so, for testing on a desktop.) */
export function hasCoarsePointer(): boolean {
  if (new URLSearchParams(window.location.search).get('forcemobile') === '1') return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

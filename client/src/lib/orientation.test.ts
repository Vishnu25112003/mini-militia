import { describe, expect, it } from 'vitest';
import { isPortraitOnMobile } from './orientation';

describe('landscape-only rule', () => {
  it('shows the rotate message on a phone in portrait', () => {
    expect(isPortraitOnMobile(true, 390, 844)).toBe(true);
    expect(isPortraitOnMobile(true, 768, 1024)).toBe(true); // tablet in portrait
  });

  it('lets a phone in landscape play', () => {
    expect(isPortraitOnMobile(true, 844, 390)).toBe(false);
    expect(isPortraitOnMobile(true, 1024, 768)).toBe(false);
  });

  it('never blocks a desktop, even in a tall narrow window', () => {
    expect(isPortraitOnMobile(false, 500, 900)).toBe(false);
    expect(isPortraitOnMobile(false, 1920, 1080)).toBe(false);
  });

  it('a square screen counts as landscape (nothing to rotate)', () => {
    expect(isPortraitOnMobile(true, 600, 600)).toBe(false);
  });
});

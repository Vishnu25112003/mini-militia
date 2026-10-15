import { describe, expect, it } from 'vitest';
import { resolveMeleeClash } from './melee.js';

describe('resolveMeleeClash', () => {
  it('A (100 hp) hits first: A gets the kill and drops to 50 hp, survives', () => {
    const result = resolveMeleeClash(100);
    expect(result.firstHitterHealthAfter).toBe(50);
    expect(result.firstHitterDies).toBe(false);
  });

  it('B (30 hp) hits first: B gets the kill, but also dies', () => {
    const result = resolveMeleeClash(30);
    expect(result.firstHitterHealthAfter).toBe(0);
    expect(result.firstHitterDies).toBe(true);
  });

  it('exactly 50 hp counts as "50 or less": the first hitter also dies', () => {
    const result = resolveMeleeClash(50);
    expect(result.firstHitterHealthAfter).toBe(0);
    expect(result.firstHitterDies).toBe(true);
  });

  it('51 hp survives', () => {
    const result = resolveMeleeClash(51);
    expect(result.firstHitterHealthAfter).toBe(1);
    expect(result.firstHitterDies).toBe(false);
  });
});

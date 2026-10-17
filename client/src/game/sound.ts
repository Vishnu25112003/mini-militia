import { getAudioContext } from '../mobileHardening';

/**
 * All sound effects (Phase 15) are synthesized with the Web Audio API rather
 * than sourced from audio files — original by construction, no licensing
 * risk, and no asset downloads to add to the bundle. Each shot/hit/explosion
 * message in `MatchScene` triggers one of these; the shared `AudioContext`
 * comes from `mobileHardening.ts`, already unlocked by the lobby's Start tap.
 */

function ctxOrNull(): AudioContext | null {
  return getAudioContext();
}

function playTone(freq: number, duration: number, type: OscillatorType, peak: number, freqEnd?: number) {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playNoise(duration: number, peak: number, lowpassFreq?: number) {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  let tail: AudioNode = source;
  if (lowpassFreq !== undefined) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpassFreq;
    tail.connect(filter);
    tail = filter;
  }
  tail.connect(gain).connect(ctx.destination);
  source.start(t0);
}

/** Hitscan weapons (rifles/smgs/shotguns/pistols) — a short sharp crack. */
export function playHitscanShot() {
  playNoise(0.07, 0.25, 4000);
  playTone(180, 0.05, 'square', 0.12, 60);
}

/** Projectile weapons (launchers, flame) — a lower whoosh. */
export function playProjectileShot() {
  playNoise(0.15, 0.2, 1200);
  playTone(90, 0.12, 'sawtooth', 0.15, 40);
}

export function playExplosion() {
  playNoise(0.4, 0.45, 900);
  playTone(70, 0.3, 'sawtooth', 0.3, 30);
}

export function playGasHiss() {
  playNoise(0.6, 0.12, 2500);
}

export function playMelee() {
  playNoise(0.08, 0.2, 5000);
}

export function playHit() {
  playTone(1100, 0.05, 'square', 0.15);
}

export function playDeath() {
  playTone(220, 0.4, 'sawtooth', 0.2, 50);
}

export function playPickup() {
  playTone(500, 0.12, 'sine', 0.18, 1100);
}

export function playReload() {
  const ctx = ctxOrNull();
  if (!ctx) return;
  playTone(700, 0.04, 'square', 0.1);
  setTimeout(() => playTone(900, 0.04, 'square', 0.1), 90);
}

export function playUiClick() {
  playTone(700, 0.04, 'square', 0.08);
}

export function playCountdownBeep(final: boolean) {
  playTone(final ? 880 : 440, 0.15, 'sine', 0.2);
}

let jetpackGain: GainNode | null = null;
let jetpackActive = false;

/** Starts/stops a looping hum while airborne — idempotent, safe to call every frame. */
export function setJetpackActive(active: boolean) {
  if (active === jetpackActive) return;
  jetpackActive = active;
  const ctx = ctxOrNull();
  if (!ctx) return;

  if (active) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 140;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    jetpackGain = gain;
    (jetpackGain as GainNode & { _osc?: OscillatorNode })._osc = osc;
  } else if (jetpackGain) {
    const gain = jetpackGain;
    const osc = (gain as GainNode & { _osc?: OscillatorNode })._osc;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc?.stop(ctx.currentTime + 0.2);
    jetpackGain = null;
  }
}

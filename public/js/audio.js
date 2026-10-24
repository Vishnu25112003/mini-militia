// WebAudio playback of the sounds decoded from da2sound16.ckb, with distance falloff and stereo pan.
import { settings } from './settings.js';

let ctx = null;
let master = null;
const buffers = new Map();
const pending = new Map();
const lastPlayed = new Map();
export const listener = { x: 0, y: 0 };

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = settings().volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function load(name) {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name));
  if (pending.has(name)) return pending.get(name);
  const p = fetch(`assets/sfx/${name}.wav`).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a))
    .then((b) => { buffers.set(name, b); return b; }).catch(() => null);
  pending.set(name, p);
  return p;
}

export function setVolume(v) {
  if (master) master.gain.value = v;
}

export function preload(names) {
  if (!ctx) return;
  for (const n of names) load(n);
}

// x/y in world points (omit for UI sounds)
export function play(name, x, y, { volume = 1, rate = 1, minGap = 0.03 } = {}) {
  if (!ctx || !name) return;
  const t = ctx.currentTime;
  if (t - (lastPlayed.get(name) || -1) < minGap) return;
  lastPlayed.set(name, t);
  let gainV = volume, pan = 0;
  if (x !== undefined) {
    const dx = x - listener.x, dy = y - listener.y;
    const d = Math.hypot(dx, dy);
    if (d > 1400) return;
    gainV *= Math.max(0, 1 - d / 1400) ** 1.6;
    pan = Math.max(-0.8, Math.min(0.8, dx / 700));
  }
  load(name).then((buf) => {
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gainV;
    let node = src.connect(g);
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(master);
    src.start();
  });
}

// Looping jetpack hiss for the local player.
let jetSrc = null, jetGain = null;
export function setJet(on) {
  if (!ctx) return;
  if (!jetSrc) {
    const buf = buffers.get('jet');
    if (!buf) { load('jet'); return; }
    jetSrc = ctx.createBufferSource();
    jetSrc.buffer = buf;
    jetSrc.loop = true;
    jetGain = ctx.createGain();
    jetGain.gain.value = 0;
    jetSrc.connect(jetGain).connect(master);
    jetSrc.start();
  }
  jetGain.gain.setTargetAtTime(on ? 0.35 : 0, ctx.currentTime, 0.05);
}

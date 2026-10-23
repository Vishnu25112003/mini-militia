// Synthesised sound effects (Web Audio). Nothing is sampled from the original game.
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private jetGain: GainNode | null = null;
  muted = false;

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const jet = this.ctx.createBufferSource();
    jet.buffer = this.noiseBuf; jet.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
    this.jetGain = this.ctx.createGain(); this.jetGain.gain.value = 0;
    jet.connect(f); f.connect(this.jetGain); this.jetGain.connect(this.master);
    jet.start();
  }

  setMuted(m: boolean) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }

  setJet(level: number) {
    if (this.jetGain && this.ctx) this.jetGain.gain.setTargetAtTime(this.muted ? 0 : level * 0.16, this.ctx.currentTime, 0.05);
  }

  private noise(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'lowpass', slide = 0.4) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur); f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t, Math.random() * 0.5, dur);
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'square', endFreq = freq) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
  }

  /** `v` is a 0..1 distance falloff. */
  play(name: string, v = 1) {
    if (!this.ctx || this.muted || v <= 0.02) return;
    switch (name) {
      case 'magnum': case 'm14': this.noise(0.18, 3200, 1, 0.55 * v); this.tone(140, 0.12, 0.3 * v, 'square', 60); break;
      case 'm93ba': this.noise(0.4, 2400, 1, 0.8 * v); this.tone(90, 0.3, 0.5 * v, 'sawtooth', 35); break;
      case 'shotgun': this.noise(0.28, 2600, 0.8, 0.8 * v); this.tone(100, 0.2, 0.4 * v, 'square', 40); break;
      case 'smaw': this.noise(0.5, 1200, 1, 0.6 * v, 'lowpass', 0.2); this.tone(70, 0.4, 0.4 * v, 'sawtooth', 30); break;
      case 'emp': this.tone(600, 0.25, 0.25 * v, 'sine', 120); break;
      case 'flame': this.noise(0.12, 1500, 0.5, 0.28 * v, 'bandpass', 0.8); break;
      case 'riot': case 'melee': this.noise(0.12, 800, 1, 0.5 * v); this.tone(120, 0.1, 0.3 * v, 'triangle', 70); break;
      case 'explosion': this.noise(0.9, 1800, 0.8, 1.0 * v, 'lowpass', 0.08); this.tone(60, 0.7, 0.7 * v, 'sawtooth', 24); break;
      case 'hit': this.tone(260, 0.07, 0.2 * v, 'triangle', 120); break;
      case 'impact': this.noise(0.05, 4000, 1, 0.12 * v, 'highpass', 0.8); break;
      case 'reload': this.tone(900, 0.04, 0.15 * v, 'square', 600); setTimeout(() => this.tone(500, 0.06, 0.15 * v, 'square', 300), 120); break;
      case 'pickup': this.tone(520, 0.08, 0.2 * v, 'sine', 780); setTimeout(() => this.tone(780, 0.1, 0.2 * v, 'sine', 1040), 70); break;
      case 'death': this.tone(300, 0.5, 0.35 * v, 'sawtooth', 50); break;
      case 'spawn': this.tone(300, 0.25, 0.15 * v, 'sine', 900); break;
      case 'flag': this.tone(660, 0.12, 0.25, 'square', 660); setTimeout(() => this.tone(880, 0.2, 0.25, 'square', 880), 120); break;
      default: this.noise(0.1, 3000, 1, 0.4 * v); break; // uzi, mp5, ak47, m16, sawgun
    }
  }
}

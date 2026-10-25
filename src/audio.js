/* Tiny procedural sound effects — no assets, no libraries. */

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
  }

  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);

        const len = Math.floor(this.ctx.sampleRate * 0.5);
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* audio is a nice-to-have */ }
  }

  tone(freq, dur, { type = 'sine', gain = 0.18, slideTo = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* ignore */ }
  }

  whoosh(gain = 0.22) {
    if (!this.ctx || !this.noiseBuf) return;
    try {
      const t0 = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.1;
      filter.frequency.setValueAtTime(1100, t0);
      filter.frequency.exponentialRampToValueAtTime(320, t0 + 0.24);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
      src.connect(filter).connect(g).connect(this.master);
      src.start(t0);
      src.stop(t0 + 0.3);
    } catch { /* ignore */ }
  }

  push() {
    this.whoosh(0.2);
    this.tone(320, 0.12, { type: 'triangle', gain: 0.1, slideTo: 180 });
  }

  catch() {
    this.whoosh(0.3);
    this.tone(160, 0.35, { type: 'sine', gain: 0.22, slideTo: 60 });
    this.tone(620, 0.22, { type: 'square', gain: 0.06, slideTo: 300, delay: 0.04 });
  }

  bite() {
    this.tone(760, 0.09, { type: 'triangle', gain: 0.09, slideTo: 420 });
    this.tone(500, 0.14, { type: 'sine', gain: 0.08, delay: 0.08, slideTo: 300 });
  }

  start() {
    [392, 523, 659].forEach((f, i) => this.tone(f, 0.24, { type: 'triangle', gain: 0.12, delay: i * 0.08 }));
  }

  tick() {
    this.tone(1050, 0.07, { type: 'sine', gain: 0.05 });
  }

  end() {
    [523, 392, 294].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', gain: 0.12, delay: i * 0.12 }));
  }
}

export const audio = new Sfx();

// AudioManager: small synthesized cues and a gentle music loop (WebAudio, no asset files).
// Respects autoplay rules (starts on first gesture), player settings, platform mute and ads.

export type Sfx = "pop" | "coin" | "click" | "deny" | "drink" | "sparkle" | "unlock" | "whoosh" | "soft" | "squeeze";

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// C major pentatonic melody (MIDI) — an original, simple loop.
const MELODY = [72, 76, 79, 76, 74, 72, 69, 72, 74, 76, 74, 72, 67, 69, 72, -1];
const BASS = [48, 48, 45, 45, 43, 43, 45, 47];

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private lastPlayed = new Map<Sfx, number>();

  music = true;
  sfx = true;
  private externalMute = false;
  private adMute = false;
  private hidden = false;

  /** Call from a user gesture; safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 0.5;
        this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.11;
        this.musicBus.connect(this.master);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.apply();
    } catch (e) {
      console.warn("[audio] unavailable", e);
    }
  }

  setSettings(music: boolean, sfx: boolean): void {
    this.music = music;
    this.sfx = sfx;
    this.apply();
  }

  setExternalMute(m: boolean): void {
    this.externalMute = m;
    this.apply();
  }

  setAdMute(m: boolean): void {
    this.adMute = m;
    this.apply();
  }

  setHidden(h: boolean): void {
    this.hidden = h;
    this.apply();
  }

  private get silenced(): boolean {
    return this.externalMute || this.adMute || this.hidden;
  }

  private apply(): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.silenced ? 0 : 1, this.ctx.currentTime, 0.05);
    if (this.music && !this.silenced) this.startMusic();
    else this.stopMusic();
  }

  play(name: Sfx): void {
    if (!this.sfx || this.silenced || !this.ctx || !this.sfxBus) return;
    const nowMs = performance.now();
    const minGap = name === "coin" ? 70 : 40;
    if (nowMs - (this.lastPlayed.get(name) ?? 0) < minGap) return;
    this.lastPlayed.set(name, nowMs);
    const t = this.ctx.currentTime;
    switch (name) {
      case "pop":
        this.tone("sine", 520, 880, t, 0.09, 0.5);
        break;
      case "coin":
        this.tone("triangle", 1318, 1318, t, 0.06, 0.25);
        this.tone("triangle", 1760, 1760, t + 0.05, 0.1, 0.22);
        break;
      case "click":
        this.tone("sine", 660, 600, t, 0.05, 0.25);
        break;
      case "deny":
        this.tone("sine", 330, 262, t, 0.14, 0.3);
        break;
      case "drink":
        this.tone("sine", 400, 700, t, 0.12, 0.25);
        break;
      case "squeeze":
        this.tone("triangle", 220, 300, t, 0.08, 0.3);
        break;
      case "sparkle":
        [1568, 1976, 2349, 3136].forEach((f, i) => this.tone("sine", f, f, t + i * 0.06, 0.12, 0.18));
        break;
      case "unlock":
        [523, 659, 784, 1046].forEach((f, i) => this.tone("triangle", f, f, t + i * 0.08, 0.18, 0.3));
        break;
      case "whoosh":
        [392, 523, 659, 784, 988, 1175].forEach((f, i) => this.tone("sine", f, f * 1.01, t + i * 0.12, 0.4, 0.2));
        break;
      case "soft":
        this.tone("sine", 392, 330, t, 0.22, 0.15);
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, bus?: GainNode): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(bus ?? this.sfxBus!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private startMusic(): void {
    if (this.musicTimer !== null || !this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 100);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private schedule(): void {
    if (!this.ctx || !this.musicBus) return;
    const beat = 0.34;
    while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
      const m = MELODY[this.step % MELODY.length];
      if (m > 0) this.tone("triangle", NOTE(m), NOTE(m), this.nextNoteTime, beat * 0.9, 0.35, this.musicBus);
      if (this.step % 2 === 0) {
        const b = BASS[(this.step / 2) % BASS.length];
        this.tone("sine", NOTE(b), NOTE(b), this.nextNoteTime, beat * 1.8, 0.5, this.musicBus);
      }
      this.nextNoteTime += beat;
      this.step++;
    }
  }
}

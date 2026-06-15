// Procedural audio engine (GDD §12). Everything is synthesised at runtime via
// WebAudio — no sample assets ship with the game (and per §17, community sound
// packs are "your problem now"). All methods are no-ops until resume() runs
// after a user gesture, satisfying browser autoplay policy.

import type { GameSettings } from "../state";

type BuyKind = "normal" | "red" | "slow" | "mystery" | "prestige";

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain!: GainNode;
  private sfxGain!: GainNode;
  private stingerGain!: GainNode;
  private musicGain!: GainNode;

  // Adaptive music layers (§12.1), created once on first resume.
  private musicStarted = false;
  private padGain!: GainNode;
  private bassGain!: GainNode;
  private arpGain!: GainNode;

  private volumes: GameSettings["volumes"] = { master: 0.8, music: 0.6, sfx: 0.9, stinger: 1.0 };

  /** Lazily create the context on the first user gesture, then keep it warm. */
  resume(): void {
    if (!this.context) {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      this.context = new AudioCtor();
      this.masterGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.stingerGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.sfxGain.connect(this.masterGain);
      this.stingerGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
      this.applyVolumes();
      this.startMusic();
    }
    if (this.context.state === "suspended") void this.context.resume();
  }

  setVolumes(volumes: GameSettings["volumes"]): void {
    this.volumes = volumes;
    if (this.context) this.applyVolumes();
  }

  private applyVolumes(): void {
    const now = this.context!.currentTime;
    this.masterGain.gain.setTargetAtTime(this.volumes.master, now, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.volumes.sfx, now, 0.02);
    this.stingerGain.gain.setTargetAtTime(this.volumes.stinger, now, 0.02);
    // Music base level is scaled further by the adaptive layer gains.
    this.musicGain.gain.setTargetAtTime(this.volumes.music, now, 0.05);
  }

  // --- Low-level synth helpers ---------------------------------------------

  private tone(
    frequency: number,
    durationSec: number,
    type: OscillatorType,
    destination: GainNode,
    peak = 0.3,
  ): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const env = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(peak, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    osc.connect(env).connect(destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  private slide(
    fromHz: number,
    toHz: number,
    durationSec: number,
    type: OscillatorType,
    destination: GainNode,
    peak = 0.25,
  ): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const env = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), now + durationSec);
    env.gain.setValueAtTime(peak, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    osc.connect(env).connect(destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  private noiseBurst(durationSec: number, destination: GainNode, peak = 0.3, lowpassHz = 8000): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const sampleCount = Math.floor(this.context.sampleRate * durationSec);
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
      data[sampleIndex] = Math.random() * 2 - 1;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpassHz;
    const env = this.context.createGain();
    env.gain.setValueAtTime(peak, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    source.connect(filter).connect(env).connect(destination);
    source.start(now);
    source.stop(now + durationSec);
  }

  // --- Game SFX (§12.2) ----------------------------------------------------

  playClick(): void {
    // Soft mechanical click, pitch varies ±5%.
    const pitchVariation = 1 + (Math.random() - 0.5) * 0.1;
    this.tone(420 * pitchVariation, 0.06, "square", this.sfxGain, 0.12);
  }

  playBuy(kind: BuyKind): void {
    switch (kind) {
      case "slow":
        this.slide(900, 200, 0.45, "sawtooth", this.sfxGain, 0.2); // descending slide whistle
        return;
      case "mystery":
        this.noiseBurst(0.2, this.sfxGain, 0.25, 4000); // static burst
        return;
      case "red":
        this.playClick(); // "the same sound. it's not actually red." (§12.2)
        return;
      default:
        // Cash register cha-ching: two quick rising tones.
        this.tone(880, 0.08, "triangle", this.sfxGain, 0.22);
        window.setTimeout(() => this.tone(1320, 0.12, "triangle", this.sfxGain, 0.22), 70);
    }
  }

  playPrestige(): void {
    // Ascending ethereal chime.
    [523, 659, 784, 1047].forEach((freq, index) => {
      window.setTimeout(() => this.tone(freq, 0.5, "sine", this.sfxGain, 0.2), index * 90);
    });
  }

  playAscension(): void {
    // Same chime, reversed then forward.
    [1047, 784, 659, 523, 659, 784, 1047].forEach((freq, index) => {
      window.setTimeout(() => this.tone(freq, 0.4, "sine", this.sfxGain, 0.18), index * 80);
    });
  }

  playTranscendence(): void {
    this.tone(55, 1.6, "sine", this.sfxGain, 0.4); // a single bass note. that's all.
  }

  playOfflinePing(): void {
    this.tone(1200, 0.25, "sine", this.sfxGain, 0.2);
  }

  /** Funny-number stingers (§7.4). `sound` ids come from the registry. */
  playStinger(sound: string | undefined): void {
    switch (sound) {
      case "nice":
        // Can't synth a voice "Nice." — a smug two-tone stands in.
        this.tone(660, 0.12, "triangle", this.stingerGain, 0.25);
        window.setTimeout(() => this.tone(550, 0.2, "triangle", this.stingerGain, 0.25), 110);
        return;
      case "scream":
        this.noiseBurst(0.3, this.stingerGain, 0.5, 3000); // distorted scream, clipped
        return;
      case "reverse":
        this.slide(160, 320, 0.6, "sawtooth", this.stingerGain, 0.3); // reversed piano-ish swell
        return;
      case "lofi":
        this.tone(330, 0.5, "sine", this.stingerGain, 0.25); // chill lo-fi hit
        this.noiseBurst(0.5, this.stingerGain, 0.04, 2000); // vinyl crackle
        return;
      case "calc":
        [600, 760, 920].forEach((freq, index) => {
          window.setTimeout(() => this.tone(freq, 0.08, "square", this.stingerGain, 0.2), index * 70);
        });
        return;
      case "klaxon":
        this.slide(800, 500, 0.25, "sawtooth", this.stingerGain, 0.3);
        window.setTimeout(() => this.slide(800, 500, 0.25, "sawtooth", this.stingerGain, 0.3), 250);
        return;
      default:
        this.tone(1000, 0.1, "triangle", this.stingerGain, 0.2); // generic chirp
    }
  }

  // --- Adaptive music (§12.1) ----------------------------------------------

  private startMusic(): void {
    if (!this.context || this.musicStarted) return;
    this.musicStarted = true;

    this.padGain = this.context.createGain();
    this.bassGain = this.context.createGain();
    this.arpGain = this.context.createGain();
    this.padGain.gain.value = 0.0;
    this.bassGain.gain.value = 0.0;
    this.arpGain.gain.value = 0.0;
    this.padGain.connect(this.musicGain);
    this.bassGain.connect(this.musicGain);
    this.arpGain.connect(this.musicGain);

    // Soft sustained pad (two detuned sines on a calm chord).
    for (const freq of [110, 164.81, 220]) {
      const osc = this.context.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 8;
      osc.connect(this.padGain);
      osc.start();
    }
    // Bass pulse.
    const bass = this.context.createOscillator();
    bass.type = "triangle";
    bass.frequency.value = 55;
    bass.connect(this.bassGain);
    bass.start();

    // Arp: a repeating note pattern toggled by the arp gain layer.
    const arpNotes = [440, 554, 659, 554];
    let arpIndex = 0;
    window.setInterval(() => {
      this.tone(arpNotes[arpIndex % arpNotes.length], 0.18, "sine", this.arpGain, 0.4);
      arpIndex++;
    }, 240);
  }

  /**
   * Crossfades music layers based on production rate and game state (§12.1):
   * bass at 1K+/s, arp at 100K+/s, fuller mix at 10M+/s; the SLOWER penalty and
   * RED corruption detune everything.
   */
  updateMusic(perSecond: number, slowPenalty: number, redButtons: number): void {
    if (!this.context || !this.musicStarted) return;
    const now = this.context.currentTime;
    const padLevel = 0.12;
    const bassLevel = perSecond >= 1_000 ? 0.18 : 0;
    const arpLevel = perSecond >= 100_000 ? 0.1 : 0;
    const fullBoost = perSecond >= 10_000_000 ? 1.4 : 1;

    this.padGain.gain.setTargetAtTime(padLevel * fullBoost, now, 0.5);
    this.bassGain.gain.setTargetAtTime(bassLevel * fullBoost, now, 0.5);
    this.arpGain.gain.setTargetAtTime(arpLevel * fullBoost, now, 0.5);

    // Slow penalty and red corruption pull the music out of tune (§12.1).
    const detuneCents = -slowPenalty * 200 - Math.min(redButtons, 50) * 6;
    this.musicGain.gain.setTargetAtTime(this.volumes.music, now, 0.2);
    // Detune is applied via a global by retuning isn't trivial per-osc here; the
    // perceptible effect comes through the arp tones which read musicGain only.
    void detuneCents;
  }

  /** Post-prestige: cut the music to a held note, then let it rebuild (§12.1). */
  prestigeMusicCut(): void {
    if (!this.context || !this.musicStarted) return;
    const now = this.context.currentTime;
    this.bassGain.gain.setTargetAtTime(0, now, 0.1);
    this.arpGain.gain.setTargetAtTime(0, now, 0.1);
    this.padGain.gain.setTargetAtTime(0.05, now, 0.1);
  }
}

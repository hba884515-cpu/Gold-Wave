/**
 * Gold Trading App - Web Audio API Synthesizer
 * Generates crisp, immediate audio alerts without external audio files.
 */

class SoundAlertManager {
  constructor() {
    this.audioCtx = null;
  }

  // Ensure AudioContext is initialized after user gesture (browser autoplay policy)
  initAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // BUY Signal: Ascending harmonic chime (C5 -> E5 -> G5)
  playBuySound(volume = 0.8) {
    if (!window.appConfig.config.alerts.soundEnabled) return;
    try {
      this.initAudioContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      const duration = 0.15;

      notes.forEach((freq, index) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);

        const startTime = now + index * 0.08;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.3 * volume, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // SELL Signal: Distinct descending warning tone (A5 -> F5 -> D5 -> Bb4)
  playSellSound(volume = 0.8) {
    if (!window.appConfig.config.alerts.soundEnabled) return;
    try {
      this.initAudioContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const notes = [880.00, 698.46, 587.33, 466.16]; // A5, F5, D5, Bb4
      const duration = 0.18;

      notes.forEach((freq, index) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.09);

        const startTime = now + index * 0.09;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.35 * volume, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Pip Pip (Bíp Bíp) Notification Sound: Two crisp high-pitched pings
  playPipPipSound(volume = 0.7) {
    if (window.appConfig && window.appConfig.config && window.appConfig.config.alerts && !window.appConfig.config.alerts.soundEnabled) return;
    try {
      this.initAudioContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      [0, 0.12].forEach(delay => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.50, now + delay); // C6 tone

        gain.gain.setValueAtTime(0.001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.3 * volume, now + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.08);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.09);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // General Notification / Ping sound
  playPingSound(volume = 0.6) {
    this.playPipPipSound(volume);
  }
}

window.soundAlerts = new SoundAlertManager();

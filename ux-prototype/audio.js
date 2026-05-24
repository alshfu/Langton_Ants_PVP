// audio.js — Multi-channel WebAudio FX with category mixers per contract §11.
// Channels: master (sums all), music, sfx, ui. Each volume in 0..1.
// API:
//   window.fx.setVolume({ master, music, sfx, ui }) — partial update
//   window.fx.getVolume() → current levels
//   window.fx.play(soundId)   — registry-based dispatch
//   window.fx.setMuted(bool)
//   window.fx.<sound>()       — direct (capture, clash, damage, ready, …)
//   window.fx.bind(settingsAccountAudio)  — subscribe to AppState.settings.audio
//
// Browsers require a user gesture before audio plays; we arm on first input.

(function () {
  let ctx = null;
  let muted = false;
  let lastPlay = 0;

  // Per-category gain nodes form a graph:
  //   osc → channelGain[category] → masterGain → destination
  let masterGain  = null;
  const channelGain = { music: null, sfx: null, ui: null };

  const volumes = { master: 0.8, music: 0.5, sfx: 0.9, ui: 0.7 };

  function getCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain(); masterGain.gain.value = volumes.master;
      masterGain.connect(ctx.destination);
      for (const k of ['music', 'sfx', 'ui']) {
        const g = ctx.createGain(); g.gain.value = volumes[k];
        g.connect(masterGain);
        channelGain[k] = g;
      }
    } catch { return null; }
    return ctx;
  }

  function arm() { const c = getCtx(); if (c && c.state === 'suspended') c.resume(); }
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, arm, { once: false, passive: true })
  );

  function applyVolumes() {
    if (!ctx) return;
    if (masterGain) masterGain.gain.linearRampToValueAtTime(muted ? 0 : volumes.master, ctx.currentTime + 0.05);
    for (const k of ['music', 'sfx', 'ui']) {
      if (channelGain[k]) channelGain[k].gain.linearRampToValueAtTime(volumes[k], ctx.currentTime + 0.05);
    }
  }

  // Tone routed through a category channel (not directly to destination).
  function tone({ freq = 440, freq2 = null, dur = 0.12, type = 'sine', gain = 0.08, attack = 0.005, release = 0.08, channel = 'sfx' }) {
    const c = getCtx(); if (!c) return;
    if (muted) return;
    const now = c.currentTime;
    if (now - lastPlay < 0.01) return;
    lastPlay = now;

    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freq2 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq2), now + dur);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g).connect(channelGain[channel] || channelGain.sfx);
    osc.start(now);
    osc.stop(now + dur + release);
  }

  function chord(freqs, opts = {}) {
    freqs.forEach((f, i) => setTimeout(() => tone({ ...opts, freq: f }), i * 18));
  }

  // Registry — keyed sound bank. Hosts can extend via fx.register(id, fn).
  const REGISTRY = {
    // Match SFX
    'capture':   () => tone({ freq: 880, dur: 0.06, type: 'triangle', gain: 0.04, channel: 'sfx' }),
    'clash':     () => tone({ freq: 220, freq2: 80, dur: 0.18, type: 'sawtooth', gain: 0.10, channel: 'sfx' }),
    'damage':    () => tone({ freq: 160, freq2: 90, dur: 0.20, type: 'square', gain: 0.06, channel: 'sfx' }),
    'death':     () => chord([329, 261, 195], { dur: 0.40, type: 'sine', gain: 0.10, channel: 'sfx' }),
    'lead':      () => chord([523, 659, 784], { dur: 0.18, type: 'triangle', gain: 0.08, channel: 'sfx' }),
    'ready':     () => tone({ freq: 660, dur: 0.10, type: 'triangle', gain: 0.07, channel: 'sfx' }),
    'victory':   () => chord([523, 659, 784, 1046], { dur: 0.50, type: 'triangle', gain: 0.10, channel: 'sfx' }),
    'defeat':    () => chord([329, 261, 196, 130], { dur: 0.50, type: 'sine', gain: 0.10, channel: 'sfx' }),

    // UI
    'ui.tap':    () => tone({ freq: 1200, dur: 0.04, type: 'sine', gain: 0.025, channel: 'ui' }),
    'ui.hover':  () => tone({ freq: 880,  dur: 0.03, type: 'sine', gain: 0.018, channel: 'ui' }),
    'ui.confirm':() => tone({ freq: 1320, freq2: 1100, dur: 0.07, type: 'triangle', gain: 0.04, channel: 'ui' }),
    'ui.error':  () => chord([220, 196], { dur: 0.16, type: 'square', gain: 0.05, channel: 'ui' }),
    'ui.toast':  () => tone({ freq: 1040, dur: 0.06, type: 'sine', gain: 0.025, channel: 'ui' }),

    // Music stubs — host plugs in real loops; until then, a quiet drone
    'music.menu':   () => tone({ freq: 110, dur: 1.2, type: 'sine', gain: 0.02, channel: 'music' }),
    'music.lobby':  () => tone({ freq: 130, dur: 1.2, type: 'sine', gain: 0.02, channel: 'music' }),
    'music.match':  () => tone({ freq: 165, dur: 0.6, type: 'triangle', gain: 0.025, channel: 'music' }),
    'music.victory':() => chord([220, 277, 330], { dur: 1.0, type: 'triangle', gain: 0.04, channel: 'music' }),
  };

  const fx = {
    // Lifecycle
    setMuted(v) { muted = !!v; applyVolumes(); },
    isMuted()  { return muted; },

    // Mixer
    setVolume(patch) {
      if (!patch || typeof patch !== 'object') return;
      for (const k of Object.keys(patch)) {
        if (k in volumes && typeof patch[k] === 'number') {
          volumes[k] = Math.max(0, Math.min(1, patch[k]));
        }
      }
      applyVolumes();
    },
    getVolume() { return { ...volumes }; },

    // Bind to AppState.settings.audio — automatically sync mixer.
    bind(audioSettings) {
      if (!audioSettings) return;
      this.setVolume({
        master: audioSettings.masterVolume,
        music:  audioSettings.musicVolume,
        sfx:    audioSettings.sfxVolume,
        ui:     audioSettings.uiVolume,
      });
    },

    // Registry
    register(id, fn) { REGISTRY[id] = fn; },
    play(id) { const fn = REGISTRY[id]; if (fn) fn(); else console.warn('[fx] unknown sound:', id); },

    // Direct named sounds (back-compat with old API)
    capture: () => REGISTRY['capture'](),
    clash:   () => REGISTRY['clash'](),
    damage:  () => REGISTRY['damage'](),
    death:   () => REGISTRY['death'](),
    lead:    () => REGISTRY['lead'](),
    ready:   () => REGISTRY['ready'](),
    victory: () => REGISTRY['victory'](),
    defeat:  () => REGISTRY['defeat'](),
    tap:     () => REGISTRY['ui.tap'](),
  };

  window.fx = fx;

  // Mirror muteWhenInBackground from settings.
  document.addEventListener('visibilitychange', () => {
    if (window.__ARENA_AUDIO_MUTE_BG && document.hidden) fx.setMuted(true);
    else if (window.__ARENA_AUDIO_MUTE_BG && !document.hidden) fx.setMuted(false);
  });
})();

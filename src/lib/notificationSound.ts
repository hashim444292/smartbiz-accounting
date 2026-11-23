/**
 * Professional Notification Sound Utility
 * Dual-engine audio: Native Web Audio API + Compact Base64 PCM WAV audio element.
 * Resilient to browser autoplay restrictions via pre-warm unlocking on login & user gestures.
 */

import { BELL_CHIME_B64 } from "./bellChimeData";

let sharedAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

/**
 * Pre-warm and unlock browser audio.
 * Calling this synchronously during a user gesture (e.g. clicking "Sign In" or clicking the document)
 * permanently permits audio playback for the session in Chrome/Edge/Safari.
 */
export function unlockNotificationAudio(): void {
  if (typeof window === "undefined" || isAudioUnlocked) return;

  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (AudioContextClass) {
      if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
        sharedAudioCtx = new AudioContextClass();
      }
      if (sharedAudioCtx.state === "suspended") {
        sharedAudioCtx.resume().catch(() => {});
      }
      isAudioUnlocked = true;
    }
  } catch {}
}

/**
 * Synthesizes high-clarity bell tones directly in Web Audio context.
 */
function playWebAudioChime(ctx: AudioContext): void {
  try {
    const now = ctx.currentTime;

    // Tone 1: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.65, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Tone 2: A5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.0, now + 0.1);

    gain2.gain.setValueAtTime(0.001, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.75, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.9);
  } catch {}
}

/**
 * Plays the notification bell chime.
 * Employs HTML5 Audio element + Web Audio API fallback with automatic deferred playback on gesture.
 */
export function playNotificationBell(): void {
  if (typeof window === "undefined") return;

  unlockNotificationAudio();

  let audioPlayed = false;

  // Engine 1: HTML5 Audio element with Base64 WAV
  try {
    const audio = new Audio(BELL_CHIME_B64);
    audio.volume = 0.9;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          audioPlayed = true;
        })
        .catch(() => {
          // Autoplay blocked by browser policy; wait for first interaction
          queueDeferredChime();
        });
    }
  } catch {
    // Fall back to Web Audio
  }

  // Engine 2: Web Audio API (if AudioContext is already running)
  if (sharedAudioCtx && sharedAudioCtx.state === "running") {
    playWebAudioChime(sharedAudioCtx);
    audioPlayed = true;
  }

  if (!audioPlayed) {
    queueDeferredChime();
  }
}

/**
 * If browser autoplay blocked initial audio, queue to play on the user's very first interaction anywhere on page.
 */
let deferredPending = false;
function queueDeferredChime(): void {
  if (typeof window === "undefined" || deferredPending) return;
  deferredPending = true;

  const onFirstInteraction = () => {
    deferredPending = false;
    unlockNotificationAudio();

    try {
      const audio = new Audio(BELL_CHIME_B64);
      audio.volume = 0.9;
      audio.play().catch(() => {});
    } catch {}

    if (sharedAudioCtx) {
      if (sharedAudioCtx.state === "suspended") {
        sharedAudioCtx
          .resume()
          .then(() => {
            playWebAudioChime(sharedAudioCtx!);
          })
          .catch(() => {});
      } else if (sharedAudioCtx.state === "running") {
        playWebAudioChime(sharedAudioCtx);
      }
    }

    window.removeEventListener("pointerdown", onFirstInteraction);
    window.removeEventListener("keydown", onFirstInteraction);
    window.removeEventListener("click", onFirstInteraction);
  };

  window.addEventListener("pointerdown", onFirstInteraction, { once: true, passive: true });
  window.addEventListener("keydown", onFirstInteraction, { once: true, passive: true });
  window.addEventListener("click", onFirstInteraction, { once: true, passive: true });
}

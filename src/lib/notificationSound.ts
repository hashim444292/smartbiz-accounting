/**
 * Professional Notification Sound Utility
 * Uses Web Audio API to synthesize a crystal-clear, harmonious two-tone bell chime
 * (D5 -> A5) without requiring any external audio files or network requests.
 * Fully offline-compatible and resilient to browser autoplay policies.
 */

export function playNotificationBell(): void {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    const triggerTones = () => {
      try {
        const now = ctx.currentTime;

        // Tone 1: D5 (587.33 Hz) - Warm Bell Attack
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(587.33, now);

        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.6);

        // Tone 2: A5 (880.00 Hz) - Crystal Chime Harmonic
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880.0, now + 0.12);

        gain2.gain.setValueAtTime(0.001, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.35, now + 0.14);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.9);

        // Cleanup context after audio finishes
        setTimeout(() => {
          try {
            if (ctx.state !== "closed") {
              ctx.close().catch(() => {});
            }
          } catch {}
        }, 1200);
      } catch {}
    };

    if (ctx.state === "suspended") {
      // Browser autoplay policy blocked audio - resume on first user interaction
      const resumeAndPlay = () => {
        ctx
          .resume()
          .then(() => {
            triggerTones();
          })
          .catch(() => {});
        window.removeEventListener("click", resumeAndPlay);
        window.removeEventListener("keydown", resumeAndPlay);
        window.removeEventListener("touchstart", resumeAndPlay);
      };

      window.addEventListener("click", resumeAndPlay, { once: true, passive: true });
      window.addEventListener("keydown", resumeAndPlay, { once: true, passive: true });
      window.addEventListener("touchstart", resumeAndPlay, { once: true, passive: true });
    } else {
      triggerTones();
    }
  } catch {}
}

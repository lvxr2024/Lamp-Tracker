/** Eyecare: beep + optional OS banner when an eye-break warning fires. */

export const EYECARE_BOUNDARY_MS = 25 * 60_000;

/** Next 25-minute mark already passed, or null if none since lastMs. */
export function crossedEyecareBoundary(focusedMs: number, lastMs: number): number | null {
  const crossed = Math.floor(focusedMs / EYECARE_BOUNDARY_MS) * EYECARE_BOUNDARY_MS;
  return crossed > lastMs ? crossed : null;
}

type WebAudioCtor = typeof AudioContext;

function AudioCtor(): WebAudioCtor | undefined {
  const w = window as Window & { webkitAudioContext?: WebAudioCtor };
  return window.AudioContext ?? w.webkitAudioContext;
}

let audioCtx: AudioContext | null = null;
let notificationAsked = false;

/** Call from a user gesture (Start, toggle) so the beep may play later. */
export function unlockEyecareAudio(): void {
  try {
    const Ctor = AudioCtor();
    if (!Ctor) return;
    if (!audioCtx || audioCtx.state === 'closed') audioCtx = new Ctor();
    if (audioCtx.state !== 'running') void audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

function beepNow(ctx: AudioContext): void {
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  // linear ramps — exponentialRamp from ~0 throws in some browsers and plays nothing
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
  gain.gain.linearRampToValueAtTime(0, t + 1.1);
  for (const [freq, offset] of [
    [659.25, 0],
    [880, 0.16],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(t + offset);
    osc.stop(t + 1.15);
  }
}

/** Chime. Resumes a suspended context instead of bailing out silently. */
export function playEyecareBeep(): void {
  try {
    unlockEyecareAudio();
    if (!audioCtx) return;
    const ctx = audioCtx;
    if (ctx.state === 'running') {
      beepNow(ctx);
      return;
    }
    void ctx.resume().then(() => {
      if (ctx.state === 'running') beepNow(ctx);
    });
  } catch {
    // no sound — on-screen cue still shows
  }
}

/** Ask at most once, only from a user gesture; denied/unsupported → skip forever. */
export function maybeAskEyecareNotification(): void {
  try {
    if (notificationAsked) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      notificationAsked = true;
      void Notification.requestPermission();
    }
  } catch {
    // unsupported — skip
  }
}

export function notifyEyecareBreak(): void {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    // silent: true — the chime (if audible) is the only sound; volume at 0 still gets this banner
    new Notification('Lamp', {
      body: 'Look outside — open Lamp and pause.',
      silent: true,
      requireInteraction: true,
    });
  } catch {
    // banner unavailable — title flash + on-screen panel still carry the cue
  }
}

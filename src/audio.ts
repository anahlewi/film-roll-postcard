/**
 * Synthesized SLR shutter — two curtain bursts, a mirror clack and a body
 * thump. No audio files. The context is created lazily on the first call so it
 * always follows a user gesture.
 */
let ctx: AudioContext | null = null;

export function playShutter(): void {
  try {
    ctx ??= new (window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    return;
  }

  const ac = ctx;
  const t = ac.currentTime;

  const master = ac.createGain();
  master.gain.value = 0.9;
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 140;
  master.connect(hp);
  hp.connect(ac.destination);

  const burst = (at: number, freq: number, q: number, dur: number, level: number) => {
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start(at);
    src.stop(at + dur + 0.02);
  };

  const tap = (at: number, freq: number, dur: number, level: number, type: OscillatorType) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(master);
    o.start(at);
    o.stop(at + dur + 0.02);
  };

  const j = (Math.random() - 0.5) * 0.006;
  burst(t, 3100 + Math.random() * 300, 1.1, 0.028, 0.85); // first curtain
  tap(t, 460 + Math.random() * 40, 0.02, 0.14, "square"); // mirror / mechanism
  tap(t + 0.001, 92, 0.085, 0.22, "sine"); // body thump
  burst(t + 0.052 + j, 2250 + Math.random() * 250, 1.3, 0.05, 0.6); // second curtain
  tap(t + 0.052 + j, 360, 0.03, 0.09, "square");
}

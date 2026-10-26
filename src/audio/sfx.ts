/**
 * Web Audio 로 직접 합성하는 효과음.
 *
 * - 음원 파일이 없어서 추가 용량이 0바이트고, 오프라인에서도 난다.
 * - 브라우저는 사용자 제스처 없이 소리를 막으므로(자동재생 정책)
 *   첫 클릭/키 입력에서 unlockAudio() 를 불러 AudioContext 를 깨워야 한다.
 * - 모든 소리는 master → limiter 를 거치므로 연타해도 찢어지지 않는다.
 */

export type SfxName =
  | 'pop'
  | 'tap'
  | 'punch'
  | 'smash'
  | 'bonk'
  | 'catch'
  | 'buzz'
  | 'sparkle'
  | 'chime'
  | 'perfect'
  | 'good'
  | 'miss'
  | 'tick'
  | 'rainbow'
  | 'finish'
  | 'drum';

const MUTE_KEY = 'momgame.muted';
/** 같은 소리가 이 간격보다 가까우면 버린다(연타로 겹쳐 찢어지는 것 방지). */
const MIN_GAP = 0.025;

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = readMuted();
const played = new Map<string, number>();

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function makeNoise(c: AudioContext) {
  const len = Math.floor(c.sampleRate * 0.7);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** AudioContext 를 (없으면) 만들고 버스를 돌려준다. 제스처 안에서 부르는 게 안전하다. */
function ensureAudio() {
  if (ac) return sfxBus ? { ctx: ac, out: sfxBus } : null;

  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  try {
    ac = new Ctor();
  } catch {
    ac = null;
    return null;
  }

  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.9;

  // 여러 소리가 겹칠 때 클리핑을 막는 리미터.
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.knee.value = 10;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.22;

  sfxBus = ac.createGain();
  sfxBus.connect(master);
  master.connect(limiter);
  limiter.connect(ac.destination);

  noise = makeNoise(ac);
  return { ctx: ac, out: sfxBus };
}

/** 배경음 모듈도 같은 버스를 쓴다. */
export function audioBus() {
  return ensureAudio();
}

/** 첫 사용자 제스처에서 호출: 자동재생 잠금을 푼다. */
export function unlockAudio() {
  const a = ensureAudio();
  if (!a) return;
  if (a.ctx.state !== 'running') void a.ctx.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    /* 저장이 막힌 브라우저는 무시 */
  }
  if (!ac || !master) return;
  const t = ac.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(value ? 0 : 0.9, t + 0.06);
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

type ToneOpts = {
  f: number;
  to?: number;
  at: number;
  dur: number;
  gain?: number;
  type?: OscillatorType;
  attack?: number;
};

function tone(c: AudioContext, out: AudioNode, o: ToneOpts) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, o.at);
  if (o.to !== undefined && o.to !== o.f) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), o.at + o.dur);
  }

  const peak = o.gain ?? 0.2;
  const attack = Math.min(o.attack ?? 0.006, o.dur * 0.4);
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), o.at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);

  osc.connect(g).connect(out);
  osc.start(o.at);
  osc.stop(o.at + o.dur + 0.03);
}

export type NoiseOpts = {
  at: number;
  dur: number;
  gain?: number;
  type?: BiquadFilterType;
  f?: number;
  sweepTo?: number;
  q?: number;
};

/** 짧은 노이즈 타격. 음악 모듈의 스네어/하이햇도 이걸 쓴다. */
export function playNoise(c: AudioContext, out: AudioNode, o: NoiseOpts) {
  noise ??= makeNoise(c);
  const src = c.createBufferSource();
  src.buffer = noise;

  const filter = c.createBiquadFilter();
  filter.type = o.type ?? 'lowpass';
  filter.frequency.setValueAtTime(Math.max(40, o.f ?? 1200), o.at);
  if (o.sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, o.sweepTo), o.at + o.dur);
  filter.Q.value = o.q ?? 0.8;

  const g = c.createGain();
  const peak = Math.max(0.0002, o.gain ?? 0.15);
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(peak, o.at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);

  src.connect(filter).connect(g).connect(out);
  src.start(o.at, Math.random() * 0.3);
  src.stop(o.at + o.dur + 0.03);
}

function arp(
  c: AudioContext,
  out: AudioNode,
  t: number,
  notes: number[],
  step: number,
  dur: number,
  gain: number,
  type: OscillatorType = 'triangle',
) {
  notes.forEach((f, i) => tone(c, out, { f, at: t + i * step, dur, gain, type }));
}

/** 게임에서 부르는 효과음. variant 는 리듬 북의 레인 번호처럼 소리를 살짝 바꿀 때 쓴다. */
export function sfx(name: SfxName, variant = 0) {
  if (muted) return;
  const a = ensureAudio();
  if (!a) return;
  const { ctx: c, out } = a;
  if (c.state === 'suspended') void c.resume();

  const t = c.currentTime;
  const key = variant ? `${name}:${variant}` : name;
  const prev = played.get(key) ?? -1;
  if (t - prev < MIN_GAP) return;
  played.set(key, t);

  switch (name) {
    case 'pop':
      tone(c, out, { f: 760, to: 230, at: t, dur: 0.11, gain: 0.22 });
      playNoise(c, out, { at: t, dur: 0.05, gain: 0.12, type: 'highpass', f: 1500 });
      break;

    case 'tap':
      tone(c, out, { f: 520, to: 430, at: t, dur: 0.055, gain: 0.1, type: 'triangle' });
      break;

    case 'punch':
      tone(c, out, { f: 165, to: 62, at: t, dur: 0.13, gain: 0.3 });
      playNoise(c, out, { at: t, dur: 0.07, gain: 0.16, type: 'lowpass', f: 900 });
      break;

    case 'smash':
      tone(c, out, { f: 150, to: 55, at: t, dur: 0.14, gain: 0.24 });
      playNoise(c, out, { at: t, dur: 0.3, gain: 0.17, type: 'lowpass', f: 4200, sweepTo: 700 });
      [1860, 2380, 3050].forEach((f, i) =>
        tone(c, out, { f, to: f * 0.82, at: t + i * 0.028, dur: 0.16, gain: 0.07, type: 'triangle' }),
      );
      break;

    case 'bonk':
      tone(c, out, { f: 300, to: 150, at: t, dur: 0.1, gain: 0.24 });
      playNoise(c, out, { at: t, dur: 0.03, gain: 0.07, type: 'bandpass', f: 900 });
      break;

    case 'catch':
      tone(c, out, { f: 520, to: 880, at: t, dur: 0.1, gain: 0.16, type: 'triangle' });
      tone(c, out, { f: 1240, at: t + 0.05, dur: 0.1, gain: 0.06 });
      break;

    case 'buzz':
      tone(c, out, { f: 170, at: t, dur: 0.16, gain: 0.08, type: 'square' });
      tone(c, out, { f: 128, at: t + 0.1, dur: 0.14, gain: 0.07, type: 'square' });
      break;

    case 'sparkle':
      arp(c, out, t, [1046, 1318, 1568, 2093], 0.04, 0.22, 0.05);
      break;

    case 'chime':
      arp(c, out, t, [523, 659, 784, 1046], 0.07, 0.34, 0.08);
      break;

    case 'perfect':
      arp(c, out, t, [1046, 1318, 1568, 2093], 0.045, 0.2, 0.06);
      tone(c, out, { f: 2637, at: t + 0.16, dur: 0.22, gain: 0.04 });
      break;

    case 'good':
      tone(c, out, { f: 880, at: t, dur: 0.09, gain: 0.09, type: 'triangle' });
      break;

    case 'miss':
      tone(c, out, { f: 220, to: 110, at: t, dur: 0.13, gain: 0.05, type: 'square' });
      playNoise(c, out, { at: t, dur: 0.06, gain: 0.04, type: 'lowpass', f: 420 });
      break;

    case 'tick':
      tone(c, out, { f: 1180, at: t, dur: 0.035, gain: 0.05, type: 'triangle' });
      break;

    case 'rainbow':
      tone(c, out, { f: 523, to: 1568, at: t, dur: 0.5, gain: 0.1, type: 'triangle' });
      playNoise(c, out, { at: t, dur: 0.45, gain: 0.05, type: 'bandpass', f: 1800, sweepTo: 4200, q: 1.2 });
      arp(c, out, t + 0.16, [1046, 1318, 1568, 2093], 0.06, 0.2, 0.045);
      break;

    case 'finish':
      arp(c, out, t, [523, 659, 784, 1046], 0.1, 0.32, 0.09);
      tone(c, out, { f: 1568, at: t + 0.42, dur: 0.5, gain: 0.07, type: 'triangle' });
      break;

    case 'drum': {
      const base = [196, 247, 294][Math.max(0, Math.min(2, variant))];
      tone(c, out, { f: base * 2.4, to: base * 0.8, at: t, dur: 0.16, gain: 0.22 });
      playNoise(c, out, { at: t, dur: 0.04, gain: 0.08, type: 'highpass', f: 1600 });
      break;
    }
  }
}

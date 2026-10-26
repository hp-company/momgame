/**
 * 리듬 북용 배경 반주.
 *
 * setInterval 로 "미리" 악보를 예약(schedule)하고, 실제 재생 시각은
 * AudioContext.currentTime 으로 잡는다. 이렇게 해야 setTimeout 오차 없이
 * 박자가 흔들리지 않는다. (Web Audio 스케줄러의 표준 패턴)
 */

import { audioBus, playNoise } from './sfx';

const BPM = 102;
/** 8분음표 길이 */
const STEP = 60 / BPM / 2;
const STEPS = 16;
const LOOKAHEAD = 0.15;
const TICK_MS = 25;

/** C2 · C2 · F2 · G2 — 두 마디마다 한 번씩 바뀐다. */
const BASS = [65.41, 65.41, 87.31, 98];

let timer: number | null = null;
let ac: AudioContext | null = null;
let bus: GainNode | null = null;
let next = 0;
let step = 0;

export function startMusic() {
  const a = audioBus();
  if (!a || timer !== null) return;

  ac = a.ctx;
  if (ac.state === 'suspended') void ac.resume();

  bus = ac.createGain();
  bus.gain.setValueAtTime(0.0001, ac.currentTime);
  bus.gain.exponentialRampToValueAtTime(0.4, ac.currentTime + 0.9);
  bus.connect(a.out);

  next = ac.currentTime + 0.12;
  step = 0;
  timer = window.setInterval(schedule, TICK_MS);
  schedule();
}

export function stopMusic() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }

  const c = ac;
  const g = bus;
  ac = null;
  bus = null;
  if (!c || !g) return;

  const t = c.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  window.setTimeout(() => {
    try {
      g.disconnect();
    } catch {
      /* 이미 끊겼으면 무시 */
    }
  }, 360);
}

function schedule() {
  const c = ac;
  const g = bus;
  if (!c || !g) return;

  // 탭이 백그라운드에 있으면 setInterval 이 밀린다 → 몰아서 재생하지 않게 건너뛴다.
  if (next < c.currentTime - 0.2) next = c.currentTime + 0.05;

  while (next < c.currentTime + LOOKAHEAD) {
    beat(c, g, step, next);
    next += STEP;
    step = (step + 1) % STEPS;
  }
}

function beat(c: AudioContext, out: AudioNode, s: number, t: number) {
  if (s === 0 || s === 6 || s === 8 || s === 14) kick(c, out, t, s === 0 ? 1 : 0.72);
  if (s === 4 || s === 12) snare(c, out, t);
  if (s % 2 === 1) hat(c, out, t);
  if (s === 0 || s === 8) bass(c, out, t, BASS[s / 8]);
  if (s === 3 || s === 10 || s === 13) pluck(c, out, t, [523, 659, 784][(s + 1) % 3]);
}

function kick(c: AudioContext, out: AudioNode, t: number, v: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(46, t + 0.14);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.42 * v, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.25);
}

function snare(c: AudioContext, out: AudioNode, t: number) {
  playNoise(c, out, { at: t, dur: 0.12, gain: 0.1, type: 'bandpass', f: 1800, q: 0.9 });
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(210, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.12);
}

function hat(c: AudioContext, out: AudioNode, t: number) {
  playNoise(c, out, { at: t, dur: 0.03, gain: 0.028, type: 'highpass', f: 7000 });
}

function bass(c: AudioContext, out: AudioNode, t: number, f: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.45);
}

function pluck(c: AudioContext, out: AudioNode, t: number, f: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.03, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.27);
}

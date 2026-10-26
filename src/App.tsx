import { useEffect, useRef, useState } from 'react';
import { isMuted, setMuted as setAudioMuted, sfx, unlockAudio } from './audio/sfx';
import { startMusic, stopMusic } from './audio/music';
import { openCamera, type Camera } from './motion/camera';
import { createPoseEngine, type Pose, type PoseEngine } from './motion/pose';
import {
  BodyScale,
  PunchTracker,
  assignPlayers,
  collectHands,
  shoulderSpan,
  type HandSample,
  type Punch,
} from './motion/punch';
import { coverRect } from './motion/viewport';
import { drawScene } from './game/render';
import { GAMES, type GameMeta } from './game/registry';
import type { MiniGame } from './game/types';

type Phase = 'home' | 'loading' | 'playing' | 'result';
type Result = { scores: [number, number]; levels: [number, number]; title: string };

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
/** ?demo=1 — 카메라 없이 마우스로 확인하는 개발 모드 */
const DEMO = params.get('demo') === '1';

/** 카메라/포즈 오류를 아이도 읽을 수 있는 문장으로 바꾼다. */
function cameraMessage(e: unknown) {
  const err = e instanceof Error ? e : null;
  const name = err?.name ?? '';
  const text = err?.message ?? String(e);

  if (!navigator.mediaDevices?.getUserMedia) {
    return '이 브라우저에서는 카메라를 켤 수 없어요. Chrome·Safari에서 https 주소로 열어 주세요.';
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return '카메라 권한이 거부되었습니다. 주소창의 카메라 아이콘에서 허용해 주세요.';
  }
  if (name === 'NotFoundError' || /device not found|no camera/i.test(text)) {
    return '카메라를 찾지 못했어요. 기기에 카메라가 연결되어 있는지 확인해 주세요.';
  }
  if (name === 'NotReadableError' || /could not start|in use/i.test(text)) {
    return '카메라를 다른 앱이 쓰고 있어요. 화상회의 앱을 끄고 다시 시도해 주세요.';
  }
  return `준비 중 문제가 생겼어요: ${text}`;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('home');
  const [players, setPlayers] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<GameMeta>(GAMES[0]);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [delegate, setDelegate] = useState('');
  const [muted, setMuted] = useState(isMuted());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera | null>(null);
  const engineRef = useRef<PoseEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const gameRef = useRef<MiniGame | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, px: 0, py: 0, prevT: 0, seenT: 0, hitAt: 0 });

  const teardown = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    cameraRef.current?.stop();
    cameraRef.current = null;
    engineRef.current?.close();
    engineRef.current = null;
  };

  useEffect(() => teardown, []);

  // 브라우저 자동재생 정책: 첫 제스처에서 AudioContext 를 깨워 둔다.
  useEffect(() => {
    const wake = () => unlockAudio();
    const onVisible = () => {
      if (document.visibilityState === 'visible') unlockAudio();
    };
    window.addEventListener('pointerdown', wake, { passive: true });
    window.addEventListener('keydown', wake);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
    if (!next) {
      unlockAudio();
      sfx('tap');
    }
  };

  const start = async (game: GameMeta = selected) => {
    unlockAudio();
    setSelected(game);
    setError(null);
    setResult(null);
    setPhase('loading');

    if (DEMO) {
      setPhase('playing');
      return;
    }

    try {
      if (!cameraRef.current) {
        setProgress('카메라를 켜는 중…');
        cameraRef.current = await openCamera(videoRef.current!);
      }
      if (!engineRef.current) {
        setProgress('포즈를 준비하는 중… (첫 실행은 몇 초 걸려요)');
        engineRef.current = await createPoseEngine({ numPoses: 2 });
        setDelegate(engineRef.current.delegate);
      }
      setPhase('playing');
    } catch (e) {
      teardown();
      setError(cameraMessage(e));
      setPhase('home');
    }
  };

  // 게임 루프
  useEffect(() => {
    if (phase !== 'playing') return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas) return;
    if (!DEMO && (!video || !engine)) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.clientWidth;
    let h = canvas.clientHeight;
    const game = selected.create(players, w, h);
    gameRef.current = game;
    // 리듬 북만 배경 반주를 깐다. 다른 게임은 효과음만.
    if (selected.id === 'rhythm') startMusic();
    else stopMusic();
    if (DEMO) (window as unknown as { __game?: MiniGame }).__game = game;
    const tracker = new PunchTracker();
    const scales = [new BodyScale(), new BodyScale()];

    let poses: Pose[] = [];
    let playerOfPose: number[] = [];
    let hands: HandSample[] = [];
    let spans: (number | null)[] = [null, null];

    const t0 = performance.now();
    let last = t0;
    let lastVideoTime = -1;
    let frames = 0;
    let fpsAt = t0;
    let fps = 0;
    let inferenceMs = 0;
    let stopped = false;
    let lastTick = -1;

    const loop = () => {
      if (stopped) return;
      rafRef.current = requestAnimationFrame(loop);

      w = canvas.clientWidth;
      h = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        game.resize(w, h);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = (now - t0) / 1000;

      frames++;
      if (now - fpsAt > 500) {
        fps = (frames * 1000) / (now - fpsAt);
        frames = 0;
        fpsAt = now;
      }

      const cover = video ? coverRect(video.videoWidth, video.videoHeight, w, h) : coverRect(16, 9, w, h);

      if (!DEMO && video && engine && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const i0 = performance.now();
        poses = engine.detect(video, now);
        inferenceMs = performance.now() - i0;
        playerOfPose = assignPlayers(poses, cover, players, w);
        hands = collectHands(poses, playerOfPose, cover);
        for (let p = 0; p < players; p++) {
          const pose = poses[p];
          scales[p].update(pose ? shoulderSpan(pose, cover) : null, h);
        }
        spans = scales.slice(0, players).map((s) => s.current);
      }

      let punches: Punch[] = [];
      if (DEMO) {
        const p = pointerRef.current;
        const player = players === 2 && p.x > w / 2 ? 1 : 0;
        hands = [];
        if (p.seenT > 0) {
          hands.push({ hand: 15, x: p.x, y: p.y, player });
          if (game.handCount === 2) {
            // 두 손 게임 확인용: 마우스 오른쪽에 두 번째 손을 붙인다.
            const off = Math.max(150, w * 0.16);
            hands.push({ hand: 16, x: Math.min(w - 8, p.x + off), y: p.y, player });
          }
        }
        if (p.seenT > 0 && p.prevT > 0) {
          const dtp = (now - p.prevT) / 1000;
          if (dtp > 0 && dtp < 0.25) {
            const v = Math.hypot(p.x - p.px, p.y - p.py) / dtp;
            if (v > h * 0.15 && now - p.hitAt > 250) {
              p.hitAt = now;
              punches.push({ hand: 15, x: p.x, y: p.y, player, speed: v });
            }
          }
        }
        p.px = p.x;
        p.py = p.y;
        p.prevT = now;
      } else {
        punches = tracker.step(dt, hands, spans);
      }

      for (const punch of punches) game.punch(punch);
      game.update(dt, hands);

      // 마지막 3초 카운트다운
      const sec = Math.ceil(game.timeLeft);
      if (sec > 0 && sec <= 3 && sec !== lastTick) {
        lastTick = sec;
        sfx('tick');
      }

      drawScene({ ctx, video: DEMO ? null : video, cover, w, h, game, poses, playerOfPose, hands, time });

      if (DEBUG || DEMO) {
        ctx.save();
        ctx.font = '600 13px ui-monospace, monospace';
        ctx.fillStyle = 'rgba(90,74,99,0.85)';
        ctx.textAlign = 'left';
        const lines = [
          `FPS ${fps.toFixed(0)}  infer ${inferenceMs.toFixed(1)}ms  ${DEMO ? 'DEMO' : engine?.delegate}`,
          `poses ${poses.length}  span ${spans.map((s) => (s ? s.toFixed(0) : '-')).join(' / ')}`,
          `thr ${spans.map((s) => (s ? (s * 0.6).toFixed(0) : '-')).join(' / ')} px/s`,
          `${selected.id}  score ${game.scores.join('/')}`,
        ];
        lines.forEach((line, i) => ctx.fillText(line, 12, h - 12 - (lines.length - 1 - i) * 17));
        ctx.restore();
      }

      if (game.done) {
        stopped = true;
        stopMusic();
        sfx('finish');
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        setResult({
          scores: [...game.scores] as [number, number],
          levels: [...game.levels] as [number, number],
          title: selected.title,
        });
        setPhase('result');
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      stopMusic();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase, players, selected]);

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!DEMO) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = pointerRef.current;
    p.x = e.clientX - rect.left;
    p.y = e.clientY - rect.top;
    p.seenT = performance.now();
  };

  return (
    <div className="app">
      <video ref={videoRef} className="cam" playsInline muted autoPlay />
      <canvas
        ref={canvasRef}
        className="stage"
        aria-label="게임 화면"
        data-on={phase === 'playing'}
        onPointerMove={onPointerMove}
      />

      {phase !== 'loading' && (
        <button
          type="button"
          className="sound"
          aria-pressed={muted}
          aria-label={muted ? '소리 켜기' : '소리 끄기'}
          onClick={toggleSound}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}

      {phase === 'home' && (
        <section className="screen home">
          <header className="brand">
            <span className="brand-emoji">🎀</span>
            <div>
              <h1>몸짓 아케이드</h1>
              <p>카메라 앞에서 손으로 노는 놀이터</p>
            </div>
          </header>

          <div className="seg" role="radiogroup" aria-label="몇 명이 할까요?">
            <button type="button" aria-checked={players === 1} onClick={() => setPlayers(1)}>
              1명
            </button>
            <button type="button" aria-checked={players === 2} onClick={() => setPlayers(2)}>
              2명 대결
            </button>
          </div>

          <ul className="games">
            {GAMES.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  className={`card${selected.id === g.id ? ' on' : ''}`}
                  style={{ ['--accent' as string]: g.accent }}
                  onClick={() => {
                    unlockAudio();
                    sfx('tap');
                    setSelected(g);
                  }}
                >
                  <span className="card-emoji">{g.emoji}</span>
                  <strong>{g.title}</strong>
                  <small>{g.line}</small>
                  <em>{g.tag}</em>
                  {selected.id === g.id && <span className="card-check">✓</span>}
                </button>
              </li>
            ))}
          </ul>

          {error && <p className="error">{error}</p>}

          <div className="cta">
            <button className="primary" type="button" onClick={() => start()}>
              {selected.emoji} {selected.title} 시작
            </button>
            <small className="note">카메라 영상은 이 기기 안에서만 쓰이고, 저장하거나 보내지 않아요.</small>
          </div>
        </section>
      )}

      {phase === 'loading' && (
        <section className="screen">
          <div className="dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <p className="sub">{progress}</p>
        </section>
      )}

      {phase === 'playing' && (
        <div className="ingame">
          <button className="chip back" type="button" onClick={() => setPhase('home')} aria-label="그만하기">
            ←
          </button>
          <p className="chip title">
            {selected.emoji} {selected.title}
          </p>
        </div>
      )}

      {phase === 'result' && result && (
        <section className="screen">
          <p className="ribbon">{result.title} · 한 판 끝</p>
          <h1 className="result-title">
            {players === 2
              ? result.scores[0] === result.scores[1]
                ? '무승부!'
                : result.scores[0] > result.scores[1]
                  ? 'P1 승리!'
                  : 'P2 승리!'
              : '잘했어요!'}
          </h1>
          <div className="scores">
            <div>
              <span>P1</span>
              <strong>{result.scores[0]}</strong>
              <em>Lv.{result.levels[0]}</em>
            </div>
            {players === 2 && (
              <div>
                <span>P2</span>
                <strong>{result.scores[1]}</strong>
                <em>Lv.{result.levels[1]}</em>
              </div>
            )}
          </div>
          <button className="primary" type="button" onClick={() => start(selected)}>
            한 판 더
          </button>
          <button className="ghost" type="button" onClick={() => setPhase('home')}>
            다른 게임 고르기
          </button>
        </section>
      )}

      {phase === 'home' && <p className="badge">{DEMO ? 'mode: demo' : delegate ? `pose: ${delegate}` : 'pose: —'}</p>}
    </div>
  );
}

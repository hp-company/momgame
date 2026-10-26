# 분석: 펀치펀치 놀이터 (motion-game.wmf34a.workers.dev)

분석일: 2026-10-27 · 대상 버전 표기: `1.2.8`

> 이 문서는 **공개된 배포 산출물을 관찰한 기록**이다. 원본의 코드/아트/폰트를 복제하지 않고,
> 동작 방식과 수치만 우리 구현(`src/`)의 근거로 사용한다.

---

## 1. 한 줄 요약

카메라 앞에서 **상체 동작**으로 노는 아동용 미니게임 모음 PWA.
MediaPipe Pose Landmarker(lite)로 손목/어깨/팔꿈치 좌표를 뽑아, **손목 속도**와 **관절 각도**로
펀치·손 뻗기·자세 따라하기·엉덩이 흔들기를 판정한다. 게임 7종 + 출시 예정 2종 + 구독 상품(펀치 패스).

## 2. 기술 스택 (관찰 근거)

| 항목 | 관찰값 | 근거 |
|---|---|---|
| 프레임워크 | 정적 SPA (Vite 빌드 산출물) | `/assets/index-*.js` 단일 번들 279,914 B, `/assets/index-*.css` 16,762 B |
| 포즈 추론 | **MediaPipe Tasks Vision `PoseLandmarker`** | 번들 내 `mediapipe.tasks.vision.pose_landmarker.PoseLandmarkerGraph` |
| 모델 | `pose_landmarker_lite.task` (5.7 MB) self-host | 번들 상수 `/models/pose_landmarker_lite.task` |
| WASM | `/wasm/` (SIMD 13.5 MB / noSIMD 12.6 MB) self-host | `/wasm/vision_wasm_internal.wasm` |
| 렌더링 | Canvas 2D (`#stage` 단일 캔버스) | HTML `<canvas id="stage">` |
| 오디오 | Web Audio (`AudioContext` + DynamicsCompressor) | 번들 내 `createDynamicsCompressor` |
| PWA | manifest + 서비스워커 `/sw.js`, `display: fullscreen` | `/manifest.webmanifest` |
| 호스팅 | Cloudflare Workers (`*.workers.dev`), `cf-cache-status: HIT` | 응답 헤더 |
| 폰트 | Jua + IBM Plex Sans KR (fontsource 조각 woff2), Pretendard | `/fonts/webfonts.css` 주석 및 요청 목록 |
| 분석 | 자체 비콘 `POST /api/visit` (sendBeacon) + 선택적 MediaPipe 텔레메트리 | 번들 `sendBeacon`, `odml.pa.googleapis.com` |

포즈 옵션: `numPoses` 가변(1~2명), detection/presence/tracking confidence 각 0.5, `runningMode: VIDEO`.

## 3. 게임 카탈로그

무료 7종 (한 판 45초, 1·2명 / 짝 맞추기만 60초):

| id | 제목 | 판정 방식 (gesture id) |
|---|---|---|
| `balloon` | 풍선 터뜨리기 🎈 | 손으로 풍선 닿기 (`reach-balloon`) |
| `ice` | 얼음 깨기 🧊 | 주먹 속도로 타격 (`punch-ice`) |
| `mole` | 땅속 친구 🦖 | 올라온 두더지 손으로 잡기 (`tap-mole`) |
| `star` | 별 따기 ⭐ | 손 뻗어 별 모으기 (`reach-star`) |
| `pose` | 따라쟁이 🙌 | 그림과 같은 자세 (`copy-pose`) |
| `heli` | 헬리콥터 🚁 | 엉덩이 좌우 흔들기 (`hips-sway`) |
| `memory` | 짝 맞추기 🃏 | 손을 든 채 카드 위에 멈추기 (`tap-card`) |

잠금(출시 예정): `dino` 공룡 피하기, `pingpong` 펀치 탁구.
수익화: `펀치 패스` 월 4,900원 / 7일 무료 체험 (출시 예정, 결제 버튼 비활성).

## 4. 핵심 수치 (우리 구현에 그대로 채택)

### 4.1 펀치 판정 — `speed 0.6 / minGap 0.35s / stale 0.3s`

```
어깨폭  = hypot((Lshoulder - Rshoulder) × 화면스케일)     // 몸 크기 기준
어깨폭' = EMA(어깨폭, α=0.3), clamp(0.08·H, 0.5·H)        // 프레임 튐 억제
속도    = |손목[t] - 손목[t-1]| / Δt                      // px/s
판정    = 속도 ≥ 0.6 × 어깨폭'  이고  같은 손 쿨다운 0.35s 경과
Δt > 0.3s 이면 속도 0 (프레임 끊김 무시)
```

→ 거리(카메라와의 거리)에 무관한 판정. `0.6 × 어깨폭`이 초당 이동량 기준.

### 4.2 얼음 깨기 (`ice`)

- 블록 10개(2인은 진영별), **5대 맞으면 파괴**, 45초
- 블록 격자: `gap = 0.02·W`, 세로 영역 `0.24H ~ 0.80H`, 정사각형 유지하며 `rows×cols ≥ N` 중 한 변 최대
- 피격 시 wobble 0.25s, 파괴 시 파편 + 점수
- 2인: 화면 좌/우 진영 분할, 진영 밖 손은 무시

### 4.3 따라쟁이 (`pose`)

- 포즈 16종: `dino, hands-up, robot, airplane, right-up, left-up, heart, right-out, left-out, hips, cross, rabbit, chicken, lightning, teapot, clock`
- `holdS 0.6s` 유지, `needS 4`회 성공, `flashS 1.2s`, 각도 허용오차 `30°`(어려운 동작 `25°`),
  팔꿈치 각 `45°~135°`, 관절 visibility `≥ 0.5`
- 판정은 **관절 각도 + 손/어깨 상대 위치** 조합 (`atan2` 각도, 벡터 내적)

## 5. UX / 제품 관찰

- 시작 화면: 1명 / 2명 대결 토글, "한 판 45초", "점프는 하지 않아요" 안전 문구, 카메라 미저장 고지
- 인앱 브라우저(iOS/Android)에서 카메라가 막히면 **"크롬으로 열기" 탈출 UI** + 링크 복사 제공
- 홈 화면 추가 유도 다이얼로그 + `beforeinstallprompt` 처리 + "오늘 하루 보지 않기"
- 세로/가로 회전 안내, 전체 화면 버튼, 음소거(상태 저장 `motion-game:mute`)
- 캘리브레이션: 어깨·팔꿈치·손목 등 필수 관절 visibility 칩 표시, 일정 프레임 연속 OK 시 시작
- 디버그: `?debug=1` 에서 FPS/추론시간/기울기/누락 관절 오버레이
- 시즌 스킨: `html.skin-halloween` (현재 할로윈 장식), 자산은 `/assets/bumblev/`

## 6. 우리 PLAN.md와 비교

| 항목 | 원본 | 우리 계획 |
|---|---|---|
| 게임 수 | 7종 미니게임 | 리듬 펀치 1종 버티컬 슬라이스 |
| 포즈 모델 | Pose Landmarker **lite** | 동일 (lite, GPU) |
| 판정 축 | 손목 속도 + 관절 각도 | 손목 속도 + 팔 신전 + (후속) 스쿼트 |
| 판정 임계 | **몸 크기(어깨폭) 정규화** | 채택 권장 |
| 세션 길이 | 45초 | 60~90초 |
| 수익화 | 구독(펀치 패스) | MVP엔 없음 |
| 인앱브라우저 대응 | 탈출 UI 있음 | 계획에 없음 → 추가 권장 |
| 캘리브레이션 | 관절별 침 표시 | 계획에 있음 (동일 방향) |

## 7. 재구현 주의

- **복제 금지 대상**: 번들 JS, 아트 SVG, 폰트 파일, 문구/캐릭터, 아이콘, 서비스워커, 분석 엔드포인트.
- **재사용 가능**: 동작 메커니즘(속도 기반 펀치, 어깨폭 정규화), 게임 규칙 수치, 표준 라이브러리(MediaPipe, Vite).
- 원본은 상업 서비스이므로, 로고/이름/캐릭터를 피하고 자체 아트·문구로 만든다.

---

## 부록: 수집 명령 메모

```bash
curl -s https://motion-game.wmf34a.workers.dev/ | head -50
curl -s https://motion-game.wmf34a.workers.dev/assets/index-*.js -o bundle.js
grep -o "pose_landmarker_lite.task\|eh={speed[^}]*}\|hitsToBreak[^,]*" bundle.js
```

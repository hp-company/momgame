# 몸짓 아케이드 (프로토타입)

카메라 앞에서 상체 동작으로 노는 웹/PWA 미니게임. 파스텔 톤 + 얼굴 달린 캐릭터로 만든 귀여운 버전. 현재 **10종**.

- 계획: `PLAN.md`
- 경쟁/참고 서비스 분석: `ANALYSIS.md` (판정식·라운드 길이만 참고, 아트/문구/코드는 원본)
- 포즈: MediaPipe Tasks Vision `PoseLandmarker` (lite, GPU) — 모델/WASM self-host

## 게임

| 게임 | 조작 | 규칙 |
|---|---|---|
| 🎈 풍선 터뜨리기 | 손을 풍선에 **대기** | 손이 닿으면 터짐, 계속 올라옴 |
| 🧊 얼음 깨기 | 손목을 **빠르게** 튕기기(펀치) | 얼음 10개, 5대 맞으면 깨짐. 다 깨면 Lv+1 |
| ⭐ 별 따기 | 별 위에 손을 **0.35초 머물기** | 모이면 별이 다시 나타남 |
| 🦖 땅속 친구 | 올라온 두더지를 **콕 누르기** | 10마리마다 Lv+1, 시간이 갈수록 빨라짐 |
| 🙌 따라쟁이 | 링 안에 손을 **0.45초 담기** | 6개마다 Lv+1, 링이 작아지고 짧아짐 |
| 🃏 짝 맞추기 | 카드를 **콕 찍어** 뒤집기 | 같은 그림 2장 = +1, 다 맞추면 새 판 |
| 🍎 과일 받기 (자체) | 손을 **좌우로** 움직여 바구니 | 과일 +1, 벌에 닿으면 잠깐 멈춤 |
| 🚁 헬리콥터 (자체) | 손을 **위아래로** 움직여 고도 조절 | 구름 길 안에 있으면 점수 |
| 🌈 무지개 잇기 (자체) | **두 손**을 양쪽 구름에 올리기 | 0.6초 유지하면 무지개 +1, 5개마다 Lv+1 |
| 🥁 리듬 북 (자체) | 노트가 판정선에 닿을 때 **손목 튕기기** | PERFECT +3 / GOOD +1, 놓치면 콤보 리셋 |

- 1명 / 2명 대결(화면 좌우 진영) 지원, 한 판 45초, 끝나면 점수·레벨 결과 화면.
- 무지개 잇기는 두 손이 필요해 `handCount: 2` 로 표시된다(데모에서는 마우스 옆에 두 번째 손이 붙는다).
- 카메라 영상은 브라우저 안에서만 처리되고 전송·저장하지 않는다.
- 아이디어 더 보기: `IDEAS.md`

## 사운드

음원 파일을 쓰지 않고 **Web Audio로 실시간 합성**한다(추가 용량 0바이트).

- 효과음: 풍선 팝, 펀치, 유리 깨짐, 두더지 콕, 과일 받기, 벌/오답, 반짝임, 레벨업, 리듬 북 레인별 드럼, 마지막 3초 카운트다운, 결과 팡파르
- 리듬 북만 102 BPM 배경 반주(킥·스네어·하이햇·베이스)를 `AudioContext.currentTime` 기반 lookahead 스케줄러로 재생
- 우측 상단 🔊 버튼으로 끄고 켤 수 있고, 선택은 `localStorage`에 저장된다
- 브라우저 자동재생 정책 때문에 **첫 터치/클릭 전에는 소리가 나지 않는다.** 첫 제스처에서 `AudioContext.resume()`을 호출해 잠금을 푼다
- iOS는 기기 옆면의 무음 스위치가 켜져 있으면 Web Audio도 들리지 않는다

## 실행

```powershell
npm install        # 최초 1회
npm run dev        # http://localhost:5173
npm run build      # dist/ 정적 빌드
```

- 카메라는 `localhost` 또는 HTTPS에서만 허용된다.
- 태블릿/폰에서 테스트하려면 같은 Wi-Fi의 `http://<PC IP>:5173` 은 **카메라가 막힌다.**
  → Cloudflare Tunnel / ngrok 같은 HTTPS 터널을 쓰거나 정적 호스팅에 올려서 테스트.

## 배포

### GitHub Pages (무료, HTTPS)

`main` 에 push 하면 `.github/workflows/pages.yml` 이 빌드해서
`https://<owner>.github.io/momgame/` 에 올린다.

- 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions** 로 한 번만 바꿔 두면 된다.
- 프로젝트 페이지라서 `VITE_BASE=/momgame/` 으로 빌드한다. (저장소 이름을 바꾸면 워크플로의 값도 바꿀 것)
- 모델/WASM을 `public/` 에서 self-host 하므로 첫 방문에 ~45MB를 받는다.

### 내 서버 (Docker)

정적 사이트라서 `dist/` 만 nginx로 서빙하면 된다. 카메라 때문에 **HTTPS 필수**.

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

nginx에서는 `try_files $uri /index.html;`, `application/wasm` MIME, gzip을 켠다.
HTTPS는 앞단의 Caddy/Nginx Proxy Manager/Cloudflare Tunnel이 담당하게 한다.

## 개발용 모드

| URL | 동작 |
|---|---|
| `/?debug=1` | FPS, 추론 시간, 어깨폭, 펀치 임계값(px/s) 오버레이 |
| `/?demo=1` | **카메라 없이** 마우스로 게임 확인. 손은 마우스 위치, 빠르게 휘저으면 펀치 |

`?demo=1`은 카메라 권한 없이 판정·렌더·점수·결과 화면까지 확인하는 용도다.
디버그용으로 `window.__game` 이 노출된다(예: `__game.scores`, `__game.balloons`).

## 구조

```
src/
  App.tsx               화면 상태(홈/로딩/플레이/결과) + 게임 루프 + 데모 포인터
  styles.css            파스텔 테마 (Jua)
  audio/
    sfx.ts              효과음 합성(AudioContext, 리미터, 음소거 저장)
    music.ts            리듬 북 배경 반주 (lookahead 스케줄러)
  motion/
    camera.ts           getUserMedia (640×480, 30fps, 전면)
    pose.ts             PoseLandmarker 생성 (GPU→CPU 폴백)
    viewport.ts         object-fit: cover + 거울 반전 좌표 매핑
    punch.ts            어깨폭 정규화, EMA, 손목 속도 펀치 판정
  game/
    art.ts              팔레트, 얼굴/별/하트 도형, 파티클, 배경 장식
    board.ts            정사각형 격자 배치 (rows×cols 최대 변)
    types.ts            MiniGame 인터페이스, 라운드 45초, 진영 계산
    balloon.ts          풍선 터뜨리기 (접촉 판정)
    ice.ts              얼음 깨기 (펀치 판정, 10블록/5타, 리레이아웃)
    star.ts             별 따기 (0.35초 유지 판정)
    dino.ts             땅속 친구 (두더지 접촉, 2P는 2×3 격자)
    follow.ts           따라쟁이 (링 안 0.45초 유지)
    memory.ts           짝 맞추기 (카드 뒤집기, 손 떼기 감지)
    fruit.ts            과일 받기 (손 x로 바구니, 낙하물)
    heli.ts             헬리콥터 (손 높이 → 고도, 구름 길 유지)
    rainbow.ts          무지개 잇기 (두 손 → 양쪽 구름, 2손 게임)
    rhythm.ts           리듬 북 (3레인 노트 + 펀치 판정, PERFECT/GOOD)
    registry.ts         게임 목록
    render.ts           Canvas 2D 렌더 (영상/게임/스켈레톤/손/HUD/파티클)
public/
  models/pose_landmarker_lite.task
  wasm/                 MediaPipe WASM (SIMD 포함)
```

## 판정식 (원본 관찰값 채택)

```
어깨폭' = EMA(어깨폭, α=0.3) clamped to [0.08H, 0.5H]
펀치    = 손목속도 ≥ 0.6 × 어깨폭'   (같은 손 쿨다운 0.35s, Δt>0.3s는 무시)
블록    = 5대 맞으면 파괴, 한 판 45초
```

## 다음 단계

1. 실제 기기에서 펀치 임계값·링 크기 튜닝 (`?debug=1`의 px/s 확인)
2. 캘리브레이션 화면(관절 visibility 칩) + "몸이 안 보여요" 안내
3. 새 게임 추가: `IDEAS.md`의 물고기 잡기 / 빨래 널기 / 거품 터뜨리기
4. 리듬 북 차트 고정(노트를 곡 박자에 맞추기) — 지금은 랜덤 스폰
5. PWA(manifest, 서비스워커, 오프라인 캐시)
6. 인앱 브라우저 감지 → "크롬으로 열기" 탈출 UI

export type Camera = {
  stream: MediaStream;
  video: HTMLVideoElement;
  stop: () => void;
};

/**
 * 전면 카메라를 연다. 영상은 화면에 직접 그리지 않고 canvas로 합성한다.
 * (거울 반전 + object-fit cover를 렌더 단계에서 처리)
 */
export async function openCamera(video: HTMLVideoElement): Promise<Camera> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, max: 30 },
    },
  });

  video.srcObject = stream;
  video.playsInline = true;
  video.muted = true;
  await video.play();

  // 첫 프레임이 준비될 때까지 기다린다 (videoWidth가 0이면 포즈 추론이 실패한다).
  if (!video.videoWidth) {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      video.addEventListener('loadeddata', done, { once: true });
      setTimeout(done, 3000);
    });
  }

  return {
    stream,
    video,
    stop: () => {
      for (const track of stream.getTracks()) track.stop();
      video.srcObject = null;
    },
  };
}

import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';

export type Pose = NormalizedLandmark[];

export type PoseEngine = {
  detect: (video: HTMLVideoElement, timestampMs: number) => Pose[];
  close: () => void;
  delegate: string;
};

/**
 * MediaPipe Pose Landmarker (lite) 를 VIDEO 모드로 초기화한다.
 * 모델과 WASM은 public/ 에서 self-host 하므로 오프라인에서도 동작한다.
 */
export async function createPoseEngine(opts?: { numPoses?: number }): Promise<PoseEngine> {
  const fileset = await FilesetResolver.forVisionTasks('/wasm');

  const build = async (delegate: 'GPU' | 'CPU') =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: '/models/pose_landmarker_lite.task',
        delegate,
      },
      runningMode: 'VIDEO',
      numPoses: opts?.numPoses ?? 2,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

  let delegate: 'GPU' | 'CPU' = 'GPU';
  let landmarker: PoseLandmarker;
  try {
    landmarker = await build('GPU');
  } catch {
    delegate = 'CPU';
    landmarker = await build('CPU');
  }

  return {
    delegate,
    detect: (video, timestampMs) => {
      const res = landmarker.detectForVideo(video, timestampMs);
      return (res.landmarks ?? []) as Pose[];
    },
    close: () => landmarker.close(),
  };
}

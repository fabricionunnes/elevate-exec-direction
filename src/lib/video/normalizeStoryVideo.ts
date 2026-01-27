import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export type StoryVideoOrientation = "portrait" | "landscape";

export type StoryVideoMeta = {
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  orientation: StoryVideoOrientation;
};

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadingPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadingPromise) return ffmpegLoadingPromise;

  ffmpegLoadingPromise = (async () => {
    const ffmpeg = new FFmpeg();

    // Load core from CDN (browser-only).
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return ffmpegLoadingPromise;
}

function parseRotation(stderr: string): StoryVideoMeta["rotation"] {
  // Common FFmpeg output patterns:
  //   rotate          : 90
  // or a displaymatrix. We'll keep it simple.
  const rotateMatch = stderr.match(/rotate\s*:\s*(-?\d+)/i);
  if (!rotateMatch) return 0;
  const raw = Number.parseInt(rotateMatch[1], 10);
  const normalized = ((raw % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
  return 0;
}

function parseDimensions(stderr: string): { width: number; height: number } {
  // Example:
  // Stream #0:0: Video: h264 (...), 1080x1920 ...
  const dimMatch = stderr.match(/\b(\d{2,5})x(\d{2,5})\b/);
  if (!dimMatch) return { width: 0, height: 0 };
  return {
    width: Number.parseInt(dimMatch[1], 10),
    height: Number.parseInt(dimMatch[2], 10),
  };
}

function computeNormalizedMeta(meta: { width: number; height: number; rotation: StoryVideoMeta["rotation"] }): StoryVideoMeta {
  const rotatedSwaps = meta.rotation === 90 || meta.rotation === 270;
  const width = rotatedSwaps ? meta.height : meta.width;
  const height = rotatedSwaps ? meta.width : meta.height;
  const orientation: StoryVideoOrientation = height > width ? "portrait" : "landscape";

  return {
    width,
    height,
    rotation: meta.rotation,
    orientation,
  };
}

function buildRotateFilter(rotation: StoryVideoMeta["rotation"]) {
  // Physical rotation
  switch (rotation) {
    case 90:
      // clockwise
      return "transpose=1";
    case 270:
      // counter-clockwise
      return "transpose=2";
    case 180:
      return "hflip,vflip";
    default:
      return null;
  }
}

export async function normalizeStoryVideo(
  file: File,
  opts?: {
    onProgress?: (progress: number) => void; // 0..1
    logger?: (line: string) => void;
  }
): Promise<{ file: File; meta: StoryVideoMeta; wasNormalized: boolean }>
{
  const ffmpeg = await getFFmpeg();

  const logger = opts?.logger;
  const onProgress = opts?.onProgress;

  ffmpeg.on("log", ({ message }) => logger?.(message));
  ffmpeg.on("progress", ({ progress }) => onProgress?.(progress));

  const inputName = `input_${Date.now()}_${Math.random().toString(36).slice(2)}.${(file.name.split(".").pop() || "mp4")}`;
  const outputName = `output_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Probe metadata: ffmpeg -i will output metadata to logs; we capture it.
  let probeOutput = "";
  const probeLogger = (line: string) => {
    probeOutput += line + "\n";
    logger?.(line);
  };

  // Temporary subscribe (FFmpeg doesn't allow scoped listeners easily; we just override by re-registering)
  ffmpeg.on("log", ({ message }) => probeLogger(message));
  try {
    // Intentionally fail with -i (it returns non-zero). We only need stderr logs.
    await ffmpeg.exec(["-hide_banner", "-i", inputName]);
  } catch {
    // ignore
  }

  const rotation = parseRotation(probeOutput);
  const { width: rawW, height: rawH } = parseDimensions(probeOutput);
  const meta = computeNormalizedMeta({ width: rawW, height: rawH, rotation });

  const rotateFilter = buildRotateFilter(rotation);
  if (!rotateFilter) {
    // No rotation metadata: keep original file
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // ignore
    }
    return { file, meta: { ...meta, rotation: 0 }, wasNormalized: false };
  }

  // Rotate physically and strip rotation metadata.
  // Note: we re-encode for broad compatibility and to guarantee correct pixel orientation.
  await ffmpeg.exec([
    "-hide_banner",
    "-y",
    "-i",
    inputName,
    "-vf",
    rotateFilter,
    "-metadata:s:v:0",
    "rotate=0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputName,
  ]);

  const out = await ffmpeg.readFile(outputName);
  // FFmpeg returns FileData (Uint8Array). Convert safely to BlobPart.
  const outBytes = out as Uint8Array;
  // Copy into a fresh Uint8Array backed by a standard ArrayBuffer (avoids SharedArrayBuffer typing issues)
  const outCopy = new Uint8Array(outBytes);
  const blob = new Blob([outCopy], { type: "video/mp4" });
  const normalizedFile = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" });

  // Cleanup
  try {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
  } catch {
    // ignore
  }

  // After physical rotation, rotation is 0.
  const normalizedMeta: StoryVideoMeta = {
    width: meta.width,
    height: meta.height,
    rotation: 0,
    orientation: meta.orientation,
  };

  return { file: normalizedFile, meta: normalizedMeta, wasNormalized: true };
}

// Fundo de câmera (blur / imagem) via segmentação de pessoa.
// Usa o MediaPipe Tasks Vision carregado do CDN em runtime (import dinâmico
// com @vite-ignore) — nenhuma dependência nova no bundle. Se o modelo não
// carregar (CDN bloqueado), cai pro vídeo cru sem efeito.
//
// Pipeline por frame: segmenta a pessoa → desenha o fundo (blur do próprio
// vídeo ou imagem) e compõe a pessoa por cima. Saída = track de um canvas.

const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

export type CameraBg = { kind: 'none' } | { kind: 'blur' } | { kind: 'image'; url: string }

interface Segmenter {
  segmentForVideo: (
    video: HTMLVideoElement,
    ts: number,
    cb: (r: { confidenceMasks?: Array<{ getAsFloat32Array: () => Float32Array; width: number; height: number; close: () => void }> }) => void
  ) => void
  close: () => void
}

let segmenterPromise: Promise<Segmenter | null> | null = null
async function getSegmenter(): Promise<Segmenter | null> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      try {
        const vision = await import(/* @vite-ignore */ `${VISION_CDN}/vision_bundle.mjs`)
        const fileset = await vision.FilesetResolver.forVisionTasks(`${VISION_CDN}/wasm`)
        const make = (delegate: 'GPU' | 'CPU') =>
          vision.ImageSegmenter.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate },
            runningMode: 'VIDEO',
            outputConfidenceMasks: true,
            outputCategoryMask: false,
          })
        // GPU é mais rápido, mas falha em alguns navegadores → cai pra CPU
        try {
          return (await make('GPU')) as Segmenter
        } catch (gpuErr) {
          console.warn('[cameraFx] GPU indisponível, tentando CPU:', gpuErr)
          return (await make('CPU')) as Segmenter
        }
      } catch (e) {
        console.warn('[cameraFx] segmentação indisponível:', e)
        segmenterPromise = null // permite tentar de novo numa próxima
        return null
      }
    })()
  }
  return segmenterPromise
}

/** Pré-carrega o modelo (pra primeira aplicação não travar). */
export function preloadCameraFx() {
  void getSegmenter()
}

export class CameraFx {
  private raw: MediaStreamTrack
  private mode: CameraBg
  private video = document.createElement('video')
  private out = document.createElement('canvas')
  private octx: CanvasRenderingContext2D
  private person = document.createElement('canvas')
  private pctx: CanvasRenderingContext2D
  private maskCv = document.createElement('canvas')
  private mctx: CanvasRenderingContext2D
  private bgImg: HTMLImageElement | null = null
  private segmenter: Segmenter | null = null
  private raf = 0
  private running = false
  private outStream: MediaStream | null = null
  private lastFrameAt = 0
  /** true se o modelo carregou e o efeito está de fato sendo aplicado */
  usingModel = false

  constructor(raw: MediaStreamTrack, mode: CameraBg) {
    this.raw = raw
    this.mode = mode
    this.octx = this.out.getContext('2d')!
    this.pctx = this.person.getContext('2d')!
    this.mctx = this.maskCv.getContext('2d')!
  }

  setMode(mode: CameraBg) {
    this.mode = mode
    if (mode.kind === 'image') this.loadImg(mode.url)
    else this.bgImg = null
  }

  private loadImg(url: string) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => (this.bgImg = img)
    img.src = url
  }

  /** Liga o pipeline e devolve a track processada (ou a crua, se sem modelo). */
  async start(): Promise<MediaStreamTrack> {
    const settings = this.raw.getSettings()
    const w = settings.width ?? 640
    const h = settings.height ?? 480
    this.out.width = w
    this.out.height = h
    this.person.width = w
    this.person.height = h

    this.video.srcObject = new MediaStream([this.raw])
    this.video.muted = true
    this.video.playsInline = true
    await this.video.play().catch(() => undefined)

    if (this.mode.kind === 'image') this.loadImg(this.mode.url)
    this.segmenter = await getSegmenter()
    if (!this.segmenter) {
      this.usingModel = false
      return this.raw // sem modelo: vídeo cru
    }

    this.outStream = this.out.captureStream(24)
    this.usingModel = true
    this.running = true
    this.loop()
    return this.outStream.getVideoTracks()[0] ?? this.raw
  }

  private loop = () => {
    if (!this.running || !this.segmenter) return
    // Segmentação limitada a ~15fps: rodar a cada frame do monitor (60-120Hz)
    // era o maior custo de CPU com a câmera ligada — 15fps é imperceptível
    // pra webcam e libera o processador pra reunião/gravação.
    const nowT = performance.now()
    if (nowT - this.lastFrameAt < 66) {
      this.raf = requestAnimationFrame(this.loop)
      return
    }
    this.lastFrameAt = nowT
    const w = this.out.width
    const h = this.out.height
    if (this.video.readyState >= 2) {
      try {
        this.segmenter.segmentForVideo(this.video, performance.now(), (result) => {
          const mask = result.confidenceMasks?.[0]
          // 1) Fundo
          if (this.mode.kind === 'image' && this.bgImg) {
            this.drawCover(this.bgImg, w, h)
          } else {
            // blur (padrão): desfoca o próprio vídeo
            this.octx.filter = 'blur(14px)'
            this.octx.drawImage(this.video, 0, 0, w, h)
            this.octx.filter = 'none'
          }
          // 2) Pessoa recortada pela máscara, por cima
          if (mask) {
            const data = mask.getAsFloat32Array()
            const mw = mask.width
            const mh = mask.height
            this.maskCv.width = mw
            this.maskCv.height = mh
            const id = this.mctx.createImageData(mw, mh)
            for (let i = 0; i < data.length; i++) {
              const a = data[i] > 0.5 ? 255 : Math.round(data[i] * 255)
              id.data[i * 4 + 3] = a // só alpha importa
            }
            this.mctx.putImageData(id, 0, 0)
            // person = vídeo recortado pela máscara
            this.pctx.clearRect(0, 0, w, h)
            this.pctx.drawImage(this.video, 0, 0, w, h)
            this.pctx.globalCompositeOperation = 'destination-in'
            this.pctx.drawImage(this.maskCv, 0, 0, w, h)
            this.pctx.globalCompositeOperation = 'source-over'
            this.octx.drawImage(this.person, 0, 0, w, h)
            mask.close()
          } else {
            this.octx.drawImage(this.video, 0, 0, w, h)
          }
        })
      } catch {
        this.octx.drawImage(this.video, 0, 0, w, h)
      }
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  private drawCover(img: HTMLImageElement, w: number, h: number) {
    const ir = img.width / img.height
    const cr = w / h
    let dw = w
    let dh = h
    if (ir > cr) {
      dh = h
      dw = h * ir
    } else {
      dw = w
      dh = w / ir
    }
    this.octx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
    this.outStream?.getTracks().forEach((t) => t.stop())
    this.outStream = null
    this.video.srcObject = null
  }
}

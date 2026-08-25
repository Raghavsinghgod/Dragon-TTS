import { useEffect, useRef } from "react"

type waveformProps = {
  analyser: AnalyserNode | null
  pcm: Float32Array | null
  active: boolean
}

function fit(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (w === 0 || h === 0) return null
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h }
}

export function Waveform({ analyser, pcm, active }: waveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let raf = 0
    const buf = new Uint8Array(1024)

    const drawLive = () => {
      const fitted = fit(canvas)
      if (!fitted) {
        raf = requestAnimationFrame(drawLive)
        return
      }
      const { ctx, w, h } = fitted
      ctx.fillStyle = "#14110d"
      ctx.fillRect(0, 0, w, h)
      if (analyser) {
        analyser.getByteTimeDomainData(buf)
        ctx.strokeStyle = "#ef6a35"
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < buf.length; i++) {
          const x = (i / buf.length) * w
          const y = h / 2 + ((buf[i] - 128) / 128) * (h / 2 - 4)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      raf = requestAnimationFrame(drawLive)
    }

    const drawStatic = () => {
      const fitted = fit(canvas)
      if (!fitted) return
      const { ctx, w, h } = fitted
      ctx.fillStyle = "#14110d"
      ctx.fillRect(0, 0, w, h)
      if (pcm && pcm.length) {
        const bars = Math.min(160, Math.floor(w / 4))
        const per = Math.floor(pcm.length / bars)
        ctx.fillStyle = active ? "#ef6a35" : "#7a6a52"
        for (let b = 0; b < bars; b++) {
          let peak = 0
          for (let i = 0; i < per; i += 8) {
            const v = Math.abs(pcm[b * per + i] ?? 0)
            if (v > peak) peak = v
          }
          const bh = Math.max(2, peak * (h - 8))
          ctx.fillRect(b * 4, (h - bh) / 2, 2.5, bh)
        }
      }
    }

    if (active) {
      raf = requestAnimationFrame(drawLive)
    } else {
      drawStatic()
    }
    window.addEventListener("resize", drawStatic)
    return () => {
      window.removeEventListener("resize", drawStatic)
      cancelAnimationFrame(raf)
    }
  }, [analyser, pcm, active])

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={120}
      className="h-[120px] w-full rounded-lg border border-border/60"
    />
  )
}

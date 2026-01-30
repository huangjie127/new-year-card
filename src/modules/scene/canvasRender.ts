import type { SceneStateV1 } from './types'
import type { Vec2 } from '../../lib/math'
import { lerpVec2 } from '../../lib/math'

export function renderScene(params: {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  timeMs: number
  state: SceneStateV1
  strokesA: Vec2[][]
  strokesB?: Vec2[][]
  morphT?: number
  hover?: boolean
}) {
  const { ctx, width, height, timeMs, state, strokesA, strokesB, morphT = 0, hover = false } = params

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Background
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = state.canvas.background
  ctx.fillRect(0, 0, width, height)

  const pulse = hover ? 0.65 + 0.35 * Math.sin(timeMs / 450) : 1
  const alpha = hover ? 0.85 : 1

  ctx.globalAlpha = alpha
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = state.logo.color
  ctx.lineWidth = Math.max(1, state.logo.lineWidth * pulse)

  const strokeCount = strokesA.length

  // Draw-in: keep fully drawn by default (morph provides motion).
  const drawIn = 1

  for (let i = 0; i < strokeCount; i++) {
    const pointsA = strokesA[i]
    const points = strokesB && strokesB[i]
      ? pointsA.map((p, idx) => lerpVec2(p, strokesB[i][idx], morphT))
      : pointsA

    const local = Math.min(1, Math.max(0, (drawIn - i * 0.02) / 0.9))
    const upto = Math.max(2, Math.floor(points.length * local))

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let j = 1; j < upto; j++) ctx.lineTo(points[j].x, points[j].y)
    ctx.stroke()
  }

  // Text overlay
  const card = state.card
  ctx.globalAlpha = 1
  ctx.fillStyle = card.textColor
  ctx.textBaseline = 'top'
  ctx.font = `600 ${card.fontSize}px ${card.fontFamily}`

  const padding = Math.max(24, Math.min(width, height) * 0.06)
  const maxTextWidth = Math.max(200, width - padding * 2)

  const lines = wrapText(ctx, card.text, maxTextWidth)
  const lineHeight = Math.round(card.fontSize * 1.28)
  const blockHeight = lines.length * lineHeight

  if (card.templateId === 'lowerThird') {
    const x = padding
    const y = Math.max(padding, height - padding - blockHeight)
    drawLines(ctx, lines, x, y, lineHeight, 'left', maxTextWidth)
  } else {
    const x = width / 2
    const y = Math.max(padding, (height - blockHeight) / 2)
    drawLines(ctx, lines, x, y, lineHeight, 'center', maxTextWidth)
  }

  ctx.restore()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const rawLines = String(text || '').split('\n')
  const out: string[] = []

  for (const raw of rawLines) {
    const s = raw.trimEnd()
    if (!s) {
      out.push('')
      continue
    }

    const hasSpaces = /\s/.test(s)
    const tokens = hasSpaces ? s.split(/\s+/) : Array.from(s)

    let line = ''
    for (const tok of tokens) {
      const candidate = line ? (hasSpaces ? `${line} ${tok}` : `${line}${tok}`) : tok
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate
      } else {
        if (line) out.push(line)
        line = tok
      }
    }

    if (line) out.push(line)
  }

  return out
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  align: CanvasTextAlign,
  maxWidth: number,
) {
  ctx.textAlign = align
  for (let i = 0; i < lines.length; i++) {
    const yy = y + i * lineHeight
    ctx.fillText(lines[i], x, yy, maxWidth)
  }
}

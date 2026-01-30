import type { SceneStateV1 } from './types'
import type { Vec2 } from '../../lib/math'
import { renderScene } from './canvasRender'

export async function exportPng(params: {
  state: SceneStateV1
  widthCss: number
  heightCss: number
  dpr?: number
  strokesA: Vec2[][]
  strokesB?: Vec2[][]
  morphT?: number
}) {
  const { state, widthCss, heightCss, dpr = 2, strokesA, strokesB, morphT } = params

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(widthCss * dpr))
  canvas.height = Math.max(1, Math.floor(heightCss * dpr))

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas ctx')

  ctx.scale(dpr, dpr)
  renderScene({
    ctx,
    width: widthCss,
    height: heightCss,
    timeMs: performance.now(),
    state,
    strokesA,
    strokesB,
    morphT,
    hover: false,
  })

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'card.png'
  a.click()
  URL.revokeObjectURL(url)
}

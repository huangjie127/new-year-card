import './App.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { defaultSceneState } from './modules/scene/defaults'
import type { SceneStateV1 } from './modules/scene/types'
import { useResizeObserver } from './lib/useResizeObserver'
import { useRaf } from './lib/useRaf'
import { useHover } from './lib/useHover'
import { renderScene } from './modules/scene/canvasRender'
import { generateHorseStrokes } from './modules/scene/horseGenerator'
import { exportPng } from './modules/scene/exportImage'
import { createShare, loadShare } from './modules/share/api'
import { getShareIdFromUrl, makeShareUrl } from './modules/share/url'
import { useMorph } from './modules/scene/useMorph'

function App() {
  const [state, setState] = useState<SceneStateV1>(defaultSceneState)
  const [shareUrl, setShareUrl] = useState<string>('')
  const [status, setStatus] = useState<string>('')

  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { width, height } = useResizeObserver(stageRef)
  const timeMs = useRaf()
  const hover = useHover(stageRef)

  const [morphKey, setMorphKey] = useState('init')
  const [morphFrom, setMorphFrom] = useState(() => [] as ReturnType<typeof generateHorseStrokes>)
  const [morphTo, setMorphTo] = useState(() => [] as ReturnType<typeof generateHorseStrokes>)

  const activeVariant = state.logo.variant
  const nextVariant = useMemo(() => (activeVariant === 'a' ? 'b' : activeVariant === 'b' ? 'c' : 'a'), [activeVariant])

  const strokesCurrent = useMemo(() => {
    if (width <= 0 || height <= 0) return []
    return generateHorseStrokes({
      seed: state.logo.seed,
      variant: state.logo.variant,
      strokeCount: state.logo.strokeCount,
      pointsPerStroke: state.logo.pointsPerStroke,
      width,
      height,
    })
  }, [state.logo.seed, state.logo.variant, state.logo.strokeCount, state.logo.pointsPerStroke, width, height])

  const { t: morphT, ready: morphReady } = useMorph({ from: morphFrom, to: morphTo, triggerKey: morphKey, durationMs: 800 })

  // Load state from shortlink if present.
  useEffect(() => {
    const id = getShareIdFromUrl()
    if (!id) return

    let cancelled = false
    setStatus('正在加载分享…')
    loadShare(id)
      .then((s) => {
        if (cancelled) return
        setState(s)
        setShareUrl(makeShareUrl(id))
        setStatus('已加载分享')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('分享链接无效或已过期')
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Keep canvas in sync with CSS size + DPR.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, Math.floor(width * dpr))
    canvas.height = Math.max(1, Math.floor(height * dpr))
  }, [width, height])

  // Render loop driven by RAF time.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.max(1, window.devicePixelRatio || 1)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const useMorphing = morphReady && morphT > 0 && morphT < 1
    renderScene({
      ctx,
      width,
      height,
      timeMs,
      state,
      strokesA: useMorphing ? morphFrom : strokesCurrent,
      strokesB: useMorphing ? morphTo : undefined,
      morphT: useMorphing ? morphT : 0,
      hover,
    })
  }, [timeMs, width, height, state, strokesCurrent, morphFrom, morphTo, morphT, morphReady, hover])

  const onMorph = () => {
    if (width <= 0 || height <= 0) return
    const from = strokesCurrent
    const to = generateHorseStrokes({
      seed: state.logo.seed,
      variant: nextVariant,
      strokeCount: state.logo.strokeCount,
      pointsPerStroke: state.logo.pointsPerStroke,
      width,
      height,
    })
    setMorphFrom(from)
    setMorphTo(to)
    setMorphKey(`${Date.now()}`)
    setState((prev) => ({ ...prev, logo: { ...prev.logo, variant: nextVariant } }))
  }

  const onReseed = () => {
    setShareUrl('')
    setStatus('')
    setState((prev) => ({ ...prev, logo: { ...prev.logo, seed: prev.logo.seed + 1 } }))
  }

  const onExport = async () => {
    try {
      setStatus('导出中…')
      await exportPng({
        state,
        widthCss: width,
        heightCss: height,
        dpr: 2,
        strokesA: strokesCurrent,
      })
      setStatus('已导出 PNG')
    } catch {
      setStatus('导出失败')
    }
  }

  const onShare = async () => {
    try {
      setStatus('生成分享链接…')
      const { id } = await createShare(state)
      const url = makeShareUrl(id)
      setShareUrl(url)
      setStatus('已生成分享链接')
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setStatus('已复制分享链接')
      }
    } catch {
      setStatus('分享失败')
    }
  }

  const uiDisabled = width <= 0 || height <= 0

  return (
    <div className="appShell">
      <div className="stage" ref={stageRef}>
        <canvas ref={canvasRef} className="stageCanvas" />
        <div className="stageHint">
          <div className="hintRow">
            <button disabled={uiDisabled} onClick={onMorph}>线条重组</button>
            <button disabled={uiDisabled} onClick={onReseed}>换一匹</button>
            <button disabled={uiDisabled} onClick={onExport}>导出 PNG</button>
            <button disabled={uiDisabled} onClick={onShare}>生成分享</button>
          </div>
          {shareUrl ? (
            <div className="shareRow">
              <input className="shareInput" value={shareUrl} readOnly />
              <button
                onClick={async () => {
                  await navigator.clipboard?.writeText(shareUrl)
                  setStatus('已复制分享链接')
                }}
              >
                复制
              </button>
            </div>
          ) : null}
          {status ? <div className="statusRow">{status}</div> : null}
        </div>
      </div>

      <aside className="panel">
        <div className="panelTitle">贺卡编辑</div>

        <label className="field">
          <div className="fieldLabel">祝福语</div>
          <textarea
            value={state.card.text}
            onChange={(e) => setState((prev) => ({ ...prev, card: { ...prev.card, text: e.target.value } }))}
            rows={5}
          />
        </label>

        <div className="grid2">
          <label className="field">
            <div className="fieldLabel">模板</div>
            <select
              value={state.card.templateId}
              onChange={(e) => setState((prev) => ({ ...prev, card: { ...prev.card, templateId: e.target.value as SceneStateV1['card']['templateId'] } }))}
            >
              <option value="center">居中</option>
              <option value="lowerThird">下三分之一</option>
            </select>
          </label>

          <label className="field">
            <div className="fieldLabel">字号</div>
            <input
              type="range"
              min={24}
              max={92}
              value={state.card.fontSize}
              onChange={(e) => setState((prev) => ({ ...prev, card: { ...prev.card, fontSize: Number(e.target.value) } }))}
            />
          </label>
        </div>

        <div className="grid2">
          <label className="field">
            <div className="fieldLabel">背景色</div>
            <input
              type="color"
              value={state.canvas.background}
              onChange={(e) => setState((prev) => ({ ...prev, canvas: { ...prev.canvas, background: e.target.value } }))}
            />
          </label>

          <label className="field">
            <div className="fieldLabel">文字色</div>
            <input
              type="color"
              value={state.card.textColor}
              onChange={(e) => setState((prev) => ({ ...prev, card: { ...prev.card, textColor: e.target.value } }))}
            />
          </label>
        </div>

        <div className="grid2">
          <label className="field">
            <div className="fieldLabel">线条色</div>
            <input
              type="color"
              value={state.logo.color}
              onChange={(e) => setState((prev) => ({ ...prev, logo: { ...prev.logo, color: e.target.value } }))}
            />
          </label>

          <label className="field">
            <div className="fieldLabel">线宽</div>
            <input
              type="range"
              min={1}
              max={8}
              value={state.logo.lineWidth}
              onChange={(e) => setState((prev) => ({ ...prev, logo: { ...prev.logo, lineWidth: Number(e.target.value) } }))}
            />
          </label>
        </div>

        <label className="field">
          <div className="fieldLabel">线条数量</div>
          <input
            type="range"
            min={10}
            max={80}
            value={state.logo.strokeCount}
            onChange={(e) => {
              setShareUrl('')
              setState((prev) => ({ ...prev, logo: { ...prev.logo, strokeCount: Number(e.target.value) } }))
            }}
          />
        </label>

        <div className="panelFooter">
          <div className="small">点击“线条重组”切换形态；“换一匹”更换随机种子。</div>
        </div>
      </aside>
    </div>
  )
}

export default App

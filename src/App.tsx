import { useEffect, useMemo, useRef, useState } from "react";
import "./styles/app.css";
import { renderConstellation, canvasToNormalizedPoint, type ConstellationScene } from "./modules/constellation/render";
import { createShare, loadShare } from "./modules/share/api";
import { makeShareUrl, getShareIdFromUrl } from "./modules/share/url";

function randBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function makeDefaultScene(): ConstellationScene {
  return {
    version: 2,
    points: [],
    bg: { a: "#05070f", b: "#0b1530" },
    lineColor: "rgba(170, 210, 255, 1)",
    pointColor: "rgba(255, 255, 255, 1)",
    glowColor: "rgba(120, 190, 255, 1)",
    template: "center",
    text: {
      content: "新年快乐 / Happy New Year",
      color: "rgba(255,255,255,0.92)",
      fontSize: 44,
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Inter, Arial",
      weight: 600,
    },
  };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [scene, setScene] = useState<ConstellationScene>(() => makeDefaultScene());
  const [guideStep, setGuideStep] = useState(0); // 0:Head, 1:FrontLegs, 2:BackLegs, 3:Tail, 4:Done
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const guides = [
    { text: "步骤 1/4：请点击【马头】的位置", hint: "建议在左上方或上方" },
    { text: "步骤 2/4：请点击【前腿】（2-3个点）", hint: "马的前肢关节" },
    { text: "步骤 3/4：请点击【后腿】（2-3个点）", hint: "强壮的后肢" },
    { text: "步骤 4/4：请点击【马尾】的位置", hint: "飘逸的尾巴" },
    { text: "完成！继续点击补充细节，或保存", hint: "任意位置点击增加星光" },
  ];
  
  const currentGuide = guides[Math.min(guideStep, 4)];
  const guideStatus = guideStep < 4 ? currentGuide.text : "点击画布添加更多星点；右键撤销。";
  const status = toast ?? guideStatus;

  const setStatus = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  };

  // Load share by ?id=xxx
  useEffect(() => {
    const id = getShareIdFromUrl();
    if (!id) return;
    
    // If sharing, skip guide
    setGuideStep(4);

    (async () => {
      try {
        const loaded = await loadShare(id);
        // keep backward compatibility: only accept version 2 constellation scenes
        if ((loaded as unknown as ConstellationScene)?.version === 2 && Array.isArray((loaded as unknown as ConstellationScene).points)) {
          setScene(loaded as unknown as ConstellationScene);
          setStatus(`已从分享链接恢复（${id}）`);
        } else {
          setStatus("分享内容版本不匹配，已忽略。");
        }
      } catch {
        setStatus("分享内容读取失败。");
      }
    })();
  }, []);

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement!;
      const r = parent.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.floor(r.width * dpr);
      canvas.height = Math.floor(r.height * dpr);
      canvas.style.width = `${Math.floor(r.width)}px`;
      canvas.style.height = `${Math.floor(r.height)}px`;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tick = (t: number) => {
      const parent = canvas.parentElement!;
      const r = parent.getBoundingClientRect();
      const dpr = canvas.width / Math.max(1, Math.floor(r.width));
      renderConstellation(ctx, scene, t, { w: Math.floor(r.width), h: Math.floor(r.height), dpr });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scene]);

  const actions = useMemo(() => {
    return {
      addPoint: (x: number, y: number) => {
        setScene((s) => ({
          ...s,
          points: [
            ...s.points,
            {
              x,
              y,
              phase: randBetween(0, Math.PI * 2),
              speed: randBetween(1.0, 2.4),
            },
          ],
        }));
      },
      undo: () => {
        setScene((s) => {
          const nextPoints = s.points.slice(0, -1);
          const n = nextPoints.length;
          setGuideStep(() => {
            if (n <= 0) return 0;
            if (n <= 2) return 1;
            if (n <= 4) return 2;
            if (n <= 5) return 3;
            return 4;
          });
          return { ...s, points: nextPoints };
        });
      },
      clear: () => {
        setScene((s) => ({ ...s, points: [] }));
        setGuideStep(0);
      },
      toggleTemplate: () => {
        setScene((s) => ({ ...s, template: s.template === "center" ? "lowerThird" : "center" }));
      },
      randomPalette: () => {
        const palettes = [
          { a: "#05070f", b: "#0b1530", glow: "rgba(120,190,255,1)" },
          { a: "#07050f", b: "#2a0b30", glow: "rgba(255,140,220,1)" },
          { a: "#02070a", b: "#052a22", glow: "rgba(120,255,210,1)" },
        ];
        const p = palettes[Math.floor(Math.random() * palettes.length)];
        setScene((s) => ({
          ...s,
          bg: { a: p.a, b: p.b },
          glowColor: p.glow,
          lineColor: "rgba(170, 210, 255, 1)",
          pointColor: "rgba(255,255,255,1)",
        }));
      },
    };
  }, []);
    
  // Pointer interactions: left click add point, right click undo
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 2) {
        e.preventDefault();
        actions.undo();
        return;
      }
      if (e.button !== 0) return;

      const p = canvasToNormalizedPoint(canvas, e.clientX, e.clientY);
      actions.addPoint(p.x, p.y);

      const nextCount = scene.points.length + 1;
      setGuideStep((prev) => {
        if (prev >= 4) return prev;
        if (prev === 0) return 1; // head
        if (prev === 1) return nextCount >= 3 ? 2 : 1; // +2 points
        if (prev === 2) return nextCount >= 5 ? 3 : 2; // +2 points
        if (prev === 3) return 4; // tail
        return prev;
      });
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("contextmenu", onContextMenu);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [actions, scene.points.length]);

  const onExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Create a temp canvas for sync 2d copy to ensure dpr consistency isn't needed if we just grab current buffer?
    // Actually our renderConstellation is pure, so let's re-render to a new clean canvas for export.
    const exportW = 1920; 
    const exportH = 1080;
    
    const off = document.createElement('canvas');
    off.width = exportW;
    off.height = exportH;
    const ctx = off.getContext('2d');
    if(!ctx) return;
    
    // Fill background immediately in case of transparency
    ctx.fillStyle = scene.bg.a;
    ctx.fillRect(0,0,exportW, exportH);

    renderConstellation(ctx, scene, performance.now(), { w: exportW, h: exportH, dpr: 1 });
    
    off.toBlob(blob => {
        if(!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'constellation-card.png';
        a.click();
        URL.revokeObjectURL(url);
        setStatus("已导出 PNG。");
    }, 'image/png');
  };

  const onShare = async () => {
    try {
      const { id } = await createShare(scene as any); 
      const url = makeShareUrl(id);
      await navigator.clipboard.writeText(url);
      setStatus(`分享链接已复制（${id}）`);
    } catch {
      setStatus("生成分享链接失败。");
    }
  };

  return (
    <div className="appRoot">
      <header className="topBar">
        <div className="brand">
          <div className="dot" />
          <div className="title">Qiji · 星图贺卡</div>
        </div>
        <div className="topHint">{status}</div>
      </header>

      <div className="layout">
        <div className="stage">
          <canvas ref={canvasRef} className="stageCanvas" />
          
          {/* Guide Overlay */}
          {guideStep < 4 && (
            <div className="guideOverlay">
              <div className="guideText">{currentGuide.hint}</div>
            </div>
          )}

          <div className="stageTip">
            <div className="stageTipTitle">{guideStep < 4 ? "绘画引导中..." : "自由创作模式"}</div>
            <div className="stageTipSub">{status}</div>
          </div>
        </div>

        <aside className="panel">
          <section className="card">
            <div className="cardTitle">祝福语</div>
            <textarea
              className="textarea"
              value={scene.text.content}
              onChange={(e) => setScene((s) => ({ ...s, text: { ...s.text, content: e.target.value } }))}
              placeholder="输入祝福语…"
              rows={4}
            />
            <div className="row">
              <label className="label">字号</label>
              <input
                className="range"
                type="range"
                min={26}
                max={64}
                value={scene.text.fontSize}
                onChange={(e) => setScene((s) => ({ ...s, text: { ...s.text, fontSize: Number(e.target.value) } }))}
              />
              <div className="pill">{scene.text.fontSize}px</div>
            </div>
          </section>

          <section className="card">
            <div className="cardTitle">布局与外观</div>
            <div className="btnGrid">
              <button className="btn" onClick={actions.toggleTemplate}>切换模板</button>
              <button className="btn" onClick={actions.randomPalette}>换配色</button>
              <button className="btn" onClick={actions.undo} disabled={scene.points.length === 0}>撤销</button>
              <button className="btn danger" onClick={actions.clear} disabled={scene.points.length === 0}>清空</button>
            </div>
          </section>

          <section className="card">
            <div className="cardTitle">导出与分享</div>
            <div className="btnStack">
              <button className="btn primary" onClick={onExport}>导出 PNG</button>
              <button className="btn primary" onClick={onShare}>生成分享链接（复制）</button>
            </div>
            <div className="footnote">
              建议点 8–18 个星点效果最好；点太密会自动只连近邻线。
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

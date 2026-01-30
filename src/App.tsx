import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import "./styles/app.css";
import {
  createPeachBlossoms,
  createUserBlossom,
  renderPeachBlossoms,
  stepPeachBlossoms,
  type PeachBlossom,
} from "./modules/effects/peachBlossoms";
import { renderFireworks, spawnBurst, stepFireworks, type FireworkBurst } from "./modules/effects/fireworks";
import { FORTUNE_SLIPS, type FortuneSlip } from "./modules/fortune/slips";

function useCanvasSize(ref: RefObject<HTMLCanvasElement | null>) {
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.floor(r.width * dpr);
      canvas.height = Math.floor(r.height * dpr);
      sizeRef.current = { w: Math.floor(r.width), h: Math.floor(r.height), dpr };
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [ref]);

  return sizeRef;
}

export default function App() {
  const [open, setOpen] = useState(false);
  const [blossomLevel, setBlossomLevel] = useState<"light" | "heavy">("light");
  const [fortuneUI, setFortuneUI] = useState<"closed" | "select" | "result">("closed");
  const [fortune, setFortune] = useState<FortuneSlip | null>(null);
  const [fortunePicked, setFortunePicked] = useState(false);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [fortuneSelectPhase, setFortuneSelectPhase] = useState<"enter" | "fan">("enter");

  const [ritualOpenedOnce, setRitualOpenedOnce] = useState(() => {
    try {
      return localStorage.getItem("nyc_ritual_opened_once_v1") === "1";
    } catch {
      return false;
    }
  });
  const [ritualHintVisible, setRitualHintVisible] = useState(false);

  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fireCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bookRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);

  const bgSizeRef = useCanvasSize(bgCanvasRef);
  const fireSizeRef = useCanvasSize(fireCanvasRef);

  const blossomsRef = useRef<PeachBlossom[]>([]);
  const burstsRef = useRef<FireworkBurst[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  const nextIdRef = useRef(1);
  const dragRef = useRef<null | { id: number; pointerId: number; dx: number; dy: number }>(null);
  const lastBgPxRef = useRef<{ w: number; h: number } | null>(null);

  const fortuneOpen = fortuneUI !== "closed";

  const blossomCount = useMemo(() => (blossomLevel === "heavy" ? 42 : 26), [blossomLevel]);

  const openFortuneUI = () => {
    if (fortunePicked) {
      setFortuneUI("result");
      return;
    }
    setSelectedCard(null);
    setFortuneSelectPhase("enter");
    setFortuneUI("select");
    window.setTimeout(() => setFortuneSelectPhase("fan"), 520);
  };

  const closeFortuneUI = () => {
    setFortuneUI("closed");
    setRitualHintVisible(false);
  };

  const pickFortuneCard = (index: number) => {
    if (fortunePicked) return;
    setSelectedCard(index);

    const pick = FORTUNE_SLIPS[Math.floor(Math.random() * FORTUNE_SLIPS.length)];
    setFortune(pick);
    setFortunePicked(true);

    // Let the card flip feel intentional before showing full content.
    window.setTimeout(() => setFortuneUI("result"), 520);
  };

  useEffect(() => {
    if (!open) {
      setRitualHintVisible(false);
      return;
    }

    if (!ritualOpenedOnce) {
      try {
        localStorage.setItem("nyc_ritual_opened_once_v1", "1");
      } catch {
        // ignore
      }
      setRitualOpenedOnce(true);
    }

    const id = window.setTimeout(() => setRitualHintVisible(true), 680);
    return () => window.clearTimeout(id);
  }, [open, ritualOpenedOnce]);

  const triggerFireworks = () => {
    const canvas = fireCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { w, h } = fireSizeRef.current;
    // burst near top half of inner card
    const x = w * (0.25 + Math.random() * 0.5);
    const y = h * (0.18 + Math.random() * 0.35);
    burstsRef.current.push(spawnBurst(x, y, 1));
  };

  // Auto fireworks when opening
  useEffect(() => {
    if (!open) return;
    triggerFireworks();
    const id = window.setInterval(() => triggerFireworks(), 900);
    const stop = window.setTimeout(() => window.clearInterval(id), 3000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Animation loop (snow + fireworks)
  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const fireCanvas = fireCanvasRef.current;
    const bgCtx = bgCanvas?.getContext("2d");
    const fireCtx = fireCanvas?.getContext("2d");

    if (!bgCanvas || !bgCtx) return;

    // (re)seed blossoms when count changes or size becomes available
    const ensureBlossoms = () => {
      const { w, h, dpr } = bgSizeRef.current;
      if (!w || !h) return;
      const W = w * dpr;
      const H = h * dpr;

      // Scale existing user blossoms when the canvas size changes.
      const prev = lastBgPxRef.current;
      const sizeChanged = !prev || prev.w !== W || prev.h !== H;
      if (!prev || prev.w !== W || prev.h !== H) {
        if (prev && prev.w > 0 && prev.h > 0) {
          const sx = W / prev.w;
          const sy = H / prev.h;
          for (const it of blossomsRef.current) {
            if (it.user) {
              it.x *= sx;
              it.y *= sy;
              it.vx *= sx;
              it.vy *= sy;
            }
          }
        }
        lastBgPxRef.current = { w: W, h: H };
      }

      const user = blossomsRef.current.filter((it) => it.user);
      const autoExisting = blossomsRef.current.filter((it) => !it.user);
      if (sizeChanged || autoExisting.length !== blossomCount) {
        const auto = createPeachBlossoms(blossomCount, W, H, 20260129);
        blossomsRef.current = [...auto, ...user];
      }
    };

    const tick = (t: number) => {
      const dt = Math.min(0.033, lastRef.current ? (t - lastRef.current) / 1000 : 0.016);
      lastRef.current = t;

      ensureBlossoms();
      const { w: bw, h: bh, dpr: bdpr } = bgSizeRef.current;
      if (bw && bh) {
        stepPeachBlossoms(blossomsRef.current, dt, bw * bdpr, bh * bdpr, 20260129);
        renderPeachBlossoms(bgCtx, blossomsRef.current, bw * bdpr, bh * bdpr);
      }

      if (fireCanvas && fireCtx) {
        const { w: fw, h: fh, dpr: fdpr } = fireSizeRef.current;
        if (fw && fh) {
          fireCtx.setTransform(1, 0, 0, 1, 0, 0);
          fireCtx.scale(fdpr, fdpr);
          stepFireworks(burstsRef.current, dt);
          renderFireworks(fireCtx, burstsRef.current, fw, fh);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [blossomCount, bgSizeRef, fireSizeRef]);

  const getBgPoint = (clientX: number, clientY: number) => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const { dpr } = bgSizeRef.current;
    const x = (clientX - r.left) * dpr;
    const y = (clientY - r.top) * dpr;
    return { x, y, w: r.width * dpr, h: r.height * dpr };
  };

  const pickBlossom = (x: number, y: number) => {
    let best: PeachBlossom | null = null;
    let bestD2 = Infinity;
    for (let i = blossomsRef.current.length - 1; i >= 0; i--) {
      const b = blossomsRef.current[i];
      if (b.kind !== "blossom") continue;
      const dx = x - b.x;
      const dy = y - b.y;
      const d2 = dx * dx + dy * dy;
      const hit = Math.max(40, b.r * 1.2);
      if (d2 <= hit * hit && d2 < bestD2) {
        best = b;
        bestD2 = d2;
      }
    }
    return best;
  };

  return (
    <div
      className="newYearRoot"
      onPointerDownCapture={(e) => {
        if (fortuneOpen) return;
        const target = e.target as Node;
        if ((bookRef.current && bookRef.current.contains(target)) || (controlsRef.current && controlsRef.current.contains(target))) return;

        const p = getBgPoint(e.clientX, e.clientY);
        if (!p) return;

        const picked = pickBlossom(p.x, p.y);
        if (picked && typeof picked.id === "number") {
          dragRef.current = { id: picked.id, pointerId: e.pointerId, dx: picked.x - p.x, dy: picked.y - p.y };
        } else if (picked) {
          picked.id = nextIdRef.current++;
          picked.user = true;
          dragRef.current = { id: picked.id, pointerId: e.pointerId, dx: picked.x - p.x, dy: picked.y - p.y };
        } else {
          const W = p.w;
          const H = p.h;
          const nb = createUserBlossom(p.x, p.y, W, H, 20260129);
          nb.id = nextIdRef.current++;
          blossomsRef.current.push(nb);
          dragRef.current = { id: nb.id, pointerId: e.pointerId, dx: 0, dy: 0 };
        }

        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMoveCapture={(e) => {
        if (fortuneOpen) return;
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        const p = getBgPoint(e.clientX, e.clientY);
        if (!p) return;
        const b = blossomsRef.current.find((it) => it.id === drag.id);
        if (!b) return;

        const pad = Math.max(40, b.r * 0.6);
        b.x = Math.max(pad, Math.min(p.w - pad, p.x + drag.dx));
        b.y = Math.max(pad, Math.min(p.h - pad, p.y + drag.dy));
        b.user = true;
      }}
      onPointerUpCapture={(e) => {
        if (fortuneOpen) return;
        if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }}
      onPointerCancelCapture={(e) => {
        if (fortuneOpen) return;
        if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
      }}
    >
      <canvas ref={bgCanvasRef} className="bgCanvas" />

      <div className="cardStage">
        <div ref={bookRef} className="book" data-open={open ? "1" : "0"}>
          <div className="page inside" onClick={() => open && triggerFireworks()} role="button" tabIndex={-1}>
            <canvas ref={fireCanvasRef} className="fireworksCanvas" />
            <div className="insideContent">
              <div className="insideFrame" aria-hidden="true" />
                    <div className="insideBlessingVertical">
                      <div className="insidePoemLines">
                        <span className="insidePoemText">一元初始</span>
                        <span className="insidePoemText">万象更新</span>
                        <span className="insidePoemText">奇绩创坛祝您新春大吉</span>
                      </div>
                    </div>
                    <div className="insidePoemSig">敬上：奇绩创坛</div>

                    {open && !fortuneOpen && !fortunePicked && ritualOpenedOnce ? (
                      <button
                        type="button"
                        className={"ritualHint" + (ritualHintVisible ? " isVisible" : "")}
                        onClick={(e) => {
                          e.stopPropagation();
                          openFortuneUI();
                        }}
                        aria-label="抽一签"
                      >
                        <span className="ritualHintDot" aria-hidden="true" />
                        <span className="ritualHintLabel">抽一签</span>
                      </button>
                    ) : null}
            </div>
          </div>

          <div
            className="page cover"
            role="button"
            tabIndex={0}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter" || e.key === " ") setOpen((v) => !v);
            }}
          >
            <div className="coverPattern" aria-hidden="true" />
            <div className="coverFrame" aria-hidden="true" />
            <div className="coverSheen" aria-hidden="true" />
            <div className="coverGlow" />
            <div className="coverContent">
              <img
                className="coverEmblem coverEmblemGold"
                src={import.meta.env.BASE_URL + "picture.png"}
                alt="徽标"
                draggable={false}
              />
              <div className="coverMain coverMainYear">2026</div>
              <div className="coverSub">HAPPY SPRING FESTIVAL</div>
              <div className="coverFooter">
                <div className="coverHint">点击翻开</div>
              </div>
            </div>
          </div>
        </div>

        <div ref={controlsRef} className="controls">
          <button className="btn" onClick={() => setOpen((v) => !v)}>
            {open ? "合上" : "翻开"}
          </button>
          <button className="btn" onClick={triggerFireworks} disabled={!open}>
            放烟花
          </button>
          <button className="btn" onClick={openFortuneUI}>
            {fortunePicked ? "查看签语" : "抽签"}
          </button>
          <button className="btn" onClick={() => setBlossomLevel((s) => (s === "light" ? "heavy" : "light"))}>
            {blossomLevel === "light" ? "桃花更多" : "桃花更少"}
          </button>
        </div>

        {fortuneOpen ? (
          <div
            className="fortuneOverlay"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeFortuneUI();
            }}
          >
            <div
              className={"fortuneModal " + (fortuneUI === "select" ? "isSelect" : "isResult")}
              data-phase={fortuneUI === "select" ? fortuneSelectPhase : undefined}
              data-picked={fortuneUI === "select" && selectedCard !== null ? "1" : "0"}
            >
              {fortuneUI === "select" ? (
                <>
                  <div className="fortuneHeader">
                    <div className="fortuneGrade">上签库</div>
                    <div className="fortuneTitle">请静心，选一张签卡</div>
                  </div>
                  <div className="fortuneCards" role="list">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={"fortuneCard" + (selectedCard === i ? " isSelected" : "")}
                        onClick={() => pickFortuneCard(i)}
                        role="listitem"
                        aria-label={`选择第 ${i + 1} 张签卡`}
                        style={
                          {
                            "--i": i,
                            "--dx": `${(i - 2) * 54}px`,
                            "--dy": `${Math.abs(i - 2) * 8}px`,
                            "--rot": `${(i - 2) * 7}deg`,
                            "--stackX": `${(i - 2) * 3}px`,
                            "--stackY": `${i * 2}px`,
                            "--stackR": `${(i - 2) * 1.2}deg`,
                          } as React.CSSProperties
                        }
                      >
                        <span className="fortuneCardInner" aria-hidden="true">
                          <span className="fortuneCardFace fortuneCardBack" />
                          <span className="fortuneCardFace fortuneCardFront" />
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="fortuneActions">
                    <button className="btn" onClick={closeFortuneUI}>
                      关闭
                    </button>
                  </div>
                </>
              ) : fortuneUI === "result" && fortune ? (
                <>
                  <div className="fortuneHeader">
                    <div className="fortuneGrade">{fortune.grade}</div>
                    <div className="fortuneTitle">{fortune.title}</div>
                  </div>

                  <div className="fortuneCards isResult" aria-hidden="true">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const selected = selectedCard === i;
                      return (
                        <div key={i} className={"fortuneCard" + (selected ? " isSelected" : " isDim")}
                          >
                          <div className="fortuneCardInner">
                            <div className="fortuneCardFace fortuneCardBack" />
                            <div className="fortuneCardFace fortuneCardFront">
                              {selected ? (
                                <div className="fortuneCardFrontText">
                                  <div className="fortuneCardFrontGrade">{fortune.grade}</div>
                                  <div className="fortuneCardFrontTitle">{fortune.title}</div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="fortunePoem">
                    {fortune.poem.map((line) => (
                      <div key={line} className="fortunePoemLine">
                        {line}
                      </div>
                    ))}
                  </div>
                  <div className="fortuneSection">
                    <div className="fortuneLabel">解析</div>
                    <div className="fortuneText">{fortune.interpretation}</div>
                  </div>
                  <div className="fortuneSection">
                    <div className="fortuneLabel">建议</div>
                    <ul className="fortuneList">
                      {fortune.advice.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="fortuneActions">
                    <button className="btn" onClick={closeFortuneUI}>
                      关闭
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";
import { snapScrollEngine } from "@openuji/scrollcraft";
import { useEffect, useRef, useState } from "react";
import type { SnapAnimatorData } from "@openuji/scrollcraft";

const MAX_DIST = 200;
const MIN_WIDTH = 0.2;
const WAVE_RADIUS = 8;

type Align = "start" | "center" | "end";

function distToProgress(distToSnap: number) {
  const d = Math.min(Math.abs(distToSnap), MAX_DIST);
  const t = 1 - d / MAX_DIST;
  return MIN_WIDTH + t * (1 - MIN_WIDTH); // 0.2–1
}

const ALIGN_TO_RATIO: Record<Align, number> = {
  start: 0,   // top of viewport
  center: 0.5, // middle
  end: 1,     // bottom
};

export default function SnapDemo() {
  const snapDataRef = useRef<SnapAnimatorData | null>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const [rulerSegs, setRulerSegs] = useState<number>(20);

  // how many bars are needed for the viewport height
  useEffect(() => {
    const h = window.innerHeight;
    const segs = Math.ceil(h / 20);
    setRulerSegs(segs);
  }, []);

  useEffect(() => {
    const { engine, guestures, command, snapAnimator } = snapScrollEngine();

    let frameId: number;

    const update = () => {
      const data = snapAnimator.data;
      snapDataRef.current = data;

      const distToSnap = data?.distToSnap ?? Infinity;
      const baseProgress = distToProgress(distToSnap);

      const container = fillRef.current;
      if (container) {
        const bars = container.querySelectorAll<HTMLElement>(".bar");
        if (bars.length) {
          // 👇 get the currently snapping element from your data structure
          const currentEl = (data as any)?.element as
            | HTMLElement
            | undefined; // <-- adjust this property name!
          if (currentEl) {

            // read data-snap-align from the active element
            const alignAttr = (currentEl?.dataset.snapAlign ||
              "center") as Align;
            const alignRatio = ALIGN_TO_RATIO[alignAttr] ?? 0.5;

            // index of the bar that should be the wave center
            const alignIndex = alignRatio * (bars.length - 1);

            bars.forEach((bar, index) => {
              const segDist = Math.abs(index - alignIndex);

              // 1 at center, 0 at WAVE_RADIUS and beyond
              const influence = Math.max(0, 1 - segDist / WAVE_RADIUS);

              const barProgress =
                MIN_WIDTH + (baseProgress - MIN_WIDTH) * influence;

              bar.style.setProperty("--bar-progress", barProgress.toString());
            });
          }
        }
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    return () => {
      guestures.destroy();
      cancelAnimationFrame(frameId);
    };
  }, []);

  const segs = 5;

  return (
    <>
      {/* ruler */}
      <div ref={fillRef} className="fixed top-0 left-0 w-20 h-screen">
        {Array.from({ length: rulerSegs }).map((_, i) => (
          <div
            key={i}
            className="bar h-1 w-20 my-4 bg-red-500"
            style={{
              transform: "scaleX(var(--bar-progress, 0.2))",
              transformOrigin: "left",
            }}
          />
        ))}
      </div>

      {/* snapping blocks */}
      <main className="flex flex-col items-center w-full">
        {Array.from({ length: segs }).map((_, i) => (
          <div
            key={i}
            data-snap-align={
              i === 0 ? "start" : i === segs - 1 ? "end" : "center"
            }

            // className={`snapBlock ${i === segs - 1 ? "" : "snap"}`}
            className="snap snapBlock"
          >
            {i + 1}
          </div>
        ))}
      </main>
    </>
  );
}

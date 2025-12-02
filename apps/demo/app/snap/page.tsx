"use client";
import { snapScrollEngine } from "@openuji/scrollcraft";
import { useEffect, useRef, useState } from "react";
import type { SnapAnimatorData } from "@openuji/scrollcraft";
import styles from "./page.module.css";

const MAX_DIST = 300;
const MIN_WIDTH = 0.2;
const WAVE_RADIUS = 8;

function distToProgress(distToSnap: number) {
  const d = Math.min(Math.abs(distToSnap), MAX_DIST);
  const t = 1 - d / MAX_DIST;
  return MIN_WIDTH + t * (1 - MIN_WIDTH);
}


export default function SnapDemo() {

  const snapDataRef = useRef<SnapAnimatorData | null>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  const [rulterSegs, setRulerSegs] = useState<number>(20);

  useEffect(() => {
    const h = window.innerHeight;
    const segs = Math.ceil(h / 20);

    setRulerSegs(segs);


  }, []);

  useEffect(() => {
    const { engine, guestures, command, snapAnimator } = snapScrollEngine();


    let frameId: number;

    const update = () => {
      // read latest data from your engine
      const data = snapAnimator.data;
      snapDataRef.current = data;

      // adjust this path to your real structure:
      const distToSnap = data?.distToSnap ?? 0;

      const progress = distToProgress(distToSnap); // 0.2–1


      const container = fillRef.current;
      if (container) {
        const bars = container.querySelectorAll<HTMLElement>(".bar");

        // align point is vertical center (because data-snap-align="center")
        const alignIndex = (bars.length - 1) / 2;

        bars.forEach((bar, index) => {
          const segDist = Math.abs(index - alignIndex);

          // 1.0 at alignIndex, linearly falling to 0 at WAVE_RADIUS
          const influence = Math.max(0, 1 - segDist / WAVE_RADIUS);

          // mix MIN_WIDTH with baseProgress using the influence
          const barProgress =
            MIN_WIDTH + (progress - MIN_WIDTH) * influence;

          bar.style.setProperty("--bar-progress", barProgress.toString());
        });
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);


    return () => {
      guestures.destroy();
    };
  }, []);
  const segs = 5;
  return <>
    <div ref={fillRef} className="fixed top-0 left-0 w-20 h-screen">
      {Array.from({ length: rulterSegs }).map((_, i) => (
        <div className="bar h-1 w-20 my-4 bg-red-500" style={{
          transform: `scaleX(var(--bar-progress))`,
          transformOrigin: "left",
        }} key={i} />
      ))}

    </div>
    <main className="flex flex-col items-center w-full">
      {Array.from({ length: segs }).map((_, i) => (
        <div
          key={i}
          data-snap-align={`${i === 0 ? "start" : i === segs - 1 ? "end" : "center"}`}
          // data-snap-align="center"
          // className={`${i === 0 || i === segs - 1 ? "" : "snap"} snapBlock`}
          className="snapBlock snap"
        // style={{
        //   backgroundColor: i % 2 === 0 ? "red" : "blue",
        // }}
        >
          {i + 1}
        </div>
      ))}
    </main>
  </>;
}
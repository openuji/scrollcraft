"use client";

import { useEffect, useState, useRef } from "react";
import { circularScrollEngine } from "@openuji/scrollcraft";
import Link from "next/link";

export default function CircularDemo() {
  const [command, setCommand] = useState<{
    scrollTo: (position: number) => void;
  } | null>(null);
  const posRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize the circular scroll engine
    // This creates a virtual circular driver that wraps around
    const { engine, guestures, command } = circularScrollEngine();

    setCommand(command);
    // Use RAF batching to prevent layout shifts
    let rafId: number | null = null;
    let latestPosition = 0;

    // Subscribe to position updates reactively (no layout reads!)
    const unsubscribe = engine.signal.on((position) => {
      latestPosition = position;

      // Only schedule RAF if not already scheduled
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (posRef.current) {
            posRef.current.textContent = `Pos: ${Math.round(latestPosition)}px`;
          }
          rafId = null;
        });
      }
    });

    return () => {
      guestures.destroy();
      unsubscribe();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  const scrollToTop = () => {
    command?.scrollTo(0);
  };

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg backdrop-blur-sm z-50 font-mono">
        <div
          ref={posRef}
          className="tabular-nums"
          style={{ minWidth: "120px" }}
        >
          Pos: 0px
        </div>
        <div className="mt-2">
          <button
            onClick={scrollToTop}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm transition-colors w-full"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="fixed top-4 left-4 z-50">
        <Link
          href="/"
          className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white font-bold transition-colors border border-white/20"
        >
          ← Back
        </Link>
      </div>

      <main className="w-full">
        {/* Header Section - Bounded Start */}
        <header
          data-snap-align="start"
          className="snap h-[100vh] w-full flex flex-col items-center justify-center bg-slate-900 text-white p-8 border-b border-white/10"
        >
          <h1 className="text-5xl font-bold mb-4">Circular Scroll</h1>
          <p className="text-xl text-slate-400 max-w-md text-center">
            Scroll down. The content below loops infinitely.
          </p>
        </header>

        {/* Looping Content */}
        {/* 
           The circular engine wraps the position, but visually we need enough content 
           to fill the screen and allow for the wrap to happen seamlessly if we were 
           mapping it to a visual loop. 
           
           However, `circularScrollEngine` in `scrollcraft` (based on the README/code) 
           uses a virtual driver. The DOM driver itself is still bounded by the content size.
           The `circular-end-unbounded` domain means the *logical* position goes on forever,
           wrapping around a period.
           
           To visualize this, we can just show a repeating pattern that matches the 
           scroll height, or simply let the user scroll "past" the end and see the 
           position counter loop/grow while the visual content might stay static or 
           we'd need to implement a virtual list to truly show infinite content.
           
           For this demo, since `scrollcraft` separates the driver (DOM) from the engine logic,
           if we use `circularScrollEngine`, it wraps the DOM driver. 
           Let's see what happens when we scroll past the end. 
           
           Actually, looking at `createVirtualCircularDriver` in `index.ts`:
           It sets `period` to `base.limit()`. 
           So the logical position will wrap [0, limit).
           
           Wait, `circular-end-unbounded` means:
           "bounded start, circular end".
           
           If we want to VISUALLY loop, we usually need to render content in a way 
           that matches the position. 
           
           But `scrollcraft`'s default `circularScrollEngine` just wraps the *value*.
           The DOM scroll position will be written back to the element. 
           If the domain says "circular", `clampToDomain` might wrap the value 
           before writing it to the driver?
           
           Let's check `ScrollEngineDOM.applyPosition`:
           `this.domain.mapPosition` -> returns `canonical` and `logical`.
           `driver.write(canonical)`
           
           If `circular-end-unbounded`, `mapPosition` (via `createDomainRuntime`) 
           likely maps the logical unbounded position back to the canonical [0, limit] range.
           
           So if I scroll past the bottom, it should jump back to 0 (or min) visually, 
           creating a loop effect if the content at bottom matches content at top.
        */}

        <div className="bg-gradient-to-b from-indigo-900 via-purple-900 to-indigo-900">
          {Array.from({ length: 5 }).map((_, i) => (
            <section
              key={i}
              className="h-[80vh] flex items-center justify-center border-b border-white/5"
            >
              <div className="text-8xl font-bold text-white/10">{i + 1}</div>
            </section>
          ))}
          {/* Duplicate first section at the end for seamless visual loop if we were doing that manually,
                but here the engine handles the coordinate wrapping. 
                If the engine wraps 0..limit, then when we hit limit, we go to 0.
                So the bottom of the page should look like the top of the scrollable area 
                (excluding the header if the header is part of the scroll area).
                
                Actually, `circularScrollEngine` wraps the WHOLE scrollable area.
                So we should probably make the whole page the loop, or at least understand 
                that the header is part of the loop.
            */}
          <footer
            data-snap-align="start"
            className="snap h-[100vh] w-full flex flex-col items-center justify-center bg-slate-900 text-white p-8 border-t border-white/10"
          >
            <h1 className="text-5xl font-bold mb-4">Circular Scroll</h1>
            <p className="text-xl text-slate-400 max-w-md text-center">
              Scroll down. The content below loops infinitely.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

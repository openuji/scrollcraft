"use client";

import { useEffect, useRef, useState } from "react";
import { defaultScrollEngine, ScrollEngine } from "@openuji/scrollcraft";
import Link from "next/link";

export default function Home() {
  const [engine, setEngine] = useState<ScrollEngine | null>(null);
  const posRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize the default scroll engine
    // This uses window driver, wheel + touch inputs, raf scheduler, exp animator
    const scrollEngine = defaultScrollEngine();
    scrollEngine.init();
    setEngine(scrollEngine);

    // Poll for position updates
    let rafId: number;
    const update = () => {
      if (posRef.current) {
        posRef.current.textContent = `Scroll: ${Math.round(scrollEngine.getPosition())}px`;
      }
      rafId = requestAnimationFrame(update);
    };
    update();

    return () => {
      cancelAnimationFrame(rafId);
      scrollEngine.destroy();
    };
  }, []);

  const scrollToTop = () => {
    engine?.scrollTo(0);
  };

  const scrollToSection = (px: number) => {
    engine?.scrollTo(px);
  };

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg backdrop-blur-sm z-50 font-mono">
        <div ref={posRef}>Scroll: 0px</div>
        <div className="mt-2 flex flex-col gap-2">
          <button
            onClick={scrollToTop}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm transition-colors"
          >
            Top
          </button>
          <button
            onClick={() => scrollToSection(1000)}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm transition-colors"
          >
            To 1000px
          </button>
          <button
            onClick={() => scrollToSection(2500)}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm transition-colors"
          >
            To 2500px
          </button>
        </div>
      </div>

      <main className="flex flex-col items-center w-full">
        <header className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
          <h1 className="text-6xl font-bold mb-4 tracking-tighter">
            Scrollcraft
          </h1>
          <p className="text-xl text-slate-400 max-w-md text-center">
            A smooth scrolling demo powered by @openuji/scrollcraft. Scroll down
            to explore.
          </p>
          <div className="absolute bottom-10 animate-bounce flex flex-col items-center gap-4">
            <span className="text-sm">↓ Scroll</span>
            <Link
              href="/circular"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-colors border border-white/20 text-sm"
            >
              Try Circular Demo →
            </Link>
          </div>
        </header>

        <section className="h-[80vh] w-full flex items-center justify-center bg-slate-100 text-slate-900 p-8">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-bold mb-6">Smooth & Natural</h2>
            <p className="text-lg leading-relaxed">
              The engine handles input from wheel and touch events, normalizing
              them into a consistent impulse. The exponential animator ensures
              that scrolling feels weighty and natural, settling smoothly at the
              target.
            </p>
          </div>
        </section>

        <section className="h-[80vh] w-full flex items-center justify-center bg-slate-900 text-white p-8">
          <div className="max-w-2xl text-right">
            <h2 className="text-4xl font-bold mb-6">Programmatic Control</h2>
            <p className="text-lg leading-relaxed">
              You can command the engine to scroll to any position. The same
              physics engine handles the transition, ensuring that even
              automated movements feel organic.
            </p>
          </div>
        </section>

        <section className="h-[150vh] w-full bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 p-8 flex flex-col items-center justify-center text-white">
          <h2 className="text-5xl font-bold mb-12">Long Sections</h2>
          <div className="flex gap-4 flex-wrap justify-center">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="w-64 h-64 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-4xl font-bold border border-white/20"
              >
                {i + 1}
              </div>
            ))}
          </div>
        </section>

        <footer className="h-[50vh] w-full flex flex-col items-center justify-center bg-black text-white p-8">
          <h2 className="text-3xl font-bold mb-4">The End</h2>
          <button
            onClick={scrollToTop}
            className="px-6 py-3 bg-white text-black rounded-full font-bold hover:scale-105 transition-transform"
          >
            Back to Top
          </button>
        </footer>
      </main>
    </div>
  );
}

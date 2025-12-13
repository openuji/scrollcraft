"use client";

import { useEffect, useRef, useState } from "react";
import type { SnapAnimatorData } from "@openuji/scrollcraft";
import {
    createRafScheduler,
    createDOMDriver,
    createEngine,
    createGesturePort,
    wheelInput,
    touchInput,
    createSnapAnimator,
    expAnimator,
    createDomainRuntime,
    createCircularByBottomDomainRuntime,
} from "@openuji/scrollcraft";
// ─────────────────────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────────────────────

type DomainType = "bounded" | "circular";
type SnapType = "mandatory" | "proximity";
type Align = "start" | "center" | "end";

interface DemoConfig {
    domain: DomainType;
    snapType: SnapType;
    proximity: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wave Visualization Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DIST = 100;
const MIN_WIDTH = 0.2;
const WAVE_RADIUS = 8;

const ALIGN_TO_RATIO: Record<Align, number> = {
    start: 0,
    center: 0.5,
    end: 1,
};

function distToProgress(distToSnap: number) {
    const d = Math.min(Math.abs(distToSnap), MAX_DIST);
    const t = 1 - d / MAX_DIST;
    return MIN_WIDTH + t * (1 - MIN_WIDTH);
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine Factory (inline to handle dynamic config)
// ─────────────────────────────────────────────────────────────────────────────

function createConfiguredEngine(config: DemoConfig) {
    // Import from scrollcraft - this only runs on client since parent component is "use client"

    const driver = createDOMDriver(window, "block");
    const scheduler = createRafScheduler();

    const inputs = [
        wheelInput({ element: document.body }),
        touchInput({ element: document.body, multiplier: 2 }),
    ];

    // Create domain based on config
    const domain =
        config.domain === "circular"
            ? createCircularByBottomDomainRuntime(() => driver.limit())
            : createDomainRuntime(driver.limit);

    // Create snap animator with config
    const snapAnimator = createSnapAnimator({
        animator: expAnimator(0.1),
        container: document.documentElement,
        domain,
        axis: "block",
        selector: ".snap",
        type: config.snapType,
        proximity: config.proximity,
    });

    const rawEngine = createEngine(driver, scheduler, domain);
    const engine = rawEngine;

    const guestures = createGesturePort({
        inputs,
        engine,
        animator: snapAnimator,
    });

    return {
        engine,
        guestures,
        snapAnimator,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Control Panel Component
// ─────────────────────────────────────────────────────────────────────────────

interface ControlPanelProps {
    config: DemoConfig;
    onConfigChange: (config: DemoConfig) => void;
    posRef: React.RefObject<HTMLDivElement | null>;
    distRef: React.RefObject<HTMLDivElement | null>;
}

function ControlPanel({
    config,
    onConfigChange,
    posRef,
    distRef,
}: ControlPanelProps) {
    const [isExpanded, setIsExpanded] = useState(() => {
        // Default: expanded on desktop (768px+), collapsed on mobile
        if (typeof window !== "undefined") {
            return window.innerWidth >= 768;
        }
        return true; // SSR fallback
    });

    // Handle screen resize / orientation change
    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 768px)");
        const handleChange = (e: MediaQueryListEvent) => {
            setIsExpanded(e.matches);
        };
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);
    const updateConfig = (partial: Partial<DemoConfig>) => {
        onConfigChange({ ...config, ...partial });
    };

    return (
        <div className="fixed top-4 right-4 bg-black/90 text-white p-4 rounded-xl backdrop-blur-md z-50 font-mono shadow-2xl border border-white/10 min-w-[200px] max-w-[280px] transition-all duration-300">
            {/* Package Info Header */}
            <div className="flex items-center gap-3 text-white/50 mb-3 pb-3 border-b border-white/10">
                <a
                    href="https://www.npmjs.com/package/@openuji/scrollcraft"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                    title="npm"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331zM10.665 10H12v2.667h-1.335V10z" />
                    </svg>
                </a>
                <a
                    href="https://github.com/openuji/scrollcraft"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                    title="GitHub"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                </a>
                <span className="text-xs">@openuji/scrollcraft</span>
            </div>

            {/* Debug Info + Toggle */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                    <div
                        ref={posRef}
                        className="tabular-nums text-lg font-bold text-cyan-400"
                    >
                        0px
                    </div>
                    <div ref={distRef} className="text-xs text-slate-400">
                        dist: 0px
                    </div>
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
                >
                    <svg
                        className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            {/* Expandable Content */}
            {isExpanded && (
                <>
                    {/* Domain Toggle */}
                    <div className="mt-4 pt-4 border-t border-white/20">
                        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                            Domain
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => updateConfig({ domain: "bounded" })}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${config.domain === "bounded"
                                    ? "bg-cyan-500 text-black"
                                    : "bg-white/10 hover:bg-white/20 text-white"
                                    }`}
                            >
                                Bounded
                            </button>
                            <button
                                onClick={() => updateConfig({ domain: "circular" })}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${config.domain === "circular"
                                    ? "bg-purple-500 text-white"
                                    : "bg-white/10 hover:bg-white/20 text-white"
                                    }`}
                            >
                                Circular
                            </button>
                        </div>
                    </div>

                    {/* Snap Type Toggle */}
                    <div className="mt-4">
                        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                            Snap Type
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => updateConfig({ snapType: "mandatory" })}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${config.snapType === "mandatory"
                                    ? "bg-orange-500 text-black"
                                    : "bg-white/10 hover:bg-white/20 text-white"
                                    }`}
                            >
                                Mandatory
                            </button>
                            <button
                                onClick={() => updateConfig({ snapType: "proximity" })}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${config.snapType === "proximity"
                                    ? "bg-green-500 text-black"
                                    : "bg-white/10 hover:bg-white/20 text-white"
                                    }`}
                            >
                                Proximity
                            </button>
                        </div>
                    </div>

                    {/* Proximity Slider (only when proximity mode) */}
                    {config.snapType === "proximity" && (
                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-slate-400 uppercase tracking-wider">
                                    Proximity
                                </span>
                                <span className="text-sm font-medium text-green-400">
                                    {config.proximity}px
                                </span>
                            </div>
                            <input
                                type="range"
                                min="50"
                                max="500"
                                step="10"
                                value={config.proximity}
                                onChange={(e) =>
                                    updateConfig({ proximity: parseInt(e.target.value) })
                                }
                                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                        </div>
                    )}
                </>
            )}

            {/* Footer: Active Config Badges */}
            <div className="mt-4 pt-3 border-t border-white/10">
                <div className="flex flex-wrap gap-1">
                    <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${config.domain === "circular"
                            ? "bg-purple-500/30 text-purple-300"
                            : "bg-cyan-500/30 text-cyan-300"
                            }`}
                    >
                        {config.domain}
                    </span>
                    <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${config.snapType === "mandatory"
                            ? "bg-orange-500/30 text-orange-300"
                            : "bg-green-500/30 text-green-300"
                            }`}
                    >
                        {config.snapType}
                        {config.snapType === "proximity" && ` (${config.proximity}px)`}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wave Ruler Component
// ─────────────────────────────────────────────────────────────────────────────

function WaveRuler({
    rulerRef,
}: {
    rulerRef: React.RefObject<HTMLDivElement | null>;
}) {
    const [rulerSegs, setRulerSegs] = useState(20);

    useEffect(() => {
        const updateSegs = () => {
            const h = window.innerHeight;
            const segs = Math.ceil(h / 20);
            setRulerSegs(segs);
        };
        updateSegs();
        window.addEventListener("resize", updateSegs);
        return () => window.removeEventListener("resize", updateSegs);
    }, []);

    return (
        <div
            ref={rulerRef}
            className="fixed top-0 left-0 w-16 h-screen pointer-events-none z-40"
        >
            {Array.from({ length: rulerSegs }).map((_, i) => (
                <div
                    key={i}
                    className="bar h-1 w-16 my-4 bg-gradient-to-r from-rose-500 to-pink-500 rounded-r"
                    style={{
                        transform: "scaleX(var(--bar-progress, 0.2))",
                        transformOrigin: "left"
                    }}
                />
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Playground Component
// ─────────────────────────────────────────────────────────────────────────────

const SNAP_BLOCKS = 6;

export default function PlaygroundDemo() {
    const [config, setConfig] = useState<DemoConfig>({
        domain: "bounded",
        snapType: "proximity",
        proximity: 200,
    });

    const posRef = useRef<HTMLDivElement>(null);
    const distRef = useRef<HTMLDivElement>(null);

    const rulerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<ReturnType<typeof createConfiguredEngine> | null>(
        null,
    );

    // Initialize/reinitialize engine when config changes
    useEffect(() => {
        // Cleanup previous engine
        if (engineRef.current) {
            engineRef.current.guestures.destroy();
        }

        // Create new engine with current config
        const engineData = createConfiguredEngine(config);
        engineRef.current = engineData;

        let frameId: number;

        const update = () => {
            const data = engineData.snapAnimator.data;

            const distToSnap = data?.distToSnap ?? Infinity;
            const baseProgress = distToProgress(distToSnap);

            // Update dist display directly via ref
            if (distRef.current) {
                distRef.current.textContent = `dist: ${Math.round(distToSnap === Infinity ? 0 : distToSnap)}px`;
            }

            const container = rulerRef.current;
            if (container) {
                const bars = container.querySelectorAll<HTMLElement>(".bar");
                if (bars.length) {
                    const currentEl = (data as SnapAnimatorData)?.element as
                        | HTMLElement
                        | undefined;

                    if (currentEl) {
                        const alignAttr = (currentEl?.dataset.snapAlign ||
                            "center") as Align;
                        const alignRatio = ALIGN_TO_RATIO[alignAttr] ?? 0.5;
                        const alignIndex = alignRatio * (bars.length - 1);

                        bars.forEach((bar, index) => {
                            const segDist = Math.abs(index - alignIndex);
                            const influence = Math.max(0, 1 - segDist / WAVE_RADIUS);
                            const barProgress =
                                MIN_WIDTH + (baseProgress - MIN_WIDTH) * influence;
                            bar.style.setProperty("--bar-progress", barProgress.toString());
                        });
                    } else {
                        // Reset bars when no active snap element
                        bars.forEach((bar) => {
                            bar.style.setProperty("--bar-progress", MIN_WIDTH.toString());
                        });
                    }
                }
            }

            frameId = requestAnimationFrame(update);
        };

        frameId = requestAnimationFrame(update);

        // Subscribe to position updates - update DOM directly to avoid re-renders
        const unsubscribe = engineData.engine.signal.on((position: number) => {
            if (posRef.current) {
                posRef.current.textContent = `${Math.round(position)}px`;
            }
        });

        return () => {
            engineData.guestures.destroy();
            unsubscribe();
            cancelAnimationFrame(frameId);
        };
    }, [config]);

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Control Panel */}
            <ControlPanel
                config={config}
                onConfigChange={setConfig}
                posRef={posRef}
                distRef={distRef}
            />

            {/* Wave Ruler */}
            <WaveRuler rulerRef={rulerRef} />

            {/* Snap Blocks */}
            <main className="flex flex-col items-center w-full">
                {Array.from({ length: SNAP_BLOCKS }).map((_, i) => {
                    const isFirst = i === 0;
                    const isLast = i === SNAP_BLOCKS - 1;
                    const align = isFirst ? "start" : isLast ? "end" : "center";

                    // Gradient colors based on index
                    const gradients = [
                        "from-indigo-900 to-purple-900",
                        "from-purple-900 to-pink-900",
                        "from-pink-900 to-rose-900",
                        "from-rose-900 to-orange-900",
                        "from-orange-900 to-amber-900",
                        "from-amber-900 to-yellow-900",
                    ];

                    return (
                        <div
                            key={i}
                            data-snap-align={align}
                            className={`snap w-full h-[80vh] flex flex-col items-center justify-center 
                bg-gradient-to-b ${gradients[i % gradients.length]} 
                border-b border-white/10 relative`}
                        >
                            {/* Block Info */}
                            <div className="relative z-10 text-center">
                                <div className="text-6xl font-bold text-white/80 mb-4">
                                    {i + 1}
                                </div>
                                <div className="text-sm font-mono text-white/40 px-3 py-1 bg-white/5 rounded-full">
                                    align: {align}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </main>
        </div>
    );
}

import { EngineMiddleware, ScrollEngine } from "../core";

type PersistenceOptions = {
  key?: (url?: string) => string;
  storage?: Storage | null;
  restoreMode?: "immediate" | "afterLayout";
  layoutTimeoutMs?: number;
  hooks?: { history?: boolean; pageshow?: boolean; visibilityHidden?: boolean };
};

export function getSessionStorageSafe(): Storage | null {
  try {
    const s = window.sessionStorage;
    s.getItem("__probe__");
    return s;
  } catch {
    return null;
  }
}

function tryGetItem(storage: Storage | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function trySetItem(storage: Storage | null, key: string, val: string) {
  if (!storage) return;
  try {
    storage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

export function sessionStoragePersistence(
  opts: PersistenceOptions = {},
): EngineMiddleware {
  const keyFn =
    opts.key ?? ((url?: string) => `pse:scroll:${url ?? window.location.href}`);
  const storageRef = () =>
    opts.storage !== undefined ? opts.storage : getSessionStorageSafe();

  const restoreMode = opts.restoreMode ?? "afterLayout";
  const layoutTimeoutMs = opts.layoutTimeoutMs ?? 2000;
  const hooks = {
    history: opts.hooks?.history ?? true,
    pageshow: opts.hooks?.pageshow ?? true,
    visibilityHidden: opts.hooks?.visibilityHidden ?? true,
  };

  const readPos = (): number | null => {
    const storage = storageRef();
    const raw = tryGetItem(storage, keyFn(location.href));
    if (!raw) return null;
    try {
      return (JSON.parse(raw)?.axes?.[0]?.position ?? null) as number | null;
    } catch {
      return null;
    }
  };

  const save = (engine: ScrollEngine) => {
    const storage = storageRef();
    if (!storage) return;
    const pos = engine.signal.value ?? 0;
    trySetItem(
      storage,
      keyFn(location.href),
      JSON.stringify({ axes: [{ position: pos }], timestamp: Date.now() }),
    );
  };

  const waitStable = (ms: number) =>
    new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, ms);
      const onLoad = () => {
        clearTimeout(timeout);
        window.removeEventListener("load", onLoad);
        resolve();
      };
      window.addEventListener("load", onLoad);
    });

  return (engine) => {
    const unsubs: (() => void)[] = [];

    // 1. Restore initial scroll position
    const initial = readPos();
    console.log("initial restore", initial, restoreMode);
    if (initial != null) {
      if (restoreMode === "immediate") {
        // before layout finishes; will likely be janky but predictable
        engine.signal.set(initial, "user");
      } else {
        // afterLayout: wait a tick / load to let layout settle
        const timeoutMs = layoutTimeoutMs;
        engine.schedule(async () => {
          await Promise.race<void>([
            waitStable(timeoutMs),
            new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
          ]);
          const p = readPos();
          if (p != null) engine.signal.set(p, "user");
        });
      }
    }

    // 2. Save on visibility change
    if (hooks.visibilityHidden) {
      const onVis = () => {
        if (document.visibilityState === "hidden") save(engine);
      };
      document.addEventListener("visibilitychange", onVis);
      unsubs.push(() =>
        document.removeEventListener("visibilitychange", onVis),
      );
    }

    // 3. Save on pageshow / pagehide (bfcache)
    if (hooks.pageshow) {
      const onHide = () => save(engine);
      window.addEventListener("pagehide", onHide);
      unsubs.push(() => window.removeEventListener("pagehide", onHide));
    }

    // 4. Patch history pushState/replaceState to save & restore on SPA nav
    if (hooks.history) {
      const patch = (m: "pushState" | "replaceState") => {
        const orig = history[m].bind(history);
        history[m] = (s: unknown, t: string, url?: string | URL | null) => {
          save(engine);
          const ret = orig(s, t, url);
          const p = readPos();
          if (p != null) {
            // schedule twice to get "after layout" semantics with your scheduler
            engine.schedule(() =>
              engine.schedule(() => engine.signal.set(p, "program")),
            );
          }
          return ret;
        };
        return () => {
          history[m] = orig;
        };
      };
      unsubs.push(patch("pushState"), patch("replaceState"));
    }

    // return destroy
    return () => {
      unsubs.forEach((u) => u());
    };
  };
}

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// ─── Infinite canvas ──────────────────────────────────────────────────────────
// draw.io-style navigation:
//   • drag empty space / middle mouse / hold Space → pan
//   • wheel or two-finger trackpad scroll → pan
//   • ⌘/Ctrl + wheel, or trackpad pinch → zoom at cursor
//   • touch: one finger pans, two fingers pinch-zoom
// Children live in "world" coordinates inside a single transformed layer.

export interface View {
  x: number;
  y: number;
  k: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasHandle {
  zoomBy(factor: number): void;
  /** Fit every `[data-node]` (or a given world rect) into the viewport. */
  fit(rect?: Rect, opts?: { maxK?: number; padding?: number }): void;
  /** Fit content WIDTH and pin it to the top — the readable overview. */
  fitWidth(opts?: { maxK?: number; top?: number; rect?: Rect; left?: number }): void;
  /** Smoothly center a node by its data-node id. */
  focusNode(id: string, opts?: { maxK?: number }): void;
  /** Convert a client (screen) point to world coordinates. */
  toWorld(clientX: number, clientY: number): { x: number; y: number };
  getView(): View;
  /** Shift the view by screen pixels (used for auto-pan while dragging). */
  panBy(dx: number, dy: number): void;
}

const MIN_K = 0.15;
const MAX_K = 2.5;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

/** Semantic zoom: cards drop detail as you zoom out (like a map). Exposed as a
 *  coarse level, not the raw view, so panning doesn't re-render every node. */
export type DetailLevel = 'far' | 'mid' | 'near';
const levelOf = (k: number): DetailLevel => (k < 0.36 ? 'far' : k < 0.5 ? 'mid' : 'near');
const DetailContext = createContext<DetailLevel>('near');
export const useDetailLevel = () => useContext(DetailContext);

interface CanvasProps {
  children: ReactNode;
  /** Rendered in screen space above the world (toolbars etc. go outside instead). */
  onBackgroundClick?: () => void;
  onViewChange?: (v: View) => void;
  className?: string;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  { children, onBackgroundClick, onViewChange, className },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [view, setViewState] = useState<View>({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  const animRef = useRef<number | null>(null);
  const [panning, setPanning] = useState(false);
  const spaceDown = useRef(false);

  const setView = useCallback(
    (v: View) => {
      viewRef.current = v;
      setViewState(v);
      onViewChange?.(v);
    },
    [onViewChange],
  );

  const cancelAnim = () => {
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  };

  const animateTo = useCallback(
    (target: View, ms = 420) => {
      cancelAnim();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) return setView(target);
      const from = viewRef.current;
      const t0 = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        const e = ease(t);
        setView({
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          k: from.k + (target.k - from.k) * e,
        });
        animRef.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      animRef.current = requestAnimationFrame(step);
    },
    [setView],
  );

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      const v = viewRef.current;
      const k = clampK(v.k * factor);
      const f = k / v.k;
      setView({ k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f });
    },
    [setView],
  );

  const measureNodes = useCallback((): Rect | null => {
    const world = worldRef.current;
    if (!world) return null;
    const v = viewRef.current;
    const box = rootRef.current!.getBoundingClientRect();
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    world.querySelectorAll<HTMLElement>('[data-node]').forEach((el) => {
      const r = el.getBoundingClientRect();
      const x1 = (r.left - box.left - v.x) / v.k;
      const y1 = (r.top - box.top - v.y) / v.k;
      minX = Math.min(minX, x1);
      minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x1 + r.width / v.k);
      maxY = Math.max(maxY, y1 + r.height / v.k);
    });
    if (!Number.isFinite(minX)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, []);

  const fitRect = useCallback(
    (rect: Rect, maxK = 1, padding = 64, animate = true) => {
      const box = rootRef.current!.getBoundingClientRect();
      const k = clampK(
        Math.min((box.width - padding * 2) / rect.w, (box.height - padding * 2) / rect.h, maxK),
      );
      const target = {
        k,
        x: box.width / 2 - (rect.x + rect.w / 2) * k,
        y: box.height / 2 - (rect.y + rect.h / 2) * k,
      };
      if (animate) animateTo(target);
      else setView(target);
    },
    [animateTo, setView],
  );

  useImperativeHandle(
    ref,
    () => ({
      zoomBy(factor) {
        const box = rootRef.current!.getBoundingClientRect();
        const v = viewRef.current;
        const k = clampK(v.k * factor);
        const f = k / v.k;
        const cx = box.width / 2;
        const cy = box.height / 2;
        animateTo({ k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f }, 200);
      },
      fit(rect, opts) {
        const r = rect ?? measureNodes();
        if (r) fitRect(r, opts?.maxK ?? 1, opts?.padding ?? 64);
      },
      fitWidth(opts) {
        const r = opts?.rect ?? measureNodes();
        if (!r) return;
        const box = rootRef.current!.getBoundingClientRect();
        const pad = opts?.left ?? 48;
        const k = clampK(Math.min((box.width - pad * 2) / r.w, opts?.maxK ?? 0.9));
        const x = opts?.left != null ? pad - r.x * k : box.width / 2 - (r.x + r.w / 2) * k;
        animateTo({ k, x, y: (opts?.top ?? 84) - r.y * k });
      },
      focusNode(id, opts) {
        const el = worldRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
        if (!el) return;
        const v = viewRef.current;
        const box = rootRef.current!.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const rect = {
          x: (r.left - box.left - v.x) / v.k,
          y: (r.top - box.top - v.y) / v.k,
          w: r.width / v.k,
          h: r.height / v.k,
        };
        fitRect(rect, opts?.maxK ?? 1.1, 96);
      },
      toWorld(clientX, clientY) {
        const box = rootRef.current!.getBoundingClientRect();
        const v = viewRef.current;
        return { x: (clientX - box.left - v.x) / v.k, y: (clientY - box.top - v.y) / v.k };
      },
      getView: () => viewRef.current,
      panBy(dx, dy) {
        const v = viewRef.current;
        setView({ ...v, x: v.x + dx, y: v.y + dy });
      },
    }),
    [animateTo, fitRect, measureNodes, setView],
  );

  // Wheel: needs a non-passive listener to preventDefault browser zoom/scroll.
  useEffect(() => {
    const el = rootRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnim();
      const box = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch arrives as ctrl+wheel with small deltas.
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025));
        zoomAt(e.clientX - box.left, e.clientY - box.top, factor);
      } else {
        const v = viewRef.current;
        const mult = e.deltaMode === 1 ? 16 : 1;
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        setView({ ...v, x: v.x - dx * mult, y: v.y - dy * mult });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setView, zoomAt]);

  // Space-to-pan, like Figma / draw.io.
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        spaceDown.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Pointer pan + touch pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    mode: 'pan' | 'pinch' | null;
    startView: View;
    sx: number;
    sy: number;
    dist: number;
    moved: boolean;
    fromBackground: boolean;
  }>({ mode: null, startView: view, sx: 0, sy: 0, dist: 0, moved: false, fromBackground: false });

  const isBackground = (t: EventTarget | null) =>
    t === rootRef.current || t === worldRef.current || (t instanceof Element && !!t.closest('[data-canvas-bg]'));

  const onPointerDown = (e: React.PointerEvent) => {
    const bg = isBackground(e.target);
    const wantsPan = bg || e.button === 1 || spaceDown.current;
    if (!wantsPan && e.pointerType !== 'touch') return;
    // On touch, panning only starts from the background (so cards stay tappable),
    // but a second finger anywhere upgrades to pinch.
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'touch' && !bg && pointers.current.size < 2) return;

    cancelAnim();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = {
        mode: 'pinch',
        startView: viewRef.current,
        sx: (a.x + b.x) / 2,
        sy: (a.y + b.y) / 2,
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        moved: true,
        fromBackground: false,
      };
    } else {
      gesture.current = {
        mode: 'pan',
        startView: viewRef.current,
        sx: e.clientX,
        sy: e.clientY,
        dist: 0,
        moved: false,
        fromBackground: bg,
      };
    }
    setPanning(true);
    if (e.button === 1) e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g.mode) return;
    if (g.mode === 'pan') {
      const dx = e.clientX - g.sx;
      const dy = e.clientY - g.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true;
      setView({ ...g.startView, x: g.startView.x + dx, y: g.startView.y + dy });
    } else {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts;
      const box = rootRef.current!.getBoundingClientRect();
      const cx = (a.x + b.x) / 2 - box.left;
      const cy = (a.y + b.y) / 2 - box.top;
      const k = clampK(g.startView.k * (Math.hypot(a.x - b.x, a.y - b.y) / g.dist));
      const f = k / g.startView.k;
      const scx = g.sx - box.left;
      const scy = g.sy - box.top;
      setView({
        k,
        x: cx - (scx - g.startView.x) * f,
        y: cy - (scy - g.startView.y) * f,
      });
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 0) {
      if (g.mode === 'pan' && !g.moved && g.fromBackground) onBackgroundClick?.();
      gesture.current.mode = null;
      setPanning(false);
    } else if (g.mode === 'pinch' && pointers.current.size === 1) {
      // Pinch → pan with remaining finger without a jump.
      const [p] = [...pointers.current.values()];
      gesture.current = { ...g, mode: 'pan', startView: viewRef.current, sx: p.x, sy: p.y, moved: true };
    }
  };

  const grid = 24 * view.k;

  return (
    <div
      ref={rootRef}
      className={`canvas-grid relative h-full w-full touch-none overflow-hidden select-none ${className ?? ''}`}
      data-panning={panning}
      style={
        {
          '--grid-size': `${Math.max(grid, 6)}px`,
          '--grid-x': `${view.x}px`,
          '--grid-y': `${view.y}px`,
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onAuxClick={(e) => e.button === 1 && e.preventDefault()}
    >
      <div
        ref={worldRef}
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.k})` }}
      >
        <DetailContext.Provider value={levelOf(view.k)}>{children}</DetailContext.Provider>
      </div>
    </div>
  );
});

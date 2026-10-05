import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

// ─── Drag & drop for project cards and task rows ──────────────────────────────
// Pointer-based (not HTML5 DnD) so it behaves the same with mouse, pen and
// touch, and so it works inside the scaled canvas: hit-testing uses
// `elementsFromPoint` + screen-space rects, which already include the zoom.
//
// Markup contract:
//   list container  → data-drop-list="<listId>"  data-drop-kind="project|task"
//   draggable item  → data-drag-id="<id>" (direct child of its list)
// listId is the parent's id: a domain id for projects, a project id for tasks.

export type DragKind = 'project' | 'task';
export interface DropTarget {
  listId: string;
  /** Insert position among the list's items, excluding the dragged one. */
  index: number;
}
interface Active {
  kind: DragKind;
  id: string;
  label: string;
}

interface DndValue {
  active: Active | null;
  over: DropTarget | null;
  begin: (e: React.PointerEvent, kind: DragKind, id: string, label: string) => void;
  /** True right after a drag ended — swallow the click it would otherwise fire. */
  justDragged: () => boolean;
}

const Ctx = createContext<DndValue>({
  active: null,
  over: null,
  begin: () => {},
  justDragged: () => false,
});
export const useDnd = () => useContext(Ctx);

const MOVE_THRESHOLD = 5;
const TOUCH_HOLD_MS = 320;
const EDGE = 56;
const EDGE_SPEED = 14;

export function DndProvider({
  children,
  onDrop,
  panBy,
  boundsRef,
}: {
  children: ReactNode;
  onDrop: (kind: DragKind, id: string, target: DropTarget) => void;
  panBy: (dx: number, dy: number) => void;
  /** Element whose edges trigger auto-pan (the canvas viewport). */
  boundsRef: React.RefObject<HTMLElement | null>;
}) {
  const [active, setActive] = useState<Active | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);
  const overRef = useRef<DropTarget | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const lastEnd = useRef(0);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const panRef = useRef(panBy);
  panRef.current = panBy;

  const hitTest = useCallback((kind: DragKind, id: string, x: number, y: number) => {
    const stack = document.elementsFromPoint(x, y);
    let list: HTMLElement | null = null;
    for (const el of stack) {
      const l = (el as HTMLElement).closest<HTMLElement>(`[data-drop-kind="${kind}"]`);
      if (l) {
        list = l;
        break;
      }
    }
    let next: DropTarget | null = null;
    if (list) {
      const items = [...list.children].filter(
        (c): c is HTMLElement => c instanceof HTMLElement && !!c.dataset.dragId && c.dataset.dragId !== id,
      );
      let index = items.length;
      for (let i = 0; i < items.length; i++) {
        const r = items[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) {
          index = i;
          break;
        }
      }
      next = { listId: list.dataset.dropList!, index };
    }
    const prev = overRef.current;
    if (prev?.listId !== next?.listId || prev?.index !== next?.index) {
      overRef.current = next;
      setOver(next);
    }
  }, []);

  const begin = useCallback(
    (e: React.PointerEvent, kind: DragKind, id: string, label: string) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const sx = e.clientX;
      const sy = e.clientY;
      const touch = e.pointerType === 'touch';
      const pointerId = e.pointerId;
      let started = false;
      let x = sx;
      let y = sy;
      let raf = 0;
      let holdTimer = 0;

      const placeGhost = () => {
        if (ghostRef.current) ghostRef.current.style.transform = `translate3d(${x + 12}px, ${y + 8}px, 0)`;
      };

      const tick = () => {
        const b = boundsRef.current?.getBoundingClientRect();
        if (b) {
          const vx = x < b.left + EDGE ? EDGE_SPEED : x > b.right - EDGE ? -EDGE_SPEED : 0;
          const vy = y < b.top + EDGE ? EDGE_SPEED : y > b.bottom - EDGE ? -EDGE_SPEED : 0;
          if (vx || vy) {
            panRef.current(vx, vy);
            hitTest(kind, id, x, y);
          }
        }
        raf = requestAnimationFrame(tick);
      };

      const start = () => {
        started = true;
        document.body.style.cursor = 'grabbing';
        setActive({ kind, id, label });
        requestAnimationFrame(placeGhost);
        hitTest(kind, id, x, y);
        raf = requestAnimationFrame(tick);
      };

      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        x = ev.clientX;
        y = ev.clientY;
        if (!started) {
          if (Math.hypot(x - sx, y - sy) < MOVE_THRESHOLD) return;
          if (touch) return cleanup(); // moved before the long-press fired → not a drag
          start();
        }
        ev.preventDefault();
        placeGhost();
        hitTest(kind, id, x, y);
      };

      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const target = overRef.current;
        const wasStarted = started;
        cleanup();
        if (wasStarted) {
          lastEnd.current = performance.now();
          if (target) onDropRef.current(kind, id, target);
        }
      };

      const key = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') {
          if (started) lastEnd.current = performance.now();
          cleanup();
        }
      };

      function cleanup() {
        window.clearTimeout(holdTimer);
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        window.removeEventListener('keydown', key);
        document.body.style.cursor = '';
        overRef.current = null;
        setOver(null);
        setActive(null);
      }

      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      window.addEventListener('keydown', key);
      if (touch) holdTimer = window.setTimeout(start, TOUCH_HOLD_MS);
    },
    [boundsRef, hitTest],
  );

  const justDragged = useCallback(() => performance.now() - lastEnd.current < 250, []);

  const value = useMemo(() => ({ active, over, begin, justDragged }), [active, over, begin, justDragged]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {active && (
        <div
          ref={ghostRef}
          className="bg-surface-overlay border-primary-500 zh-body-xs text-text-primary pointer-events-none fixed top-0 left-0 z-[60] max-w-72 truncate rounded-sm border-2 px-3 py-1.5 shadow-lg"
          style={{ transform: 'translate3d(-9999px,0,0)' }}
          aria-hidden
        >
          {active.kind === 'project' ? '專案　' : '任務　'}
          {active.label}
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Thin bar showing where the dragged item will land. Zero layout height so
 *  the list doesn't shift under the pointer (which would make the hovered
 *  index flicker); `className` can cancel a parent's flex gap. */
export function DropLine({ className, as: Tag = 'div' }: { className?: string; as?: 'div' | 'li' }) {
  return (
    <Tag className={`pointer-events-none relative h-0 shrink-0 list-none ${className ?? ''}`} aria-hidden>
      <span className="bg-primary-500 absolute inset-x-0 -top-0.5 h-1 rounded-full" />
    </Tag>
  );
}

/**
 * Interleave a DropLine into a list at the hovered index (index counts items
 * other than the one being dragged).
 */
export function withDropLine<T extends { id: string }>(
  items: T[],
  render: (item: T) => ReactNode,
  listId: string,
  over: DropTarget | null,
  activeId: string | undefined,
  line: ReactNode,
) {
  const out: ReactNode[] = [];
  let i = 0;
  const showAt = over?.listId === listId ? over.index : -1;
  for (const item of items) {
    if (item.id !== activeId) {
      if (i === showAt) out.push(<DropSlot key="__drop">{line}</DropSlot>);
      i++;
    }
    out.push(render(item));
  }
  if (showAt >= i) out.push(<DropSlot key="__drop">{line}</DropSlot>);
  return out;
}

function DropSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

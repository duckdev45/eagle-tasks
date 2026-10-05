import { toast } from '@duckdev45/eagle-component';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Board, EntityKind, EntityMap } from '../types';
import { SHEET_OF } from '../types';
import { api, type BatchOp } from './api';

const EMPTY: Board = { domains: [], projects: [], tasks: [], members: [] };
const POLL_MS = 60_000;

export type LoadState = 'loading' | 'ready' | 'error';

/**
 * Board state with optimistic writes. Every mutation updates local state
 * immediately, then syncs; on failure it toasts and re-fetches so the canvas
 * never shows something the sheet doesn't have.
 */
export function useBoard() {
  const [board, setBoard] = useState<Board>(EMPTY);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const pendingRef = useRef(0);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setState((s) => (s === 'ready' ? s : 'loading'));
    try {
      const b = await api.list();
      // Don't clobber optimistic edits that are still in flight.
      if (pendingRef.current === 0) setBoard(b);
      setState('ready');
      setError('');
      setLastSync(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState((s) => (s === 'ready' ? s : 'error'));
      if (silent) return;
      toast.error('讀取資料失敗', { description: e instanceof Error ? e.message : undefined });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true);
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  const track = useCallback(
    async (work: () => Promise<unknown>, okMsg?: string) => {
      pendingRef.current += 1;
      setPending(pendingRef.current);
      try {
        await work();
        if (okMsg) toast.success(okMsg);
        setLastSync(new Date());
      } catch (e) {
        toast.error('同步失敗，已重新載入', {
          description: e instanceof Error ? e.message : undefined,
        });
        pendingRef.current -= 1;
        setPending(pendingRef.current);
        await refresh(true);
        return;
      }
      pendingRef.current -= 1;
      setPending(pendingRef.current);
    },
    [refresh],
  );

  const save = useCallback(
    <K extends EntityKind>(kind: K, record: EntityMap[K], okMsg?: string) => {
      const sheet = SHEET_OF[kind];
      setBoard((b) => {
        const rows = b[sheet] as unknown as EntityMap[K][];
        const i = rows.findIndex((r) => r.id === record.id);
        const next = i >= 0 ? rows.map((r) => (r.id === record.id ? record : r)) : [...rows, record];
        return { ...b, [sheet]: next };
      });
      return track(() => api.upsert(sheet, record), okMsg);
    },
    [track],
  );

  /** Apply several upserts/deletes at once (reorder, cascade delete). */
  const batch = useCallback(
    (ops: BatchOp[], okMsg?: string) => {
      setBoard((b) => {
        const next: Board = {
          domains: [...b.domains],
          projects: [...b.projects],
          tasks: [...b.tasks],
          members: [...b.members],
        };
        for (const op of ops) {
          const rows = next[op.sheet] as { id: string }[];
          if (op.action === 'delete') {
            (next[op.sheet] as { id: string }[]) = rows.filter((r) => r.id !== op.id);
          } else {
            const i = rows.findIndex((r) => r.id === op.record.id);
            if (i >= 0) rows[i] = { ...rows[i], ...op.record };
            else rows.push(op.record);
          }
        }
        return next;
      });
      return track(() => api.batch(ops), okMsg);
    },
    [track],
  );

  return {
    board,
    state,
    error,
    syncing: pending > 0,
    lastSync,
    mode: api.mode,
    refresh,
    save,
    batch,
    resetDemo: api.reset
      ? () => {
          api.reset?.();
          void refresh();
        }
      : undefined,
  };
}

export type BoardApi = ReturnType<typeof useBoard>;

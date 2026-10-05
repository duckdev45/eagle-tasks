import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@duckdev45/eagle-component';
import {
  BuildingsIcon,
  CheckSquareIcon,
  FolderSimpleIcon,
  UserIcon,
} from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '../lib/cn';
import { search, type Hit } from '../lib/search';
import type { Board, EntityKind } from '../types';

const GROUPS: { kind: EntityKind; label: string; icon: React.ReactNode }[] = [
  { kind: 'domain', label: '客戶 / 產品線', icon: <BuildingsIcon /> },
  { kind: 'project', label: '專案', icon: <FolderSimpleIcon /> },
  { kind: 'member', label: '成員', icon: <UserIcon /> },
  { kind: 'task', label: '任務', icon: <CheckSquareIcon /> },
];

/**
 * "客戶提到什麼？" — the boss types whatever the client said (公司名、產業、
 * 需求關鍵字) and jumps straight to the frame / project / person to talk to.
 */
export function FindBox({
  board,
  onPick,
  className,
}: {
  board: Board;
  onPick: (hit: Hit) => void;
  className?: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => search(board, q), [board, q]);

  // ⌘K / Ctrl+K or "/" focuses the box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        wrapRef.current?.querySelector('input')?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const pick = (h: Hit) => {
    onPick(h);
    setOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const showList = open && q.trim().length > 0;

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <Command
        shouldFilter={false}
        className="bg-surface-elevated border-border-subtle overflow-visible rounded-md border shadow-sm"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            (e.target as HTMLElement).blur();
          }
        }}
      >
        <CommandInput
          value={q}
          onValueChange={(v) => {
            setQ(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="客戶提到什麼？輸入公司、產業或需求…  ⌘K"
          className="zh-body-xs h-10"
        />
        {showList && (
          <CommandList className="bg-surface-overlay border-border-subtle absolute top-full right-0 left-0 z-50 mt-1 max-h-[60vh] rounded-md border p-1 shadow-lg">
            <CommandEmpty>
              <span className="zh-body-xs text-text-muted">找不到「{q}」— 可以在客戶 / 產品線加上這個關鍵字</span>
            </CommandEmpty>
            {GROUPS.map((g) => {
              const rows = hits.filter((h) => h.kind === g.kind);
              if (!rows.length) return null;
              return (
                <CommandGroup key={g.kind} heading={g.label}>
                  {rows.map((h) => (
                    <CommandItem
                      key={`${h.kind}:${h.id}`}
                      value={`${h.kind}:${h.id}`}
                      onSelect={() => pick(h)}
                      className="flex items-start gap-2 py-2"
                    >
                      <span className="text-text-muted mt-0.5">{g.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="zh-body-xs text-text-primary block truncate font-medium">{h.title}</span>
                        <span className="zh-body-xxs text-text-muted block truncate">
                          {h.sub}
                          {h.via && <span className="text-accent-400"> · 符合{h.via}</span>}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        )}
      </Command>
    </div>
  );
}

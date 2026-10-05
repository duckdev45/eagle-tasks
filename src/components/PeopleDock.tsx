import { Button } from '@duckdev45/eagle-component';
import { PlusIcon, UsersThreeIcon } from '@phosphor-icons/react';

import { cn } from '../lib/cn';
import { isUrgent } from '../lib/meta';
import type { Member, Task } from '../types';
import { MemberAvatar } from './MemberAvatar';

/**
 * Bottom dock: who's on the team and how many open tasks each has. Clicking a
 * person spotlights everything they touch on the canvas.
 */
export function PeopleDock({
  members,
  tasks,
  active,
  onToggle,
  onOpen,
  onAdd,
}: {
  members: Member[];
  tasks: Task[];
  active: string | null;
  onToggle: (id: string | null) => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const open = (id: string) => tasks.filter((t) => t.assigneeId === id && t.status !== 'done').length;
  const urgent = (id: string) => tasks.filter((t) => t.assigneeId === id && isUrgent(t)).length;
  return (
    <div
      role="toolbar"
      aria-label="依成員篩選"
      className="bg-surface-elevated border-border-subtle flex max-w-[calc(100vw-24px)] items-center gap-1 overflow-x-auto rounded-full border p-1 shadow-md"
    >
      <button
        type="button"
        onClick={() => onToggle(null)}
        aria-pressed={active === null}
        className={cn(
          'zh-body-xxs-medium flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3',
          active === null ? 'bg-primary-600 text-text-on-primary' : 'text-text-secondary hover:bg-surface-sunken',
        )}
      >
        <UsersThreeIcon size={16} /> 全部
      </button>
      {members.map((m) => {
        const n = open(m.id);
        const u = urgent(m.id);
        const on = active === m.id;
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(on ? null : m.id)}
            onDoubleClick={() => onOpen(m.id)}
            title={`${m.name}${m.title ? ` · ${m.title}` : ''} — 點一下篩選，點兩下看詳細`}
            className={cn(
              'flex h-9 shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1',
              on ? 'bg-state-row-selected ring-primary-500 ring-2' : 'hover:bg-surface-sunken',
            )}
          >
            <MemberAvatar member={m} size="sm" />
            <span className="zh-body-xxs-medium text-text-primary">{m.name}</span>
            <span
              className={cn(
                'mono-xs min-w-5 rounded-full px-1.5 text-center',
                n ? 'bg-surface-sunken text-text-secondary' : 'text-text-muted',
              )}
            >
              {n}
            </span>
            {u > 0 && (
              <span
                className="mono-xs bg-danger-bold min-w-5 rounded-full px-1.5 text-center text-white"
                title={`${u} 項緊急`}
              >
                {u}
              </span>
            )}
          </button>
        );
      })}
      <Button variant="ghost" size="sm" radius="full" aria-label="新增成員" title="新增成員" onClick={onAdd} leadingIcon={<PlusIcon />} />
    </div>
  );
}

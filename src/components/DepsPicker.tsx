import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@duckdev45/eagle-component';
import { CheckIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';

import { cn } from '../lib/cn';
import { parseDeps } from '../lib/schedule';
import type { Task } from '../types';

/** 前置任務多選：同專案的任務，勾選＝「這些做完才能開始」。 */
export function DepsPicker({
  id,
  task,
  tasks,
  onChange,
}: {
  id?: string;
  task: Task;
  tasks: Task[];
  onChange: (deps: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = parseDeps(task);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const options = tasks
    .filter((t) => t.projectId === task.projectId && t.id !== task.id)
    .sort((a, b) => a.order - b.order);
  const set = (ids: string[]) => onChange(ids.join(','));

  return (
    <div className="flex flex-col gap-2">
      {chosen.length > 0 && (
        <ul className="flex flex-col gap-1">
          {chosen.map((d) => (
            <li
              key={d}
              className="bg-surface-sunken border-border-subtle flex items-center gap-2 rounded-xs border py-1 pr-1 pl-2"
            >
              <span
                className={cn(
                  'zh-body-xs min-w-0 flex-1 truncate',
                  byId.get(d)?.status === 'done' && 'text-text-muted line-through',
                )}
              >
                {byId.get(d)?.title ?? '（已刪除的任務）'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label="移除前置任務"
                leadingIcon={<XIcon />}
                onClick={() => set(chosen.filter((x) => x !== d))}
              />
            </li>
          ))}
        </ul>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            size="sm"
            leadingIcon={<PlusIcon />}
            disabled={!task.projectId}
            className="self-start"
          >
            {chosen.length ? '調整前置任務' : '加入前置任務'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(380px,calc(100vw-32px))] p-0">
          <Command>
            <CommandInput placeholder="搜尋同專案的任務…" className="zh-body-xs" />
            <CommandList className="max-h-72">
              <CommandEmpty>
                <span className="zh-body-xs text-text-muted">沒有符合的任務</span>
              </CommandEmpty>
              {options.map((t) => {
                const on = chosen.includes(t.id);
                return (
                  <CommandItem
                    key={t.id}
                    value={`${t.title} ${t.id}`}
                    onSelect={() => set(on ? chosen.filter((x) => x !== t.id) : [...chosen, t.id])}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={cn(
                        'grid size-4 shrink-0 place-items-center rounded-xs border',
                        on ? 'bg-primary-500 border-primary-500 text-white' : 'border-border-raised',
                      )}
                    >
                      {on && <CheckIcon weight="bold" size={11} />}
                    </span>
                    <span
                      className={cn(
                        'zh-body-xs min-w-0 flex-1 truncate',
                        t.status === 'done' && 'text-text-muted',
                      )}
                    >
                      {t.title}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

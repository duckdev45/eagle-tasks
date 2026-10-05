import { Badge, Button } from '@duckdev45/eagle-component';
import {
  ArrowBendDownRightIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
  HandshakeIcon,
  PlusIcon,
  ProhibitIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { memo, useRef } from 'react';

import { ComplexityPips } from '../components/Complexity';
import { MemberAvatar } from '../components/MemberAvatar';
import { cn } from '../lib/cn';
import {
  DOMAIN_COLOR,
  DOMAIN_KIND,
  PROJECT_PRIORITY,
  PROJECT_STATUS,
  TASK_STATUS,
  fmtDays,
  isBlocked,
  taskUrgency,
  daysUntil,
  shortDate,
  splitTags,
} from '../lib/meta';
import type { Spotlight } from '../lib/spotlight';
import type { Domain, Member, Project, Selection, Task } from '../types';
import { useDetailLevel } from './Canvas';
import { DropLine, useDnd, withDropLine } from './dnd';
import { FRAME_W, ROOT_H, ROOT_W, elbowPath, type Pos } from './layout';

const dimAttr = (spot: Spotlight | null, set: keyof Spotlight, id: string) =>
  spot ? (spot[set].has(id) ? 'false' : 'true') : undefined;

// ─── Root ─────────────────────────────────────────────────────────────────────

export function RootNode({
  pos,
  stats,
}: {
  pos: Pos;
  stats: { projects: number; open: number; people: number };
}) {
  const level = useDetailLevel();
  return (
    <div
      data-node
      data-node-id="root"
      className="bg-primary-600 text-text-on-primary absolute flex flex-col justify-center rounded-lg px-5 shadow-md"
      style={{ left: pos.x, top: pos.y, width: ROOT_W, height: ROOT_H }}
    >
      <div className={cn(level === 'far' ? 'text-[40px] leading-[48px] font-bold' : 'text-display-lg')}>
        EagleAI 團隊
      </div>
      {level !== 'far' && (
        <div className="zh-body-xs mt-1 opacity-85">
          {stats.projects} 個專案 · {stats.open} 項進行中任務 · {stats.people} 位成員
        </div>
      )}
    </div>
  );
}

export function Edges({
  root,
  targets,
  dim,
}: {
  root: Pos;
  targets: { id: string; pos: Pos; color: string }[];
  dim: (id: string) => boolean;
}) {
  const from = { x: root.x + ROOT_W / 2, y: root.y + ROOT_H };
  return (
    <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden>
      {targets.map((t) => (
        <g key={t.id} style={{ opacity: dim(t.id) ? 0.25 : 1, transition: 'opacity 160ms' }}>
          <path
            d={elbowPath(from, { x: t.pos.x + FRAME_W / 2, y: t.pos.y })}
            fill="none"
            stroke="var(--border-raised)"
            strokeWidth={2}
          />
          <circle cx={t.pos.x + FRAME_W / 2} cy={t.pos.y} r={5} fill={t.color} />
        </g>
      ))}
      <circle cx={from.x} cy={from.y} r={5} fill="var(--primary-600)" />
    </svg>
  );
}

// ─── Domain frame ─────────────────────────────────────────────────────────────

interface DomainFrameProps {
  domain: Domain;
  pos: Pos;
  /** 1-based position in the row. */
  index: number;
  /** This frame is the one being dragged (follows the pointer, no slide animation). */
  dragging: boolean;
  projects: Project[];
  tasks: Task[];
  members: Map<string, Member>;
  selection: Selection;
  spotlight: Spotlight | null;
  pulseId: string | null;
  getScale: () => number;
  onSelect: (s: Selection) => void;
  onDrag: (id: string, pos: Pos) => void;
  onDragEnd: (id: string, pos: Pos) => void;
  onAddProject: (domainId: string) => void;
  onAddTask: (projectId: string) => void;
}

export const DomainFrame = memo(function DomainFrame({
  domain,
  pos,
  index,
  dragging,
  projects,
  tasks,
  members,
  selection,
  spotlight,
  pulseId,
  getScale,
  onSelect,
  onDrag,
  onDragEnd,
  onAddProject,
  onAddTask,
}: DomainFrameProps) {
  const level = useDetailLevel();
  const color = DOMAIN_COLOR[domain.color].css;
  const lead = members.get(domain.leadId);
  const selected = selection?.kind === 'domain' && selection.id === domain.id;
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const k = getScale();
    const dx = (e.clientX - d.sx) / k;
    const dy = (e.clientY - d.sy) / k;
    if (!d.moved && Math.hypot(dx, dy) * k < 4) return;
    d.moved = true;
    onDrag(domain.id, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      const k = getScale();
      onDragEnd(domain.id, {
        x: Math.round(d.ox + (e.clientX - d.sx) / k),
        y: Math.round(d.oy + (e.clientY - d.sy) / k),
      });
    } else onSelect({ kind: 'domain', id: domain.id });
  };

  const keywords = splitTags(domain.keywords);
  const dnd = useDnd();

  return (
    <section
      data-node
      data-node-id={domain.id}
      data-dim={dimAttr(spotlight, 'domains', domain.id)}
      aria-label={`${DOMAIN_KIND[domain.kind].label}：${domain.name}`}
      className={cn(
        'bg-surface-raised absolute rounded-lg border shadow-sm',
        selected ? 'border-transparent ring-2' : 'border-border-subtle',
        pulseId === domain.id && 'focus-pulse',
      )}
      style={
        {
          left: pos.x,
          top: pos.y,
          width: FRAME_W,
          zIndex: dragging ? 20 : undefined,
          transition: dragging ? 'none' : 'left 200ms ease, top 200ms ease',
          '--tw-ring-color': color,
        } as React.CSSProperties
      }
    >
      {/* Header doubles as the drag handle. */}
      <header
        className="cursor-grab touch-none rounded-t-lg px-4 pt-3 pb-3 active:cursor-grabbing"
        style={{
          borderTop: `6px solid ${color}`,
          background: `color-mix(in srgb, ${color} 7%, transparent)`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
      >
        {level === 'far' ? (
          <div className="py-2 text-[52px] leading-[60px] font-bold" style={{ color }}>
            <span className="text-text-muted mr-3 font-mono">{String(index).padStart(2, '0')}</span>
            {domain.name}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span
                className="mono-sm-bold text-text-on-primary flex h-6 min-w-6 shrink-0 items-center justify-center rounded-xs px-1"
                style={{ background: color }}
                title={`第 ${index} 欄，拖曳標題可調整順序`}
              >
                {String(index).padStart(2, '0')}
              </span>
              <Badge variant={DOMAIN_KIND[domain.kind].badge} size="sm">
                {DOMAIN_KIND[domain.kind].label}
              </Badge>
              <h2 className="zh-subheading text-text-primary min-w-0 flex-1 truncate">{domain.name}</h2>
              <Button
                variant="ghost"
                size="sm"
                aria-label="新增專案"
                title="新增專案"
                onClick={() => onAddProject(domain.id)}
               leadingIcon={<PlusIcon />} />
            </div>
            <div className="zh-body-xs text-text-secondary mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <MemberAvatar member={lead} size="xs" />
                {lead ? `${lead.name} 負責` : '未指定負責人'}
              </span>
              {domain.clientContact && (
                <span className="inline-flex items-center gap-1">
                  <HandshakeIcon className="text-text-muted" />
                  {domain.clientContact}
                </span>
              )}
            </div>
            {level === 'near' && keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {keywords.slice(0, 8).map((k) => (
                  <span
                    key={k}
                    className="zh-body-xxs text-text-muted bg-surface-sunken rounded-xs px-1.5 py-0.5"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </header>

      <div
        className="flex min-h-16 flex-col gap-3 p-3"
        data-drop-list={domain.id}
        data-drop-kind="project"
      >
        {withDropLine(
          projects,
          (p) => (
            <ProjectCard
              key={p.id}
              project={p}
              tasks={tasks.filter((t) => t.projectId === p.id).sort((a, b) => a.order - b.order)}
              members={members}
              selection={selection}
              spotlight={spotlight}
              pulse={pulseId === p.id}
              onSelect={onSelect}
              onAddTask={onAddTask}
            />
          ),
          domain.id,
          dnd.active?.kind === 'project' ? dnd.over : null,
          dnd.active?.id,
          <DropLine className="-my-1.5" />,
        )}
        {projects.length === 0 && level !== 'far' && (
          <button
            type="button"
            onClick={() => onAddProject(domain.id)}
            className="border-border-raised text-text-muted hover:bg-surface-sunken zh-body-xs flex items-center justify-center gap-1 rounded-md border border-dashed py-6"
          >
            <PlusIcon /> 新增第一個專案
          </button>
        )}
      </div>
    </section>
  );
});

// ─── Project card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  tasks,
  members,
  selection,
  spotlight,
  pulse,
  onSelect,
  onAddTask,
}: {
  project: Project;
  tasks: Task[];
  members: Map<string, Member>;
  selection: Selection;
  spotlight: Spotlight | null;
  pulse: boolean;
  onSelect: (s: Selection) => void;
  onAddTask: (projectId: string) => void;
}) {
  const level = useDetailLevel();
  const owner = members.get(project.ownerId);
  const selected = selection?.kind === 'project' && selection.id === project.id;
  const done = tasks.filter((t) => t.status === 'done').length;
  const status = PROJECT_STATUS[project.status];
  const assignees = [...new Set(tasks.filter((t) => t.status !== 'done').map((t) => t.assigneeId))]
    .map((id) => members.get(id))
    .filter(Boolean) as Member[];

  const dnd = useDnd();
  const dragging = dnd.active?.kind === 'project' && dnd.active.id === project.id;
  const open = () => {
    if (!dnd.justDragged()) onSelect({ kind: 'project', id: project.id });
  };
  const grab = (e: React.PointerEvent) => dnd.begin(e, 'project', project.id, project.name);

  if (level === 'far') {
    return (
      <div
        data-node-id={project.id}
        data-drag-id={project.id}
        data-dim={dimAttr(spotlight, 'projects', project.id)}
        onClick={open}
        onPointerDown={grab}
        className={cn(
          'bg-surface-elevated border-border-subtle flex cursor-grab items-center gap-3 rounded-md border px-4 py-3',
          project.priority === 'P0' && 'border-danger-bold border-4',
          selected && 'ring-primary-500 ring-2',
          dragging && 'opacity-40',
        )}
      >
        <span
          className="size-4 shrink-0 rounded-full"
          style={{ background: `var(--color-${status.badge === 'secondary' ? 'neutral-400' : status.badge === 'info' ? 'info-bold' : status.badge === 'warning' ? 'warning-bold' : 'success-bold'})` }}
        />
        {project.priority === 'P0' && <span className="text-danger-bold text-[30px] leading-[38px] font-bold">P0</span>}
        <span className="truncate text-[30px] leading-[38px] font-bold">{project.name}</span>
      </div>
    );
  }

  return (
    <article
      data-node-id={project.id}
      data-drag-id={project.id}
      data-dim={dimAttr(spotlight, 'projects', project.id)}
      className={cn(
        'bg-surface-elevated group rounded-md border p-3 transition-colors',
        selected ? 'border-primary-500 ring-primary-500 ring-1' : 'border-border-subtle hover:border-border-raised',
        project.priority === 'P0' && !selected && 'border-danger-mid',
        project.priority === 'P0' && level === 'mid' && 'border-2',
        pulse && 'focus-pulse',
        dragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        onClick={open}
        onPointerDown={grab}
        className="block w-full cursor-grab text-left active:cursor-grabbing"
        title="點一下看詳細，拖曳可排序或移到其他欄"
      >
        <div className="flex items-start gap-2">
          <h3 className="zh-label text-text-primary min-w-0 flex-1 font-bold">{project.name}</h3>
          {project.priority !== 'P1' && (
            <Badge
              variant={PROJECT_PRIORITY[project.priority].badge}
              size="sm"
              className="mt-0.5 shrink-0"
              title={PROJECT_PRIORITY[project.priority].hint}
            >
              {project.priority}
            </Badge>
          )}
          <Badge variant={status.badge} size="sm" className="mt-0.5 shrink-0">
            {status.label}
          </Badge>
        </div>
        <div className="zh-body-xxs text-text-secondary mt-2 flex items-center gap-1.5">
          <MemberAvatar member={owner} size="xs" />
          <span className="text-text-muted">窗口</span>
          <span className="text-text-primary font-medium">{owner?.name ?? '未指定'}</span>
          {project.dueDate && <DueChip due={project.dueDate} done={project.status === 'done'} />}
          <span className="flex-1" />
          <ComplexityPips level={project.complexity} showLabel={level === 'near'} className="mr-1" />
          {tasks.length > 0 && (
            <span className="mono-xs text-text-muted">
              {done}/{tasks.length}
            </span>
          )}
        </div>
        {tasks.length > 0 && (
          <div className="bg-surface-sunken mt-2 h-1 overflow-hidden rounded-full" aria-hidden>
            <div
              className="bg-primary-500 h-full rounded-full"
              style={{ width: `${(done / tasks.length) * 100}%` }}
            />
          </div>
        )}
        {level === 'near' && project.nextStep && (
          <div className="zh-body-xs text-text-secondary mt-2 flex gap-1">
            <ArrowBendDownRightIcon className="text-accent-300 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{project.nextStep}</span>
          </div>
        )}
        {level === 'mid' && assignees.length > 0 && (
          <div className="mt-2 flex -space-x-1.5">
            {assignees.map((m) => (
              <MemberAvatar key={m.id} member={m} size="sm" ring />
            ))}
          </div>
        )}
      </button>

      {level === 'near' && (
        <ul
          className="border-border-subtle mt-3 flex min-h-8 flex-col border-t pt-2"
          data-drop-list={project.id}
          data-drop-kind="task"
        >
          {withDropLine(
            tasks,
            (t) => (
              <TaskRow
                key={t.id}
                task={t}
                assignee={members.get(t.assigneeId)}
                selected={selection?.kind === 'task' && selection.id === t.id}
                dim={dimAttr(spotlight, 'tasks', t.id)}
                onSelect={onSelect}
              />
            ),
            project.id,
            dnd.active?.kind === 'task' ? dnd.over : null,
            dnd.active?.id,
            <DropLine as="li" />,
          )}
          <li>
            <button
              type="button"
              onClick={() => onAddTask(project.id)}
              className="zh-body-xxs text-text-muted hover:text-text-primary hover:bg-surface-sunken mt-1 flex w-full items-center gap-1 rounded-xs px-1.5 py-1 opacity-70 group-hover:opacity-100"
            >
              <PlusIcon /> 新增任務
            </button>
          </li>
        </ul>
      )}
    </article>
  );
}

function TaskRow({
  task,
  assignee,
  selected,
  dim,
  onSelect,
}: {
  task: Task;
  assignee: Member | undefined;
  selected: boolean;
  dim: string | undefined;
  onSelect: (s: Selection) => void;
}) {
  const st = TASK_STATUS[task.status];
  const isDone = task.status === 'done';
  const urgency = taskUrgency(task);
  const blocked = isBlocked(task);
  const dnd = useDnd();
  const dragging = dnd.active?.kind === 'task' && dnd.active.id === task.id;
  return (
    <li data-node-id={task.id} data-drag-id={task.id} data-dim={dim} className={cn(dragging && 'opacity-40')}>
      <button
        type="button"
        onClick={() => {
          if (!dnd.justDragged()) onSelect({ kind: 'task', id: task.id });
        }}
        onPointerDown={(e) => {
          e.stopPropagation(); // don't also start dragging the parent project card
          dnd.begin(e, 'task', task.id, task.title);
        }}
        className={cn(
          'hover:bg-surface-sunken flex w-full cursor-grab items-center gap-2 rounded-xs px-1.5 py-1 text-left active:cursor-grabbing',
          (urgency?.level === 'urgent' || blocked) && 'bg-danger-dim',
          selected && 'bg-state-row-selected',
        )}
        title={[st.label, blocked && `卡住：${task.blockedReason}`, urgency?.reason, task.estimateDays ? `預估 ${fmtDays(task.estimateDays)} 天` : '', task.note]
          .filter(Boolean)
          .join(' · ')}
      >
        <span
          className="flex size-3.5 shrink-0 items-center justify-center rounded-full"
          style={
            isDone
              ? { background: st.dot, color: 'var(--text-on-primary)' }
              : { boxShadow: `inset 0 0 0 2px ${st.dot}` }
          }
          aria-label={st.label}
        >
          {isDone && <CheckIcon size={9} weight="bold" />}
        </span>
        <span
          className={cn(
            'zh-body-xs min-w-0 flex-1 truncate',
            isDone ? 'text-text-muted line-through' : 'text-text-primary',
          )}
        >
          {task.title}
        </span>
        {blocked ? (
          <ProhibitIcon weight="bold" className="text-danger-bold shrink-0" aria-label={`卡住：${task.blockedReason}`} />
        ) : urgency?.level === 'urgent' ? (
          <WarningCircleIcon weight="fill" className="text-danger-bold shrink-0" aria-label={urgency.reason} />
        ) : urgency?.level === 'stale' ? (
          <ClockIcon weight="fill" className="text-warning-bold shrink-0" aria-label={urgency.reason} />
        ) : (
          task.priority === 'high' &&
          !isDone && <FlagIcon weight="fill" className="text-danger-bold shrink-0" aria-label="高優先" />
        )}
        {task.estimateDays > 0 && !isDone && (
          <span className="mono-xs text-text-muted shrink-0">{fmtDays(task.estimateDays)}d</span>
        )}
        {task.dueDate && !isDone && <DueChip due={task.dueDate} />}
        <MemberAvatar member={assignee} size="xs" />
      </button>
    </li>
  );
}

function DueChip({ due, done }: { due: string; done?: boolean }) {
  const d = daysUntil(due);
  const tone =
    done || d == null
      ? 'text-text-muted'
      : d < 0
        ? 'text-danger-bold'
        : d <= 3
          ? 'text-warning-bold'
          : 'text-text-muted';
  return (
    <span className={cn('mono-xs shrink-0', tone)} title={due}>
      {shortDate(due)}
    </span>
  );
}

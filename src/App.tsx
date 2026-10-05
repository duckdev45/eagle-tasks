import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Logo,
  SegmentedControl,
  ToggleChip,
  toast,
  useConfirm,
} from '@duckdev45/eagle-component';
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  BuildingsIcon,
  CheckSquareIcon,
  CornersOutIcon,
  FolderSimpleIcon,
  MinusIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
  UserPlusIcon,
  ChartPieSliceIcon,
  MapTrifoldIcon,
  PathIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Canvas, type CanvasHandle } from './canvas/Canvas';
import { DndProvider, type DragKind, type DropTarget } from './canvas/dnd';
import { DomainFrame, Edges, RootNode } from './canvas/nodes';
import { FRAME_W, layoutRow, rootPosition, type Pos } from './canvas/layout';
import { FindBox } from './components/FindBox';
import { PeopleDock } from './components/PeopleDock';
import { newId, type BatchOp } from './data/api';
import { useBoard } from './data/useBoard';
import { DOMAIN_COLOR, TASK_STATUS, isUrgent } from './lib/meta';
import type { Hit } from './lib/search';
import { hasFilter, spotlightForEntity, spotlightForFilter, type Spotlight } from './lib/spotlight';
import { DetailPanel, type PanelState } from './panels/DetailPanel';
import type { Domain, EntityKind, EntityMap, Member, Project, Selection, Task, TaskStatus } from './types';
import { SHEET_OF } from './types';
import { cn } from './lib/cn';
import { Overview } from './views/Overview';
import { Plan } from './views/Plan';

type View = 'map' | 'plan' | 'overview';

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return match;
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('eagle-tasks/theme');
      if (saved) return saved === 'dark';
    } catch {
      /* ignore */
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('eagle-tasks/theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [dark]);
  return [dark, setDark] as const;
}

const nextOrder = (rows: { order: number }[]) => rows.reduce((m, r) => Math.max(m, r.order), 0) + 1;

export default function App() {
  const store = useBoard();
  const { board } = store;
  const canvas = useRef<CanvasHandle>(null);
  const wide = useMediaQuery('(min-width: 1024px)');
  const [dark, setDark] = useTheme();
  const [zoom, setZoom] = useState(100);
  const [panel, setPanel] = useState<PanelState>(null);
  const [view, setViewState] = useState<View>(() => {
    try {
      const v = localStorage.getItem('eagle-tasks/view');
      return v === 'overview' || v === 'plan' ? v : 'map';
    } catch {
      return 'map';
    }
  });
  const setView = useCallback((v: View) => {
    setViewState(v);
    try {
      localStorage.setItem('eagle-tasks/view', v);
    } catch {
      /* ignore */
    }
  }, []);
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [p0Only, setP0Only] = useState(false);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const filter = useMemo(() => ({ memberId: memberFilter, p0Only, urgentOnly }), [memberFilter, p0Only, urgentOnly]);
  const urgentCount = useMemo(() => board.tasks.filter(isUrgent).length, [board.tasks]);
  const [focusSpot, setFocusSpot] = useState<Spotlight | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [dragFrame, setDragFrame] = useState<{ id: string; pos: Pos } | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  // ── Derived ────────────────────────────────────────────────────────────────
  const members = useMemo(() => new Map(board.members.map((m) => [m.id, m])), [board.members]);
  const row = useMemo(() => layoutRow(board.domains, dragFrame), [board.domains, dragFrame]);
  const positions = row.positions;
  const frameIndex = useMemo(() => new Map(row.order.map((id, i) => [id, i + 1])), [row.order]);
  const root = useMemo(() => rootPosition(Object.values(positions)), [positions]);
  const spotlight = useMemo(
    () => (hasFilter(filter) ? spotlightForFilter(board, filter, isUrgent) : focusSpot),
    [board, filter, focusSpot],
  );
  const selection: Selection =
    panel?.mode === 'view'
      ? panel.sel
      : panel?.mode === 'edit' && !panel.isNew
        ? { kind: panel.kind, id: panel.record.id }
        : null;

  const stats = useMemo(
    () => ({
      projects: board.projects.filter((p) => p.status !== 'done').length,
      open: board.tasks.filter((t) => t.status === 'doing' || t.status === 'review').length,
      people: board.members.length,
    }),
    [board],
  );

  // ── First load: fit everything ─────────────────────────────────────────────
  const fitted = useRef(false);
  useEffect(() => {
    if (store.state === 'ready' && !fitted.current) {
      fitted.current = true;
      requestAnimationFrame(() => {
        const first = board.domains[0];
        if (window.innerWidth < 720 && first) {
          // Phone: start on the first column at a readable size, root in view;
          // swipe sideways for the rest.
          const p = positions[first.id];
          canvas.current?.fitWidth({
            rect: { x: p.x, y: root.y, w: FRAME_W, h: 1 },
            left: 16,
            top: 132,
            maxK: 0.95,
          });
        } else canvas.current?.fitWidth({ maxK: 0.9 });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const select = useCallback((s: Selection) => {
    setFocusSpot(null);
    setPanel(s ? { mode: 'view', sel: s } : null);
  }, []);
  const getScale = useCallback(() => canvas.current?.getView().k ?? 1, []);

  const pulse = useCallback((id: string) => {
    setPulseId(id);
    window.setTimeout(() => setPulseId((p) => (p === id ? null : p)), 2800);
  }, []);

  const focusOn = useCallback(
    (kind: EntityKind, id: string) => {
      if (kind === 'member') {
        setFocusSpot(null);
        setMemberFilter(id);
        setPanel({ mode: 'view', sel: { kind, id } });
        requestAnimationFrame(() => canvas.current?.fit(undefined, { maxK: 0.9 }));
        return;
      }
      setMemberFilter(null);
      setFocusSpot(spotlightForEntity(board, kind, id));
      setPanel({ mode: 'view', sel: { kind, id } });
      // Domains: frame the whole column. Projects/tasks: zoom close enough to read.
      requestAnimationFrame(() =>
        canvas.current?.focusNode(kind === 'task' ? (board.tasks.find((t) => t.id === id)?.projectId ?? id) : id, {
          maxK: kind === 'domain' ? 0.95 : 1.15,
        }),
      );
      pulse(kind === 'task' ? (board.tasks.find((t) => t.id === id)?.projectId ?? id) : id);
    },
    [board, pulse],
  );

  const onPick = useCallback(
    (h: Hit) => {
      setView('map');
      requestAnimationFrame(() => focusOn(h.kind, h.id));
    },
    [focusOn, setView],
  );

  const onDrag = useCallback((id: string, pos: Pos) => setDragFrame({ id, pos }), []);
  const onDragEnd = useCallback(
    (id: string, pos: Pos) => {
      // Frames live in a fixed row: dropping one just changes its slot. Persist
      // `order` 1..n for everything that moved (and clear any old free x/y).
      const { order } = layoutRow(board.domains, { id, pos });
      const ops: BatchOp[] = order.flatMap((did, i): BatchOp[] => {
        const d = board.domains.find((x) => x.id === did)!;
        if (d.order === i + 1 && d.x == null && d.y == null) return [];
        return [{ action: 'upsert', sheet: 'domains', record: { ...d, order: i + 1, x: null, y: null } as Domain }];
      });
      setDragFrame(null);
      if (ops.length) void store.batch(ops);
    },
    [board.domains, store],
  );

  const create = useCallback(
    (kind: EntityKind, preset: Partial<EntityMap[EntityKind]> = {}) => {
      let record: EntityMap[EntityKind];
      if (kind === 'domain') {
        record = {
          id: newId('d'), name: '', kind: 'client', keywords: '', description: '', clientContact: '',
          leadId: '', color: (['teal', 'violet', 'accent', 'info'] as const)[board.domains.length % 4],
          x: null, y: null, order: nextOrder(board.domains), ...(preset as Partial<Domain>),
        } satisfies Domain;
      } else if (kind === 'project') {
        const p = preset as Partial<Project>;
        record = {
          id: newId('p'), domainId: p.domainId ?? board.domains[0]?.id ?? '', name: '', status: 'planning',
          ownerId: '', summary: '', pitch: '', nextStep: '', tags: '', dueDate: '', link: '',
          order: nextOrder(board.projects), ...p, priority: p.priority ?? 'P1', complexity: p.complexity ?? 0, complexityNote: p.complexityNote ?? '',
        } satisfies Project;
      } else if (kind === 'task') {
        const t = preset as Partial<Task>;
        record = {
          id: newId('t'), projectId: t.projectId ?? '', title: '', assigneeId: '', status: 'todo',
          priority: 'mid', dueDate: '', note: '', estimateDays: 0, uncertainty: '', blockedReason: '', deps: '', blockedAt: '', startedAt: '', doneAt: '', order: nextOrder(board.tasks), ...t,
        } satisfies Task;
      } else {
        record = {
          id: newId('m'), name: '', title: '', expertise: '', email: '', phone: '', line: '',
          order: nextOrder(board.members), ...(preset as Partial<Member>),
        } satisfies Member;
      }
      setPanel({ mode: 'edit', kind, record, isNew: true });
    },
    [board],
  );

  const addProject = useCallback((domainId: string) => create('project', { domainId }), [create]);
  const addTask = useCallback((projectId: string) => create('task', { projectId }), [create]);

  const save = useCallback(
    <K extends EntityKind>(kind: K, record: EntityMap[K], isNew: boolean) => {
      void store.save(kind, record, isNew ? '已新增' : '已儲存');
      setFocusSpot(null);
      setPanel({ mode: 'view', sel: { kind, id: record.id } });
      if (isNew && kind !== 'member') {
        const target = kind === 'task' ? (record as Task).projectId : record.id;
        window.setTimeout(() => {
          canvas.current?.focusNode(target, { maxK: 1 });
          pulse(target);
        }, 60);
      }
    },
    [store, pulse],
  );

  const remove = useCallback(
    async (kind: EntityKind, id: string) => {
      if (kind === 'domain') {
        const n = board.projects.filter((p) => p.domainId === id).length;
        if (n) {
          toast.warning(`底下還有 ${n} 個專案`, { description: '請先把專案移到其他客戶 / 產品線或刪除後，再刪除這個框。' });
          return;
        }
      }
      const name =
        kind === 'domain' ? board.domains.find((d) => d.id === id)?.name
        : kind === 'project' ? board.projects.find((p) => p.id === id)?.name
        : kind === 'task' ? board.tasks.find((t) => t.id === id)?.title
        : board.members.find((m) => m.id === id)?.name;
      const childTasks = kind === 'project' ? board.tasks.filter((t) => t.projectId === id) : [];
      const ok = await confirm({
        title: `刪除「${name ?? ''}」？`,
        description:
          kind === 'project' && childTasks.length
            ? `底下 ${childTasks.length} 個任務會一起刪除，Google Sheet 上的資料也會移除。`
            : kind === 'member'
              ? '他手上的任務會變成「未指派」。'
              : 'Google Sheet 上的資料也會移除。',
        variant: 'delete',
      });
      if (!ok) return;
      const ops: BatchOp[] = [
        ...childTasks.map((t): BatchOp => ({ action: 'delete', sheet: 'tasks', id: t.id })),
        { action: 'delete', sheet: SHEET_OF[kind], id },
      ];
      void store.batch(ops, '已刪除');
      setPanel(null);
      if (kind === 'member' && memberFilter === id) setMemberFilter(null);
    },
    [board, confirm, store, memberFilter],
  );

  // Drag & drop: reorder within a list, or move to another domain / project.
  // Rewrites `order` 1..n for the target list only; a move also changes the parent.
  const onDrop = useCallback(
    (kind: DragKind, id: string, target: DropTarget) => {
      const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
      if (kind === 'project') {
        const item = board.projects.find((p) => p.id === id);
        if (!item) return;
        const list = board.projects.filter((p) => p.domainId === target.listId && p.id !== id).sort(byOrder);
        list.splice(target.index, 0, { ...item, domainId: target.listId });
        const ops: BatchOp[] = list
          .map((p, i) => ({ ...p, order: i + 1 }))
          .filter((p) => {
            const orig = board.projects.find((o) => o.id === p.id)!;
            return orig.order !== p.order || orig.domainId !== p.domainId;
          })
          .map((record) => ({ action: 'upsert', sheet: 'projects', record }));
        const moved = item.domainId !== target.listId;
        if (ops.length)
          void store.batch(ops, moved ? `已移到「${board.domains.find((d) => d.id === target.listId)?.name ?? ''}」` : undefined);
      } else {
        const item = board.tasks.find((t) => t.id === id);
        if (!item) return;
        const list = board.tasks.filter((t) => t.projectId === target.listId && t.id !== id).sort(byOrder);
        list.splice(target.index, 0, { ...item, projectId: target.listId });
        const ops: BatchOp[] = list
          .map((t, i) => ({ ...t, order: i + 1 }))
          .filter((t) => {
            const orig = board.tasks.find((o) => o.id === t.id)!;
            return orig.order !== t.order || orig.projectId !== t.projectId;
          })
          .map((record) => ({ action: 'upsert', sheet: 'tasks', record }));
        const moved = item.projectId !== target.listId;
        if (ops.length)
          void store.batch(ops, moved ? `已移到「${board.projects.find((p) => p.id === target.listId)?.name ?? ''}」` : undefined);
      }
    },
    [board, store],
  );
  const panBy = useCallback((dx: number, dy: number) => canvas.current?.panBy(dx, dy), []);
  const mainRef = useRef<HTMLElement>(null);

  const quickStatus = useCallback(
    (task: Task, status: TaskStatus) => {
      if (task.status === status) return;
      void store.save('task', { ...task, status }, `「${task.title}」→ ${TASK_STATUS[status].label}`);
    },
    [store],
  );

  const clearFocus = useCallback(() => {
    setFocusSpot(null);
    setMemberFilter(null);
    setPanel(null);
  }, []);

  // Keyboard: Shift+1 fit, +/- zoom, Esc clears focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.key === '!' || (e.shiftKey && e.code === 'Digit1')) canvas.current?.fit(undefined, { maxK: 0.9 });
      else if ((e.key === '=' || e.key === '+') && !e.metaKey && !e.ctrlKey) canvas.current?.zoomBy(1.25);
      else if (e.key === '-' && !e.metaKey && !e.ctrlKey) canvas.current?.zoomBy(0.8);
      else if (e.key === 'Escape' && !panel) {
        setFocusSpot(null);
        setMemberFilter(null);
        setP0Only(false);
        setUrgentOnly(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);

  // ── World content (memoised so pan/zoom frames don't rebuild it) ───────────
  const world = useMemo(
    () => (
      <>
        <Edges
          root={root}
          targets={board.domains.map((d) => ({ id: d.id, pos: positions[d.id], color: DOMAIN_COLOR[d.color].css }))}
          dim={(id) => !!spotlight && !spotlight.domains.has(id)}
        />
        <RootNode pos={root} stats={stats} />
        {board.domains.map((d) => (
          <DomainFrame
            key={d.id}
            domain={d}
            pos={positions[d.id]}
            index={frameIndex.get(d.id) ?? 0}
            dragging={dragFrame?.id === d.id}
            projects={board.projects.filter((p) => p.domainId === d.id).sort((a, b) => a.order - b.order)}
            tasks={board.tasks}
            members={members}
            selection={selection}
            spotlight={spotlight}
            pulseId={pulseId}
            getScale={getScale}
            onSelect={select}
            onDrag={onDrag}
            onDragEnd={onDragEnd}
            onAddProject={addProject}
            onAddTask={addTask}
          />
        ))}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, positions, frameIndex, dragFrame?.id, root, members, selection?.kind, selection?.id, spotlight, pulseId, stats, onDragEnd],
  );

  const orphanProjects = board.projects.filter((p) => !board.domains.some((d) => d.id === p.domainId));

  return (
    <div className="flex h-full">
      <main ref={mainRef} className="@container relative min-w-0 flex-1">
        {/* The canvas stays mounted (just hidden) in 總覽 so its camera survives the switch. */}
        <div className={cn('absolute inset-0', view !== 'map' && 'pointer-events-none invisible')} aria-hidden={view !== 'map'}>
          <DndProvider onDrop={onDrop} panBy={panBy} boundsRef={mainRef}>
            <Canvas ref={canvas} onBackgroundClick={clearFocus} onViewChange={(v) => setZoom(Math.round(v.k * 100))}>
              {world}
            </Canvas>
          </DndProvider>
        </div>
        {view === 'plan' && (
          <div className="bg-surface-base absolute inset-x-0 top-[72px] bottom-0 @max-[1360px]:top-[124px]">
            <Plan board={board} onSelect={(s) => s && setPanel({ mode: 'view', sel: s })} />
          </div>
        )}
        {view === 'overview' && (
          <div className="bg-surface-base absolute inset-x-0 top-[72px] bottom-0 @max-[1360px]:top-[124px]">
            <Overview board={board} onSelect={(s) => s && setPanel({ mode: 'view', sel: s })} />
          </div>
        )}

        {/* ── Top-left: identity + sync ─────────────────────────────────── */}
        <div className="pointer-events-none absolute top-3 left-3 flex items-start gap-2">
          <div className="bg-surface-elevated border-border-subtle pointer-events-auto flex h-12 items-center gap-2.5 rounded-md border px-3 shadow-sm">
            <Logo variant="mark" className="text-primary-600 h-6 w-auto" />
            <div className="leading-tight max-sm:hidden">
              <div className="zh-body-xs-bold text-text-primary">團隊地圖</div>
              <div className="zh-body-xxs text-text-muted hidden sm:block">
                {store.mode === 'demo' ? 'Demo · 本機資料' : 'GS'}
                {store.error && store.state === 'ready'
                  ? ` · 連線失敗，顯示 ${store.lastSync?.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) ?? ''} 的資料`
                  : store.syncing
                    ? ' · 同步中…'
                    : store.lastSync
                      ? ` · ${store.lastSync.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 更新`
                      : ''}
              </div>
            </div>
            <Button variant="ghost" size="sm" aria-label="重新載入" title="重新載入" onClick={() => void store.refresh()} loading={store.state === 'loading'} leadingIcon={<ArrowClockwiseIcon />} />
          </div>
        </div>

        {/* ── Top-center: "客戶提到什麼？" ──────────────────────────────────── */}
        <FindBox
          board={board}
          onPick={onPick}
          className="absolute top-3 left-1/2 w-[min(520px,calc(100%-24px))] -translate-x-1/2 @max-[1360px]:top-[68px]"
        />

        {/* ── Top-right: create + theme ───────────────────────────────────── */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <SegmentedControl
            aria-label="切換畫面"
            size="md"
            value={view}
            onChange={(v) => setView(v as View)}
            options={[
              { value: 'map', 'aria-label': '地圖', label: <span className="max-sm:hidden">地圖</span>, icon: <MapTrifoldIcon /> },
              { value: 'plan', 'aria-label': '路徑', label: <span className="max-sm:hidden">路徑</span>, icon: <PathIcon /> },
              { value: 'overview', 'aria-label': '總覽', label: <span className="max-sm:hidden">總覽</span>, icon: <ChartPieSliceIcon /> },
            ]}
            className="bg-surface-elevated shadow-sm"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button leadingIcon={<PlusIcon />} className="shadow-sm">
                <span className="max-sm:hidden">新增</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuLabel>新增到地圖</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => create('domain')}>
                <BuildingsIcon /> 客戶 / 產品線
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => create('project')} disabled={!board.domains.length}>
                <FolderSimpleIcon /> 專案
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => create('task')} disabled={!board.projects.length}>
                <CheckSquareIcon /> 任務
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => create('member')}>
                <UserPlusIcon /> 成員
              </DropdownMenuItem>
              {store.resetDemo && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={store.resetDemo}>
                    <ArrowCounterClockwiseIcon /> 重設 Demo 資料
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            aria-label={dark ? '切換淺色' : '切換深色'}
            title={dark ? '切換淺色' : '切換深色'}
            onClick={() => setDark(!dark)}
            className="bg-surface-elevated shadow-sm"
           leadingIcon={dark ? <SunIcon /> : <MoonIcon />} />
        </div>

        {view === 'map' && (
          <>
        {/* ── Filters: P0 / 緊急 / active person / focus ─────────────────── */}
        <div className="absolute top-[68px] left-3 flex items-center gap-2 @max-[1360px]:top-[118px]">
          <ToggleChip
            selected={p0Only}
            onSelectedChange={(v) => {
              setFocusSpot(null);
              setP0Only(v);
            }}
            className="bg-surface-elevated shadow-sm"
            title="只看 P0：對客戶有承諾／期限，或直接影響收款"
          >
            只看 P0
          </ToggleChip>
          <ToggleChip
            selected={urgentOnly}
            onSelectedChange={(v) => {
              setFocusSpot(null);
              setUrgentOnly(v);
            }}
            icon={<WarningCircleIcon weight="fill" className="text-danger-bold" />}
            className="bg-surface-elevated shadow-sm"
            title="逾期，或高優先且 3 天內到期"
          >
            緊急 {urgentCount}
          </ToggleChip>
          {(memberFilter || (focusSpot && !hasFilter(filter))) && (
            <Badge
              variant="info"
              size="md"
              className="shadow-sm"
              onRemove={() => {
                setMemberFilter(null);
                setFocusSpot(null);
              }}
            >
              {memberFilter ? `${members.get(memberFilter)?.name ?? ''} 的工作` : '聚焦中 · Esc 取消'}
            </Badge>
          )}
        </div>

        {/* ── Bottom: people dock ─────────────────────────────────────────── */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 @max-[900px]:bottom-16">
          <PeopleDock
            members={board.members}
            tasks={board.tasks}
            active={memberFilter}
            onToggle={(id) => {
              setFocusSpot(null);
              setMemberFilter(id);
            }}
            onOpen={(id) => focusOn('member', id)}
            onAdd={() => create('member')}
          />
        </div>

        {/* ── Bottom-left: legend ─────────────────────────────────────────── */}
        <div className="bg-surface-elevated/90 border-border-subtle zh-body-xxs text-text-secondary absolute bottom-3 left-3 hidden flex-col gap-1 rounded-md border px-3 py-2 shadow-sm backdrop-blur @min-[1180px]:flex">
          <div className="flex items-center gap-3">
            {(Object.keys(TASK_STATUS) as TaskStatus[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-full" style={{ boxShadow: `inset 0 0 0 2px ${TASK_STATUS[s].dot}`, background: s === 'done' ? TASK_STATUS[s].dot : undefined }} />
                {TASK_STATUS[s].label}
              </span>
            ))}
          </div>
          <div className="text-text-muted">拖曳空白處平移 · ⌘＋滾輪縮放 · 標題、卡片、任務都能拖</div>
        </div>

        {/* ── Bottom-right: zoom ──────────────────────────────────────────── */}
        <div className="bg-surface-elevated border-border-subtle absolute right-3 bottom-3 flex items-center rounded-md border p-0.5 shadow-sm">
          <Button variant="ghost" size="sm" aria-label="縮小" title="縮小（-）" onClick={() => canvas.current?.zoomBy(0.8)} leadingIcon={<MinusIcon />} />
          <button
            type="button"
            className="mono-xs text-text-secondary hover:bg-surface-sunken w-12 rounded-xs py-1 text-center"
            title="重設為 100%"
            onClick={() => {
              const k = canvas.current?.getView().k ?? 1;
              canvas.current?.zoomBy(1 / k);
            }}
          >
            {zoom}%
          </button>
          <Button variant="ghost" size="sm" aria-label="放大" title="放大（+）" onClick={() => canvas.current?.zoomBy(1.25)} leadingIcon={<PlusIcon />} />
          <Button variant="ghost" size="sm" aria-label="全部顯示" title="全部顯示（Shift+1）" onClick={() => canvas.current?.fit(undefined, { maxK: 0.9 })} leadingIcon={<CornersOutIcon />} />
        </div>

          </>
        )}

        {store.state === 'loading' && board.domains.length === 0 && (
          <div
            role="status"
            className="bg-surface-overlay border-border-subtle absolute top-1/2 left-1/2 flex w-[min(360px,90%)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-lg border p-6 text-center shadow-lg"
          >
            <span className="border-primary-500 size-8 animate-spin rounded-full border-4 border-t-transparent" aria-hidden />
            <div className="zh-body-sm-bold text-text-primary">正在從 Google Sheet 載入…</div>
            <p className="zh-body-xxs text-text-muted">第一次打開可能要等 10～30 秒，之後就會很快。</p>
          </div>
        )}

        {store.state === 'error' && (
          <div className="bg-surface-overlay border-danger-mid absolute top-1/2 left-1/2 w-[min(420px,90%)] -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 shadow-lg">
            <div className="zh-body-sm-bold text-danger-bold">讀不到 Google Sheet</div>
            <p className="zh-body-xs text-text-secondary mt-1 break-all">{store.error}</p>
            <p className="zh-body-xxs text-text-muted mt-2">
              請確認 Apps Script 部署為「任何人」可存取，且 VITE_GAS_TOKEN 與指令碼屬性 API_TOKEN 相同。
            </p>
            <Button className="mt-3" size="sm" onClick={() => void store.refresh()}>
              再試一次
            </Button>
          </div>
        )}

        {orphanProjects.length > 0 && (
          <div className="absolute top-[64px] right-3 max-w-72">
            <Badge variant="warning" size="md" leadingIcon={<XIcon />}>
              {orphanProjects.length} 個專案的客戶 / 產品線不存在
            </Badge>
          </div>
        )}
      </main>

      <DetailPanel
        board={board}
        panel={panel}
        inline={wide}
        onClose={() => setPanel(null)}
        onSelect={(s) => (s ? focusOn(s.kind, s.id) : setPanel(null))}
        onView={(s) => setPanel({ mode: 'view', sel: s })}
        onEdit={(kind, record) => setPanel({ mode: 'edit', kind, record, isNew: false })}
        onCreate={create}
        onSave={save}
        onDelete={(k, id) => void remove(k, id)}
        onQuickStatus={quickStatus}
      />
      {confirmDialog}
    </div>
  );
}

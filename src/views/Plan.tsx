import { EmptyState, SegmentedControl, Select, ToggleChip } from '@duckdev45/eagle-component';
import { FlagIcon, PathIcon, ProhibitIcon, WarningIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';

import { MemberAvatar } from '../components/MemberAvatar';
import { cn } from '../lib/cn';
import { DOMAIN_COLOR, fmtDays, isBlocked } from '../lib/meta';
import { md, schedulePlan, workdayDate, ymd, type PlanItem } from '../lib/schedule';
import type { Board, Member, Selection } from '../types';

// ─── 路徑圖：給老闆看的泳道流程 ────────────────────────────────────────────────
// 一列一個人（泳道），橫軸是工作天。方塊＝任務，箭頭＝「這件做完才能做那件」，
// 橘色粗框＝要徑：這串任何一件晚一天，專案就晚一天。

const DAY = 24; // px per workday
const ROW = 48;
const LEFT = 156;
const STRIP = 30; // milestone strip above the lanes
const PREFS = 'eagle-tasks/plan';

type Prefs = { projectIds: string[] | null; buffered: boolean; focus: number };

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? '{}');
    return {
      projectIds: Array.isArray(p.projectIds) ? p.projectIds : null,
      buffered: !!p.buffered,
      focus: typeof p.focus === 'number' ? p.focus : 0.7,
    };
  } catch {
    return { projectIds: null, buffered: false, focus: 0.7 };
  }
}

const codeOf = (title: string) => /^[A-Z]{1,2}\d{2}/.exec(title)?.[0] ?? '';

export function Plan({ board, onSelect }: { board: Board; onSelect: (s: Selection) => void }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  // 可選的專案：P0，或任務有填前置關係的
  const candidates = useMemo(() => {
    const withDeps = new Set(board.tasks.filter((t) => t.deps.trim()).map((t) => t.projectId));
    return board.projects
      .filter((p) => p.status !== 'done' && (p.priority === 'P0' || withDeps.has(p.id)))
      .sort((a, b) => (a.priority === 'P0' ? 0 : 1) - (b.priority === 'P0' ? 0 : 1) || a.order - b.order);
  }, [board]);
  const selected = (
    prefs.projectIds ?? candidates.filter((p) => p.priority === 'P0').map((p) => p.id)
  ).filter((id) => candidates.some((p) => p.id === id));

  const plan = useMemo(
    () => schedulePlan(board, { projectIds: selected, buffered: prefs.buffered, focus: prefs.focus }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, selected.join(','), prefs.buffered, prefs.focus],
  );

  const [hover, setHover] = useState<string | null>(null);
  const domainOf = useMemo(() => new Map(board.domains.map((d) => [d.id, d])), [board.domains]);
  const projectColor = (it: PlanItem) => {
    const d = it.project && domainOf.get(it.project.domainId);
    return d ? DOMAIN_COLOR[d.color].css : 'var(--neutral-500)';
  };

  // ── 泳道：有排到任務的人依成員順序，最後是未指派 ──
  const lanes = useMemo(() => {
    const ids = new Set(plan.items.map((i) => i.lane));
    const people: { id: string; member?: Member }[] = board.members
      .filter((m) => ids.has(m.id))
      .map((m) => ({ id: m.id, member: m }));
    for (const id of ids) if (id && !people.some((p) => p.id === id)) people.push({ id });
    if (ids.has('')) people.push({ id: '' });
    let top = STRIP;
    return people.map((p) => {
      const items = plan.items.filter((i) => i.lane === p.id).sort((a, b) => a.start - b.start);
      const rowEnd: number[] = [];
      const rowOf = new Map<string, number>();
      for (const it of items) {
        let r = rowEnd.findIndex((e) => e <= it.start + 1e-6);
        if (r < 0) r = rowEnd.length;
        rowEnd[r] = it.end;
        rowOf.set(it.task.id, r);
      }
      const rows = Math.max(1, rowEnd.length);
      const lane = { ...p, items, rowOf, top, height: rows * ROW };
      top += lane.height;
      return lane;
    });
  }, [plan, board.members]);
  const lanesH = (lanes.at(-1)?.top ?? STRIP) + (lanes.at(-1)?.height ?? 0);

  const geo = useMemo(() => {
    const g = new Map<string, { x1: number; x2: number; y: number }>();
    for (const l of lanes)
      for (const it of l.items) {
        const r = l.rowOf.get(it.task.id)!;
        g.set(it.task.id, { x1: it.start * DAY, x2: it.end * DAY, y: l.top + r * ROW + ROW / 2 });
      }
    return g;
  }, [lanes]);

  const days = Math.ceil(plan.end) + 6;
  const W = days * DAY;
  const today = new Date();

  const ticks = useMemo(() => {
    const out: { x: number; label: string; month?: string }[] = [];
    let lastMonth = -1;
    for (let n = 0; n < days; n++) {
      const d = workdayDate(n, today);
      if (n === 0 || d.getDay() === 1) {
        const month =
          d.getMonth() !== lastMonth
            ? `${d.getFullYear() !== today.getFullYear() ? d.getFullYear() + '/' : ''}${d.getMonth() + 1}月`
            : undefined;
        lastMonth = d.getMonth();
        out.push({ x: n * DAY, label: md(d), month });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const related = useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    const it = plan.byId.get(hover);
    it?.deps.forEach((d) => s.add(d));
    plan.items.forEach((i) => i.deps.includes(hover) && s.add(i.task.id));
    return s;
  }, [hover, plan]);

  const bottleneck = [...plan.laneLoad].filter(([id]) => id).sort((a, b) => b[1] - a[1])[0];
  const memberName = (id: string) => board.members.find((m) => m.id === id)?.name ?? '未指派';
  const weeks = (n: number) => `${Math.max(1, Math.round(n / 5))} 週`;
  const unestimated = plan.items.filter((i) => i.unestimated).length;
  const multi = selected.length > 1;

  const toggle = (id: string, on: boolean) =>
    setPrefs((p) => ({ ...p, projectIds: on ? [...selected, id] : selected.filter((x) => x !== id) }));

  return (
    <div className="flex h-full flex-col">
      {/* ── 控制列＋摘要 ─────────────────────────────────────────────── */}
      <div className="border-border-subtle shrink-0 border-b px-4 pt-3 pb-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {candidates.map((p) => (
            <ToggleChip
              key={p.id}
              size="sm"
              selected={selected.includes(p.id)}
              onSelectedChange={(on) => toggle(p.id, on)}
            >
              {p.priority === 'P0' && <b className="text-danger-bold mr-1">P0</b>}
              {p.name}
            </ToggleChip>
          ))}
          <span className="flex-1" />
          <SegmentedControl
            aria-label="天數算法"
            size="sm"
            value={prefs.buffered ? 'buf' : 'est'}
            onChange={(v) => setPrefs((p) => ({ ...p, buffered: v === 'buf' }))}
            options={[
              { value: 'est', label: '樂觀（預估）' },
              { value: 'buf', label: '保守（含緩衝）' },
            ]}
          />
          <div className="w-36">
            <Select
              aria-label="專注度"
              size="sm"
              value={String(prefs.focus)}
              onChange={(v) => setPrefs((p) => ({ ...p, focus: Number(v) }))}
              options={[0.5, 0.6, 0.7, 0.8, 1].map((f) => ({
                value: String(f),
                label: `專注度 ${f * 100}%`,
              }))}
            />
          </div>
        </div>

        {plan.items.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
            {plan.finishes.map((f) => (
              <div
                key={f.project.id}
                className="bg-surface-raised border-border-subtle rounded-md border px-3 py-2"
              >
                <div className="zh-body-xxs text-text-muted truncate">{f.project.name}</div>
                <div className="text-text-primary mt-0.5 flex items-baseline gap-2">
                  <span className="text-lg font-semibold">
                    {f.open ? ymd(workdayDate(f.end, today)) : '已完成'}
                  </span>
                  {f.open > 0 && <span className="zh-body-xs text-text-secondary">約 {weeks(f.end)}</span>}
                </div>
                <div className="zh-body-xxs text-text-muted">
                  剩 {f.open} 項{f.done ? ` · 已完成 ${f.done} 項` : ''}
                </div>
              </div>
            ))}
            {bottleneck && (
              <div className="bg-[color-mix(in_srgb,var(--accent-300)_20%,var(--surface-raised))] border-accent-200 rounded-md border px-3 py-2">
                <div className="zh-body-xxs text-text-muted">瓶頸</div>
                <div className="text-text-primary mt-0.5 flex items-baseline gap-2">
                  <span className="text-lg font-semibold">{memberName(bottleneck[0])}</span>
                  <span className="zh-body-xs text-text-secondary">排了 {weeks(bottleneck[1])}</span>
                </div>
                <div className="zh-body-xxs text-text-muted">把他的任務分給別人，最能提早完成</div>
              </div>
            )}
          </div>
        )}

        <div className="zh-body-xxs text-text-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="border-accent-400 bg-[color-mix(in_srgb,var(--accent-300)_20%,var(--surface-raised))] h-3 w-5 rounded-xs border-2" />{' '}
            要徑：晚一天，完成日就晚一天
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden>
              <path d="M0 4 H18" stroke="var(--text-muted)" strokeWidth="1.5" />
              <path d="M16 1 L21 4 L16 7 Z" fill="var(--text-muted)" />
            </svg>
            前一件做完才能開始
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ProhibitIcon className="text-danger-bold" weight="bold" /> 卡關
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="border-text-muted h-3 w-5 rounded-xs border border-dashed" />{' '}
            未估天數（先算半天）
          </span>
          <span>
            日期跳過週末；每人一天約 {Math.round(prefs.focus * 100)}% 時間在專案上
            {unestimated ? `；${unestimated} 件未估` : ''}
            {plan.doneCount ? `；已完成的 ${plan.doneCount} 件不顯示` : ''}
          </span>
          {plan.cycles.length > 0 && (
            <span className="text-warning-bold inline-flex items-center gap-1">
              <WarningIcon /> 前置關係有循環，已略過部分
            </span>
          )}
        </div>
      </div>

      {/* ── 泳道圖 ─────────────────────────────────────────────────── */}
      {plan.items.length === 0 ? (
        <div className="grid flex-1 place-items-center p-6">
          <EmptyState
            icon={<PathIcon />}
            title={selected.length ? '這些專案沒有未完成的任務' : '選一個專案'}
            description="勾選上方的專案。任務填了「預估人天」和「前置任務」，這裡就會排出誰先做什麼、哪天能完成。"
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <div className="relative" style={{ width: LEFT + W, minHeight: '100%' }}>
            {/* header */}
            <div className="bg-surface-base border-border-subtle sticky top-0 z-30 flex h-11 border-b">
              <div
                className="bg-surface-base border-border-subtle zh-overline-xs text-text-muted sticky left-0 z-10 flex shrink-0 items-end border-r px-3 pb-1.5"
                style={{ width: LEFT }}
              >
                成員
              </div>
              <div className="relative" style={{ width: W }}>
                {ticks.map((t) => (
                  <div key={t.x} className="absolute inset-y-0" style={{ left: t.x }}>
                    {t.month && (
                      <span className="zh-body-xxs-bold text-text-primary absolute top-1 left-1 whitespace-nowrap">
                        {t.month}
                      </span>
                    )}
                    <span className="mono-xs text-text-muted absolute bottom-1 left-1 whitespace-nowrap">
                      {t.label}
                    </span>
                    <span className="bg-border-subtle absolute bottom-0 left-0 h-2 w-px" />
                  </div>
                ))}
              </div>
            </div>

            <div className="relative" style={{ height: lanesH + 24 }}>
              {/* background: lane stripes, week lines, today, finish lines */}
              <div className="absolute inset-y-0" style={{ left: LEFT, width: W }} aria-hidden>
                {lanes.map((l, i) => (
                  <div
                    key={l.id || '_'}
                    className={cn(
                      'border-border-subtle absolute inset-x-0 border-b',
                      i % 2 && 'bg-surface-sunken/60',
                    )}
                    style={{ top: l.top, height: l.height }}
                  />
                ))}
                {ticks.map((t) => (
                  <div
                    key={t.x}
                    className="bg-border-subtle absolute inset-y-0 w-px opacity-70"
                    style={{ left: t.x }}
                  />
                ))}
                <div className="bg-primary-500 absolute inset-y-0 w-0.5" style={{ left: 0 }} />
                {plan.finishes
                  .filter((f) => f.open)
                  .map((f) => (
                    <div key={f.project.id} className="absolute inset-y-0" style={{ left: f.end * DAY }}>
                      <div className="border-text-secondary absolute inset-y-0 border-l border-dashed" />
                      <div className="bg-surface-overlay border-border-raised zh-body-xxs-bold text-text-primary absolute top-1 right-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 whitespace-nowrap shadow-xs">
                        <FlagIcon
                          weight="fill"
                          style={{ color: multi ? domainColorOf(board, f.project.domainId) : undefined }}
                        />
                        {short(f.project.name)} 完成 {md(workdayDate(f.end, today))}
                      </div>
                    </div>
                  ))}
                <div className="zh-body-xxs-bold text-primary-600 absolute top-1 left-1.5">今天</div>
              </div>

              {/* arrows */}
              <svg
                className="pointer-events-none absolute top-0"
                style={{ left: LEFT }}
                width={W}
                height={lanesH}
                aria-hidden
              >
                <defs>
                  {(['n', 'c'] as const).map((k) => (
                    <marker
                      key={k}
                      id={`ah-${k}`}
                      viewBox="0 0 6 6"
                      refX="5.5"
                      refY="3"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path
                        d="M0 0 L6 3 L0 6 Z"
                        fill={k === 'c' ? 'var(--accent-400)' : 'var(--text-muted)'}
                      />
                    </marker>
                  ))}
                </defs>
                {plan.items.flatMap((it) =>
                  it.deps.map((d) => {
                    const a = geo.get(d);
                    const b = geo.get(it.task.id);
                    if (!a || !b) return null;
                    const crit = it.critical && plan.byId.get(d)!.critical;
                    const lit = related
                      ? related.has(d) && related.has(it.task.id) && (d === hover || it.task.id === hover)
                      : false;
                    const x1 = a.x2 - 2;
                    const x2 = b.x1 + 1;
                    const mid = Math.max(x1 + 3, x2 - 8);
                    return (
                      <path
                        key={`${d}>${it.task.id}`}
                        d={a.y === b.y ? `M${x1} ${a.y} H${x2}` : `M${x1} ${a.y} H${mid} V${b.y} H${x2}`}
                        fill="none"
                        stroke={crit || lit ? 'var(--accent-400)' : 'var(--text-muted)'}
                        strokeWidth={crit || lit ? 2 : 1.25}
                        strokeOpacity={related && !lit ? 0.12 : crit || lit ? 0.95 : 0.4}
                        markerEnd={`url(#ah-${crit || lit ? 'c' : 'n'})`}
                      />
                    );
                  }),
                )}
              </svg>

              {/* lanes */}
              {lanes.map((l) => (
                <div
                  key={l.id || '_'}
                  className="absolute inset-x-0 flex"
                  style={{ top: l.top, height: l.height }}
                >
                  <div
                    className="bg-surface-base border-border-subtle sticky left-0 z-20 flex shrink-0 items-start gap-2 border-r border-b px-3 pt-2"
                    style={{ width: LEFT }}
                  >
                    <MemberAvatar member={l.member} size="sm" />
                    <div className="min-w-0 leading-tight">
                      <div className="zh-body-xs-bold text-text-primary truncate">
                        {l.member?.name ?? '未指派'}
                      </div>
                      <div className="zh-body-xxs text-text-muted">
                        {l.items.length} 件 · {fmtDays(plan.laneLoad.get(l.id) ?? 0)} 天
                      </div>
                    </div>
                  </div>
                  <div className="relative" style={{ width: W }}>
                    {l.items.map((it) => {
                      const r = l.rowOf.get(it.task.id)!;
                      const w = Math.max(8, (it.end - it.start) * DAY - 4);
                      const code = codeOf(it.task.title);
                      const label = code ? it.task.title.slice(code.length).trim() : it.task.title;
                      const blocked = isBlocked(it.task);
                      const doing = it.task.status === 'doing' || it.task.status === 'review';
                      const dim = related && !related.has(it.task.id);
                      const s = workdayDate(it.start, today);
                      const e = workdayDate(Math.max(it.start, it.end - 0.01), today);
                      return (
                        <button
                          key={it.task.id}
                          type="button"
                          onClick={() => onSelect({ kind: 'task', id: it.task.id })}
                          onPointerEnter={() => setHover(it.task.id)}
                          onPointerLeave={() => setHover(null)}
                          onFocus={() => setHover(it.task.id)}
                          onBlur={() => setHover(null)}
                          title={`${it.task.title}\n${md(s)} → ${md(e)}（${it.unestimated ? '未估' : fmtDays(it.task.estimateDays) + ' 人天'}）${it.critical ? '\n要徑' : ''}${blocked ? '\n卡關：' + it.task.blockedReason : ''}`}
                          className={cn(
                            'absolute flex items-center gap-1 overflow-hidden rounded-sm border px-1.5 text-left shadow-xs transition-opacity',
                            'hover:ring-primary-500 focus-visible:ring-primary-500 outline-none hover:z-10 hover:ring-2 focus-visible:ring-2',
                            it.critical
                              ? 'border-accent-400 bg-[color-mix(in_srgb,var(--accent-300)_20%,var(--surface-raised))] border-2'
                              : 'bg-surface-raised border-border-raised',
                            blocked && 'bg-danger-dim border-danger-mid',
                            it.unestimated && 'border-dashed',
                            dim && 'opacity-35',
                          )}
                          style={{ left: it.start * DAY + 2, width: w, top: r * ROW + 8, height: ROW - 16 }}
                        >
                          {multi && (
                            <span
                              className="h-full w-1 shrink-0 rounded-full"
                              style={{ background: projectColor(it) }}
                            />
                          )}
                          {blocked && <ProhibitIcon className="text-danger-bold shrink-0" weight="bold" />}
                          {doing && !blocked && (
                            <span className="bg-primary-500 size-1.5 shrink-0 rounded-full" title="進行中" />
                          )}
                          {w > 26 && code && (
                            <span className="mono-xs text-text-secondary shrink-0 font-semibold">{code}</span>
                          )}
                          {w > 64 && (
                            <span className="zh-body-xxs text-text-primary min-w-0 truncate">{label}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const short = (name: string) => name.replace(/（.*?）/g, '').replace(/^EagleAI\s*/, '');
function domainColorOf(board: Board, domainId: string) {
  const d = board.domains.find((x) => x.id === domainId);
  return d ? DOMAIN_COLOR[d.color].css : undefined;
}

import { BarChart, EmptyState, SummaryCard } from '@duckdev45/eagle-component';
import { ChartBarHorizontalIcon, ProhibitIcon } from '@phosphor-icons/react';
import { useMemo, type ReactNode } from 'react';

import { ComplexityPips } from '../components/Complexity';
import { MemberAvatar } from '../components/MemberAvatar';
import { cn } from '../lib/cn';
import { CAPACITY_DAYS, UNC_ROWS, computeInsights, type RiskCell } from '../lib/insights';
import { COMPLEXITY_LABEL, fmtDays } from '../lib/meta';
import type { Board, Selection } from '../types';

// ─── 總覽：給老闆看的「現在誰忙、哪裡卡、哪裡危險」 ───────────────────────────────
// Charts use eagle-component's BarChart (tooltips, legend, table view built in);
// the risk matrix and blocked list are plain HTML so every label stays text.

function Card({
  title,
  sub,
  children,
  className,
}: {
  title: string;
  sub?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('bg-surface-raised border-border-subtle rounded-lg border p-5', className)}>
      <h2 className="zh-title text-text-primary">{title}</h2>
      {sub && <p className="zh-body-xs text-text-muted mt-1">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Overview({ board, onSelect }: { board: Board; onSelect: (s: Selection) => void }) {
  const ins = useMemo(() => computeInsights(board), [board]);
  const { kpi } = ins;

  const loadData = ins.load.map((l) => ({
    category: l.member.name,
    value: null,
    values: l.estimate ? { est: l.estimate, buf: +l.buffer.toFixed(1) } : {},
  }));
  const unestimatedPeople = ins.load.filter((l) => l.unestimated > 0);

  const progressData = ins.progress.map((p) => ({
    category: `${p.project.priority === 'P0' ? 'P0 · ' : ''}${p.project.name}`,
    value: null,
    values: { done: p.doneDays, left: p.remainingDays },
  }));

  const accuracyData = ins.accuracy.map((a) => ({
    category: a.member.name,
    value: +(a.actual / a.estimate).toFixed(2),
  }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-4 pb-16 sm:px-6">
        {/* ── KPI ─────────────────────────────────────────────────────── */}
        <SummaryCard
          title="現在的狀況"
          columns={5}
          stats={[
            {
              label: '剩餘工作量',
              value: kpi.remaining ? `${fmtDays(kpi.remaining)} 人天` : '—',
              subCaption: kpi.unestimated ? `另有 ${kpi.unestimated} 件未估` : '含不確定性緩衝',
            },
            { label: '未完成任務', value: kpi.openCount },
            {
              label: '卡關',
              value: kpi.blocked,
              subCaption: kpi.blocked ? '見下方清單' : '沒有卡關',
            },
            { label: '逾期', value: kpi.overdue },
            {
              label: '準時完成率',
              value: kpi.onTimeRate == null ? '—' : `${Math.round(kpi.onTimeRate * 100)}%`,
              subCaption: kpi.onTimeBase
                ? `${kpi.onTimeBase} 件有截止日的已完成任務`
                : '完成有截止日的任務後才會有數字',
            },
          ]}
        />

        <div className="grid gap-5 lg:grid-cols-2">
          {/* ── 每人負載 ─────────────────────────────────────────────── */}
          <Card
            title="每人手上還有多少工作"
            sub={`未完成任務的預估人天；淺色是依不確定性加的緩衝。超過線（${CAPACITY_DAYS} 天＝兩週）代表排不完。`}
          >
            {ins.load.some((l) => l.estimate) ? (
              <BarChart
                title="每人剩餘工作量"
                orientation="horizontal"
                unit="天"
                data={loadData}
                series={[
                  { key: 'est', label: '預估' },
                  { key: 'buf', label: '不確定性緩衝' },
                ]}
                referenceLine={{ value: CAPACITY_DAYS, label: '兩週產能' }}
                formatValue={fmtDays}
                showTableView
              />
            ) : (
              <EmptyState
                variant="compact"
                icon={<ChartBarHorizontalIcon />}
                title="還沒有任何任務填預估天數"
                description="在任務裡選「預估人天」，這張圖就會出現每個人的負載。"
              />
            )}
            {unestimatedPeople.length > 0 && (
              <p className="zh-body-xxs text-text-muted mt-3">
                未估算：
                {unestimatedPeople.map((l) => `${l.member.name} ${l.unestimated} 件`).join('、')}
              </p>
            )}
          </Card>

          {/* ── 卡關 ────────────────────────────────────────────────── */}
          <Card title="卡關清單" sub="任務填了「卡住原因」就會出現在這裡，卡最久的排最上面。">
            {ins.blocked.length ? (
              <ul className="flex flex-col gap-2">
                {ins.blocked.map(({ task, project, assignee, days }) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onSelect({ kind: 'task', id: task.id })}
                      className="bg-surface-elevated border-border-subtle hover:border-border-raised flex w-full items-start gap-3 rounded-md border p-3 text-left"
                    >
                      <MemberAvatar member={assignee} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="zh-body-xs-bold text-text-primary block">{task.title}</span>
                        <span className="zh-body-xxs text-text-muted block truncate">
                          {assignee?.name ?? '未指派'} · {project?.name ?? ''}
                        </span>
                        <span className="zh-body-xs text-text-secondary mt-1 block">
                          {task.blockedReason}
                        </span>
                      </span>
                      <span className="bg-danger-dim text-danger-bold zh-body-xxs-bold inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5">
                        <ProhibitIcon weight="bold" />
                        {days == null ? '卡關' : days === 0 ? '今天' : `${days} 天`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                variant="compact"
                title="目前沒有卡關"
                description="有任務在等人、等資料、等決定時，在任務裡寫下卡住原因。"
              />
            )}
          </Card>
        </div>

        {/* ── 風險矩陣 ─────────────────────────────────────────────── */}
        <Card
          title="專案風險矩陣"
          sub="橫軸是複雜度，直軸是任務裡最高的不確定性。越往右上越需要盯；點專案看詳細。"
        >
          <RiskMatrix cells={ins.risk} onSelect={onSelect} />
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* ── 專案進度 ─────────────────────────────────────────────── */}
          <Card title="專案進度（人天）" sub="已完成 vs 剩餘的預估人天。只列出有任務填了預估的專案。">
            {progressData.length ? (
              <BarChart
                title="專案進度"
                orientation="horizontal"
                unit="天"
                data={progressData}
                series={[
                  { key: 'done', label: '已完成' },
                  { key: 'left', label: '剩餘' },
                ]}
                formatValue={fmtDays}
                showTableView
              />
            ) : (
              <EmptyState
                variant="compact"
                icon={<ChartBarHorizontalIcon />}
                title="還沒有專案的任務填預估"
                description="任務填了預估人天後，這裡會看到每個專案完成了多少、還剩多少。"
              />
            )}
          </Card>

          {/* ── 估算準確度 ───────────────────────────────────────────── */}
          <Card
            title="估算準確度"
            sub="實際花的工作天 ÷ 預估天數。1 代表剛好；2 代表實際花了兩倍時間，下次這個人的估算要乘上去。"
          >
            {accuracyData.length ? (
              <BarChart
                title="實際 ÷ 預估"
                orientation="horizontal"
                unit="倍"
                data={accuracyData}
                referenceLine={{ value: 1, label: '剛好' }}
                formatValue={(v) => v.toFixed(1)}
                showTableView
              />
            ) : (
              <EmptyState
                variant="compact"
                title="資料還不夠"
                description="任務從「進行中」到「完成」會自動記下時間；有預估的任務完成後，這裡就會算出每個人的估算誤差。"
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function RiskMatrix({ cells, onSelect }: { cells: RiskCell[]; onSelect: (s: Selection) => void }) {
  const cols = [1, 2, 3, 4, 5];
  const unrated = cells.filter((c) => c.complexity === 0).flatMap((c) => c.projects);
  const at = (cx: number, u: string) =>
    cells.find((c) => c.complexity === cx && c.uncertainty === u)?.projects ?? [];
  const rank = { high: 3, mid: 2, low: 1, '': 0 } as const;

  return (
    <div>
      <div className="grid grid-cols-[88px_repeat(5,minmax(0,1fr))] gap-1">
        {UNC_ROWS.map((row) => (
          <div key={row.key} className="contents">
            <div className="zh-body-xxs text-text-muted flex items-center pr-1">{row.label}</div>
            {cols.map((cx) => {
              const r = rank[row.key];
              // Sequential, one hue: more complex × more uncertain → deeper.
              const pct = r ? Math.round(((cx * r) / 15) * 55) + 6 : 0;
              const projects = at(cx, row.key);
              return (
                <div
                  key={cx}
                  className="border-border-subtle flex min-h-16 flex-col gap-1 rounded-sm border p-1"
                  style={{
                    background: r
                      ? `color-mix(in srgb, var(--accent-300) ${pct}%, var(--surface-raised))`
                      : 'var(--surface-sunken)',
                  }}
                >
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelect({ kind: 'project', id: p.id })}
                      title={p.name}
                      className="bg-surface-overlay text-text-primary zh-body-xxs hover:ring-primary-500 line-clamp-2 rounded-xs px-1.5 py-0.5 text-left break-all shadow-xs hover:ring-1"
                    >
                      {p.priority === 'P0' && <b className="text-danger-bold mr-1">P0</b>}
                      {p.name}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
        <div />
        {cols.map((cx) => (
          <div key={cx} className="flex flex-col items-center gap-0.5 pt-1">
            <ComplexityPips level={cx} showLabel={false} />
            <span className="zh-body-xxs text-text-muted">{COMPLEXITY_LABEL[cx]}</span>
          </div>
        ))}
      </div>
      {unrated.length > 0 && (
        <p className="zh-body-xxs text-text-muted mt-3">
          複雜度未評估：{unrated.map((p) => p.name).join('、')}
        </p>
      )}
    </div>
  );
}

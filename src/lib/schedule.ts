import { bufferedDays } from './meta';
import type { Board, Project, Task } from '../types';

// ─── 路徑排程：前置關係 + 每個人一次只做一件事 ─────────────────────────────────
// Serial schedule generation with gap back-filling:
//   1. 只排未完成的任務；已完成的前置視為已滿足。
//   2. 依「到終點最長還要幾天」（tail）由大到小挑可開工的任務 —— 越在要徑上越先排。
//   3. 每件放在「前置都做完」且「負責人有空檔」的最早時間；未指派的不搶人。
// 時間單位是工作天（週一到週五），已除以專注度（專案只佔一天的一部分）。

export const parseDeps = (t: Pick<Task, 'deps'>) =>
  t.deps
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** 備註裡的「階段：X」。 */
export const phaseOf = (t: Task) => /階段：([^｜\n]+)/.exec(t.note)?.[1].trim() ?? '';

/** 「之後」階段（上線後的延伸規劃）不算進專案完成日。 */
const AFTER = '之後';

export interface PlanItem {
  task: Task;
  project: Project | undefined;
  /** '' = 未指派 */
  lane: string;
  start: number;
  end: number;
  /** 沒估天數，用 MIN_DAYS 佔位 */
  unestimated: boolean;
  /** 依前置／同一人排隊，排在誰後面（畫箭頭與追要徑用）。 */
  deps: string[];
  critical: boolean;
  phase: string;
}

export interface ProjectFinish {
  project: Project;
  end: number;
  open: number;
  done: number;
}

export interface Plan {
  items: PlanItem[];
  byId: Map<string, PlanItem>;
  end: number;
  finishes: ProjectFinish[];
  /** 每人排到的工作天（含專注度換算），找瓶頸用 */
  laneLoad: Map<string, number>;
  /** 有前置循環時被打斷的任務 */
  cycles: string[];
  doneCount: number;
}

export interface PlanOptions {
  projectIds: string[];
  buffered: boolean;
  /** 0–1，一天有多少比例真的在做專案 */
  focus: number;
}

const MIN_DAYS = 0.5;
const EPS = 1e-6;

export function schedulePlan(board: Board, opt: PlanOptions): Plan {
  const scope = new Set(opt.projectIds);
  const projectById = new Map(board.projects.map((p) => [p.id, p]));
  const inScope = board.tasks.filter((t) => scope.has(t.projectId));
  const open = inScope.filter((t) => t.status !== 'done');
  const openIds = new Set(open.map((t) => t.id));

  const dur = new Map<string, number>();
  for (const t of open) {
    const d = t.estimateDays > 0 ? (opt.buffered ? bufferedDays(t) : t.estimateDays) : MIN_DAYS;
    dur.set(t.id, d / Math.max(0.1, opt.focus));
  }
  const deps = new Map(open.map((t) => [t.id, parseDeps(t).filter((d) => openIds.has(d) && d !== t.id)]));
  const succ = new Map<string, string[]>(open.map((t) => [t.id, []]));
  for (const [id, ds] of deps) for (const d of ds) succ.get(d)!.push(id);

  // tail = 這件加上後面最長的一串
  const tail = new Map<string, number>();
  const visiting = new Set<string>();
  const tailOf = (id: string): number => {
    const memo = tail.get(id);
    if (memo != null) return memo;
    if (visiting.has(id)) return 0; // cycle — broken below
    visiting.add(id);
    const v = dur.get(id)! + Math.max(0, ...succ.get(id)!.map(tailOf));
    visiting.delete(id);
    tail.set(id, v);
    return v;
  };
  open.forEach((t) => tailOf(t.id));

  const busy = new Map<string, [number, number][]>(); // lane → sorted intervals
  const placed = new Map<string, PlanItem>();
  const cycles: string[] = [];
  const pending = new Set(openIds);
  // 先排 P0 專案，同級再看進行中、要徑長短 —— 搶同一個人時 P0 優先。
  const prio = (t: Task) => ({ P0: 0, P1: 1, P2: 2 })[projectById.get(t.projectId)?.priority ?? 'P1'];
  const rank = (t: Task) => (t.status === 'doing' || t.status === 'review' ? 1 : 0);
  const byPriority = [...open].sort(
    (a, b) =>
      prio(a) - prio(b) || rank(b) - rank(a) || tail.get(b.id)! - tail.get(a.id)! || a.order - b.order,
  );

  while (pending.size) {
    let next = byPriority.find((t) => pending.has(t.id) && deps.get(t.id)!.every((d) => placed.has(d)));
    if (!next) {
      // 前置有循環：挑最優先的一件，忽略還沒排的前置
      next = byPriority.find((t) => pending.has(t.id))!;
      cycles.push(next.id);
    }
    const ds = deps.get(next.id)!.filter((d) => placed.has(d));
    const ready = Math.max(0, ...ds.map((d) => placed.get(d)!.end));
    const d = dur.get(next.id)!;
    const lane = next.assigneeId;
    let start = ready;
    if (lane) {
      const iv = busy.get(lane) ?? [];
      for (const [s, e] of iv) {
        if (start + d <= s + EPS) break; // fits in the gap before this interval
        if (e > start) start = e;
      }
      iv.push([start, start + d]);
      iv.sort((a, b) => a[0] - b[0]);
      busy.set(lane, iv);
    }
    placed.set(next.id, {
      task: next,
      project: projectById.get(next.projectId),
      lane,
      start,
      end: start + d,
      unestimated: !(next.estimateDays > 0),
      deps: ds,
      critical: false,
      phase: phaseOf(next),
    });
    pending.delete(next.id);
  }

  const items = [...placed.values()];
  const end = Math.max(0, ...items.map((i) => i.end));

  // 要徑（考慮人力後的「關鍵鏈」）：從最晚結束的往回追 ——
  // 是誰讓它不能更早開始？前置剛好在它開始時做完，或同一人上一件剛好做完。
  const laneItems = new Map<string, PlanItem[]>();
  for (const it of items) if (it.lane) laneItems.set(it.lane, [...(laneItems.get(it.lane) ?? []), it]);
  const finishesFor = (pid: string | null) =>
    items.filter((i) => (pid == null || i.task.projectId === pid) && i.phase !== AFTER);
  const markChain = (from: PlanItem | undefined) => {
    let cur = from;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.task.id)) {
      seen.add(cur.task.id);
      cur.critical = true;
      if (cur.start < EPS) break;
      const s = cur.start;
      const viaDep = cur.deps.map((d) => placed.get(d)!).find((p) => Math.abs(p.end - s) < EPS);
      const viaLane = cur.lane
        ? laneItems.get(cur.lane)!.find((p) => p !== cur && Math.abs(p.end - s) < EPS)
        : undefined;
      cur = viaDep ?? viaLane;
    }
  };

  const finishes: ProjectFinish[] = opt.projectIds
    .map((pid) => projectById.get(pid))
    .filter((p): p is Project => !!p)
    .map((p) => {
      const mine = finishesFor(p.id);
      const last = mine.reduce<PlanItem | undefined>((a, b) => (!a || b.end > a.end ? b : a), undefined);
      markChain(last);
      return {
        project: p,
        end: last?.end ?? 0,
        open: items.filter((i) => i.task.projectId === p.id).length,
        done: inScope.filter((t) => t.projectId === p.id && t.status === 'done').length,
      };
    });

  const laneLoad = new Map<string, number>();
  for (const it of items) laneLoad.set(it.lane, (laneLoad.get(it.lane) ?? 0) + (it.end - it.start));

  return {
    items,
    byId: placed,
    end,
    finishes,
    laneLoad,
    cycles,
    doneCount: inScope.length - open.length,
  };
}

/** 從今天起第 n 個工作天的日期（跳過週末）。 */
export function workdayDate(n: number, from = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  let left = Math.floor(n + EPS);
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d;
}

export const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
export const ymd = (d: Date) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;

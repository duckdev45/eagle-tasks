import type { Board, Member, Project, Task } from '../types';
import { UNCERTAINTY, bufferedDays, daysUntil, isBlocked, workdaysBetween } from './meta';

/** Two working weeks per person — the reference line on the load chart. */
export const CAPACITY_DAYS = 10;

const UNC_RANK = { '': 0, low: 1, mid: 2, high: 3 } as const;

export interface MemberLoad {
  member: Member;
  estimate: number;
  buffer: number;
  openTasks: number;
  unestimated: number;
  blocked: number;
}

export interface ProjectProgress {
  project: Project;
  doneDays: number;
  remainingDays: number;
  unestimated: number;
}

export interface RiskCell {
  complexity: number; // 1..5, 0 = 未評估
  uncertainty: '' | 'low' | 'mid' | 'high';
  projects: Project[];
}

export interface BlockedItem {
  task: Task;
  project?: Project;
  assignee?: Member;
  days: number | null;
}

export interface Accuracy {
  member: Member;
  estimate: number;
  actual: number;
  tasks: number;
}

const open = (t: Task) => t.status !== 'done';

export function computeInsights(board: Board) {
  const projectById = new Map(board.projects.map((p) => [p.id, p]));
  const memberById = new Map(board.members.map((m) => [m.id, m]));
  const openTasks = board.tasks.filter(open);

  // ── KPIs ──
  const remaining = openTasks.reduce((s, t) => s + bufferedDays(t), 0);
  const unestimated = openTasks.filter((t) => !t.estimateDays).length;
  const blockedTasks = openTasks.filter(isBlocked);
  const overdue = openTasks.filter((t) => {
    const d = daysUntil(t.dueDate);
    return d != null && d < 0;
  }).length;
  const dueDone = board.tasks.filter((t) => t.status === 'done' && t.dueDate && t.doneAt);
  const onTime = dueDone.filter((t) => t.doneAt.slice(0, 10) <= t.dueDate).length;

  // ── Load per person ──
  const load: MemberLoad[] = board.members.map((member) => {
    const mine = openTasks.filter((t) => t.assigneeId === member.id);
    const estimate = mine.reduce((s, t) => s + t.estimateDays, 0);
    return {
      member,
      estimate,
      buffer: mine.reduce((s, t) => s + bufferedDays(t), 0) - estimate,
      openTasks: mine.length,
      unestimated: mine.filter((t) => !t.estimateDays).length,
      blocked: mine.filter(isBlocked).length,
    };
  });

  // ── Progress per project (estimated work only) ──
  const progress: ProjectProgress[] = board.projects
    .map((project) => {
      const tasks = board.tasks.filter((t) => t.projectId === project.id);
      return {
        project,
        doneDays: tasks.filter((t) => !open(t)).reduce((s, t) => s + t.estimateDays, 0),
        remainingDays: tasks.filter(open).reduce((s, t) => s + t.estimateDays, 0),
        unestimated: tasks.filter((t) => open(t) && !t.estimateDays).length,
      };
    })
    .filter((p) => p.doneDays + p.remainingDays > 0)
    .sort(
      (a, b) =>
        a.project.priority.localeCompare(b.project.priority) || b.remainingDays - a.remainingDays,
    );

  // ── Risk matrix: complexity × the highest uncertainty among open tasks ──
  const risk = new Map<string, RiskCell>();
  for (const p of board.projects) {
    if (p.status === 'done') continue;
    let u: RiskCell['uncertainty'] = '';
    for (const t of openTasks) {
      if (t.projectId === p.id && UNC_RANK[t.uncertainty] > UNC_RANK[u]) u = t.uncertainty;
    }
    const key = `${p.complexity}|${u}`;
    if (!risk.has(key)) risk.set(key, { complexity: p.complexity, uncertainty: u, projects: [] });
    risk.get(key)!.projects.push(p);
  }

  // ── Blocked, longest first ──
  const blocked: BlockedItem[] = blockedTasks
    .map((task) => ({
      task,
      project: projectById.get(task.projectId),
      assignee: memberById.get(task.assigneeId),
      days: task.blockedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(task.blockedAt).getTime()) / 86_400_000))
        : null,
    }))
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1));

  // ── Estimate accuracy (done tasks with both timestamps and an estimate) ──
  const accuracy: Accuracy[] = board.members
    .map((member) => {
      let estimate = 0;
      let actual = 0;
      let tasks = 0;
      for (const t of board.tasks) {
        if (t.assigneeId !== member.id || t.status !== 'done' || !t.estimateDays) continue;
        const a = workdaysBetween(t.startedAt, t.doneAt);
        if (a == null) continue;
        estimate += t.estimateDays;
        actual += a;
        tasks++;
      }
      return { member, estimate, actual, tasks };
    })
    .filter((a) => a.tasks > 0);

  return {
    kpi: {
      remaining,
      openCount: openTasks.length,
      unestimated,
      blocked: blockedTasks.length,
      overdue,
      onTimeRate: dueDone.length ? onTime / dueDone.length : null,
      onTimeBase: dueDone.length,
    },
    load,
    progress,
    risk: [...risk.values()],
    blocked,
    accuracy,
  };
}

export const UNC_ROWS = [
  { key: 'high', label: `不確定性 ${UNCERTAINTY.high.label}` },
  { key: 'mid', label: `不確定性 ${UNCERTAINTY.mid.label}` },
  { key: 'low', label: `不確定性 ${UNCERTAINTY.low.label}` },
  { key: '', label: '未評估' },
] as const;

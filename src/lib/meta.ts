import type { BadgeVariant } from '@duckdev45/eagle-component';

import type {
  DomainColor,
  DomainKind,
  Member,
  ProjectPriority,
  ProjectStatus,
  Task,
  TaskPriority,
  TaskStatus,
  Uncertainty,
} from '../types';

export const DOMAIN_KIND: Record<DomainKind, { label: string; badge: BadgeVariant }> = {
  client: { label: '客戶', badge: 'info' },
  sector: { label: '產品線', badge: 'secondary' },
  internal: { label: '內部', badge: 'outline' },
};

/** Domain identity colour → Eagle token. Categorical/role hues only — never
 *  status green/red, so a frame's colour can't be misread as a state. */
export const DOMAIN_COLOR: Record<DomainColor, { label: string; css: string }> = {
  teal: { label: '青', css: 'var(--cat-teal)' },
  violet: { label: '紫', css: 'var(--cat-violet)' },
  accent: { label: '橘', css: 'var(--accent-300)' },
  info: { label: '藍', css: 'var(--info-bold)' },
  primary: { label: '綠', css: 'var(--primary-500)' },
  neutral: { label: '灰', css: 'var(--neutral-500)' },
};

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; badge: BadgeVariant }> = {
  planning: { label: '規劃中', badge: 'secondary' },
  active: { label: '進行中', badge: 'info' },
  paused: { label: '暫停', badge: 'warning' },
  done: { label: '已完成', badge: 'success' },
};

export const PROJECT_PRIORITY: Record<ProjectPriority, { label: string; hint: string; badge: BadgeVariant }> = {
  P0: { label: 'P0', hint: '對客戶有承諾／期限，或直接影響收款', badge: 'error' },
  P1: { label: 'P1', hint: '產品線正在做的主要功能', badge: 'outline' },
  P2: { label: 'P2', hint: '實驗、內部工具、暫停中', badge: 'ghost' },
};

export const COMPLEXITY_LABEL = ['未評估', '很小', '小', '中', '大', '極大'] as const;

export const UNCERTAINTY: Record<Exclude<Uncertainty, ''>, { label: string; buffer: number; hint: string }> = {
  low: { label: '低', buffer: 0.1, hint: '做過類似的，需求清楚' },
  mid: { label: '中', buffer: 0.3, hint: '大致清楚，有些細節待確認' },
  high: { label: '高', buffer: 0.5, hint: '沒做過、需求未定或要等別人' },
};

/** Estimate plus the buffer its uncertainty calls for (unset → 中). */
export function bufferedDays(t: Pick<Task, 'estimateDays' | 'uncertainty'>) {
  const b = UNCERTAINTY[t.uncertainty || 'mid'].buffer;
  return t.estimateDays * (1 + b);
}

export const isBlocked = (t: Task) => t.status !== 'done' && t.blockedReason.trim() !== '';

/** Fill in the automatic timestamps when a task's status / blocker changes. */
export function stampTask(prev: Task | undefined, next: Task): Task {
  const now = new Date().toISOString();
  const out = { ...next };
  if (next.status === 'doing' && !out.startedAt) out.startedAt = now;
  if (next.status === 'done' && prev?.status !== 'done') {
    out.doneAt = now;
    if (!out.startedAt) out.startedAt = prev?.updatedAt || now;
  }
  if (next.status !== 'done' && prev?.status === 'done') out.doneAt = '';
  const blocked = next.blockedReason.trim() !== '';
  if (blocked && !(prev?.blockedReason ?? '').trim()) out.blockedAt = now;
  if (!blocked) out.blockedAt = '';
  return out;
}

/** Weekdays between two ISO times, at least half a day. */
export function workdaysBetween(a: string, b: string) {
  const s = new Date(a);
  const e = new Date(b);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return null;
  let days = 0;
  const d = new Date(s);
  d.setHours(0, 0, 0, 0);
  const end = new Date(e);
  end.setHours(0, 0, 0, 0);
  while (d < end) {
    const w = d.getDay();
    if (w !== 0 && w !== 6) days++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(0.5, days);
}

export function fmtDays(n: number) {
  return n >= 10 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, '');
}

export type Urgency = { level: 'urgent' | 'stale'; reason: string };
const STALE_REVIEW_DAYS = 3;

/**
 * Automatic flags on top of the manual 高/中/低:
 *  • 逾期 → urgent
 *  • 高優先且 3 天內到期 → urgent
 *  • 「待確認」超過 3 天沒動 → stale
 */
export function taskUrgency(t: Task): Urgency | null {
  if (t.status === 'done') return null;
  const d = daysUntil(t.dueDate);
  if (d != null && d < 0) return { level: 'urgent', reason: `逾期 ${-d} 天` };
  if (d != null && d <= 3 && t.priority === 'high')
    return { level: 'urgent', reason: d === 0 ? '今天到期' : `${d} 天後到期` };
  if (t.status === 'review' && t.updatedAt) {
    const age = Math.floor((Date.now() - new Date(t.updatedAt).getTime()) / 86_400_000);
    if (age >= STALE_REVIEW_DAYS) return { level: 'stale', reason: `待確認 ${age} 天沒動` };
  }
  return null;
}

export const isUrgent = (t: Task) => taskUrgency(t)?.level === 'urgent';

export const TASK_STATUS: Record<TaskStatus, { label: string; badge: BadgeVariant; dot: string }> = {
  todo: { label: '待辦', badge: 'secondary', dot: 'var(--neutral-400)' },
  doing: { label: '進行中', badge: 'info', dot: 'var(--info-bold)' },
  review: { label: '待確認', badge: 'warning', dot: 'var(--warning-bold)' },
  done: { label: '完成', badge: 'success', dot: 'var(--success-bold)' },
};

export const TASK_PRIORITY: Record<TaskPriority, { label: string }> = {
  high: { label: '高' },
  mid: { label: '中' },
  low: { label: '低' },
};

const AVATAR_TONES = [
  'var(--role-super)',
  'var(--cat-violet)',
  'var(--role-sub)',
  'var(--cat-teal)',
  'var(--role-qm)',
  'var(--accent-400)',
  'var(--role-gc)',
  'var(--role-safety)',
];

export function memberTone(m: Pick<Member, 'id'> | undefined) {
  if (!m) return 'var(--neutral-400)';
  let h = 0;
  for (const c of m.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function initials(name: string) {
  const s = name.trim();
  if (!s) return '?';
  // CJK names → last 1–2 chars read naturally (王小明 → 小明); latin → first letters.
  if (/[一-鿿]/.test(s)) return s.length > 2 ? s.slice(-2) : s;
  const parts = s.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function splitTags(s: string) {
  return s
    .split(/[,，、\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Days until due (negative = overdue). Null when no date. */
export function daysUntil(due: string) {
  if (!due) return null;
  const d = new Date(due + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function shortDate(due: string) {
  if (!due) return '';
  const [, m, d] = due.split('-');
  return m && d ? `${+m}/${+d}` : due;
}

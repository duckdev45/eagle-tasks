import type { Board } from '../types';

/** Which nodes stay lit. `null` = nothing dimmed. */
export interface Spotlight {
  domains: Set<string>;
  projects: Set<string>;
  tasks: Set<string>;
}

/** Everything a member touches: their tasks, projects they own or work on,
 *  and the domains those sit in (plus domains they lead). */
export function spotlightForMember(board: Board, memberId: string): Spotlight {
  const tasks = new Set(board.tasks.filter((t) => t.assigneeId === memberId).map((t) => t.id));
  const projects = new Set<string>();
  for (const p of board.projects) {
    if (p.ownerId === memberId || board.tasks.some((t) => t.projectId === p.id && tasks.has(t.id)))
      projects.add(p.id);
  }
  const domains = new Set<string>();
  for (const d of board.domains) {
    if (d.leadId === memberId || board.projects.some((p) => p.domainId === d.id && projects.has(p.id)))
      domains.add(d.id);
  }
  return { domains, projects, tasks };
}

/** Focus on one entity and its ancestry/descendants. */
export function spotlightForEntity(
  board: Board,
  kind: 'domain' | 'project' | 'task',
  id: string,
): Spotlight {
  if (kind === 'domain') {
    const projects = new Set(board.projects.filter((p) => p.domainId === id).map((p) => p.id));
    const tasks = new Set(board.tasks.filter((t) => projects.has(t.projectId)).map((t) => t.id));
    return { domains: new Set([id]), projects, tasks };
  }
  if (kind === 'project') {
    const p = board.projects.find((x) => x.id === id);
    const tasks = new Set(board.tasks.filter((t) => t.projectId === id).map((t) => t.id));
    return { domains: new Set(p ? [p.domainId] : []), projects: new Set([id]), tasks };
  }
  const t = board.tasks.find((x) => x.id === id);
  const p = t && board.projects.find((x) => x.id === t.projectId);
  return {
    domains: new Set(p ? [p.domainId] : []),
    projects: new Set(p ? [p.id] : []),
    tasks: new Set([id]),
  };
}

export interface BoardFilter {
  memberId: string | null;
  p0Only: boolean;
  urgentOnly: boolean;
}

export const hasFilter = (f: BoardFilter) => !!f.memberId || f.p0Only || f.urgentOnly;

/**
 * Combined filter (AND across conditions):
 *  • member  → their tasks, projects they own, domains they lead
 *  • P0      → only P0 projects
 *  • 緊急    → only tasks the urgency rules flag as urgent
 */
export function spotlightForFilter(
  board: Board,
  f: BoardFilter,
  isUrgent: (t: Board['tasks'][number]) => boolean,
): Spotlight {
  const projectById = new Map(board.projects.map((p) => [p.id, p]));
  const taskOk = (t: Board['tasks'][number]) =>
    (!f.memberId || t.assigneeId === f.memberId) &&
    (!f.urgentOnly || isUrgent(t)) &&
    (!f.p0Only || projectById.get(t.projectId)?.priority === 'P0');
  const tasks = new Set(board.tasks.filter(taskOk).map((t) => t.id));

  const projects = new Set<string>();
  for (const p of board.projects) {
    if (f.p0Only && p.priority !== 'P0') continue;
    const hasTask = board.tasks.some((t) => t.projectId === p.id && tasks.has(t.id));
    const owns = !!f.memberId && p.ownerId === f.memberId && !f.urgentOnly;
    const noTaskCriteria = !f.memberId && !f.urgentOnly; // P0 alone lights the whole project
    if (hasTask || owns || noTaskCriteria) projects.add(p.id);
  }
  const domains = new Set<string>();
  for (const d of board.domains) {
    const leads = !!f.memberId && d.leadId === f.memberId && !f.urgentOnly && !f.p0Only;
    if (leads || board.projects.some((p) => p.domainId === d.id && projects.has(p.id))) domains.add(d.id);
  }
  return { domains, projects, tasks };
}

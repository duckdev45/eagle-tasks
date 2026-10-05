// Data model — one Google Sheet tab per entity. Column names in the sheet
// match these field names exactly (see gas/Code.gs SCHEMA).

export type DomainKind = 'client' | 'sector' | 'internal';
export type DomainColor = 'teal' | 'violet' | 'accent' | 'info' | 'primary' | 'neutral';

/** 客戶 / 產品線 — top-level frame on the canvas. */
export interface Domain {
  id: string;
  name: string;
  kind: DomainKind;
  /** Comma-separated keywords the boss might type when a client mentions them. */
  keywords: string;
  description: string;
  /** 對方窗口（client-side contact）. */
  clientContact: string;
  /** Our member who owns the relationship. */
  leadId: string;
  color: DomainColor;
  /** Canvas position (world coordinates). Empty → auto layout. */
  x: number | null;
  y: number | null;
  order: number;
  updatedAt?: string;
}

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'done';
/** P0 對客戶有承諾／期限或影響收款 · P1 產品線主功能 · P2 實驗、內部工具、暫停 */
export type ProjectPriority = 'P0' | 'P1' | 'P2';

export interface Project {
  id: string;
  domainId: string;
  name: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  /** 專案負責人 / 對外窗口. */
  ownerId: string;
  summary: string;
  /** 切入建議 — what to say / offer when an external client brings this up. */
  pitch: string;
  nextStep: string;
  tags: string;
  dueDate: string;
  link: string;
  order: number;
  updatedAt?: string;
}

export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';
export type TaskPriority = 'high' | 'mid' | 'low';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  note: string;
  order: number;
  updatedAt?: string;
}

export interface Member {
  id: string;
  name: string;
  title: string;
  /** What to route to this person — shown to the boss as "找他談什麼". */
  expertise: string;
  email: string;
  phone: string;
  line: string;
  order: number;
  updatedAt?: string;
}

export interface Board {
  domains: Domain[];
  projects: Project[];
  tasks: Task[];
  members: Member[];
}

export type EntityKind = 'domain' | 'project' | 'task' | 'member';

export interface EntityMap {
  domain: Domain;
  project: Project;
  task: Task;
  member: Member;
}

export const SHEET_OF: Record<EntityKind, keyof Board> = {
  domain: 'domains',
  project: 'projects',
  task: 'tasks',
  member: 'members',
};

export type Selection = { kind: EntityKind; id: string } | null;

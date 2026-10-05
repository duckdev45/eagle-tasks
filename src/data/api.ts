import type { Board, Domain, Member, Project, Task } from '../types';
import { SEED } from './seed';

// ─── Transport ────────────────────────────────────────────────────────────────
//
// Two interchangeable backends behind one interface:
//   • GasClient   — Google Apps Script Web App (VITE_GAS_URL). Sheet = database.
//   • ProxyClient — same API through the Vercel Function at /api/board
//                   (VITE_PROXY=1). CDN-cached reads, token stays server-side.
//   • LocalClient — Demo mode, localStorage, seeded. Lets the page work before
//                   the sheet exists.
//
// POSTs are sent as `text/plain` on purpose: Apps Script Web Apps can't answer
// a CORS preflight, and text/plain is a "simple request" that skips it.

export type SheetName = keyof Board;

export interface ApiClient {
  readonly mode: 'gas' | 'proxy' | 'demo';
  list(): Promise<Board>;
  upsert<T extends { id: string }>(sheet: SheetName, record: T): Promise<T>;
  remove(sheet: SheetName, id: string): Promise<void>;
  /** Several writes in one round-trip (drag-reorder, cascades). */
  batch(ops: BatchOp[]): Promise<void>;
}

export type BatchOp =
  | { action: 'upsert'; sheet: SheetName; record: { id: string } }
  | { action: 'delete'; sheet: SheetName; id: string };

// ─── Normalisation ────────────────────────────────────────────────────────────
// Sheets hand back "" for empty cells and numbers-as-strings sometimes; coerce
// every row into the exact shape the UI expects.

const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};
const numOrNull = (v: unknown) => {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};
/** Sheets turns ISO dates into Date → JSON → full timestamp; keep yyyy-mm-dd. */
const date = (v: unknown) => {
  const s = str(v);
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

type Row = Record<string, unknown>;

export function normalizeBoard(raw: Partial<Record<SheetName, Row[]>>): Board {
  const domains: Domain[] = (raw.domains ?? [])
    .filter((r) => r.id)
    .map((r) => ({
      id: str(r.id),
      name: str(r.name),
      kind: oneOf(r.kind, ['client', 'sector', 'internal'] as const, 'client'),
      keywords: str(r.keywords),
      description: str(r.description),
      clientContact: str(r.clientContact),
      leadId: str(r.leadId),
      color: oneOf(r.color, ['teal', 'violet', 'accent', 'info', 'primary', 'neutral'] as const, 'teal'),
      x: numOrNull(r.x),
      y: numOrNull(r.y),
      order: num(r.order),
      updatedAt: str(r.updatedAt),
    }));

  const projects: Project[] = (raw.projects ?? [])
    .filter((r) => r.id)
    .map((r) => ({
      id: str(r.id),
      domainId: str(r.domainId),
      name: str(r.name),
      status: oneOf(r.status, ['planning', 'active', 'paused', 'done'] as const, 'planning'),
      priority: oneOf(r.priority, ['P0', 'P1', 'P2'] as const, 'P1'),
      ownerId: str(r.ownerId),
      summary: str(r.summary),
      pitch: str(r.pitch),
      nextStep: str(r.nextStep),
      tags: str(r.tags),
      dueDate: date(r.dueDate),
      link: str(r.link),
      order: num(r.order),
      updatedAt: str(r.updatedAt),
    }));

  const tasks: Task[] = (raw.tasks ?? [])
    .filter((r) => r.id)
    .map((r) => ({
      id: str(r.id),
      projectId: str(r.projectId),
      title: str(r.title),
      assigneeId: str(r.assigneeId),
      status: oneOf(r.status, ['todo', 'doing', 'review', 'done'] as const, 'todo'),
      priority: oneOf(r.priority, ['high', 'mid', 'low'] as const, 'mid'),
      dueDate: date(r.dueDate),
      note: str(r.note),
      order: num(r.order),
      updatedAt: str(r.updatedAt),
    }));

  const members: Member[] = (raw.members ?? [])
    .filter((r) => r.id)
    .map((r) => ({
      id: str(r.id),
      name: str(r.name),
      title: str(r.title),
      expertise: str(r.expertise),
      email: str(r.email),
      phone: str(r.phone),
      line: str(r.line),
      order: num(r.order),
      updatedAt: str(r.updatedAt),
    }));

  const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
  return {
    domains: domains.sort(byOrder),
    projects: projects.sort(byOrder),
    tasks: tasks.sort(byOrder),
    members: members.sort(byOrder),
  };
}

// ─── Google Apps Script ───────────────────────────────────────────────────────

class GasClient implements ApiClient {
  readonly mode = 'gas' as const;
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async post(body: Record<string, unknown>) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: this.token }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Apps Script 回傳錯誤');
    return json;
  }

  async list() {
    const u = new URL(this.url);
    u.searchParams.set('action', 'list');
    if (this.token) u.searchParams.set('token', this.token);
    const res = await fetch(u.toString());
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Apps Script 回傳錯誤');
    return normalizeBoard(json.data);
  }

  async upsert<T extends { id: string }>(sheet: SheetName, record: T) {
    const json = await this.post({ action: 'upsert', sheet, record });
    return { ...record, ...(json.record ?? {}) } as T;
  }

  async remove(sheet: SheetName, id: string) {
    await this.post({ action: 'delete', sheet, id });
  }

  async batch(ops: BatchOp[]) {
    if (ops.length) await this.post({ action: 'batch', ops });
  }
}

// ─── Vercel proxy (/api/board) ────────────────────────────────────────────────

/** After a write, read straight through for this long so the CDN's 60s copy
 *  can't snap the editor's screen back to the old data. */
const FRESH_AFTER_WRITE_MS = 120_000;

class ProxyClient implements ApiClient {
  readonly mode = 'proxy' as const;
  private lastWrite = 0;
  constructor(private endpoint: string) {}

  private async post(body: Record<string, unknown>) {
    this.lastWrite = Date.now();
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (!json.ok) throw new Error(json.error || 'Apps Script 回傳錯誤');
    this.lastWrite = Date.now();
    return json;
  }

  async list() {
    const fresh = Date.now() - this.lastWrite < FRESH_AFTER_WRITE_MS;
    const res = await fetch(fresh ? `${this.endpoint}?fresh=1` : this.endpoint);
    const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (!json.ok) throw new Error(json.error || 'Apps Script 回傳錯誤');
    return normalizeBoard(json.data);
  }

  async upsert<T extends { id: string }>(sheet: SheetName, record: T) {
    const json = await this.post({ action: 'upsert', sheet, record });
    return { ...record, ...(json.record ?? {}) } as T;
  }

  async remove(sheet: SheetName, id: string) {
    await this.post({ action: 'delete', sheet, id });
  }

  async batch(ops: BatchOp[]) {
    if (ops.length) await this.post({ action: 'batch', ops });
  }
}

// ─── Demo (localStorage) ──────────────────────────────────────────────────────

const LS_KEY = 'eagle-tasks/demo-board/v3';

class LocalClient implements ApiClient {
  readonly mode = 'demo' as const;

  private read(): Board {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return normalizeBoard(JSON.parse(raw));
    } catch {
      /* storage blocked or corrupt → fall back to seed */
    }
    return structuredClone(SEED);
  }

  private write(board: Board) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(board));
    } catch {
      /* private mode etc. — demo just won't persist */
    }
  }

  private apply(board: Board, op: BatchOp) {
    const rows = board[op.sheet] as { id: string }[];
    if (op.action === 'delete') {
      (board[op.sheet] as { id: string }[]) = rows.filter((r) => r.id !== op.id);
      return;
    }
    const rec = { ...op.record, updatedAt: new Date().toISOString() };
    const i = rows.findIndex((r) => r.id === rec.id);
    if (i >= 0) rows[i] = { ...rows[i], ...rec };
    else rows.push(rec);
  }

  async list() {
    return this.read();
  }

  async upsert<T extends { id: string }>(sheet: SheetName, record: T) {
    const b = this.read();
    this.apply(b, { action: 'upsert', sheet, record });
    this.write(b);
    return record;
  }

  async remove(sheet: SheetName, id: string) {
    const b = this.read();
    this.apply(b, { action: 'delete', sheet, id });
    this.write(b);
  }

  async batch(ops: BatchOp[]) {
    const b = this.read();
    ops.forEach((op) => this.apply(b, op));
    this.write(b);
  }

  /** Demo-only: wipe local edits back to seed. */
  reset() {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }
}

const GAS_URL = (import.meta.env.VITE_GAS_URL as string | undefined)?.trim() ?? '';
const GAS_TOKEN = (import.meta.env.VITE_GAS_TOKEN as string | undefined)?.trim() ?? '';
const USE_PROXY = (import.meta.env.VITE_PROXY as string | undefined)?.trim() === '1';

// Priority: proxy (production on Vercel) → direct Apps Script (local dev) → demo.
export const api: ApiClient & { reset?: () => void } = USE_PROXY
  ? new ProxyClient('/api/board')
  : GAS_URL
    ? new GasClient(GAS_URL, GAS_TOKEN)
    : new LocalClient();

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

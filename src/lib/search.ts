import type { Board, EntityKind } from '../types';
import { splitTags } from './meta';

export interface Hit {
  kind: EntityKind;
  id: string;
  title: string;
  /** Secondary line — for projects it's "who to talk to". */
  sub: string;
  /** Which field matched, shown when it isn't the title. */
  via?: string;
  score: number;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKC');

function scoreField(q: string, text: string, weight: number) {
  const t = norm(text);
  if (!t) return 0;
  if (t === q) return weight * 3;
  if (t.startsWith(q)) return weight * 2;
  if (t.includes(q)) return weight;
  return 0;
}

/**
 * Multi-term search ("工地 照片" matches both). Every term must hit some field;
 * the best field per term contributes to the score.
 */
export function search(board: Board, raw: string, limit = 24): Hit[] {
  const terms = norm(raw).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const members = new Map(board.members.map((m) => [m.id, m]));
  const domains = new Map(board.domains.map((d) => [d.id, d]));
  const hits: Hit[] = [];

  const run = (
    fields: [label: string, text: string, weight: number][],
    make: (score: number, via?: string) => Hit,
  ) => {
    let total = 0;
    let via: string | undefined;
    for (const q of terms) {
      let best = 0;
      let bestLabel = '';
      for (const [label, text, w] of fields) {
        const s = scoreField(q, text, w);
        if (s > best) {
          best = s;
          bestLabel = label;
        }
      }
      if (!best) return;
      total += best;
      if (bestLabel && bestLabel !== 'title' && !via) via = bestLabel;
    }
    hits.push(make(total, via));
  };

  for (const d of board.domains) {
    const lead = members.get(d.leadId);
    run(
      [
        ['title', d.name, 10],
        ...splitTags(d.keywords).map((k): [string, string, number] => [`關鍵字「${k}」`, k, 7]),
        ['說明', d.description, 2],
        ['對方窗口', d.clientContact, 4],
      ],
      (score, via) => ({
        kind: 'domain',
        id: d.id,
        title: d.name,
        sub: lead ? `${lead.name} 負責` : '未指定負責人',
        via,
        score: score + 2,
      }),
    );
  }

  for (const p of board.projects) {
    const owner = members.get(p.ownerId);
    const dom = domains.get(p.domainId);
    run(
      [
        ['title', p.name, 9],
        ...splitTags(p.tags).map((k): [string, string, number] => [`標籤「${k}」`, k, 6]),
        ['摘要', p.summary, 3],
        ['切入建議', p.pitch, 3],
        ['下一步', p.nextStep, 2],
        ['客戶 / 產品線', dom?.name ?? '', 3],
      ],
      (score, via) => ({
        kind: 'project',
        id: p.id,
        title: p.name,
        sub: `${dom?.name ?? '未分類'} · 找 ${owner?.name ?? '未指定'}`,
        via,
        score: score + 1,
      }),
    );
  }

  for (const t of board.tasks) {
    const who = members.get(t.assigneeId);
    run(
      [
        ['title', t.title, 6],
        ['備註', t.note, 2],
      ],
      (score, via) => ({
        kind: 'task',
        id: t.id,
        title: t.title,
        sub: who ? who.name : '未指派',
        via,
        score,
      }),
    );
  }

  for (const m of board.members) {
    run(
      [
        ['title', m.name, 10],
        ['職稱', m.title, 4],
        ['專長', m.expertise, 4],
      ],
      (score, via) => ({ kind: 'member', id: m.id, title: m.name, sub: m.title, via, score }),
    );
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

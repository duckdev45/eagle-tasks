import {
  DatePicker,
  Field,
  Input,
  Select,
  Textarea,
  type SelectOption,
} from '@duckdev45/eagle-component';
import { useId, useState } from 'react';

import { DepsPicker } from '../components/DepsPicker';

import {
  DOMAIN_COLOR,
  DOMAIN_KIND,
  COMPLEXITY_LABEL,
  PROJECT_PRIORITY,
  PROJECT_STATUS,
  TASK_PRIORITY,
  TASK_STATUS,
  UNCERTAINTY,
  bufferedDays,
  fmtDays,
} from '../lib/meta';
import type { Board, Domain, EntityKind, EntityMap, Member, Project, Task } from '../types';

// One generic draft-editing form per entity. Each returns the edited record
// through `onChange`; validation lives in `validate()` so the panel footer
// can disable "儲存" and show the error on the right Field.

const ESTIMATES = [0, 0.5, 1, 2, 3, 5, 8, 13];

const toOptions = <T extends string>(m: Record<T, { label: string }>): SelectOption[] =>
  (Object.keys(m) as T[]).map((k) => ({ value: k, label: m[k].label }));

const memberOptions = (members: Member[], emptyLabel = '未指定'): SelectOption[] => [
  { value: '', label: emptyLabel },
  ...members.map((m) => ({ value: m.id, label: m.title ? `${m.name}（${m.title}）` : m.name })),
];

const toDate = (s: string) => (s ? new Date(s + 'T00:00:00') : undefined);
const fromDate = (d: Date | undefined) => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function validate<K extends EntityKind>(kind: K, r: EntityMap[K]): Record<string, string> {
  const e: Record<string, string> = {};
  if (kind === 'domain' && !(r as Domain).name.trim()) e.name = '請輸入名稱';
  if (kind === 'project') {
    if (!(r as Project).name.trim()) e.name = '請輸入專案名稱';
    if (!(r as Project).domainId) e.domainId = '請選擇所屬客戶 / 產品線';
  }
  if (kind === 'task') {
    if (!(r as Task).title.trim()) e.title = '請輸入任務內容';
    if (!(r as Task).projectId) e.projectId = '請選擇專案';
  }
  if (kind === 'member' && !(r as Member).name.trim()) e.name = '請輸入姓名';
  return e;
}

interface FormProps<T> {
  value: T;
  onChange: (v: T) => void;
  board: Board;
  errors: Record<string, string>;
}

/** Small helper: a Field whose control gets a stable id for label binding. */
function useIds(...names: string[]) {
  const base = useId();
  return Object.fromEntries(names.map((n) => [n, `${base}-${n}`])) as Record<string, string>;
}

export function DomainForm({ value: v, onChange, board, errors }: FormProps<Domain>) {
  const id = useIds('name', 'kind', 'lead', 'contact', 'keywords', 'desc', 'color');
  const set = <K extends keyof Domain>(k: K, val: Domain[K]) => onChange({ ...v, [k]: val });
  return (
    <div className="flex flex-col gap-4">
      <Field orientation="vertical" label="名稱" htmlFor={id.name} required error={errors.name}>
        <Input id={id.name} value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="例：福懋建設" status={errors.name ? 'error' : 'default'} />
      </Field>
      <div className="flex flex-col gap-4">
        <Field orientation="vertical" label="類型" htmlFor={id.kind}>
          <Select id={id.kind} options={toOptions(DOMAIN_KIND)} value={v.kind} onChange={(x) => set('kind', x as Domain['kind'])} />
        </Field>
        <Field orientation="vertical" label="顏色" htmlFor={id.color}>
          <Select id={id.color} options={toOptions(DOMAIN_COLOR)} value={v.color} onChange={(x) => set('color', x as Domain['color'])} />
        </Field>
      </div>
      <Field orientation="vertical" label="我方負責人" htmlFor={id.lead}>
        <Select id={id.lead} options={memberOptions(board.members)} value={v.leadId} onChange={(x) => set('leadId', x as string)} searchable />
      </Field>
      <Field orientation="vertical" label="對方窗口" htmlFor={id.contact} description="客戶端聯絡人 / 單位">
        <Input id={id.contact} value={v.clientContact} onChange={(e) => set('clientContact', e.target.value)} />
      </Field>
      <Field orientation="vertical" label="關鍵字" htmlFor={id.keywords} description="用逗號分隔。外部客戶提到這些詞時，搜尋會帶到這裡。">
        <Textarea id={id.keywords} rows={2} value={v.keywords} onChange={(e) => set('keywords', e.target.value)} />
      </Field>
      <Field orientation="vertical" label="說明" htmlFor={id.desc}>
        <Textarea id={id.desc} rows={3} value={v.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
    </div>
  );
}

export function ProjectForm({ value: v, onChange, board, errors }: FormProps<Project>) {
  const id = useIds('name', 'domain', 'status', 'priority', 'cx', 'cxNote', 'owner', 'summary', 'pitch', 'next', 'tags', 'due', 'link');
  const set = <K extends keyof Project>(k: K, val: Project[K]) => onChange({ ...v, [k]: val });
  return (
    <div className="flex flex-col gap-4">
      <Field orientation="vertical" label="專案名稱" htmlFor={id.name} required error={errors.name}>
        <Input id={id.name} value={v.name} onChange={(e) => set('name', e.target.value)} status={errors.name ? 'error' : 'default'} />
      </Field>
      <Field orientation="vertical" label="所屬客戶 / 產品線" htmlFor={id.domain} required error={errors.domainId}>
        <Select
          id={id.domain}
          options={board.domains.map((d) => ({ value: d.id, label: d.name }))}
          value={v.domainId}
          onChange={(x) => set('domainId', x as string)}
          status={errors.domainId ? 'error' : 'default'}
        />
      </Field>
      <div className="flex flex-col gap-4">
        <Field orientation="vertical" label="狀態" htmlFor={id.status}>
          <Select id={id.status} options={toOptions(PROJECT_STATUS)} value={v.status} onChange={(x) => set('status', x as Project['status'])} />
        </Field>
        <Field orientation="vertical" label="截止日" htmlFor={id.due}>
          <DatePicker id={id.due} locale="zh-TW" date={toDate(v.dueDate)} setDate={(d) => set('dueDate', fromDate(d))} />
        </Field>
      </div>
      <Field orientation="vertical" label="優先級" htmlFor={id.priority} description={PROJECT_PRIORITY[v.priority].hint}>
        <Select
          id={id.priority}
          options={(['P0', 'P1', 'P2'] as const).map((k) => ({ value: k, label: `${k}　${PROJECT_PRIORITY[k].hint}` }))}
          value={v.priority}
          onChange={(x) => set('priority', x as Project['priority'])}
        />
      </Field>
      <Field orientation="vertical" label="複雜度" htmlFor={id.cx} description="看程式規模、畫面與 API 數、資料表、串接的外部系統、角色權限">
        <Select
          id={id.cx}
          options={[1, 2, 3, 4, 5, 0].map((n) => ({ value: String(n), label: n ? `${n}　${COMPLEXITY_LABEL[n]}` : '未評估' }))}
          value={String(v.complexity)}
          onChange={(x) => set('complexity', Number(x))}
        />
      </Field>
      <Field orientation="vertical" label="複雜度說明" htmlFor={id.cxNote}>
        <Textarea id={id.cxNote} rows={3} value={v.complexityNote} onChange={(e) => set('complexityNote', e.target.value)} />
      </Field>
      <Field orientation="vertical" label="負責人 / 對外窗口" htmlFor={id.owner}>
        <Select id={id.owner} options={memberOptions(board.members)} value={v.ownerId} onChange={(x) => set('ownerId', x as string)} searchable />
      </Field>
      <Field orientation="vertical" label="摘要" htmlFor={id.summary}>
        <Textarea id={id.summary} rows={2} value={v.summary} onChange={(e) => set('summary', e.target.value)} />
      </Field>
      <Field orientation="vertical" label="切入建議" htmlFor={id.pitch} description="外部客戶聊到相關話題時，老闆可以怎麼開場、能提供什麼">
        <Textarea id={id.pitch} rows={3} value={v.pitch} onChange={(e) => set('pitch', e.target.value)} />
      </Field>
      <Field orientation="vertical" label="下一步" htmlFor={id.next}>
        <Input id={id.next} value={v.nextStep} onChange={(e) => set('nextStep', e.target.value)} />
      </Field>
      <Field orientation="vertical" label="標籤" htmlFor={id.tags} description="逗號分隔，可被搜尋">
        <Input id={id.tags} value={v.tags} onChange={(e) => set('tags', e.target.value)} />
      </Field>
      <Field orientation="vertical" label="連結" htmlFor={id.link} description="文件、Figma、repo…">
        <Input id={id.link} value={v.link} onChange={(e) => set('link', e.target.value)} placeholder="https://" />
      </Field>
    </div>
  );
}

export function TaskForm({ value: v, onChange, board, errors }: FormProps<Task>) {
  const id = useIds('title', 'project', 'assignee', 'status', 'priority', 'due', 'note', 'est', 'unc', 'blocked', 'deps');
  const set = <K extends keyof Task>(k: K, val: Task[K]) => onChange({ ...v, [k]: val });
  const domainName = new Map(board.domains.map((d) => [d.id, d.name]));
  return (
    <div className="flex flex-col gap-4">
      <Field orientation="vertical" label="任務" htmlFor={id.title} required error={errors.title}>
        <Input id={id.title} value={v.title} onChange={(e) => set('title', e.target.value)} status={errors.title ? 'error' : 'default'} />
      </Field>
      <Field orientation="vertical" label="專案" htmlFor={id.project} required error={errors.projectId}>
        <Select
          id={id.project}
          searchable
          options={board.projects.map((p) => ({
            value: p.id,
            label: p.name,
            group: domainName.get(p.domainId) ?? '未分類',
          }))}
          value={v.projectId}
          onChange={(x) => set('projectId', x as string)}
          status={errors.projectId ? 'error' : 'default'}
        />
      </Field>
      <Field orientation="vertical" label="負責人" htmlFor={id.assignee}>
        <Select id={id.assignee} options={memberOptions(board.members, '未指派')} value={v.assigneeId} onChange={(x) => set('assigneeId', x as string)} searchable />
      </Field>
      <div className="flex flex-col gap-4">
        <Field orientation="vertical" label="狀態" htmlFor={id.status}>
          <Select id={id.status} options={toOptions(TASK_STATUS)} value={v.status} onChange={(x) => set('status', x as Task['status'])} />
        </Field>
        <Field orientation="vertical" label="優先度" htmlFor={id.priority}>
          <Select id={id.priority} options={toOptions(TASK_PRIORITY)} value={v.priority} onChange={(x) => set('priority', x as Task['priority'])} />
        </Field>
      </div>
      <Field orientation="vertical" label="截止日" htmlFor={id.due}>
        <DatePicker id={id.due} locale="zh-TW" date={toDate(v.dueDate)} setDate={(d) => set('dueDate', fromDate(d))} />
      </Field>
      <Field
        orientation="vertical"
        label="預估人天"
        htmlFor={id.est}
        description={
          v.estimateDays > 5
            ? '超過 5 天的任務建議再拆小，比較好追進度'
            : v.estimateDays > 0
              ? `加上不確定性緩衝後約 ${fmtDays(bufferedDays(v))} 天`
              : '一個人專心做要幾天（不含緩衝）'
        }
      >
        <Select
          id={id.est}
          options={ESTIMATES.map((n) => ({ value: String(n), label: n ? `${n} 天` : '未估' }))}
          value={String(v.estimateDays)}
          onChange={(x) => set('estimateDays', Number(x))}
        />
      </Field>
      <Field
        orientation="vertical"
        label="不確定性"
        htmlFor={id.unc}
        description={v.uncertainty ? `${UNCERTAINTY[v.uncertainty].hint}，緩衝 +${UNCERTAINTY[v.uncertainty].buffer * 100}%` : '沒選的話以「中」計算緩衝'}
      >
        <Select
          id={id.unc}
          options={[
            { value: '', label: '未評估' },
            ...(['low', 'mid', 'high'] as const).map((k) => ({ value: k, label: `${UNCERTAINTY[k].label}　${UNCERTAINTY[k].hint}` })),
          ]}
          value={v.uncertainty}
          onChange={(x) => set('uncertainty', x as Task['uncertainty'])}
        />
      </Field>
      <Field
        orientation="vertical"
        label="前置任務"
        htmlFor={id.deps}
        description="這些做完才能開始。路徑圖會依這個畫箭頭、排先後"
      >
        <DepsPicker id={id.deps} task={v} tasks={board.tasks} onChange={(d) => set('deps', d)} />
      </Field>
      <Field orientation="vertical" label="卡住原因" htmlFor={id.blocked} description="有填就算卡關，會出現在總覽的卡關清單；解決後清空即可">
        <Textarea
          id={id.blocked}
          rows={2}
          value={v.blockedReason}
          placeholder="例：等福懋提供 monday 匯出檔"
          onChange={(e) => set('blockedReason', e.target.value)}
        />
      </Field>
      <Field orientation="vertical" label="備註" htmlFor={id.note}>
        <Textarea id={id.note} rows={3} value={v.note} onChange={(e) => set('note', e.target.value)} />
      </Field>
    </div>
  );
}

export function MemberForm({ value: v, onChange, errors }: FormProps<Member>) {
  const id = useIds('name', 'title', 'expertise', 'email', 'phone', 'line');
  const set = <K extends keyof Member>(k: K, val: Member[K]) => onChange({ ...v, [k]: val });
  return (
    <div className="flex flex-col gap-4">
      <Field orientation="vertical" label="姓名" htmlFor={id.name} required error={errors.name}>
        <Input id={id.name} value={v.name} onChange={(e) => set('name', e.target.value)} status={errors.name ? 'error' : 'default'} />
      </Field>
      <Field orientation="vertical" label="職稱" htmlFor={id.title}>
        <Input id={id.title} value={v.title} onChange={(e) => set('title', e.target.value)} />
      </Field>
      <Field orientation="vertical" label="專長 / 找他談什麼" htmlFor={id.expertise}>
        <Textarea id={id.expertise} rows={2} value={v.expertise} onChange={(e) => set('expertise', e.target.value)} />
      </Field>
      <Field orientation="vertical" label="Email" htmlFor={id.email}>
        <Input id={id.email} value={v.email} onChange={(e) => set('email', e.target.value)} />
      </Field>
      <div className="flex flex-col gap-4">
        <Field orientation="vertical" label="電話" htmlFor={id.phone}>
          <Input id={id.phone} value={v.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field orientation="vertical" label="LINE ID" htmlFor={id.line}>
          <Input id={id.line} value={v.line} onChange={(e) => set('line', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

/** Draft state wrapper so the panel can own "dirty" + validation. */
export function useDraft<T>(initial: T) {
  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState(false);
  return {
    draft,
    touched,
    setDraft: (v: T) => {
      setDraft(v);
      setTouched(true);
    },
    reset: (v: T) => {
      setDraft(v);
      setTouched(false);
    },
  };
}

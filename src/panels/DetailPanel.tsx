import { Badge, Button, SegmentedControl, SidePanel } from '@duckdev45/eagle-component';
import {
  ArrowBendDownRightIcon,
  ArrowSquareOutIcon,
  CaretRightIcon,
  ChatCircleDotsIcon,
  EnvelopeSimpleIcon,
  HandshakeIcon,
  LightbulbIcon,
  PencilSimpleIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { MemberAvatar } from '../components/MemberAvatar';
import { cn } from '../lib/cn';
import {
  DOMAIN_COLOR,
  DOMAIN_KIND,
  PROJECT_PRIORITY,
  PROJECT_STATUS,
  taskUrgency,
  TASK_PRIORITY,
  TASK_STATUS,
  shortDate,
  splitTags,
} from '../lib/meta';
import type {
  Board,
  Domain,
  EntityKind,
  EntityMap,
  Member,
  Project,
  Selection,
  Task,
  TaskStatus,
} from '../types';
import { DomainForm, MemberForm, ProjectForm, TaskForm, validate } from './forms';

export type PanelState =
  | { mode: 'view'; sel: NonNullable<Selection> }
  | { mode: 'edit'; kind: EntityKind; record: EntityMap[EntityKind]; isNew: boolean }
  | null;

interface DetailPanelProps {
  board: Board;
  panel: PanelState;
  inline: boolean;
  onClose: () => void;
  onSelect: (s: Selection) => void;
  /** Leave edit mode back to the read view, without moving the camera. */
  onView: (s: NonNullable<Selection>) => void;
  onEdit: <K extends EntityKind>(kind: K, record: EntityMap[K]) => void;
  onCreate: (kind: EntityKind, preset?: Partial<EntityMap[EntityKind]>) => void;
  onSave: <K extends EntityKind>(kind: K, record: EntityMap[K], isNew: boolean) => void;
  onDelete: (kind: EntityKind, id: string) => void;
  onQuickStatus: (task: Task, status: TaskStatus) => void;
}

const KIND_LABEL: Record<EntityKind, string> = {
  domain: '客戶 / 產品線',
  project: '專案',
  task: '任務',
  member: '成員',
};

export function DetailPanel(props: DetailPanelProps) {
  const { board, panel, inline, onClose } = props;
  const idx = useMemo(
    () => ({
      domain: new Map(board.domains.map((d) => [d.id, d])),
      project: new Map(board.projects.map((p) => [p.id, p])),
      task: new Map(board.tasks.map((t) => [t.id, t])),
      member: new Map(board.members.map((m) => [m.id, m])),
    }),
    [board],
  );

  const open = !!panel;
  let title: ReactNode = '';
  let body: ReactNode = null;
  let footer: ReactNode = null;

  if (panel?.mode === 'edit') {
    return (
      <EditPanel
        key={`${panel.kind}:${panel.record.id}`}
        {...props}
        kind={panel.kind}
        record={panel.record}
        isNew={panel.isNew}
      />
    );
  }

  if (panel?.mode === 'view') {
    const { kind, id } = panel.sel;
    const rec = idx[kind].get(id);
    if (!rec) {
      body = <p className="zh-body-sm text-text-muted p-5">這筆資料已被刪除或尚未同步。</p>;
    } else {
      title = KIND_LABEL[kind];
      const editBtn = (
        <Button variant="outline" size="sm" leadingIcon={<PencilSimpleIcon />} onClick={() => props.onEdit(kind, rec)}>
          編輯
        </Button>
      );
      const delBtn = (
        <Button
          variant="ghost"
          size="sm"
          aria-label="刪除"
          title="刪除"
          className="text-danger-bold"
          onClick={() => props.onDelete(kind, id)}
         leadingIcon={<TrashIcon />} />
      );
      const addChild =
        kind === 'domain' ? (
          <Button size="sm" leadingIcon={<PlusIcon />} onClick={() => props.onCreate('project', { domainId: id })}>
            新增專案
          </Button>
        ) : kind === 'project' ? (
          <Button size="sm" leadingIcon={<PlusIcon />} onClick={() => props.onCreate('task', { projectId: id })}>
            新增任務
          </Button>
        ) : kind === 'member' ? (
          <Button size="sm" leadingIcon={<PlusIcon />} onClick={() => props.onCreate('task', { assigneeId: id })}>
            指派任務
          </Button>
        ) : null;
      footer = (
        <div className="flex w-full items-center gap-2">
          {delBtn}
          <span className="flex-1" />
          {editBtn}
          {addChild}
        </div>
      );
      body =
        kind === 'domain' ? (
          <DomainView domain={rec as Domain} board={board} idx={idx} onSelect={props.onSelect} />
        ) : kind === 'project' ? (
          <ProjectView project={rec as Project} board={board} idx={idx} onSelect={props.onSelect} />
        ) : kind === 'task' ? (
          <TaskView task={rec as Task} idx={idx} onSelect={props.onSelect} onQuickStatus={props.onQuickStatus} />
        ) : (
          <MemberView member={rec as Member} board={board} idx={idx} onSelect={props.onSelect} />
        );
    }
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      mode={inline ? 'inline' : 'overlay'}
      size="lg"
      title={title}
      footer={footer}
      aria-label="詳細資訊"
      className={cn(inline && 'bg-surface-elevated h-full')}
      contentClassName="p-0"
    >
      {body}
    </SidePanel>
  );
}

// ─── Edit / create ────────────────────────────────────────────────────────────

function EditPanel({
  board,
  inline,
  onClose,
  onSave,
  onView,
  kind,
  record,
  isNew,
}: DetailPanelProps & { kind: EntityKind; record: EntityMap[EntityKind]; isNew: boolean }) {
  const [draft, setDraft] = useState(record);
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => setDraft(record), [record]);
  const errors = validate(kind, draft);
  const shownErrors = showErrors ? errors : {};
  const hasErrors = Object.keys(errors).length > 0;

  const submit = () => {
    if (hasErrors) return setShowErrors(true);
    onSave(kind, draft, isNew);
  };
  const cancel = () => (isNew ? onClose() : onView({ kind, id: record.id }));

  const formProps = { board, errors: shownErrors };
  return (
    <SidePanel
      open
      onClose={onClose}
      mode={inline ? 'inline' : 'overlay'}
      size="lg"
      title={`${isNew ? '新增' : '編輯'}${KIND_LABEL[kind]}`}
      aria-label={`${isNew ? '新增' : '編輯'}${KIND_LABEL[kind]}`}
      className={cn(inline && 'bg-surface-elevated h-full')}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={cancel}>
            取消
          </Button>
          <Button onClick={submit}>{isNew ? '建立' : '儲存'}</Button>
        </div>
      }
    >
      <form
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {kind === 'domain' && <DomainForm value={draft as Domain} onChange={setDraft} {...formProps} />}
        {kind === 'project' && <ProjectForm value={draft as Project} onChange={setDraft} {...formProps} />}
        {kind === 'task' && <TaskForm value={draft as Task} onChange={setDraft} {...formProps} />}
        {kind === 'member' && <MemberForm value={draft as Member} onChange={setDraft} {...formProps} />}
        <button type="submit" hidden />
      </form>
    </SidePanel>
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────

type Idx = {
  domain: Map<string, Domain>;
  project: Map<string, Project>;
  task: Map<string, Task>;
  member: Map<string, Member>;
};

function Section({ title, children, aside }: { title: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-border-subtle border-b px-5 py-4 last:border-b-0">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="zh-overline-xs text-text-muted flex-1">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function PitchCallout({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="bg-accent-100 border-accent-200 flex gap-2 rounded-sm border p-3">
      <LightbulbIcon weight="fill" className="text-accent-400 mt-0.5 shrink-0" size={18} />
      <div>
        <div className="zh-body-xxs-bold text-accent-500 mb-0.5">切入建議</div>
        <p className="zh-body-xs text-text-primary whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

function ContactCard({
  member,
  role,
  onSelect,
}: {
  member: Member | undefined;
  role: string;
  onSelect: (s: Selection) => void;
}) {
  if (!member)
    return (
      <div className="bg-surface-sunken zh-body-xs text-text-muted rounded-md p-3">
        {role}：未指定
      </div>
    );
  const links = [
    member.email && { icon: <EnvelopeSimpleIcon />, label: member.email, href: `mailto:${member.email}` },
    member.phone && { icon: <PhoneIcon />, label: member.phone, href: `tel:${member.phone}` },
    member.line && { icon: <ChatCircleDotsIcon />, label: `LINE ${member.line}`, href: undefined },
  ].filter(Boolean) as { icon: ReactNode; label: string; href?: string }[];
  return (
    <div className="bg-surface-raised border-border-subtle rounded-md border p-3">
      <button
        type="button"
        onClick={() => onSelect({ kind: 'member', id: member.id })}
        className="flex w-full items-center gap-3 text-left"
      >
        <MemberAvatar member={member} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="zh-body-xxs text-text-muted">{role}</div>
          <div className="zh-label text-text-primary font-bold">{member.name}</div>
          {member.title && <div className="zh-body-xxs text-text-secondary">{member.title}</div>}
        </div>
        <CaretRightIcon className="text-text-muted" />
      </button>
      {member.expertise && (
        <p className="zh-body-xs text-text-secondary mt-2">
          <span className="text-text-muted">找他談：</span>
          {member.expertise}
        </p>
      )}
      {links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {links.map((l) =>
            l.href ? (
              <a key={l.label} href={l.href} className="zh-body-xxs text-info-bold inline-flex items-center gap-1 hover:underline">
                {l.icon}
                {l.label}
              </a>
            ) : (
              <span key={l.label} className="zh-body-xxs text-text-secondary inline-flex items-center gap-1">
                {l.icon}
                {l.label}
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function PeopleList({
  tasks,
  extra,
  idx,
  onSelect,
}: {
  tasks: Task[];
  extra?: string[];
  idx: Idx;
  onSelect: (s: Selection) => void;
}) {
  const counts = new Map<string, number>();
  for (const id of extra ?? []) if (id) counts.set(id, counts.get(id) ?? 0);
  for (const t of tasks) {
    if (!t.assigneeId || t.status === 'done') continue;
    counts.set(t.assigneeId, (counts.get(t.assigneeId) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([id, n]) => ({ m: idx.member.get(id), n }))
    .filter((r) => r.m)
    .sort((a, b) => b.n - a.n);
  if (!rows.length) return <p className="zh-body-xs text-text-muted">尚無人員</p>;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map(({ m, n }) => (
        <li key={m!.id}>
          <button
            type="button"
            onClick={() => onSelect({ kind: 'member', id: m!.id })}
            className="hover:bg-surface-sunken flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left"
          >
            <MemberAvatar member={m} size="sm" />
            <span className="zh-body-xs text-text-primary font-medium">{m!.name}</span>
            <span className="zh-body-xxs text-text-muted min-w-0 flex-1 truncate">{m!.title}</span>
            <span className="mono-xs text-text-secondary">{n} 項</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TaskList({
  tasks,
  idx,
  onSelect,
  showProject,
}: {
  tasks: Task[];
  idx: Idx;
  onSelect: (s: Selection) => void;
  showProject?: boolean;
}) {
  if (!tasks.length) return <p className="zh-body-xs text-text-muted">沒有任務</p>;
  const order: TaskStatus[] = ['doing', 'review', 'todo', 'done'];
  const sorted = [...tasks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <ul className="flex flex-col">
      {sorted.map((t) => {
        const st = TASK_STATUS[t.status];
        const p = idx.project.get(t.projectId);
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect({ kind: 'task', id: t.id })}
              className="hover:bg-surface-sunken flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left"
            >
              <Badge variant={st.badge} size="sm" className="shrink-0">
                {st.label}
              </Badge>
              <span className="min-w-0 flex-1">
                <span className={cn('zh-body-xs block truncate', t.status === 'done' && 'text-text-muted line-through')}>
                  {t.title}
                </span>
                {showProject && p && <span className="zh-body-xxs text-text-muted block truncate">{p.name}</span>}
              </span>
              {t.dueDate && <span className="mono-xs text-text-muted">{shortDate(t.dueDate)}</span>}
              <MemberAvatar member={idx.member.get(t.assigneeId)} size="xs" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DomainView({
  domain: d,
  board,
  idx,
  onSelect,
}: {
  domain: Domain;
  board: Board;
  idx: Idx;
  onSelect: (s: Selection) => void;
}) {
  const projects = board.projects.filter((p) => p.domainId === d.id);
  const pids = new Set(projects.map((p) => p.id));
  const tasks = board.tasks.filter((t) => pids.has(t.projectId));
  const color = DOMAIN_COLOR[d.color].css;
  return (
    <div>
      <div className="px-5 pt-4 pb-4" style={{ background: `color-mix(in srgb, ${color} 8%, transparent)`, borderTop: `4px solid ${color}` }}>
        <Badge variant={DOMAIN_KIND[d.kind].badge} size="sm">
          {DOMAIN_KIND[d.kind].label}
        </Badge>
        <h2 className="zh-heading text-text-primary mt-2">{d.name}</h2>
        {d.description && <p className="zh-body-xs text-text-secondary mt-1 whitespace-pre-wrap">{d.description}</p>}
        {d.clientContact && (
          <p className="zh-body-xs text-text-secondary mt-2 inline-flex items-center gap-1">
            <HandshakeIcon className="text-text-muted" /> 對方窗口：{d.clientContact}
          </p>
        )}
      </div>
      <Section title="我方負責人">
        <ContactCard member={idx.member.get(d.leadId)} role="關係負責人" onSelect={onSelect} />
      </Section>
      <Section title={`可以聊的專案（${projects.length}）`}>
        <div className="flex flex-col gap-3">
          {projects.map((p) => {
            const owner = idx.member.get(p.ownerId);
            return (
              <div key={p.id} className="border-border-subtle rounded-md border">
                <button
                  type="button"
                  onClick={() => onSelect({ kind: 'project', id: p.id })}
                  className="hover:bg-surface-sunken flex w-full items-center gap-2 rounded-t-md px-3 py-2 text-left"
                >
                  <span className="zh-body-sm-bold text-text-primary min-w-0 flex-1 truncate">{p.name}</span>
                  <Badge variant={PROJECT_PRIORITY[p.priority].badge} size="sm" title={PROJECT_PRIORITY[p.priority].hint}>
                    {p.priority}
                  </Badge>
                  <Badge variant={PROJECT_STATUS[p.status].badge} size="sm">
                    {PROJECT_STATUS[p.status].label}
                  </Badge>
                </button>
                <div className="flex flex-col gap-2 px-3 pb-3">
                  <div className="zh-body-xxs text-text-secondary flex items-center gap-1.5">
                    <MemberAvatar member={owner} size="xs" />
                    找 <b className="text-text-primary">{owner?.name ?? '未指定'}</b>
                    {owner?.title && <span className="text-text-muted">· {owner.title}</span>}
                  </div>
                  <PitchCallout text={p.pitch} />
                  {p.nextStep && (
                    <p className="zh-body-xxs text-text-secondary flex gap-1">
                      <ArrowBendDownRightIcon className="text-accent-300 mt-0.5 shrink-0" />
                      下一步：{p.nextStep}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {!projects.length && <p className="zh-body-xs text-text-muted">還沒有專案</p>}
        </div>
      </Section>
      <Section title="誰在做（未完成任務數）">
        <PeopleList tasks={tasks} extra={[d.leadId, ...projects.map((p) => p.ownerId)]} idx={idx} onSelect={onSelect} />
      </Section>
      {splitTags(d.keywords).length > 0 && (
        <Section title="關鍵字">
          <div className="flex flex-wrap gap-1.5">
            {splitTags(d.keywords).map((k) => (
              <Badge key={k} variant="outline" size="sm">
                {k}
              </Badge>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function ProjectView({
  project: p,
  board,
  idx,
  onSelect,
}: {
  project: Project;
  board: Board;
  idx: Idx;
  onSelect: (s: Selection) => void;
}) {
  const domain = idx.domain.get(p.domainId);
  const tasks = board.tasks.filter((t) => t.projectId === p.id);
  const done = tasks.filter((t) => t.status === 'done').length;
  return (
    <div>
      <div className="px-5 pt-4 pb-4">
        {domain && (
          <button
            type="button"
            onClick={() => onSelect({ kind: 'domain', id: domain.id })}
            className="zh-body-xxs text-text-muted hover:text-text-primary inline-flex items-center gap-1"
          >
            <span className="size-2 rounded-full" style={{ background: DOMAIN_COLOR[domain.color].css }} />
            {domain.name}
            <CaretRightIcon size={10} />
          </button>
        )}
        <h2 className="zh-heading text-text-primary mt-1">{p.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={PROJECT_PRIORITY[p.priority].badge} title={PROJECT_PRIORITY[p.priority].hint}>
            {p.priority}
          </Badge>
          <Badge variant={PROJECT_STATUS[p.status].badge}>{PROJECT_STATUS[p.status].label}</Badge>
          {p.dueDate && <span className="mono-xs text-text-secondary">截止 {p.dueDate}</span>}
          {tasks.length > 0 && <span className="mono-xs text-text-secondary">任務 {done}/{tasks.length}</span>}
        </div>
        {p.summary && <p className="zh-body-xs text-text-secondary mt-3 whitespace-pre-wrap">{p.summary}</p>}
      </div>
      {(p.pitch || p.nextStep) && (
        <Section title="對外說法">
          <div className="flex flex-col gap-2">
            <PitchCallout text={p.pitch} />
            {p.nextStep && (
              <p className="zh-body-xs text-text-secondary flex gap-1">
                <ArrowBendDownRightIcon className="text-accent-300 mt-0.5 shrink-0" />
                下一步：{p.nextStep}
              </p>
            )}
          </div>
        </Section>
      )}
      <Section title="負責人 / 對外窗口">
        <ContactCard member={idx.member.get(p.ownerId)} role="專案窗口" onSelect={onSelect} />
      </Section>
      <Section title={`任務（${tasks.length}）`}>
        <TaskList tasks={tasks} idx={idx} onSelect={onSelect} />
      </Section>
      <Section title="參與成員">
        <PeopleList tasks={tasks} extra={[p.ownerId]} idx={idx} onSelect={onSelect} />
      </Section>
      {(p.tags || p.link) && (
        <Section title="其他">
          <div className="flex flex-wrap gap-1.5">
            {splitTags(p.tags).map((k) => (
              <Badge key={k} variant="outline" size="sm">
                {k}
              </Badge>
            ))}
          </div>
          {p.link && (
            <a
              href={p.link}
              target="_blank"
              rel="noreferrer"
              className="zh-body-xs text-info-bold mt-2 inline-flex items-center gap-1 break-all hover:underline"
            >
              <ArrowSquareOutIcon className="shrink-0" /> {p.link}
            </a>
          )}
        </Section>
      )}
    </div>
  );
}

function TaskView({
  task: t,
  idx,
  onSelect,
  onQuickStatus,
}: {
  task: Task;
  idx: Idx;
  onSelect: (s: Selection) => void;
  onQuickStatus: (task: Task, status: TaskStatus) => void;
}) {
  const p = idx.project.get(t.projectId);
  const urgency = taskUrgency(t);
  const d = p && idx.domain.get(p.domainId);
  return (
    <div>
      <div className="px-5 pt-4 pb-4">
        <div className="zh-body-xxs text-text-muted flex flex-wrap items-center gap-1">
          {d && (
            <button type="button" className="hover:text-text-primary" onClick={() => onSelect({ kind: 'domain', id: d.id })}>
              {d.name}
            </button>
          )}
          {p && (
            <>
              <CaretRightIcon size={10} />
              <button type="button" className="hover:text-text-primary" onClick={() => onSelect({ kind: 'project', id: p.id })}>
                {p.name}
              </button>
            </>
          )}
        </div>
        <h2 className="zh-subheading text-text-primary mt-1">{t.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="zh-body-xxs text-text-muted">優先度 {TASK_PRIORITY[t.priority].label}</span>
          {urgency && (
            <Badge variant={urgency.level === 'urgent' ? 'error' : 'warning'} size="sm">
              {urgency.reason}
            </Badge>
          )}
          {t.dueDate && <span className="mono-xs text-text-secondary">截止 {t.dueDate}</span>}
        </div>
      </div>
      <Section title="狀態">
        <SegmentedControl
          aria-label="任務狀態"
          size="sm"
          value={t.status}
          onChange={(v) => onQuickStatus(t, v as TaskStatus)}
          options={(Object.keys(TASK_STATUS) as TaskStatus[]).map((s) => ({ value: s, label: TASK_STATUS[s].label }))}
          className="w-full"
        />
      </Section>
      <Section title="負責人">
        <ContactCard member={idx.member.get(t.assigneeId)} role="任務負責人" onSelect={onSelect} />
      </Section>
      {t.note && (
        <Section title="備註">
          <p className="zh-body-xs text-text-secondary whitespace-pre-wrap">{t.note}</p>
        </Section>
      )}
    </div>
  );
}

function MemberView({
  member: m,
  board,
  idx,
  onSelect,
}: {
  member: Member;
  board: Board;
  idx: Idx;
  onSelect: (s: Selection) => void;
}) {
  const tasks = board.tasks.filter((t) => t.assigneeId === m.id);
  const open = tasks.filter((t) => t.status !== 'done');
  const owns = board.projects.filter((p) => p.ownerId === m.id);
  const leads = board.domains.filter((d) => d.leadId === m.id);
  return (
    <div>
      <Section title="聯絡">
        <ContactCard member={m} role="成員" onSelect={() => {}} />
      </Section>
      {(leads.length > 0 || owns.length > 0) && (
        <Section title="對外負責">
          <ul className="flex flex-col gap-1">
            {leads.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onSelect({ kind: 'domain', id: d.id })}
                  className="hover:bg-surface-sunken flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left"
                >
                  <span className="size-2.5 rounded-full" style={{ background: DOMAIN_COLOR[d.color].css }} />
                  <span className="zh-body-xs flex-1">{d.name}</span>
                  <span className="zh-body-xxs text-text-muted">關係負責人</span>
                </button>
              </li>
            ))}
            {owns.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect({ kind: 'project', id: p.id })}
                  className="hover:bg-surface-sunken flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left"
                >
                  <Badge variant={PROJECT_STATUS[p.status].badge} size="sm">
                    {PROJECT_STATUS[p.status].label}
                  </Badge>
                  <span className="zh-body-xs min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="zh-body-xxs text-text-muted">專案窗口</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={`手上任務（未完成 ${open.length} / 全部 ${tasks.length}）`}>
        <TaskList tasks={tasks} idx={idx} onSelect={onSelect} showProject />
      </Section>
    </div>
  );
}

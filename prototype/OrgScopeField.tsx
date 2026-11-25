// 原型（2026-11-17）：可见成员 = 全部成员 / 指定部门和成员。
// 交互沿用客户端 Skill 部门可见性已定稿的形态（纵向单选 + 内嵌字段 + 独立选择弹窗），
// 在选择弹窗里增加「成员」页签。部门选中后其下级部门与成员视为已包含。
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronDown, ChevronRight, Mail, Plus, User, Users, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { orgDemo, type OrgScope } from './shared';

export type ScopeDepartment = { id: string; name: string; parentId: string | null };
export type ScopeMember = { id: string; name: string; department: string; departmentId: string; email?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmailId = (id: string) => id.startsWith('email:');
const emailOf = (id: string) => id.slice('email:'.length);

function ancestors(id: string, byId: Map<string, ScopeDepartment>): string[] {
  const out: string[] = [];
  let p = byId.get(id)?.parentId ?? null;
  while (p && !out.includes(p)) { out.push(p); p = byId.get(p)?.parentId ?? null; }
  return out;
}

export function useScopeDirectory() {
  const [departments, setDepartments] = useState<ScopeDepartment[] | null>(null);
  const [members, setMembers] = useState<ScopeMember[]>([]);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([orgDemo().departments(), orgDemo().members()]).then(([d, m]: [ScopeDepartment[], ScopeMember[]]) => {
      if (!cancelled) { setDepartments(d); setMembers(m); }
    });
    return () => { cancelled = true; };
  }, []);
  return { departments, members };
}

/** 一句话描述范围，用于确认文案与列表副标题。 */
export function describeScope(scope: OrgScope, departments: ScopeDepartment[], members: ScopeMember[], orgName: string): string {
  if (scope.mode === 'all') return `${orgName}全部成员`;
  const names = scope.departmentIds.map(id => isEmailId(id) ? emailOf(id) : departments.find(d => d.id === id)?.name ?? members.find(m => m.id === id)?.name ?? '已失效');
  return names.length <= 3 ? names.join('、') : `${names.slice(0, 3).join('、')} 等 ${names.length} 项`;
}

export function OrgScopeField({ value, onChange, departments, members, disabled, hideLegend }: {
  value: OrgScope; onChange: (next: OrgScope) => void; hideLegend?: boolean;
  departments: ScopeDepartment[]; members: ScopeMember[]; disabled?: boolean;
}) {
  const radio = useId();
  const [picker, setPicker] = useState<{ revertToAll: boolean } | null>(null);
  const byId = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const selected = value.departmentIds;
  const choose = (mode: OrgScope['mode']) => {
    if (mode === value.mode) return;
    onChange({ mode, departmentIds: selected });
    if (mode === 'departments' && selected.length === 0) setPicker({ revertToAll: true });
  };
  const close = (confirmed?: string[]) => {
    const revert = picker?.revertToAll;
    setPicker(null);
    if (confirmed) onChange({ mode: 'departments', departmentIds: confirmed });
    else if (revert && selected.length === 0) onChange({ mode: 'all', departmentIds: [] });
  };

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-2 text-14 text-[var(--text-primary)]">
      <legend className={hideLegend ? 'sr-only' : 'mb-2 text-13 text-[var(--text-secondary)]'}>可见范围</legend>
      <div className="overflow-hidden rounded-xl border border-[var(--border-default)]">
        {(['all', 'departments'] as const).map(mode => (
          <div key={mode} className={mode === 'departments' ? 'border-t border-[var(--border-default)]' : ''}>
            <label className="flex cursor-pointer items-center gap-2 p-3">
              <input type="radio" name={radio} className="accent-[var(--confirm-btn-primary-bg)]" checked={value.mode === mode} onChange={() => choose(mode)} />
              {mode === 'all' ? '全部成员' : '指定部门和成员'}
            </label>
            {mode === 'departments' && value.mode === 'departments' ? (
              <div className="pb-3 pl-8 pr-3">
                <div onClick={event => { if (event.target === event.currentTarget) setPicker({ revertToAll: false }); }}
                  className={cn('flex min-h-10 cursor-pointer flex-wrap items-center gap-1.5 rounded-xl border bg-[var(--surface-elevated)] px-2 py-1.5',
                    selected.length ? 'border-[var(--border-default)]' : 'border-[var(--error-border)]')}>
                  {selected.map(id => {
                    const dept = byId.get(id), member = memberById.get(id);
                    const parent = dept?.parentId ? byId.get(dept.parentId)?.name : null;
                    if (isEmailId(id)) return (
                      <span key={id} className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-[var(--chat-input-chip-bg)] pl-2.5 pr-1 text-12">
                        <Mail size={12} aria-hidden="true" className="shrink-0 text-[var(--text-tertiary)]" />
                        <span className="truncate">{emailOf(id)}</span>
                        <button type="button" aria-label={`移除 ${emailOf(id)}`} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          onClick={() => onChange({ mode: 'departments', departmentIds: selected.filter(x => x !== id) })}><X size={12} /></button>
                      </span>
                    );
                    return (
                      <span key={id} className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-[var(--chat-input-chip-bg)] pl-2.5 pr-1 text-12">
                        {member ? <User size={12} aria-hidden="true" className="shrink-0 text-[var(--text-tertiary)]" /> : <Users size={12} aria-hidden="true" className="shrink-0 text-[var(--text-tertiary)]" />}
                        <span className="truncate">{dept?.name ?? member?.name ?? '已失效'}</span>
                        {parent ? <span className="truncate text-[var(--text-secondary)]">· {parent}</span> : null}
                        {member ? <span className="truncate text-[var(--text-secondary)]">· {member.department.split(' / ').pop()}</span> : null}
                        <button type="button" aria-label={`移除 ${dept?.name ?? member?.name ?? ''}`}
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          onClick={() => onChange({ mode: 'departments', departmentIds: selected.filter(x => x !== id) })}><X size={12} /></button>
                      </span>
                    );
                  })}
                  <button type="button" onClick={() => setPicker({ revertToAll: false })}
                    className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-12 font-medium hover:bg-[var(--button-secondary-hover)]">
                    <Plus size={14} />{selected.length ? '添加' : '选择部门或成员'}
                  </button>
                </div>
                {!selected.length ? <p className="mt-1.5 px-1 text-12 text-[var(--error-fg)]">请至少选择一个部门或成员</p> : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {picker ? <PickerSwitch departments={departments} members={members} selected={selected} onClose={close} /> : null}
    </fieldset>
  );
}

// ───────────────────────── 可见范围选择弹窗 ─────────────────────────
type PickerProps = { departments: ScopeDepartment[]; members: ScopeMember[]; selected: string[]; onClose: (confirmed?: string[]) => void };

// 2026-11-18 比稿定 A（与企业后台同款）；B 方案见本地备份 OrgScopeField.AB.bak。
function PickerSwitch(props: PickerProps) {
  return <TreePicker {...props} switcher={null} />;
}

/** A：与企业后台「可见范围」选择弹窗同一形态——部门树里先列直属成员，再列下级部门；搜索分组；完整邮箱可按邮箱添加。 */
function TreePicker({ departments, members, selected, onClose, switcher }: PickerProps & { switcher: ReactNode }) {
  const [draft, setDraft] = useState(selected);
  const [query, setQuery] = useState('');
  const byId = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const children = (parent: string | null) => departments.filter(d => (d.parentId && byId.has(d.parentId) ? d.parentId : null) === parent);
  const directMembers = (deptId: string) => members.filter(m => m.departmentId === deptId);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(selected.flatMap(id => byId.has(id) ? ancestors(id, byId) : [])));
  const set = new Set(draft);
  const deptCovered = (id: string) => ancestors(id, byId).some(a => set.has(a));
  const memberCovered = (m: ScopeMember) => set.has(m.departmentId) || deptCovered(m.departmentId);
  const toggleDept = (id: string, on: boolean) => setDraft(cur => on
    ? [...cur.filter(x => !(byId.has(x) && ancestors(x, byId).includes(id))), id] : cur.filter(x => x !== id));
  const toggleId = (id: string, on: boolean) => setDraft(cur => on ? [...cur.filter(x => x !== id), id] : cur.filter(x => x !== id));
  const path = (id: string) => ancestors(id, byId).reverse().map(a => byId.get(a)?.name).filter(Boolean).join(' / ');
  const q = query.trim(), lower = q.toLowerCase();

  const indent = (depth: number) => ({ paddingInlineStart: depth * 18 });
  const deptRow = (d: ScopeDepartment, depth: number, opts: { expandable: boolean; sub?: string }) => {
    const inherited = deptCovered(d.id);
    const open = opts.expandable && expanded.has(d.id);
    return (
      <li key={`d:${d.id}`}>
        <div style={indent(depth)} className="flex min-h-8 items-center gap-1.5 rounded-lg pr-2 hover:bg-[var(--surface-hover)]">
          {opts.expandable ? (
            <button type="button" aria-label={open ? `收起 ${d.name}` : `展开 ${d.name}`}
              onClick={() => setExpanded(prev => { const n = new Set(prev); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-[var(--text-tertiary)]">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
          ) : <span className="w-6 shrink-0" />}
          <label className={cn('flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1', inherited && 'cursor-default')}>
            <input type="checkbox" className="accent-[var(--confirm-btn-primary-bg)]" checked={inherited || set.has(d.id)} disabled={inherited} onChange={e => toggleDept(d.id, e.target.checked)} />
            <Users size={13} aria-hidden="true" className="shrink-0 text-[var(--text-tertiary)]" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{d.name}</span>
              {opts.sub ? <span className="truncate text-12 text-[var(--text-tertiary)]">{opts.sub}</span> : null}
            </span>
            {inherited ? <span className="shrink-0 text-12 text-[var(--text-tertiary)]">已包含</span> : null}
          </label>
        </div>
      </li>
    );
  };
  const memberRow = (m: ScopeMember, depth: number, treeRow: boolean) => {
    const inherited = treeRow && memberCovered(m);
    return (
      <li key={`m:${m.id}`}>
        <label style={indent(depth)} className={cn('flex h-8 cursor-pointer items-center gap-2 rounded-lg pr-2 hover:bg-[var(--surface-hover)]', !treeRow && 'px-2', inherited && 'cursor-default')}>
          {treeRow ? <span className="w-6 shrink-0" /> : null}
          <input type="checkbox" className="accent-[var(--confirm-btn-primary-bg)]" checked={inherited || set.has(m.id)} disabled={inherited} onChange={e => toggleId(m.id, e.target.checked)} />
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="shrink-0 truncate">{m.name}</span>
            {m.email ? <span className="min-w-0 truncate text-12 text-[var(--text-tertiary)]">{m.email}</span> : null}
          </span>
          {inherited ? <span className="shrink-0 text-12 text-[var(--text-tertiary)]">已包含</span> : null}
        </label>
      </li>
    );
  };
  const tree = (parent: string | null, depth: number): ReactNode[] => children(parent).flatMap(d => {
    const subs = children(d.id), people = directMembers(d.id);
    const expandable = subs.length > 0 || people.length > 0;
    return [deptRow(d, depth, { expandable }),
      ...(expandable && expanded.has(d.id) ? [...people.map(m => memberRow(m, depth + 1, true)), ...tree(d.id, depth + 1)] : [])];
  });
  const group = (text: string) => <p className="px-2 pb-1 pt-3 text-12 text-[var(--text-tertiary)] first:pt-1">{text}</p>;
  const foundMembers = q ? members.filter(m => m.name.includes(q) || (m.email ?? '').toLowerCase().includes(lower)) : [];
  const foundDepts = q ? departments.filter(d => d.name.toLowerCase().includes(lower)) : [];
  const emailCandidate = q && EMAIL.test(q) && !members.some(m => m.email?.toLowerCase() === lower) ? lower : null;

  const picked = { depts: draft.filter(id => byId.has(id)), mems: draft.filter(id => memberById.has(id)), emails: draft.filter(isEmailId) };
  const pickedRow = (id: string, icon: ReactNode, name: string, sub?: string) => (
    <li key={id} className="flex min-h-9 items-center gap-2 py-1">
      {icon}
      <span className="flex min-w-0 flex-1 flex-col"><span className="truncate">{name}</span>{sub ? <span className="truncate text-12 text-[var(--text-tertiary)]">{sub}</span> : null}</span>
      <button type="button" aria-label={`移除 ${name}`} className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        onClick={() => setDraft(cur => cur.filter(x => x !== id))}><X size={12} /></button>
    </li>
  );

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-scrim fixed inset-0 z-[10010]" />
        <Dialog.Content aria-describedby={undefined} onPointerDownOutside={e => e.preventDefault()}
          className="modal-panel fixed left-1/2 top-1/2 z-[10010] flex max-h-[85vh] w-[min(680px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col">
          <div className="flex shrink-0 items-center gap-3 px-5 pt-5">
            <Dialog.Title className="text-18 font-medium text-[var(--text-primary)]">选择可见范围</Dialog.Title>
            {switcher}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_230px] px-5 pt-4 text-14 text-[var(--text-primary)]">
            <div className="flex min-h-0 flex-col gap-2 pr-4">
              <Input autoFocus value={query} onChange={setQuery} placeholder="搜索部门、成员姓名或邮箱" aria-label="搜索部门、成员姓名或邮箱" />
              <div className="h-[360px] max-h-[50vh] overflow-y-auto">
                {!q ? <>{group('部门')}<ul>{tree(null, 0)}</ul></> : <>
                  {foundDepts.length ? <>{group('部门')}<ul>{foundDepts.map(d => deptRow(d, 0, { expandable: false, sub: path(d.id) || undefined }))}</ul></> : null}
                  {group('成员')}
                  {foundMembers.length ? <ul>{foundMembers.map(m => memberRow(m, 0, false))}</ul> : <p className="px-2 py-2 text-12 text-[var(--text-tertiary)]">没有匹配的成员</p>}
                  {emailCandidate ? <>{group('邮箱')}<ul><li>
                    <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-[var(--surface-hover)]">
                      <input type="checkbox" className="accent-[var(--confirm-btn-primary-bg)]" checked={set.has(`email:${emailCandidate}`)} onChange={e => toggleId(`email:${emailCandidate}`, e.target.checked)} />
                      <span className="min-w-0 truncate">按邮箱添加 {emailCandidate}</span>
                    </label>
                  </li></ul></> : null}
                </>}
              </div>
            </div>
            <div className="flex min-h-0 flex-col border-l border-[var(--border-default)] pl-4">
              <div className="flex h-9 shrink-0 items-center justify-between">
                <span className="text-12 text-[var(--text-tertiary)]">已选 {draft.length} 项</span>
                {draft.length ? <button type="button" className="text-12 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" onClick={() => setDraft([])}>清空</button> : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {!draft.length ? <p className="py-6 text-center text-12 text-[var(--text-tertiary)]">还没有选择</p> : null}
                {picked.depts.length ? <>{group('部门')}<ul className="divide-y divide-[var(--border-default)]">{picked.depts.map(id => pickedRow(id, <Users size={13} aria-hidden="true" className="shrink-0 text-[var(--text-tertiary)]" />, byId.get(id)!.name, path(id) || undefined))}</ul></> : null}
                {picked.mems.length ? <>{group('成员')}<ul className="divide-y divide-[var(--border-default)]">{picked.mems.map(id => { const m = memberById.get(id)!; return pickedRow(id, <User size={13} aria-hidden="true" className="shrink-0 text-[var(--text-tertiary)]" />, m.name, m.email); })}</ul></> : null}
                {picked.emails.length ? <>{group('邮箱')}<ul className="divide-y divide-[var(--border-default)]">{picked.emails.map(id => pickedRow(id, <Mail size={13} aria-hidden="true" className="shrink-0 text-[var(--text-tertiary)]" />, emailOf(id)))}</ul></> : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 p-4">
            <Button variant="secondary" onClick={() => onClose()}>取消</Button>
            <Button variant="primary" disabled={draft.length === 0} onClick={() => onClose(draft)}>确定</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

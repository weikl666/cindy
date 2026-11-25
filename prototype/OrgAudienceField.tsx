// 原型（2026-11-17）：复制自客户端 Skill 部门可见性已定稿的选择器（ui/skill-audience-review），文案内联。
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { orgDemo } from './shared';
export interface SkillAudienceDepartment { id: string; name: string; parentId: string | null }

type Props = {
  initialDepartments?: SkillAudienceDepartment[];
  initialError?: boolean;
  onDepartmentsLoaded?: (departments: SkillAudienceDepartment[]) => void;
  mode: 'all' | 'departments'; selected: string[]; disabled?: boolean;
  onChange: (mode: 'all' | 'departments', selected: string[]) => void;
  hideLegend?: boolean;
  onValidityChange: (valid: boolean) => void;
};

type DepartmentIndex = {
  byId: ReadonlyMap<string, SkillAudienceDepartment>;
  parents: ReadonlyMap<string, string | null>;
  childrenByParent: ReadonlyMap<string | null, SkillAudienceDepartment[]>;
};

const MAX_SUMMARY_CHIPS = 6;

export function departmentAncestors(id: string, parents: ReadonlyMap<string, string | null>): string[] {
  const result: string[] = [];
  let parent = parents.get(id);
  while (parent && parent !== id && !result.includes(parent)) {
    result.push(parent); parent = parents.get(parent);
  }
  return result;
}

/** Keep the nearest ancestors, which tell same-named departments apart; the full path stays in the title. */
function compactPath(path: string[]): string {
  return path.length > 2 ? `… / ${path.slice(-2).join(' / ')}` : path.join(' / ');
}

/** Ancestor names from the root down, excluding the department itself. */
export function departmentPath(id: string, index: DepartmentIndex): string[] {
  return departmentAncestors(id, index.parents).reverse()
    .map(ancestor => index.byId.get(ancestor)?.name).filter((name): name is string => Boolean(name));
}

function indexDepartments(departments: SkillAudienceDepartment[]): DepartmentIndex {
  const byId = new Map(departments.map(d => [d.id, d]));
  const parents = new Map(departments.map(d => [d.id, d.parentId]));
  const childrenByParent = new Map<string | null, SkillAudienceDepartment[]>();
  for (const d of departments) {
    const parent = d.parentId && byId.has(d.parentId) ? d.parentId : null;
    const children = childrenByParent.get(parent) ?? [];
    children.push(d); childrenByParent.set(parent, children);
  }
  return { byId, parents, childrenByParent };
}

/** Selecting a department replaces descendants it now covers; selecting all children never promotes the parent. */
function toggleSelection(selected: string[], id: string, parents: ReadonlyMap<string, string | null>): string[] {
  return selected.includes(id) ? selected.filter(value => value !== id)
    : [...selected.filter(value => !departmentAncestors(value, parents).includes(id)), id];
}

export function OrgAudienceField({ hideLegend, mode, selected, disabled, onChange, onValidityChange, initialDepartments, initialError = false, onDepartmentsLoaded }: Props) {
    const radioName = useId();
  const [departments, setDepartments] = useState<SkillAudienceDepartment[]>(initialDepartments ?? []);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(initialDepartments ? 'ready' : initialError ? 'error' : 'loading');
  const [attempt, setAttempt] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  // The picker opens by itself when 指定部门 is chosen with nothing selected; cancelling
  // that first pick returns to the previous choice instead of leaving an empty, invalid scope.
  const revertOnCancelRef = useRef(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (initialDepartments) { setDepartments(initialDepartments); setStatus('ready'); return; }
    let cancelled = false;
    setStatus('loading');
    void orgDemo().departments().then((list: SkillAudienceDepartment[]) => {
      if (cancelled) return;
      setDepartments(list); setStatus('ready'); onDepartmentsLoaded?.(list);
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [attempt, initialDepartments, onDepartmentsLoaded]);
  const index = useMemo(() => indexDepartments(departments), [departments]);
  const missing = selected.filter(id => !index.byId.has(id));
  useEffect(() => {
    onValidityChange(status === 'ready' && (mode === 'all' || (selected.length > 0 && selected.length <= 500 && missing.length === 0)));
  }, [status, mode, selected.length, missing.length, onValidityChange]);

  const chooseMode = (value: 'all' | 'departments') => {
    if (value === mode) return;
    onChange(value, selected);
    if (value === 'departments' && selected.length === 0 && status === 'ready') {
      revertOnCancelRef.current = true;
      setPickerOpen(true);
    }
  };
  const openPicker = () => { revertOnCancelRef.current = false; setPickerOpen(true); };
  const closePicker = (confirmed?: string[]) => {
    setPickerOpen(false);
    if (confirmed) {
      onChange('departments', confirmed);
      // Back in a long form, keep the result of the pick in sight.
      requestAnimationFrame(() => fieldRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
    }
    else if (revertOnCancelRef.current && selected.length === 0) onChange('all', selected);
    revertOnCancelRef.current = false;
  };
  const remove = (id: string) => onChange('departments', selected.filter(value => value !== id));
  const shown = selected.slice(0, MAX_SUMMARY_CHIPS);
  const hiddenCount = selected.length - shown.length;

  return <fieldset disabled={disabled} className="flex flex-col gap-2 text-sm text-[var(--msg-assistant-text)]">
    <legend className={hideLegend ? 'sr-only' : 'mb-2'}>{'可见成员'}</legend>
    <div className="rounded-xl border border-[var(--cmd-palette-border)] overflow-hidden">
      {(['all', 'departments'] as const).map(value => <div key={value} className={value === 'departments' ? 'border-t border-[var(--cmd-palette-border)]' : ''}>
        <label className="flex cursor-pointer items-center gap-2 p-3">
          <input className="accent-[var(--confirm-btn-primary-bg)]" type="radio" name={radioName} checked={mode === value} onChange={() => chooseMode(value)} />
          {(value === 'all' ? '全部成员' : '指定部门')}
        </label>
        {value === 'departments' && mode === 'departments' && status === 'ready' && <div className="flex flex-col gap-1.5 pb-3 pl-8 pr-3">
          {/* A field, not a row of loose controls: the box reads as "where departments go" and its
              trailing action always says how to add more. Clicking blank space opens the same picker. */}
          <div ref={fieldRef} onClick={event => { if (!disabled && event.target === event.currentTarget) openPicker(); }}
            aria-disabled={disabled || undefined}
            className={cn('flex min-h-10 w-full scroll-mb-6 cursor-pointer flex-wrap',
              disabled && 'pointer-events-none cursor-default opacity-60', 'items-center gap-1.5 rounded-xl border bg-[var(--surface-elevated)] px-2 py-1.5',
              'focus-within:border-[var(--text-tertiary-stone)] focus-within:ring-2 focus-within:ring-[var(--focus-ring-soft)]',
              selected.length === 0 || missing.length > 0 || selected.length > 500 ? 'border-[var(--error-border)]' : 'border-[var(--border-default)]')}>
            {shown.map(id => {
              const department = index.byId.get(id);
              const path = department ? departmentPath(id, index) : [];
              const parentName = path[path.length - 1];
              return <Tip key={id} contentClassName="z-[10001]" text={department ? [...path, department.name].join(' / ') : '已失效部门'}>
                <span className={cn('inline-flex h-7 max-w-full cursor-default items-center gap-1 rounded-full pl-2.5 pr-1 text-xs',
                  department ? 'bg-[var(--chat-input-chip-bg)] text-[var(--text-primary)]' : 'bg-[var(--error-bg)] text-[var(--error-fg)]')}>
                  <span className="truncate">{department?.name ?? '已失效部门'}</span>
                  {parentName && <span className="truncate text-[var(--text-secondary)]">· {parentName}</span>}
                  <button type="button" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    aria-label={`移除 ${department?.name ?? '已失效部门'}`} onClick={() => remove(id)}>
                    <X size={12} />
                  </button>
                </span>
              </Tip>;
            })}
            {hiddenCount > 0 && <button type="button" className="h-7 rounded-full px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onClick={openPicker}>
              {`+${hiddenCount}`}
            </button>}
            <button type="button" onClick={openPicker}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--button-secondary-hover)]">
              <Plus size={14} />
              {(selected.length ? '添加部门' : '选择部门')}
            </button>
          </div>
          {selected.length === 0 && <p className="px-1 text-xs text-[var(--error-fg)]">{'请选择至少一个部门'}</p>}
          {missing.length > 0 && <p role="alert" className="px-1 text-xs text-[var(--error-fg)]">{'部分部门已失效，请移除后重新选择'}</p>}
          {selected.length > 500 && <p role="alert" className="px-1 text-xs text-[var(--error-fg)]">{'最多选择 500 个部门，请移除部分选择后保存。'}</p>}
        </div>}
      </div>)}
    </div>
    {status === 'loading' && <p role="status" className="text-xs text-[var(--cmd-palette-item-meta)]">{'正在加载部门…'}</p>}
    {status === 'error' && <div role="alert" className="flex items-center gap-2 text-xs text-[var(--error-fg)]">
      {'无法加载部门，请重试'}
      <Button type="button" variant="secondary" size="xs" onClick={() => setAttempt(n => n + 1)}>{'重试'}</Button>
    </div>}
    {pickerOpen && <DepartmentPickerDialog departments={departments} index={index} selected={selected} onClose={closePicker} />}
  </fieldset>;
}

type Row = { department: SkillAudienceDepartment; depth: number; hasChildren: boolean; path?: string[] };

function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<span className="font-medium underline decoration-[var(--cmd-palette-item-meta)] underline-offset-2">{text.slice(at, at + query.length)}</span>{text.slice(at + query.length)}</>;
}

function DepartmentPickerDialog({ departments, index, selected, onClose }: {
  departments: SkillAudienceDepartment[]; index: DepartmentIndex; selected: string[];
  onClose: (confirmed?: string[]) => void;
}) {
    const [draft, setDraft] = useState(selected);
  const [query, setQuery] = useState('');
  // Reveal existing selections: expand every ancestor of a selected department.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(selected.flatMap(id => departmentAncestors(id, index.parents))));
  const draftIds = useMemo(() => new Set(draft), [draft]);
  const trimmed = query.trim();
  const rows = useMemo<Row[]>(() => {
    if (trimmed) {
      const needle = trimmed.toLocaleLowerCase();
      return departments.filter(d => d.name.toLocaleLowerCase().includes(needle)).map(d => ({
        department: d, depth: 0, hasChildren: false, path: departmentPath(d.id, index),
      }));
    }
    const result: Row[] = [];
    const seen = new Set<string>();
    const visit = (d: SkillAudienceDepartment, depth: number) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      const children = index.childrenByParent.get(d.id) ?? [];
      result.push({ department: d, depth, hasChildren: children.length > 0 });
      if (expanded.has(d.id)) children.forEach(child => visit(child, depth + 1));
    };
    (index.childrenByParent.get(null) ?? []).forEach(d => visit(d, 0));
    return result;
  }, [departments, expanded, trimmed, index]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualized = rows.length > 100;
  const virtualizer = useVirtualizer({
    count: rows.length,
    enabled: virtualized,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (trimmed ? 48 : 32),
    getItemKey: i => rows[i].department.id,
    overscan: 8,
  });
  const visibleRows = virtualized
    ? virtualizer.getVirtualItems().map(item => ({ ...rows[item.index], item }))
    : rows.map(row => ({ ...row, item: undefined }));
  const toggle = (id: string) => setDraft(current => toggleSelection(current, id, index.parents));
  const toggleExpanded = (id: string) => setExpanded(previous => {
    const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="modal-scrim fixed inset-0 z-[10010]" />
      <Dialog.Content aria-describedby={undefined} onPointerDownOutside={event => event.preventDefault()}
        className="modal-panel fixed left-1/2 top-1/2 z-[10010] flex max-h-[85vh] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Dialog.Title className="shrink-0 px-5 pt-5 text-lg font-medium text-[var(--msg-assistant-text)]">{'选择可见部门'}</Dialog.Title>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_220px] gap-0 px-5 pt-4 text-sm text-[var(--msg-assistant-text)]">
          <div className="flex min-h-0 flex-col gap-2 pr-4">
            <Input aria-label={'搜索部门'} placeholder={'搜索部门'} autoFocus
              value={query} onChange={value => { if (scrollRef.current) scrollRef.current.scrollTop = 0; setQuery(value); }} />
            <div ref={scrollRef} className="h-[360px] max-h-[50vh] overflow-y-auto">
              {rows.length === 0 && <p className="py-6 text-center text-xs text-[var(--cmd-palette-item-meta)]">{'没有匹配的部门'}</p>}
              <div className="relative" style={virtualized ? { height: virtualizer.getTotalSize() } : undefined}>
                {visibleRows.map(({ department: d, depth, hasChildren, path, item }) => {
                  const included = departmentAncestors(d.id, index.parents).some(id => draftIds.has(id));
                  const checked = included || draftIds.has(d.id);
                  const expandLabel = (expanded.has(d.id) ? '收起' : '展开');
                  return <div key={d.id} data-index={item?.index} ref={item ? virtualizer.measureElement : undefined}
                    className="flex items-start gap-0.5 rounded-lg hover:bg-[var(--surface-hover)]"
                    style={{ paddingInlineStart: depth * 16, ...(item ? { position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` } as const : {}) }}>
                    <span className="inline-flex h-8 w-6 shrink-0 items-center justify-center">
                      {hasChildren && <button type="button" aria-label={expandLabel} title={expandLabel} onClick={() => toggleExpanded(d.id)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--cmd-palette-item-meta)] hover:text-[var(--msg-assistant-text)]">
                        {expanded.has(d.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>}
                    </span>
                    <label className={cn('flex min-w-0 flex-1 cursor-pointer gap-2 py-1.5 pr-2', included && 'cursor-default')}>
                      <input className="mt-0.5 accent-[var(--confirm-btn-primary-bg)]" type="checkbox" checked={checked} disabled={included} onChange={() => toggle(d.id)}
                        aria-label={d.name} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate"><Highlight text={d.name} query={trimmed} />
                          {included && <span className="ml-1.5 text-xs text-[var(--cmd-palette-item-meta)]">{'已包含'}</span>}</span>
                        {path && path.length > 0 && <span className="truncate text-xs text-[var(--cmd-palette-item-meta)]">{path.join(' / ')}</span>}
                      </span>
                    </label>
                  </div>;
                })}
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-col border-l border-[var(--cmd-palette-border)] pl-4">
            <div className="flex h-9 shrink-0 items-center justify-between">
              <span className="text-xs text-[var(--cmd-palette-item-meta)]">{`已选 ${draft.length} 个部门`}</span>
              {draft.length > 0 && <button type="button" className="text-xs text-[var(--cmd-palette-item-meta)] hover:text-[var(--msg-assistant-text)]" onClick={() => setDraft([])}>{'清空'}</button>}
            </div>
            <ul className="mt-2 min-h-0 flex-1 overflow-y-auto">
              {draft.map(id => {
                const department = index.byId.get(id);
                const path = department ? departmentPath(id, index) : [];
                return <li key={id} className="flex items-start gap-1 rounded-lg py-1.5 pl-1 hover:bg-[var(--surface-hover)]">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn('truncate', !department && 'text-[var(--error-fg)]')}>{department?.name ?? '已失效部门'}</span>
                    {path.length > 0 && <span className="truncate text-xs text-[var(--cmd-palette-item-meta)]" title={path.join(' / ')}>{compactPath(path)}</span>}
                  </span>
                  <button type="button" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--cmd-palette-item-meta)] hover:text-[var(--msg-assistant-text)]"
                    aria-label={`移除 ${department?.name ?? '已失效部门'}`} onClick={() => setDraft(current => current.filter(value => value !== id))}>
                    <X size={12} />
                  </button>
                </li>;
              })}
            </ul>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 p-4">
          {draft.length > 500 && <p role="alert" className="mr-auto pl-1 text-xs text-[var(--error-fg)]">{'最多选择 500 个部门，请移除部分选择后保存。'}</p>}
          <Button type="button" variant="secondary" size="md" onClick={() => onClose()}>{'取消'}</Button>
          <Button type="button" variant="primary" size="md" disabled={draft.length === 0 || draft.length > 500} onClick={() => onClose(draft)}>{'确定'}</Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

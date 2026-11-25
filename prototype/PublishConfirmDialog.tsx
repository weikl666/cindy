// 原型（2026-11-17）：企业发布确认屏 + 可见成员。AI 对话发布与界面发布都弹这一个。
// 新插件默认全部成员；已发布过的插件带出当前范围，可直接改（作者改范围不需重审）。
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { OrgScopeField, describeScope, useScopeDirectory, type ScopeDepartment, type ScopeMember } from './OrgScopeField';
import { orgDemo, type OrgScope } from './shared';

export interface PublishConfirmFacts {
  orgSlug: string; orgName: string | null; ghostId: string; name: string; version: string; size: string;
}

export type PrototypeVisibility = { mode: 'all' | 'names'; names?: string[] };

/** 原型：按名称匹配部门、成员和邮箱；完全相同且唯一才算找到。 */
function resolveNames(names: string[], departments: ScopeDepartment[], members: ScopeMember[]) {
  const ids: string[] = []; const missing: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(name)) {
      const m = members.find(x => x.email === name);
      ids.push(m ? m.id : `email:${name}`); continue;
    }
    const depts = departments.filter(d => d.name === name);
    const mems = members.filter(m => m.name === name);
    if (depts.length + mems.length === 1) ids.push((depts[0] ?? mems[0]).id);
    else missing.push(name);
  }
  return { ids: [...new Set(ids)], missing };
}

export function PublishConfirmDialog({ facts, labels, onSettle, visibility }: {
  facts: PublishConfirmFacts; visibility?: PrototypeVisibility;
  labels: { title: string; org: string; pluginId: string; version: string; size: string; confirm: string; cancel: string };
  onSettle: (result: { confirmed: boolean; scope?: OrgScope }) => void;
}) {
  const existing: OrgScope | null = orgDemo().scopeForGhost(facts.ghostId);
  const [scope, setScope] = useState<OrgScope>(existing ?? { mode: 'all', departmentIds: [] });
  const { departments, members } = useScopeDirectory();
  const orgName = facts.orgName ?? facts.orgSlug;
  const [missing, setMissing] = useState<string[]>([]);
  // 对话里说了具体名称：目录加载后预先选好；对不上的列在下面。
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !departments) return;
    applied.current = true;
    if (visibility?.mode === 'all') setScope({ mode: 'all', departmentIds: [] });
    if (visibility?.mode === 'names' && visibility.names?.length) {
      const { ids, missing: notFound } = resolveNames(visibility.names, departments, members);
      setMissing(notFound);
      if (ids.length) setScope({ mode: 'departments', departmentIds: ids });
    }
  }, [departments, members, visibility]);
  const valid = scope.mode === 'all' || scope.departmentIds.length > 0;
  const rows: [string, string][] = [
    [labels.org, orgName], [labels.pluginId, facts.ghostId], [labels.version, facts.version], [labels.size, facts.size],
  ];
  const finish = (confirmed: boolean) => {
    if (confirmed) toast.success(`已提交 ${facts.name} ${facts.version}，审核通过后${describeScope(scope, departments ?? [], members, orgName)}可以安装`);
    onSettle(confirmed ? { confirmed, scope } : { confirmed });
  };

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) finish(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-scrim fixed inset-0 z-[10000]" />
        <Dialog.Content aria-describedby={undefined} onInteractOutside={e => e.preventDefault()}
          className="modal-panel fixed left-1/2 top-1/2 z-[10000] flex max-h-[85vh] w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col p-5">
          <Dialog.Title className="text-18 font-medium text-[var(--text-primary)]">{labels.title}</Dialog.Title>
          <div className="mt-4 min-h-0 space-y-5 overflow-y-auto">
            <dl className="space-y-2 text-13 text-[var(--text-secondary)]">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><dt>{k}</dt><dd className="text-[var(--text-primary)]">{v}</dd></div>
              ))}
            </dl>
            {departments ? (
              <div>
                <OrgScopeField value={scope} onChange={setScope} departments={departments} members={members} />
                {missing.length ? <p className="mt-1.5 px-1 text-12 text-[var(--error-fg)]">没找到：{missing.join('、')}</p> : null}
              </div>
            ) : <p role="status" className="text-13 text-[var(--text-tertiary)]">正在加载部门…</p>}
          </div>
          <div className="mt-5 flex shrink-0 justify-end gap-2">
            <Button variant="secondary" onClick={() => finish(false)}>{labels.cancel}</Button>
            <Button variant="cta" autoFocus disabled={!departments || !valid} onClick={() => finish(true)}>{labels.confirm}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

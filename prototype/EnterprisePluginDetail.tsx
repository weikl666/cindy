// 原型（2026-11-17）：企业插件详情。2026-11-19 定：结构与说法沿用客户端公开插件详情（现有不改），
// 只多出企业独有的「可见范围」「维护者」和下架。顺序：概览 → 本地版本 → 可见范围 → 维护者 → 已上架 → 当前提审 → 发布记录。
import * as Dialog from '@radix-ui/react-dialog';
import { Activity, ArrowDownToLine, ChevronRight, Plus } from 'lucide-react';
import { Tip } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { toast } from '@/lib/toast';
import { AttentionDot } from '@/components/sidebar/AttentionDot';
import { usePluginReviewUpdates } from '@/contexts/PluginReviewUpdatesContext';
import { GhostPluginIcon } from '../GhostPluginIcon';
import { PluginDetailTopBar, usePluginDetailScrolled } from '../PluginDetailTopBar';
import { PLUGIN_MANAGEMENT_FRAME_CLASS, PluginManagementPage } from '../PluginManagementLayout';
import { OrgScopeField } from './OrgScopeField';
import { OrgPublishDialog, type OrgPublishPreset } from './OrgPublishDialog';
import {
  formatTime, latestLabel, orgDemo, releaseLabel, scopeLabel,
  type DemoLocalPlugin, type Department, type Member, type OrgPlugin, type OrgScope,
} from './shared';

const h2 = 'text-16 font-medium leading-6 text-[var(--text-primary)]';
const body = 'text-14 leading-6 text-[var(--text-secondary)]';
const section = 'space-y-3 border-t border-[var(--border-default)] pt-5';

export function EnterprisePluginDetail({ id, backLabel, onBack }: { id: string; backLabel: string; onBack: () => void }) {
  const { confirm } = useConfirmDialog();
  const { scrolled, onScroll } = usePluginDetailScrolled();
  const orgName: string = orgDemo().orgName;
  const [plugin, setPlugin] = useState<OrgPlugin | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [maintainerOpen, setMaintainerOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [publish, setPublish] = useState<OrgPublishPreset | null>(null);
  // 审核结果未读：打开详情即视为已读，本次停留期间在「当前提审」旁保留圆点。
  const reviewUpdates = usePluginReviewUpdates();
  const unread = reviewUpdates.updates.find(update => update.pluginId === id && update.unread);
  const [freshResult, setFreshResult] = useState<{ tone: 'done' | 'error' } | null>(null);
  useEffect(() => {
    if (!unread || !plugin) return;
    setFreshResult({ tone: unread.status === 'approved' || unread.status === 'enabled' ? 'done' : 'error' });
    void reviewUpdates.markRead(unread.pluginId, unread.key);
  }, [unread, plugin, reviewUpdates]);

  useEffect(() => orgDemo().subscribe(() => setVersion(v => v + 1)), []);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([orgDemo().detail(id), orgDemo().departments(), orgDemo().members()]).then(([p, d, m]: [OrgPlugin, Department[], Member[]]) => {
      if (!cancelled) { setPlugin(p); setDepartments(d); setMembers(m); }
    });
    return () => { cancelled = true; };
  }, [id, version]);

  const local: DemoLocalPlugin | undefined = plugin
    ? orgDemo().localPlugins().find((item: DemoLocalPlugin) => item.ghostId === plugin.ghostId) : undefined;
  const localBlocked: string | null = local ? orgDemo().unavailable(local, 'org') : null;
  const latest = plugin?.releases[0];
  const listed = Boolean(plugin?.listedVersion);

  const run = useCallback(async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try { await action(); toast.success(done); } finally { setBusy(null); }
  }, []);

  const unlist = async () => {
    if (!plugin) return;
    // 2026-11-19 用户定：作者只能「下架」——市场里看不到、不能新装，已安装的保留；卸载别人电脑上的插件只给管理员。
    const accepted = await confirm({
      title: `下架「${plugin.name}」？`,
      description: '成员看不到这个插件，也不能新安装；已安装的可以继续使用，但不再收到更新。之后可以重新上架。',
      confirmText: '下架',
      cancelText: '取消',
    });
    if (accepted) await run('unlist', () => orgDemo().setUnlisted(plugin.id, true), `${plugin.name} 已下架`);
  };
  const relist = async () => {
    if (!plugin) return;
    const accepted = await confirm({
      title: '上架插件',
      description: '上架这个插件？上架后，符合使用策略的成员可以使用。',
      confirmText: '上架',
      cancelText: '取消',
    });
    if (accepted) await run('relist', () => orgDemo().setUnlisted(plugin.id, false), `${plugin.name} 已上架`);
  };
  const removeMaintainer = async (member: Member) => {
    if (!plugin) return;
    const accepted = await confirm({
      title: `移除维护者 ${member.name}？`,
      description: '之后可以重新添加。',
      confirmText: '移除',
      cancelText: '取消',
      confirmVariant: 'destructive',
    });
    if (!accepted) return;
    await run(`rm-${member.id}`, () => orgDemo().removeMaintainer(plugin.id, member.id), `已移除 ${member.name}`);
  };
  const cancelReview = async () => {
    if (!plugin || !latest) return;
    const accepted = await confirm({
      title: `取消 ${plugin.name} ${latest.version} 的提审？`,
      description: `取消不影响当前上架版本。${latest.version} 已经提审，之后必须使用新版本号再提交。`,
      confirmText: '取消本次提审',
      cancelText: '保留提审',
    });
    if (accepted) await run('cancel', () => orgDemo().cancelReview(plugin.id), '已取消本次提审。当前上架版本不受影响。');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <main className="app-wallpaper-surface min-h-0 flex-1 overflow-y-auto bg-[var(--surface)]" onScroll={onScroll}>
        <PluginDetailTopBar label={backLabel} onBack={onBack} scrolled={scrolled} frameClassName={PLUGIN_MANAGEMENT_FRAME_CLASS} />
        <PluginManagementPage className="pt-6">
          {!plugin ? <p role="status" className={body}>正在加载…</p> : <>
            <header className="mb-6 flex min-w-0 items-start gap-4">
              <GhostPluginIcon iconId={plugin.ghostId} iconName={plugin.name} size="detail" />
              <div className="min-w-0">
                <h1 className="break-words text-20 font-medium leading-7 text-[var(--text-primary)]">{plugin.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-13 leading-5 text-[var(--text-tertiary)]">
                  <span>{members.find(m => m.id === orgDemo().meId)?.name ?? ''}</span>
                  {listed && !plugin.unlisted ? <><span aria-hidden="true">·</span><span>v{plugin.listedVersion}</span></> : null}
                  {listed ? <>
                    <span aria-hidden="true">·</span>
                    <Tip text="累计下载请求次数：成功获取安装包下载地址后计一次，包括更新、重装及重新获取地址的重试；不代表成功安装次数。">
                      <span className="inline-flex items-center gap-1"><ArrowDownToLine size={13} aria-hidden="true" />{plugin.downloads.toLocaleString('zh-CN')} 次下载</span>
                    </Tip>
                    <span aria-hidden="true">·</span>
                    <Tip text="当前共享范围内各版本累计的工具调用次数。">
                      <span className="inline-flex items-center gap-1"><Activity size={13} aria-hidden="true" />{plugin.toolCalls.toLocaleString('zh-CN')} 次使用</span>
                    </Tip>
                  </> : null}
                </div>
              </div>
            </header>

            {/* 与公开插件详情同一排概览（PluginVersionFacts 同样式、同说法） */}
            <dl className="mb-6 grid grid-cols-3 gap-x-6 gap-y-3 border-y border-[var(--border-default)] py-3 max-[600px]:grid-cols-1">
              {([
                ['本地版本', local ? local.version : '本机未安装'],
                ['已上架', listed ? (plugin.unlisted ? '已下架' : plugin.listedVersion!) : '尚未上架'],
                ['待审核', latest?.state === 'pending' ? latest.version : '无待审核版本'],
              ] as const).map(([label, value]) => <div key={label} className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <dt className="text-12 leading-5 text-[var(--text-tertiary)]">{label}</dt>
                <dd className="break-words text-14 font-medium leading-5 text-[var(--text-primary)]">{value}</dd>
              </div>)}
            </dl>

            <div className="space-y-6 pb-8">
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className={h2}>本地版本</h2>
                    <p className={body}>{local ? `${local.version} · 本地开发` : '本机未安装'}</p>
                  </div>
                  {local && !localBlocked ? (
                    <Button variant="cta" size="sm" onClick={() => void window.electronAPI.pluginPublisher.start(local.id)}>
                      提交 {local.version} 审核
                    </Button>
                  ) : null}
                </div>
                {local && localBlocked ? <p role="status" className="text-12 leading-5 text-[var(--text-tertiary)]">{localBlocked}</p> : null}
              </section>

              <section className={section}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className={h2}>可见范围</h2>
                  <Button variant="secondary" size="sm" onClick={() => setScopeOpen(true)}>修改</Button>
                </div>
                <p className="text-14 leading-6 text-[var(--text-primary)]">
                  {plugin.scope.mode === 'all' ? `${orgName}全部成员` : plugin.scope.departmentIds
                    .map(depId => departments.find(d => d.id === depId)?.name ?? members.find(m => m.id === depId)?.name ?? '已失效').join('、')}
                </p>
              </section>

              <section className={section}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className={h2}>维护者</h2>
                  {plugin.creatorId === orgDemo().meId ? <Button variant="secondary" size="sm" onClick={() => setMaintainerOpen(true)}><Plus size={14} />添加</Button> : null}
                </div>
                <ul className="divide-y divide-[var(--border-default)] rounded-lg border border-[var(--border-default)]">
                  {[plugin.creatorId, ...plugin.maintainerIds].map(memberId => {
                    const member = members.find(m => m.id === memberId);
                    if (!member) return null;
                    const creator = memberId === plugin.creatorId;
                    const self = memberId === orgDemo().meId;
                    return (
                      <li key={memberId} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="text-14 leading-5 text-[var(--text-primary)]">{member.name}{self ? <span className="text-[var(--text-tertiary)]">（你）</span> : null}</span>
                          <span className="ml-2 text-12 leading-5 text-[var(--text-tertiary)]">{member.department}</span>
                        </span>
                        {/* 2026-11-19 定：只有创建者能添加 / 移除维护者；创建者不能被移除；没有「退出」。 */}
                        {creator ? <span className="text-12 text-[var(--text-tertiary)]">创建者</span> : self || plugin.creatorId !== orgDemo().meId ? null : (
                          <Button variant="secondary" tone="quiet" size="xs" loading={busy === `rm-${memberId}`} disabled={Boolean(busy)}
                            onClick={() => void removeMaintainer(member)}>移除</Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className={section}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className={h2}>已上架{listed && !plugin.unlisted ? ` · ${plugin.listedVersion}` : ''}</h2>
                  {listed ? plugin.unlisted ? plugin.unlistedByAdmin ? null : (
                    <Button variant="secondary" size="sm" loading={busy === 'relist'} disabled={Boolean(busy)}
                      onClick={() => void relist()}>上架</Button>
                  ) : (
                    <Button variant="secondary" size="sm" loading={busy === 'unlist'} disabled={Boolean(busy)}
                      onClick={() => void unlist()}>下架</Button>
                  ) : null}
                </div>
                <p className={body}>
                  {!listed ? '尚未上架' : plugin.unlisted ? (plugin.unlistedByAdmin ? `已下架 · ${plugin.listedVersion}。管理员已下架，需由管理员重新上架。` : `已下架 · ${plugin.listedVersion}`) : plugin.description}
                </p>
              </section>

              <section className={section}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className={`${h2} flex items-center gap-2`}>当前提审{freshResult ? <span role="img" className="inline-flex" aria-label="新的审核结果"><AttentionDot tone={freshResult.tone} /></span> : null}</h2>
                  {latest?.state === 'pending' ? (
                    <Button variant="secondary" size="sm" loading={busy === 'cancel'} disabled={Boolean(busy)}
                      onClick={() => void cancelReview()}>取消本次提审</Button>
                  ) : null}
                </div>
                {latest ? <>
                  <p className="flex flex-wrap gap-x-2 text-14 leading-6 text-[var(--text-primary)]">{latestLabel(plugin)}</p>
                  <dl className="flex flex-wrap gap-x-6 gap-y-2 text-12 leading-5 text-[var(--text-tertiary)]"><div className="flex gap-2"><dt>提审时间</dt><dd>{formatTime(latest.at)}</dd></div></dl>
                  {latest.reason ? <p className="select-text whitespace-pre-wrap break-words text-14 leading-6 text-[var(--text-primary)]">{latest.reason}</p> : null}
                </> : <p className={body}>尚未提交</p>}
              </section>

              <details open className="group/history border-t border-[var(--border-default)] pt-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-13 font-medium leading-5 text-[var(--text-secondary)] [&::-webkit-details-marker]:hidden">
                  <ChevronRight size={14} aria-hidden="true" className="shrink-0 group-open/history:rotate-90" />
                  发布记录
                </summary>
                <ol className="space-y-3 pt-4">
                  {plugin.releases.map(r => (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[var(--border-default)] p-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap gap-x-2 text-14 leading-6 text-[var(--text-primary)]">
                          <span>{r.version}</span><span aria-hidden="true">·</span>
                          <span>{r.state === 'approved' && r.version === plugin.listedVersion ? (plugin.unlisted ? '已下架' : '已上架') : releaseLabel[r.state]}</span>
                        </p>
                        <p className="text-13 leading-5 text-[var(--text-tertiary)]">{formatTime(r.at)}</p>
                        {r.reason ? <p className="mt-1 text-13 leading-5 text-[var(--text-secondary)]">{r.reason}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          </>}
        </PluginManagementPage>
      </main>
      {plugin ? (
        <ScopeDialog open={scopeOpen} onOpenChange={setScopeOpen} plugin={plugin} departments={departments} members={members}
          onSave={scope => run('scope', () => orgDemo().setScope(plugin.id, scope), '可见范围已更新').then(() => setScopeOpen(false))} />
      ) : null}
      {plugin ? (
        <MaintainerDialog open={maintainerOpen} onOpenChange={setMaintainerOpen} members={members}
          exclude={[plugin.creatorId, ...plugin.maintainerIds]}
          onAdd={member => run(`add-${member.id}`, () => orgDemo().addMaintainer(plugin.id, member.id), `已添加 ${member.name}`).then(() => setMaintainerOpen(false))} />
      ) : null}
      <OrgPublishDialog open={Boolean(publish)} preset={publish ?? undefined} departments={departments}
        onOpenChange={open => { if (!open) setPublish(null); }} />
    </div>
  );
}

function ScopeDialog({ open, onOpenChange, plugin, departments, members, onSave }: {
  open: boolean; onOpenChange: (open: boolean) => void; plugin: OrgPlugin; departments: Department[]; members: Member[];
  onSave: (scope: OrgScope) => Promise<void>;
}) {
  const [scope, setScope] = useState<OrgScope>(plugin.scope);
  const [valid, setValid] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setScope(plugin.scope); }, [open, plugin.scope]);
  const changed = scope.mode !== plugin.scope.mode
    || scope.departmentIds.join() !== plugin.scope.departmentIds.join();
  const orgName: string = orgDemo().orgName;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-scrim fixed inset-0 z-[10000]" />
        <Dialog.Content aria-describedby={undefined} onInteractOutside={event => event.preventDefault()}
          className="modal-panel fixed left-1/2 top-1/2 z-[10000] flex max-h-[85vh] w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col p-4">
          <Dialog.Title className="text-18 font-medium text-[var(--text-primary)]">修改可见范围</Dialog.Title>
          <div className="my-4 min-h-0 overflow-y-auto p-1">
            <OrgScopeField hideLegend value={scope} onChange={next => { setScope(next); setValid(next.mode === 'all' || next.departmentIds.length > 0); }}
              departments={departments} members={members} disabled={saving} />
            {changed && valid ? (
              <p className="mt-3 text-13 leading-5 text-[var(--text-secondary)]">
                保存后，{scope.mode === 'all' ? `${orgName}全部成员` : scopeLabel(scope, departments, members)}可以安装。不在范围内的成员，已安装的插件会保留，但不再获得更新。
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Dialog.Close asChild><Button variant="secondary">取消</Button></Dialog.Close>
            <Button variant="cta" loading={saving} disabled={!changed || !valid || saving}
              onClick={() => { setSaving(true); void onSave(scope).finally(() => setSaving(false)); }}>保存</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MaintainerDialog({ open, onOpenChange, members, exclude, onAdd }: {
  open: boolean; onOpenChange: (open: boolean) => void; members: Member[]; exclude: string[];
  onAdd: (member: Member) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  useEffect(() => { if (open) { setQuery(''); setAdding(null); } }, [open]);
  const q = query.trim();
  const candidates = members.filter(m => !exclude.includes(m.id) && (!q || m.name.includes(q) || m.department.includes(q)));
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-scrim fixed inset-0 z-[10000]" />
        <Dialog.Content aria-describedby={undefined}
          className="modal-panel fixed left-1/2 top-1/2 z-[10000] flex max-h-[70vh] w-[calc(100vw-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 flex-col p-4">
          <Dialog.Title className="text-18 font-medium text-[var(--text-primary)]">添加维护者</Dialog.Title>
          <div className="mt-4 shrink-0"><Input autoFocus value={query} onChange={setQuery} placeholder="搜索成员或部门" aria-label="搜索成员或部门" /></div>
          <ul className="mt-2 min-h-0 flex-1 overflow-y-auto">
            {candidates.map(m => (
              <li key={m.id}>
                <button type="button" disabled={Boolean(adding)}
                  onClick={() => { setAdding(m.id); void onAdd(m).finally(() => setAdding(null)); }}
                  className="flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-[var(--surface-hover)] disabled:opacity-60">
                  <span className="min-w-0 flex-1">
                    <span className="block text-14 leading-5 text-[var(--text-primary)]">{m.name}</span>
                    <span className="block text-12 leading-4 text-[var(--text-tertiary)]">{m.department}</span>
                  </span>
                  <span className="text-13 text-[var(--text-secondary)]">{adding === m.id ? '添加中…' : '添加'}</span>
                </button>
              </li>
            ))}
            {candidates.length === 0 ? <li className="py-6 text-center text-13 text-[var(--text-tertiary)]">没有匹配的成员</li> : null}
          </ul>
          <div className="mt-3 flex shrink-0 justify-end">
            <Dialog.Close asChild><Button variant="secondary">完成</Button></Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

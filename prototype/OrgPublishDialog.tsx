// 原型（2026-11-17）：发布插件时先选「发布到」，企业发布再选可见成员。只走体验数据。
import * as Dialog from '@radix-ui/react-dialog';
import { Building2, Check, Globe } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { GhostPluginIcon } from '../GhostPluginIcon';
import { orgDemo, scopeLabel, type DemoLocalPlugin, type Department, type Destination, type OrgScope } from './shared';

export interface OrgPublishPreset {
  localId?: string;
  destination?: Destination;
  /** 从某个插件详情进入时，去向已经确定，不再让用户改。 */
  lockDestination?: boolean;
}

export function OrgPublishDialog({ open, preset, departments, onOpenChange }: {
  open: boolean;
  preset?: OrgPublishPreset;
  departments: Department[];
  onOpenChange: (open: boolean) => void;
}) {
  const locals: DemoLocalPlugin[] = orgDemo().localPlugins();
  const orgName: string = orgDemo().orgName;
  // 个人账号只能发公开市场，不显示「发布到」。
  const personal: boolean = orgDemo().personal;
  const [destination, setDestination] = useState<Destination>(personal ? 'public' : preset?.destination ?? 'org');
  const [selection, setSelection] = useState<string | null>(preset?.localId ?? null);
  const [scope, setScope] = useState<OrgScope>({ mode: 'all', departmentIds: [] });
  const [scopeValid, setScopeValid] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDestination(personal ? 'public' : preset?.destination ?? 'org');
    setSelection(preset?.localId ?? null);
    setBusy(false);
  }, [open, preset]);

  const local = locals.find(item => item.id === selection);
  // 已发布到企业的插件沿用现有可见成员；新插件默认全部成员。
  useEffect(() => {
    if (!local) return;
    setScope(orgDemo().existingScope(local) ?? { mode: 'all', departmentIds: [] });
  }, [local]);

  const unavailable = useCallback((item: DemoLocalPlugin): string | null =>
    orgDemo().unavailable(item, destination), [destination]);
  useEffect(() => {
    if (local && unavailable(local)) setSelection(null);
  }, [local, unavailable]);

  const canSubmit = Boolean(local) && !unavailable(local!) && !busy;
  void scopeValid; void setScopeValid;
  const audienceText = useMemo(() => destination === 'org'
    ? (scope.mode === 'all' ? `${orgName}全部成员` : scopeLabel(scope, departments))
    : '所有 Cindy 用户', [destination, scope, departments, orgName]);

  const submit = async () => {
    if (!local || !canSubmit) return;
    if (destination === 'org') {
      // 企业发布：关闭本弹窗，走 Host 发布流程，由确认屏收集可见成员。
      onOpenChange(false);
      await window.electronAPI.pluginPublisher.start(local.id);
      return;
    }
    setBusy(true);
    try {
      await orgDemo().publish({ localId: local.id, destination, ...(destination === 'org' ? { scope } : {}) });
      toast.success(`已提交 ${local.name} ${local.version} 审核`);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const destinationCard = (value: Destination, icon: React.ReactNode, label: string, description: string) => {
    const selected = destination === value;
    const disabled = preset?.lockDestination && !selected;
    return (
      <button type="button" disabled={disabled} aria-pressed={selected}
        onClick={() => setDestination(value)}
        className={cn('flex min-w-0 flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
          selected ? 'border-[var(--settings-theme-preview-border-active)]' : 'border-[var(--cmd-palette-border)] hover:border-[var(--file-chip-bg)]',
          disabled && 'cursor-not-allowed opacity-50 hover:border-[var(--cmd-palette-border)]')}>
        <span className="flex items-center gap-2">
          <span className={selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}>{icon}</span>
          <span className="text-14 font-medium text-[var(--text-primary)]">{label}</span>
        </span>
        <span className="text-12 leading-[1.4] text-[var(--text-tertiary)]">{description}</span>
      </button>
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-scrim fixed inset-0 z-[10000]" />
        <Dialog.Content onInteractOutside={event => event.preventDefault()} aria-describedby={undefined}
          className="modal-panel fixed left-1/2 top-1/2 z-[10000] flex max-h-[85vh] w-[calc(100vw-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col p-4">
          <Dialog.Title className="text-18 font-medium text-[var(--text-primary)]">
            {preset?.lockDestination && local ? `提交 ${local.name} 新版本` : '发布插件'}
          </Dialog.Title>
          <div className="my-4 min-h-0 space-y-5 overflow-y-auto p-1">
            {personal ? null : <section className="space-y-2">
              <h3 className="text-13 text-[var(--text-secondary)]">发布到</h3>
              <div className="grid grid-cols-2 gap-2">
                {destinationCard('org', <Building2 size={14} />, '团队共享', `${orgName}成员可安装`)}
                {destinationCard('public', <Globe size={14} />, '公开市场', '所有 Cindy 用户可安装')}
              </div>
            </section>}

            {!preset?.lockDestination ? (
              <section className="space-y-1">
                <h3 className="mb-2 text-13 text-[var(--text-secondary)]">插件</h3>
                {locals.map(item => {
                  const reason = unavailable(item);
                  const selected = selection === item.id;
                  return (
                    <button type="button" key={item.id} disabled={Boolean(reason) || busy}
                      aria-pressed={selected} onClick={() => setSelection(item.id)}
                      className={cn('flex w-full min-w-0 items-center gap-3 rounded-lg border px-2 py-2.5 text-left enabled:hover:bg-[var(--surface-hover)] disabled:cursor-default',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]',
                        selected ? 'border-[var(--border-default)] bg-[var(--surface-hover)]' : 'border-transparent')}>
                      <GhostPluginIcon iconId={item.ghostId} iconName={item.name} />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-14 font-medium leading-5', reason ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]')}>
                          {item.name} <span className="font-normal text-[var(--text-tertiary)]">· {item.version}</span>
                        </span>
                        <span className="mt-0.5 block text-12 leading-4 text-[var(--text-tertiary)]">{reason ?? item.ghostId}</span>
                      </span>
                      {selected ? <Check size={16} aria-hidden="true" className="shrink-0 text-[var(--text-primary)]" /> : null}
                    </button>
                  );
                })}
              </section>
            ) : null}

            {/* 企业：可见成员在下一步的确认屏里选（与 AI 对话发布同一个确认屏）。 */}

            {local ? (
              <section className="space-y-2 border-t border-[var(--border-default)] pt-3 text-13 leading-5 text-[var(--text-secondary)]">
                <p className="font-medium text-[var(--text-primary)]">{local.name} · {local.version}</p>
                <p className="whitespace-pre-wrap break-words">{local.description}</p>
                {destination === 'public' ? <p>审核通过后，{audienceText}可以安装。</p> : null}
              </section>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">取消</Button>
            </Dialog.Close>
            <Button variant="cta" loading={busy} disabled={!canSubmit} onClick={() => void submit()}>
              {destination === 'org' ? '下一步' : local ? `提交 ${local.version} 审核` : '提交审核'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

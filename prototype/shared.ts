// 原型（2026-11-17）：「我的插件」合并企业插件。数据来自仓库外体验数据，不进产品提交。
import { useEffect, useState } from 'react';

export type OrgScope = { mode: 'all' | 'departments'; departmentIds: string[] };
export type OrgRelease = {
  id: string; version: string; at: string;
  state: 'pending' | 'approved' | 'rejected' | 'failed' | 'cancelled';
  reason?: string | null;
};
export type OrgPlugin = {
  id: string; ghostId: string; name: string; description: string;
  listedVersion: string | null; unlisted: boolean; unlistedByAdmin?: boolean; installs: number;
  scope: OrgScope; releases: OrgRelease[]; updatedAt: string;
  downloads: number; toolCalls: number;
  creatorId: string; maintainerIds: string[];
};
export type Member = { id: string; name: string; department: string };
export type Department = { id: string; name: string; parentId: string | null };
export type DemoLocalPlugin = { id: string; ghostId: string; name: string; version: string; description: string; publicPluginId?: string };
export type Destination = 'org' | 'public';
export type RowFilter = 'all' | 'pending' | 'needs_action' | 'published';

// 仅原型：本地 vite 把下面这个调用替换成仓库外体验数据，真实客户端没有这个接口。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const orgDemo = (): any =>
  // @ts-expect-error 原型注入
  window.electronAPI.orgPluginsDemo;

export const isOrgId = (id: string | null | undefined) => Boolean(id?.startsWith('org:'));

export const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

export const releaseLabel: Record<OrgRelease['state'], string> = {
  pending: '待审核', approved: '审核通过', rejected: '已退回', failed: '上传失败', cancelled: '已取消',
};

export function listedLabel(p: OrgPlugin): string {
  if (!p.listedVersion) return '未上架';
  return p.unlisted ? '已下架' : p.listedVersion;
}

export function latestLabel(p: OrgPlugin): string {
  const r = p.releases[0];
  if (!r) return '尚未提交';
  if (r.state === 'approved' && r.version === p.listedVersion) return `${r.version} · ${p.unlisted ? '已下架' : '已上架'}`;
  return `${r.version} · ${releaseLabel[r.state]}`;
}

export function matchesFilter(p: OrgPlugin, filter: RowFilter, query: string): boolean {
  const q = query.trim();
  if (q && !p.name.includes(q) && !p.ghostId.includes(q)) return false;
  const s = p.releases[0]?.state;
  if (filter === 'pending') return s === 'pending';
  if (filter === 'needs_action') return s === 'rejected' || s === 'failed';
  if (filter === 'published') return Boolean(p.listedVersion) && !p.unlisted;
  return true;
}

export function scopeLabel(scope: OrgScope, departments: Department[], members: Member[] = []): string {
  if (scope.mode === 'all') return '全部成员';
  const names = scope.departmentIds.map(id => departments.find(d => d.id === id)?.name ?? members.find(m => m.id === id)?.name ?? '已失效');
  if (names.length <= 2) return names.join('、');
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 项`;
}

/** 企业插件与部门数据；体验数据变化时自动刷新。 */
export function useOrgData() {
  const [plugins, setPlugins] = useState<OrgPlugin[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => orgDemo().subscribe(() => setVersion(v => v + 1)), []);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([orgDemo().list(), orgDemo().departments(), orgDemo().members()]).then(([list, depts, mems]: [OrgPlugin[], Department[], Member[]]) => {
      if (cancelled) return;
      setPlugins(list); setDepartments(depts); setMembers(mems);
    });
    return () => { cancelled = true; };
  }, [version]);
  return { plugins, departments, members, version };
}

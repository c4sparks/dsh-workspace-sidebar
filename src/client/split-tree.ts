/**
 * dsh-workspace-sidebar — 分屏树纯逻辑（split-tree）。
 *
 * 独立模块：分屏的树结构操作集中在这里，便于增强 / 测试；
 * 是否启用分屏由 `WorkspaceState.splitEnabled` 控制（settings「布局配置」）。
 */
import type { SplitNode } from "./types";

/** 在树中把 paneId 叶子替换为 split（新面板按 dir 方向放 after=前/后）。 */
export function splitNodeAt(node: SplitNode, paneId: string, dir: 'row' | 'col', newPaneId: string, after: boolean): SplitNode {
  if (node.kind === 'leaf') {
    if (node.paneId !== paneId) return node
    const leaves: SplitNode[] = after
      ? [{ kind: 'leaf', paneId }, { kind: 'leaf', paneId: newPaneId }]
      : [{ kind: 'leaf', paneId: newPaneId }, { kind: 'leaf', paneId }]
    return { kind: 'split', dir, weights: [1, 1], children: leaves }
  }
  return { ...node, children: node.children.map((c) => splitNodeAt(c, paneId, dir, newPaneId, after)) }
}

/** 移除 paneId 叶子；父 split 只剩一个孩子时折叠。 */
export function closeNodeAt(node: SplitNode, paneId: string): SplitNode | null {
  if (node.kind === 'leaf') return node.paneId === paneId ? null : node
  const children: SplitNode[] = []
  const weights: number[] = []
  node.children.forEach((c, i) => {
    const r = closeNodeAt(c, paneId)
    if (r !== null) { children.push(r); weights.push(node.weights[i] ?? 1) }
  })
  if (children.length === 0) return null
  if (children.length === 1) return children[0]
  return { kind: 'split', dir: node.dir, weights, children }
}

/** 树中所有叶子 paneId。 */
export function leavesOf(node: SplitNode): string[] {
  if (node.kind === 'leaf') return [node.paneId]
  return node.children.flatMap(leavesOf)
}

/** 校验分屏树：非空、weights 合法；非法返回 null。 */
export function sanitizeSplitNode(node: SplitNode): SplitNode | null {
  if (node.kind === 'leaf') {
    if (typeof node.paneId !== 'string' || node.paneId === '') return null;
    return { kind: 'leaf', paneId: node.paneId };
  }
  if (node.kind !== 'split' || !Array.isArray(node.children) || node.children.length < 2) return null;
  const children: SplitNode[] = [];
  for (const c of node.children) {
    const s = sanitizeSplitNode(c as SplitNode);
    if (s !== null) children.push(s);
  }
  if (children.length < 2) return null;
  const weights = Array.isArray(node.weights)
    ? node.weights.slice(0, children.length).map((w) => (typeof w === 'number' && isFinite(w) && w > 0 ? w : 1))
    : children.map(() => 1);
  while (weights.length < children.length) weights.push(1);
  return { kind: 'split', dir: node.dir === 'col' ? 'col' : 'row', weights, children };
}

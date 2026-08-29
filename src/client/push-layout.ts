/**
 * dsh-workspace-sidebar — 停靠面板「推挤」宿主布局的副作用（宿主 DOM 知识集中在此）。
 *
 * 右面板 → `#root { margin-right + width: calc(100% - effRightW) }`（对话左推，只动右缘、
 * 侧边栏不受影响）；底面板 → **主内容列**（`[data-slot="conversation"]` 的父元素，含对话 +
 * 输入框等）`margin-bottom + height: calc(100% - 高度)` **整体上推**，侧边栏（兄弟列）
 * 纹丝不动；左面板**覆盖不推挤**。右 + 底可**同时推挤**（互不冲突）。拖动时禁用过渡（丝滑跟手）。
 *
 * 宿主布局结构一旦变化，只需改本文件。返回 cleanup（卸载 / 依赖变化时复位样式）。
 */

export interface PushLayoutSpec {
  rightOpen: boolean;
  effRightW: number;
  bottomOpen: boolean;
  effBottomH: number;
  dragActive: boolean;
}

export function applyPushLayout(spec: PushLayoutSpec): () => void {
  const root = document.getElementById("root");
  const conv = document.querySelector("[data-slot=\"conversation\"]") as HTMLElement | null;
  const main = conv && conv.parentElement ? conv.parentElement : null;
  if (root) {
    const st = root.style;
    st.transition = spec.dragActive ? "none" : "margin-right .25s ease, width .25s ease";
    st.marginRight = spec.rightOpen ? spec.effRightW + "px" : "";
    st.width = spec.rightOpen ? "calc(100% - " + spec.effRightW + "px)" : "";
  }
  if (main) {
    const ms = main.style;
    ms.transition = spec.dragActive ? "none" : "margin-bottom .25s ease, height .25s ease";
    if (spec.bottomOpen) {
      ms.boxSizing = "border-box";
      ms.marginBottom = spec.effBottomH + "px";
      ms.height = "calc(100% - " + spec.effBottomH + "px)";
    } else {
      ms.boxSizing = ""; ms.marginBottom = ""; ms.height = "";
    }
  }
  return function cleanup() {
    if (root) { const st = root.style; st.transition = ""; st.marginRight = ""; st.width = ""; }
    if (main) { const ms = main.style; ms.transition = ""; ms.boxSizing = ""; ms.marginBottom = ""; ms.height = ""; }
  };
}

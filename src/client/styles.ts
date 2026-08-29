/**
 * dsh-workspace-sidebar — 样式定义与注入（作用域化，跟随 dsh 主题 token）。
 *
 * 从 constants.ts 抽出：constants.ts 只留纯值，本文件管 CSS 字符串 + 一次性 <style>
 * 注入（纯值 + DOM 副作用，无 React 依赖）。
 */
import { CLS } from "./constants";

/** 工作台覆盖层样式表（作用域化，跟随 dsh 主题 token）。 */
export const CSS = [
  "." + CLS + "-overlay{position:fixed;top:0;right:0;bottom:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#333);font-family:system-ui,sans-serif;font-size:14px}",
  // 每模式独立进入动画名（dsws-enter-<mode>）：模式切换时动画名必变 → 必然重放，
  // 方向始终正确且一致（底从下往上、右从右往左、左从左往右、全屏从右）
  "@keyframes dsws-enter-fullscreen{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}",
  "@keyframes dsws-enter-left{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}",
  "@keyframes dsws-enter-right{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}",
  "@keyframes dsws-enter-bottom{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}",
  "." + CLS + "-toolbar{display:flex;align-items:center;gap:4px;flex:0 0 auto;height:34px;padding:0 8px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));background:var(--dsw-alias-bg-layer-1,#f7f7f8);overflow-x:auto;scrollbar-width:none}",
  "." + CLS + "-toolbar::-webkit-scrollbar{display:none}",
  "." + CLS + "-modeBtn{width:30px;height:30px;padding:0;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#666);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}",
  "." + CLS + "-modeBtn{width:30px;height:30px;padding:0;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#666);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;transition:background .12s,color .12s}",
  "." + CLS + "-modeBtn:hover{background:var(--dsw-alias-interactive-bg-hover,#ececee)}",
  // 激活态用 !important：hover 特异性(0,2,0)会盖过激活态(0,1,0)，导致点击后看不出高亮
  // 激活态 = 灰底 + 蓝图标（点击后一直蓝，hover 不盖）
  "." + CLS + "-modeBtnActive{background:var(--dsw-alias-interactive-bg-hover,#e4e6eb)!important;color:#3b82f6!important;font-weight:600}",
  "." + CLS + "-footerModes{display:flex;gap:2px;flex-wrap:nowrap;flex:0 1 auto;min-width:0;overflow:hidden;align-items:center}",
  "." + CLS + "-footerMode{width:28px;height:28px;padding:0;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#666);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:0 1 auto;min-width:0;transition:background .12s,color .12s}",
  "." + CLS + "-footerMode:hover{background:var(--dsw-alias-interactive-bg-hover,#ececee)}",
  // 激活态 !important：hover 特异性(0,2,0)会盖过激活态(0,1,0)，导致点击后看不出高亮
  // 激活态 = 灰底 + 蓝图标
  "." + CLS + "-footerModeActive{background:var(--dsw-alias-interactive-bg-hover,#e4e6eb)!important;color:#3b82f6!important;font-weight:600}",
  "." + CLS + "-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,#333);white-space:nowrap}",
  "." + CLS + "-back{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#333);display:inline-flex;align-items:center;gap:4px;white-space:nowrap}",
  "." + CLS + "-back:hover{background:var(--dsw-alias-interactive-bg-hover,#ececee)}",
  "." + CLS + "-presets{display:flex;gap:4px}",
  "." + CLS + "-preset{border:1px solid transparent;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;background:transparent;color:var(--dsw-alias-label-secondary,#666)}",
  "." + CLS + "-preset:hover{background:var(--dsw-alias-interactive-bg-hover,#ececee)}",
  "." + CLS + "-presetActive{background:var(--dsw-alias-interactive-bg-hover,#e4e6eb);color:var(--dsw-alias-label-primary,#333);font-weight:600;border-color:var(--dsw-alias-border-l1,rgba(0,0,0,.08))}",
  "." + CLS + "-spacer{flex:1 1 auto}",
  "." + CLS + "-close{width:28px;height:28px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#666);font-size:14px;cursor:pointer;line-height:1}",
  "." + CLS + "-close:hover{background:var(--dsw-alias-interactive-bg-hover,#ececee)}",
  "." + CLS + "-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden}",
  "." + CLS + "-row{flex:1 1 auto;min-height:0;display:flex;flex-direction:row;overflow:hidden}",
  // position:relative → 拖拽拆分指示器（inset:0）的定位锚点落在区域内
  "." + CLS + "-region{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base,#fff)}",
  // 区域/面板间不画 border：分割线由拖拽手柄居中画出（跟随 --dsws-divider-* 设置），避免双线错位
  "." + CLS + "-regionLeft{flex:0 0 auto}",
  "." + CLS + "-regionRight{flex:0 0 auto}",
  "." + CLS + "-regionCenter{flex:1 1 auto}",
  "." + CLS + "-regionBottom{background:var(--dsw-alias-bg-layer-1,#f7f7f8);flex:0 0 auto}",
  "." + CLS + "-tabbar{display:flex;flex-direction:row;align-items:center;gap:2px;flex:0 0 auto;height:34px;padding:0 6px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));overflow-x:auto;scrollbar-width:none}",
  "." + CLS + "-tabbar::-webkit-scrollbar{display:none}",
  "." + CLS + "-tab{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border:none;border-radius:6px 6px 0 0;padding:6px 10px;font-size:12px;cursor:pointer;background:transparent;color:var(--dsw-alias-label-secondary,#666);touch-action:none;user-select:none;position:relative}",
  "." + CLS + "-tab:hover{background:var(--dsw-alias-interactive-bg-hover,#ececee)}",
  "." + CLS + "-tabActive{background:var(--dsw-alias-interactive-bg-hover,#e4e6eb);color:var(--dsw-alias-label-primary,#333);font-weight:600}",
  "." + CLS + "-tabIcon{display:inline-flex;align-items:center;justify-content:center;width:16px;flex:0 0 auto}",
  "." + CLS + "-tabLabel{overflow:hidden;text-overflow:ellipsis;max-width:180px}",
  // 关闭 / 新增按钮（每个 tab 的 ✕ + tabbar 末尾的 +）与 widget 选择弹层
  "." + CLS + "-tabClose{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;margin-left:2px;padding:0;border:none;border-radius:4px;background:transparent;color:inherit;font-size:10px;line-height:1;cursor:pointer;opacity:.65;flex:0 0 auto}",
  "." + CLS + "-tabClose:hover{background:rgba(0,0,0,.12);opacity:1}",
  "." + CLS + "-tabAdd{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#666);font-size:14px;line-height:1;cursor:pointer;flex:0 0 auto;margin-left:2px}",
  "." + CLS + "-tabAdd:hover{background:var(--dsw-alias-interactive-bg-hover,#ececee);color:var(--dsw-alias-state-business-primary,#3b82f6)}",
  "." + CLS + "-tabPickerBackdrop{position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.18)}",
  "." + CLS + "-tabPicker{position:fixed;z-index:41;max-height:240px;overflow:auto;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.12);padding:4px}",
  "." + CLS + "-tabPickerItem{display:flex;align-items:center;gap:6px;padding:6px 8px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary,#333);font-size:12px;text-align:left;cursor:pointer}",
  "." + CLS + "-tabPickerItem:hover{background:var(--dsw-alias-interactive-bg-hover,#ececee)}",
  "." + CLS + "-tabPickerIcon{display:inline-flex;align-items:center;justify-content:center;width:16px;flex:0 0 auto}",
  "." + CLS + "-groupLabel{font-size:12px;color:var(--dsw-alias-label-secondary,#999);margin-right:2px}",
  "." + CLS + "-pane{position:relative;flex:1 1 auto;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}",
  "." + CLS + "-regionBody{flex:1 1 auto;min-height:0;min-width:0;position:relative;overflow:hidden}",
  "." + CLS + "-widgetPane{position:absolute;inset:0;overflow:auto;scrollbar-width:none}",
  "." + CLS + "-widgetPane::-webkit-scrollbar{display:none}",
  "." + CLS + "-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;height:100%;padding:24px;text-align:center;color:var(--dsw-alias-label-secondary,#999);font-size:12px;line-height:1.6}",
  // 手柄固定 6px 拖拽热区；可见线 = var(--dsws-divider-width)（居中，1–3px）
  "." + CLS + "-resize{flex:0 0 6px;background:linear-gradient(90deg,transparent 0 calc(3px - var(--dsws-divider-width, 1px) / 2),var(--dsws-divider-color,var(--dsw-alias-border-l2,rgba(0,0,0,.12))) calc(3px - var(--dsws-divider-width, 1px) / 2) calc(3px + var(--dsws-divider-width, 1px) / 2),transparent calc(3px + var(--dsws-divider-width, 1px) / 2));touch-action:none;cursor:col-resize}",
  "." + CLS + "-resizeRow{flex:0 0 6px;background:linear-gradient(0deg,transparent 0 calc(3px - var(--dsws-divider-width, 1px) / 2),var(--dsws-divider-color,var(--dsw-alias-border-l2,rgba(0,0,0,.12))) calc(3px - var(--dsws-divider-width, 1px) / 2) calc(3px + var(--dsws-divider-width, 1px) / 2),transparent calc(3px + var(--dsws-divider-width, 1px) / 2));touch-action:none;cursor:row-resize}",
  "." + CLS + "-resize:hover{background:linear-gradient(90deg,transparent 0 calc(3px - var(--dsws-divider-width, 1px) / 2),var(--dsw-alias-state-business-primary,#3b82f6) calc(3px - var(--dsws-divider-width, 1px) / 2) calc(3px + var(--dsws-divider-width, 1px) / 2),transparent calc(3px + var(--dsws-divider-width, 1px) / 2));opacity:.9}",
  "." + CLS + "-resize[data-dragging]{background:linear-gradient(90deg,transparent 0 calc(3px - var(--dsws-divider-width, 1px) / 2),var(--dsw-alias-state-business-primary,#3b82f6) calc(3px - var(--dsws-divider-width, 1px) / 2) calc(3px + var(--dsws-divider-width, 1px) / 2),transparent calc(3px + var(--dsws-divider-width, 1px) / 2));opacity:1}",
  "." + CLS + "-resizeRow:hover{background:linear-gradient(0deg,transparent 0 calc(3px - var(--dsws-divider-width, 1px) / 2),var(--dsw-alias-state-business-primary,#3b82f6) calc(3px - var(--dsws-divider-width, 1px) / 2) calc(3px + var(--dsws-divider-width, 1px) / 2),transparent calc(3px + var(--dsws-divider-width, 1px) / 2));opacity:.9}",
  "." + CLS + "-resizeRow[data-dragging]{background:linear-gradient(0deg,transparent 0 calc(3px - var(--dsws-divider-width, 1px) / 2),var(--dsw-alias-state-business-primary,#3b82f6) calc(3px - var(--dsws-divider-width, 1px) / 2) calc(3px + var(--dsws-divider-width, 1px) / 2),transparent calc(3px + var(--dsws-divider-width, 1px) / 2));opacity:1}",
  "." + CLS + "-testContent{padding:20px;color:var(--dsw-alias-label-secondary,#666)}"
].join("");

/** 幂等注入工作台样式。 */
export function injectCss(): void {
  const tagId = "dsh-workspace-sidebar/styles.css";
  if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"" + tagId + "\"]") === null) {
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-workspace-sidebar";
    tag.dataset.pluginCss = tagId;
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }
}

/** 幂等注入 footer 纵向堆叠样式（多个侧车入口上下排列）。 */
export function injectFooterStackCss(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("dsh-workspace-footer-css")) return;
  const style = document.createElement("style");
  style.id = "dsh-workspace-footer-css";
  style.textContent = [
    "div:has(> [data-slot=\"sidebar.footer.action\"]){flex-direction:column !important;height:auto !important;gap:4px !important}",
    "[data-slot=\"sidebar.footer.action\"]{display:flex !important;flex-direction:column !important;gap:4px !important}",
    "[data-slot=\"sidebar.footer.action\"] > div{width:100% !important}"
  ].join("");
  document.head.appendChild(style);
}

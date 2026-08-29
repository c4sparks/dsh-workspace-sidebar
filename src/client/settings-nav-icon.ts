/**
 * dsh-workspace-sidebar — 给设置页左导航「工作台」分区打标记，供 CSS 换成 LayoutDashboard 图标。
 *
 * DSH 0.1.x 的 `settings.section` 注册只透传 id / order / label，设置页左导航的图标
 * 由宿主按内置 id 列表选择（外部插件统一给通用齿轮），注册契约没有 icon 字段。
 * settings-nav-icon：用 MutationObserver 找到文本等于本分区
 * label 的导航按钮，打上标记属性；注入的 CSS 隐藏宿主的齿轮 SVG、用 currentColor mask
 * 渲染 LayoutDashboard。标记在 fiber 卸载时移除（HMR 安全）。
 */

export const SETTINGS_NAV_MARKER = "data-dsh-workspace-settings-nav";

/** LayoutDashboard 的 Lucide SVG（URL 编码，作为 CSS mask 数据 URI）。 */
const LAYOUT_DASHBOARD_SVG = "%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='7' height='9' x='3' y='3' rx='1'/%3E%3Crect width='7' height='5' x='14' y='3' rx='1'/%3E%3Crect width='7' height='9' x='14' y='12' rx='1'/%3E%3Crect width='7' height='5' x='3' y='16' rx='1'/%3E%3C/svg%3E";

/** 把设置页左导航中文本等于本分区 label 的按钮打上标记（供 CSS 换图标）。 */
export function registerSettingsNavIcon(label: () => string): () => void {
  if (typeof document === "undefined") return function () {};
  let disposed = false;
  const sync = (): void => {
    if (disposed) return;
    const currentLabel = label().trim();
    const buttons = document.querySelectorAll<HTMLButtonElement>("[role=\"dialog\"] nav button");
    for (const button of buttons) {
      const matches = currentLabel.length > 0 && button.textContent?.trim() === currentLabel;
      if (matches) button.setAttribute(SETTINGS_NAV_MARKER, "");
      else button.removeAttribute(SETTINGS_NAV_MARKER);
    }
  };
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return function () {
    disposed = true;
    observer.disconnect();
    document.querySelectorAll("[" + SETTINGS_NAV_MARKER + "]").forEach(function (el) { el.removeAttribute(SETTINGS_NAV_MARKER); });
  };
}

/** 注入把标记导航按钮的齿轮换成 LayoutDashboard 的 CSS（幂等）。 */
export function injectSettingsNavIconCss(): void {
  if (typeof document === "undefined") return;
  const tagId = "dsh-workspace-sidebar/settings-nav-icon.css";
  if (document.querySelector("style[data-plugin-css=\"" + tagId + "\"]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-workspace-sidebar";
  tag.dataset.pluginCss = tagId;
  tag.textContent = [
    "[" + SETTINGS_NAV_MARKER + "] > svg:first-child{display:none}",
    "[" + SETTINGS_NAV_MARKER + "]::before{content:'';flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url(\"data:image/svg+xml," + LAYOUT_DASHBOARD_SVG + "\") center / contain no-repeat;mask:url(\"data:image/svg+xml," + LAYOUT_DASHBOARD_SVG + "\") center / contain no-repeat}"
  ].join("");
  document.head.appendChild(tag);
}

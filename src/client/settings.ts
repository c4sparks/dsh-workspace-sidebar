/**
 * src/client/settings.ts — 工作台设置分区（`settings.section` 槽位 UI）。
 *
 * 本文件是从 src/client/components.ts 中抽取出来的（原 createComponents 内部的
 * WorkspaceSettingsSection + NumberField，两者只被设置分区使用）。与组件同构：
 * 不 import 运行时 react，React 经 createSettingsSection(deps) 依赖注入；service
 * 由 plugin.ts 经 createDeferredService（./scope）产出后注入（apply 后即当前服务）。
 *
 * 设置是**声明式**的，分两层：
 * - L1 内部布局配置：`SETTINGS_FIELDS` schema，绑定 `service.layout`（read/write 访问器）。
 * - L2 第三方 插件设置：widget 在 `registerWidget` 里声明 `settings`，本分区按
 *   widget 分组渲染（判别联合 `WidgetSettingField` → 控件），值持久化到
 *   `pluginSettings[widgetId]`（独立 localStorage 键）。
 * 两层共用同一批控件渲染（NumberField / TextField / switch / select）。
 *
 * ── 联动修改说明（改动本文件时，以下位置必须同步检查/更新）──────────────
 *
 * 1. src/client/plugin.ts：`createSettingsSection({ React, icons, service })`，槽位注册不变。
 * 2. src/client/components.ts：已删除（2026-08 拆分到 footer / workspace-view / settings /
 *    scope / styles / push-layout）。
 * 3. 重新构建：`node scripts/build.mjs`（产物 lib/client.js / lib/index.js）。
 * 4. 运行时依赖：service.layout（L1 布局）+ service（getWidgets / getWidgetSettings /
 *    setWidgetSettings / resetWidgetSettings / subscribeWidgetSettings / getSettingsVersion）
 *    + icons.lucideIcon（LayoutDashboard）。
 * ──────────────────────────────────────────────────────────────────────────
 */
import type * as ReactTypes from "react";
import { createPluginSettingsSection } from "./plugin-settings";
import type { LayoutControl, WorkspaceService, WorkspaceState } from "./types";
import type { Icons } from "./icons";

export interface SettingsSectionDeps {
  React: typeof ReactTypes;
  icons: Icons;
  service: WorkspaceService;
}

/** 一条声明式布局设置项（L1 内部布局配置）：控件如何渲染 + 如何读 / 写 `service.layout`。 */
interface SettingsField {
  /** 唯一 key（渲染 key / 排错用）。 */
  key: string;
  label: string;
  /** 设置项说明（控件下方灰色小字）。 */
  desc?: string;
  type: "number" | "color" | "switch" | "radio" | "select";
  /** number 型钳制范围（提交时由 store clamp，这里是 UI 侧 min/max）。 */
  min?: number;
  max?: number;
  /** radio / select 型选项（value 存到 read/write）。 */
  options?: { value: string; label: string }[];
  /** 从布局状态读当前显示值（number 型返回 number，color 型返回 CSS 色串，switch 型返回 boolean）。 */
  read(state: WorkspaceState): number | string | boolean;
  /** 把控件值写回 `service.layout`（color 型传 `''` = 恢复 dsh token 默认）。 */
  write(layout: LayoutControl, value: number | string | boolean): void;
}

/** 布局配置项 schema（L1；新增布局设置项 = 在此加一行 + 同步 LayoutControl/store）。 */
const SETTINGS_FIELDS: SettingsField[] = [
  {
    key: "fullscreenDividers",
    label: "全屏分割线",
    desc: "大屏（全屏）页面是否显示区域分割线（默认关；停靠面板不受影响）",
    type: "switch",
    read: function (s) { return s.fullscreenDividers; },
    write: function (l, v) { l.setFullscreenDividers(v === true); }
  },
  {
    key: "dockMaxRatio",
    label: "停靠最大占比（%）",
    desc: "左/右/底停靠面板最大可拖到主内容区的比例（10–100）",
    type: "number",
    min: 10,
    max: 100,
    // store 存 0.1–1，UI 显示 10–100
    read: function (s) { return Math.round(s.dockMaxRatio * 100); },
    write: function (l, v) { l.setDockMaxRatio(Number(v) / 100); }
  },
  {
    key: "dividerWidth",
    label: "分割线粗细（px）",
    desc: "面板之间分割线的可见粗细",
    type: "select",
    // 只允许 1–6px：做成下拉选择，避免输入非法值（单位 px 已在标签里）
    options: [
      { value: "1", label: "1" },
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
      { value: "5", label: "5" },
      { value: "6", label: "6" }
    ],
    read: function (s) { return String(s.dividerWidth); },
    write: function (l, v) { l.setDividerWidth(Number(v)); }
  },
  {
    key: "dividerColor",
    label: "分割线颜色",
    desc: "分割线的颜色（留空 = 跟随主题）",
    type: "color",
    // 空串 = dsh token 默认；取色器用黑色占位（取色器无空值）
    read: function (s) { return s.dividerColor || "#000000"; },
    write: function (l, v) { l.setDividerColor(String(v)); }
  },
  {
    key: "multiPanel",
    label: "左/右/底同时展示",
    desc: "开：左/右/底三个停靠可同屏；关：独立展示（一次一个）",
    type: "switch",
    // 关 = 独立展示（一次一个，默认）；开 = 同时展示
    read: function (s) { return s.multiPanel; },
    write: function (l, v) { l.setMultiPanel(v === true); }
  },
  {
    key: "splitEnabled",
    label: "分屏拖拽",
    desc: "关：不可拖拽拆分，已有分屏只读保留",
    type: "switch",
    read: function (s) { return s.splitEnabled; },
    write: function (l, v) { l.setSplitEnabled(v === true); }
  }
];

export function createSettingsSection(deps: SettingsSectionDeps): {
  WorkspaceSettingsSection: ReactTypes.ComponentType;
} {
  const { React, icons, service } = deps;
  const useSyncExternalStore = React.useSyncExternalStore;

  /** 数字输入：本地草稿，失焦 / 回车才提交（避免输入中逐键触发被钳制）。 */
  function NumberField(props: { value: number; min: number; max: number; onCommit: (n: number) => void }): React.ReactNode {
    const draftState = React.useState(String(props.value));
    const draft = draftState[0];
    const setDraft = draftState[1];
    React.useEffect(function () { setDraft(String(props.value)); }, [props.value]);
    const commit = function () {
      const v = Number(draft);
      if (isFinite(v)) props.onCommit(v);
      else setDraft(String(props.value));
    };
    return React.createElement("input", {
      type: "number",
      min: props.min,
      max: props.max,
      value: draft,
      style: { border: "1.5px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 25%, transparent)", borderRadius: 6, padding: "4px 8px", fontSize: 13, width: 80, boxSizing: "border-box", background: "var(--dsw-alias-bg-base,#fff)" },
      onChange: function (e) { setDraft(e.target.value); },
      onBlur: commit,
      onKeyDown: function (e) { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }
    });
  }

  /** 文本输入：本地草稿，失焦 / 回车提交（同 NumberField 语义）。 */
  function TextField(props: { value: string; placeholder?: string; onCommit: (s: string) => void }): React.ReactNode {
    const draftState = React.useState(props.value);
    const draft = draftState[0];
    const setDraft = draftState[1];
    React.useEffect(function () { setDraft(props.value); }, [props.value]);
    const commit = function () { props.onCommit(draft); };
    return React.createElement("input", {
      type: "text",
      value: draft,
      placeholder: props.placeholder,
      style: { border: "1.5px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 25%, transparent)", borderRadius: 6, padding: "4px 8px", fontSize: 13, width: 160, background: "var(--dsw-alias-bg-base,#fff)", boxSizing: "border-box" },
      onChange: function (e) { setDraft(e.target.value); },
      onBlur: commit,
      onKeyDown: function (e) { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }
    });
  }

  // L2 插件设置卡片独立文件：plugin-settings.tsx（两列 + 手风琴 + 启停 + 声明式字段）
  const { PluginSettingsSection } = createPluginSettingsSection({ React, icons, service, NumberField: NumberField, TextField: TextField });

  /** 工作台设置分区（settings.section）：标题 + 简介 + L1 布局 + L2 各 插件设置 + 重置。 */
  function WorkspaceSettingsSection(): React.ReactNode {
    const state = useSyncExternalStore(service.layout.subscribeState, function () { return service.layout.getState(); });
    const noticeState = React.useState<string | null>(null);
    const notice = noticeState[0];
    const setNotice = noticeState[1];
    const resetHoverState = React.useState(false);
    const resetHover = resetHoverState[0];
    const setResetHover = resetHoverState[1];
    // 自定义确认弹窗（替代 window.confirm 原生网页弹框）
    const confirmOpenState = React.useState(false);
    const confirmOpen = confirmOpenState[0];
    const setConfirmOpen = confirmOpenState[1];
    const openResetConfirm = function () { setConfirmOpen(true); };
    const doReset = function () {
      setConfirmOpen(false);
      service.layout.reset();
      setNotice("已恢复默认值");
    };
    const inputStyle: ReactTypes.CSSProperties = { border: "1.5px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 25%, transparent)", borderRadius: 6, padding: "4px 8px", fontSize: 13, width: 80, background: "var(--dsw-alias-bg-base,#fff)", boxSizing: "border-box" };
    // L1 声明式渲染：一条 schema 行 → 一个控件（number → NumberField；color → 取色器 + 默认）
    const fieldControl = function (field: SettingsField): React.ReactNode {
      if (field.type === "radio") {
        const current = String(field.read(state));
        const opts = field.options ?? [];
        return React.createElement("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
          opts.map(function (o) {
            return React.createElement("label", {
              key: o.value,
              style: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--dsw-alias-label-secondary,#666)", cursor: "pointer" }
            },
              React.createElement("input", {
                type: "radio",
                name: field.key,
                value: o.value,
                checked: current === o.value,
                onChange: function () { field.write(service.layout, o.value); },
                style: { cursor: "pointer" }
              }),
              o.label
            );
          })
        );
      }
      if (field.type === "switch") {
        const on = field.read(state) === true;
        // open 开关按钮：轨道 + 滑块（开=蓝，关=灰）
        return React.createElement("button", {
          type: "button",
          role: "switch",
          "aria-checked": on,
          title: on ? "开：同时展示" : "关：独立展示（一次一个）",
          onClick: function () { field.write(service.layout, !on); },
          style: {
            width: 40, height: 22, borderRadius: 11, padding: 0, border: "none", cursor: "pointer",
            background: on ? "#3b82f6" : "#d1d5db", position: "relative", transition: "background .15s", flex: "0 0 auto"
          }
        }, React.createElement("span", {
          style: { position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: 9, background: "var(--dsw-alias-bg-base,#fff)", boxShadow: "0 1px 2px rgba(0,0,0,.2)", transition: "left .15s" }
        }));
      }
      if (field.type === "select") {
        const current = String(field.read(state));
        const opts = field.options ?? [];
        return React.createElement("select", {
          value: current,
          onChange: function (e) { field.write(service.layout, (e.target as HTMLSelectElement).value); },
          // 宽度与数字输入（停靠最大占比）一致，避免被 flex 撑宽
          style: { border: "1.5px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 25%, transparent)", borderRadius: 6, padding: "4px 8px", fontSize: 13, cursor: "pointer", width: 80, boxSizing: "border-box", background: "var(--dsw-alias-bg-base,#fff)" }
        }, opts.map(function (o) {
          return React.createElement("option", { key: o.value, value: o.value }, o.label);
        }));
      }
      if (field.type === "color") {
        return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
          React.createElement("input", {
            type: "color",
            value: field.read(state) as string,
            style: { ...inputStyle, width: 44, padding: 0, height: 28 },
            onChange: function (e) { field.write(service.layout, (e.target as HTMLInputElement).value); }
          }),
          React.createElement("button", {
            title: "恢复 dsh 默认",
            onClick: function () { field.write(service.layout, ""); },
            style: { border: "1.5px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 25%, transparent)", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer", background: "var(--dsw-alias-bg-base,#fff)", color: "var(--dsw-alias-label-secondary,#666)" }
          }, "默认")
        );
      }
      return React.createElement(NumberField, {
        value: field.read(state) as number,
        // UI 侧 min/max 属性；真正钳制在 store（LayoutControl），undefined 给宽松兜底
        min: field.min ?? 0,
        max: field.max ?? Number.MAX_SAFE_INTEGER,
        onCommit: function (v) { field.write(service.layout, v); }
      });
    };
    // L1 布局行：标签（固定宽右对齐）+ 控件 + 控件下方灰色说明（desc）
    const layoutRow = function (field: SettingsField): React.ReactNode {
      return React.createElement("div", { key: field.key, style: { display: "flex", alignItems: "flex-start", gap: 8 } },
        React.createElement("span", { style: { fontSize: 13, color: "var(--dsw-alias-label-secondary,#666)", width: 130, flex: "0 0 auto", textAlign: "right", paddingTop: 4 } }, field.label),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2, flex: "1 1 auto" } },
          fieldControl(field),
          field.desc ? React.createElement("span", { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary,#999)", lineHeight: 1.4 } }, field.desc) : null
        )
      );
    };
    // 分组框：布局配置 / 插件设置 各自一个框（border + 圆角，透明背景不泛灰）
    const boxStyle: ReactTypes.CSSProperties = {
      border: "1.5px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 25%, transparent)",
      borderRadius: 10,
      background: "transparent",
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 8
    };
    return React.createElement(
      "div",
      { "data-dsh-workspace-settings-section": "", style: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 520, padding: "4px 0", fontFamily: "system-ui, sans-serif" } },
      // 标题行：LayoutDashboard 图标 + 名称（与侧边栏入口同图标，识别性强）
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
        React.createElement("span", { style: { display: "inline-flex", color: "var(--dsw-alias-label-secondary,#666)" } }, icons.lucideIcon("LayoutDashboard", 16)),
        React.createElement("span", { style: { fontSize: 15, fontWeight: 600, color: "var(--dsw-alias-label-primary,#333)" } }, "工作台")
      ),
      React.createElement("p", { style: { margin: 0, fontSize: 13, color: "var(--dsw-alias-label-secondary,#444)", lineHeight: 1.7 } },
        "全屏 / 左侧 / 右侧 / 底部四种工作台布局，widget 面板即装即用。"
      ),
      // 布局配置卡片：头部 + hairline + 字段 + hairline + 底部操作
      React.createElement("div", { style: boxStyle },
        React.createElement("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" } },
          React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary,#333)" } }, "布局配置"),
          React.createElement("span", { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary,#999)" } }, "改动即时生效并自动保存")
        ),
        React.createElement("div", { style: { height: 1, background: "color-mix(in srgb, var(--dsw-alias-label-secondary) 18%, transparent)" } }),
        SETTINGS_FIELDS.map(function (field) {
          // 全屏分割线：最上方 + 线框框起；下方用一条分隔线与后续设置隔开
          if (field.key === "fullscreenDividers") {
            return React.createElement(React.Fragment, { key: field.key },
              React.createElement("div", {
                style: { border: "1.5px dashed color-mix(in srgb, var(--dsw-alias-label-secondary) 35%, transparent)", borderRadius: 8, padding: "8px 10px" }
              }, layoutRow(field)),
              React.createElement("div", {
                style: { height: 1, background: "color-mix(in srgb, var(--dsw-alias-label-secondary) 20%, transparent)" }
              })
            );
          }
          return layoutRow(field);
        }),
        // 卡片底：hairline + 重置按钮（常态安静，悬停转红提示危险动作）
        React.createElement("div", { style: { height: 1, background: "color-mix(in srgb, var(--dsw-alias-label-secondary) 18%, transparent)" } }),
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
          React.createElement("button", {
            onClick: openResetConfirm,
            onMouseEnter: function () { setResetHover(true); },
            onMouseLeave: function () { setResetHover(false); },
            style: {
              display: "inline-flex", alignItems: "center", gap: 6,
              border: "1px solid " + (resetHover ? "#fca5a5" : "color-mix(in srgb, var(--dsw-alias-label-secondary) 25%, transparent)"),
              borderRadius: 8, padding: "7px 14px", cursor: "pointer",
              background: resetHover ? "#fef2f2" : "transparent",
              color: resetHover ? "#dc2626" : "var(--dsw-alias-label-secondary,#666)",
              fontSize: 13, transition: "background .12s, border-color .12s, color .12s"
            }
          }, "重置默认值"),
          notice ? React.createElement("span", { style: { fontSize: 12, color: "#16a34a" } }, notice) : null
        )
      ),
      // 插件设置（L2，独立文件 plugin-settings.tsx：两列卡片 + 手风琴 + 启停 + 声明式字段）
      React.createElement(PluginSettingsSection, {}),
      // 重置确认弹窗（portaled 到 body，独立于页面，避免被设置容器裁剪）
      confirmOpen ? icons.createPortalToBody(
        React.createElement(React.Fragment, null,
          React.createElement("div", {
            onClick: function () { setConfirmOpen(false); },
            style: { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }
          }),
          React.createElement("div", {
            role: "dialog",
            "aria-modal": "true",
            style: {
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              background: "var(--dsw-alias-bg-base,#fff)",
              border: "1.5px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 30%, transparent)",
              borderRadius: 12, padding: "20px 24px", width: 360, boxSizing: "border-box",
              boxShadow: "0 12px 40px rgba(0,0,0,.18)", zIndex: 10000,
              display: "flex", flexDirection: "column", gap: 14, fontFamily: "system-ui, sans-serif"
            }
          },
            React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: "var(--dsw-alias-label-primary,#333)" } }, "重置工作台设置"),
            React.createElement("div", { style: { fontSize: 13, color: "var(--dsw-alias-label-secondary,#666)", lineHeight: 1.6 } }, "此操作将把所有设置项恢复为默认值，当前自定义配置会丢失。确定继续吗？"),
            React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 } },
              React.createElement("button", {
                type: "button",
                onClick: function () { setConfirmOpen(false); },
                style: { border: "1px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 25%, transparent)", borderRadius: 8, padding: "8px 16px", cursor: "pointer", background: "transparent", color: "var(--dsw-alias-label-secondary,#666)", fontSize: 13 }
              }, "取消"),
              React.createElement("button", {
                type: "button",
                onClick: doReset,
                style: { border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", background: "var(--dsw-alias-state-business-primary,#3b82f6)", color: "#fff", fontSize: 13 }
              }, "确定")
            )
          )
        )
      ) : null
    );
  }

  return {
    WorkspaceSettingsSection: WorkspaceSettingsSection
  };
}

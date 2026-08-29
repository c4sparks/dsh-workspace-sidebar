/**
 * src/client/plugin-settings.tsx — 设置分区里的「插件设置」卡片（L2）。
 *
 * 独立文件：widget 声明式设置（`WidgetDescriptor.settings`）的卡片渲染——两列布局、
 * 手风琴折叠（`settings.collapsible`）、启停开关、声明式字段控件。后续针对插件设置的
 * 规范 / 交互改动**只改本文件**，不影响布局配置（settings.ts）。
 *
 * 依赖注入：React / icons / service 由 settings.ts 传入；共享控件 NumberField / TextField
 * 也由 settings.ts 提供（本文件不直接 import 运行时 react，同插件其它模块）。
 */
import type * as ReactTypes from "react";
import type { WidgetSettingField, WorkspaceService } from "./types";
import type { Icons } from "./icons";

export interface PluginSettingsSectionDeps {
  React: typeof ReactTypes;
  icons: Icons;
  service: WorkspaceService;
  /** 共享控件（settings.ts 提供；本文件用于渲染 widget 声明式字段）。 */
  NumberField: (props: { value: number; min: number; max: number; onCommit: (n: number) => void }) => ReactTypes.ReactNode;
  TextField: (props: { value: string; placeholder?: string; onCommit: (s: string) => void }) => ReactTypes.ReactNode;
}

export function createPluginSettingsSection(deps: PluginSettingsSectionDeps): {
  PluginSettingsSection: ReactTypes.ComponentType;
} {
  const { React, icons, service, NumberField, TextField } = deps;
  const useSyncExternalStore = React.useSyncExternalStore;

  /** 判别联合 → 控件：主插件统一渲染 widget 声明式设置字段（L2）。 */
  function widgetFieldControl(field: WidgetSettingField, value: unknown, onWrite: (v: unknown) => void): React.ReactNode {
    switch (field.type) {
      case "number": {
        const n = typeof value === "number" && isFinite(value) ? value : (field.min ?? 0);
        return React.createElement(NumberField, {
          value: n,
          min: field.min ?? 0,
          max: field.max ?? Number.MAX_SAFE_INTEGER,
          onCommit: function (v) { onWrite(v); }
        });
      }
      case "switch": {
        const on = value === true;
        return React.createElement("input", {
          type: "checkbox",
          checked: on,
          onChange: function (e) { onWrite((e.target as HTMLInputElement).checked); },
          style: { width: 16, height: 16, cursor: "pointer" }
        });
      }
      case "select": {
        const current = typeof value === "string" ? value : (field.options[0]?.value ?? "");
        return React.createElement("select", {
          value: current,
          onChange: function (e) { onWrite((e.target as HTMLSelectElement).value); },
          style: { border: "1.5px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 25%, transparent)", borderRadius: 6, padding: "4px 8px", fontSize: 13, cursor: "pointer" }
        }, field.options.map(function (o) {
          return React.createElement("option", { key: o.value, value: o.value }, o.label);
        }));
      }
      case "text": {
        const t = typeof value === "string" ? value : "";
        return React.createElement(TextField, {
          value: t,
          placeholder: field.placeholder,
          onCommit: function (s) { onWrite(s); }
        });
      }
    }
  }

  /** 插件卡片字段行：标签靠左、控件紧跟。 */
  function row(key: string, label: string, input: React.ReactNode): React.ReactNode {
    return React.createElement("div", { key: key, style: { display: "flex", alignItems: "center", gap: 8 } },
      React.createElement("span", { style: { fontSize: 13, color: "var(--dsw-alias-label-secondary,#666)", whiteSpace: "nowrap" } }, label),
      input
    );
  }

  /** 插件卡片：`collapsible` 时为手风琴（头带 ▼/▲、点击折叠、默认收起）；
   *  否则始终展开显示配置（头仅展示，不可点）。hover 背景加深（深浅自适应）。 */
  function WidgetCard(props: {
    icon: React.ReactNode;
    title: string;
    toggle: React.ReactNode;
    collapsible?: boolean;
    children?: React.ReactNode;
  }): React.ReactNode {
    const collapsible = props.collapsible === true;
    const openState = React.useState(!collapsible);
    const open = openState[0];
    const setOpen = openState[1];
    const hoverState = React.useState(false);
    const hover = hoverState[0];
    const setHover = hoverState[1];
    const cardStyle: ReactTypes.CSSProperties = {
      border: "1.5px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 30%, transparent)",
      borderRadius: 8,
      background: "var(--dsw-alias-bg-layer-1,#fff)",
      boxShadow: "0 1px 2px rgba(0,0,0,.04)",
      padding: "10px 12px"
    };
    return React.createElement("div", {
      onMouseEnter: function () { setHover(true); },
      onMouseLeave: function () { setHover(false); },
      style: {
        ...cardStyle,
        background: hover ? "var(--dsw-alias-interactive-bg-hover)" : cardStyle.background,
        display: "flex",
        flexDirection: "column",
        gap: 6
      }
    },
      React.createElement("div", {
        onClick: collapsible ? function () { setOpen(!open); } : undefined,
        title: collapsible ? (open ? "收起配置" : "展开配置") : undefined,
        style: { display: "flex", alignItems: "center", gap: 6, cursor: collapsible ? "pointer" : "default", userSelect: "none", minWidth: 0 }
      },
        React.createElement("span", { style: { display: "inline-flex", width: 16, flex: "0 0 auto", color: "var(--dsw-alias-label-secondary,#555)" } }, props.icon),
        React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary,#333)", flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, props.title),
        React.createElement("span", { style: { flex: "0 0 auto", display: "inline-flex" }, onClick: function (e: ReactTypes.MouseEvent) { e.stopPropagation(); } }, props.toggle),
        collapsible ? React.createElement("span", { style: { display: "inline-flex", flex: "0 0 auto", color: "var(--dsw-alias-label-secondary,#555)" } }, icons.lucideIcon(open ? "chevronUp" : "chevronDown", 14)) : null
      ),
      open ? React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, props.children) : null
    );
  }

  /** 「插件设置」框：标题 + 各插件卡片（一行两个网格）。无声明 settings 的 widget 不渲染。 */
  function PluginSettingsSection(): React.ReactNode {
    const state = useSyncExternalStore(service.layout.subscribeState, function () { return service.layout.getState(); });
    const widgets = useSyncExternalStore(service.subscribe, function () { return service.getWidgets(); });
    const settingsVersion = useSyncExternalStore(service.subscribeWidgetSettings, function () { return service.getSettingsVersion(); });
    void settingsVersion;
    const boxStyle: ReactTypes.CSSProperties = {
      border: "1.5px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 25%, transparent)",
      borderRadius: 10,
      background: "transparent",
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 8
    };
    const widgetSettingsCards = widgets.filter(function (w) { return w.settings !== undefined; }).map(function (w) {
      const id = w.id;
      const decl = w.settings!;
      const block = service.getWidgetSettings(id);
      const title = typeof w.title === "function" ? w.title() : w.title;
      const fields = decl.fields ?? [];
      const disabled = state.disabledWidgets?.[id] === true;
      const toggle = React.createElement("button", {
        type: "button",
        role: "switch",
        "aria-checked": !disabled,
        title: disabled ? "启用" : "禁用",
        onClick: function () { service.setWidgetDisabled(id, !disabled); },
        style: {
          width: 40, height: 22, borderRadius: 11, padding: 0, border: "none", cursor: "pointer", flex: "0 0 auto",
          background: !disabled ? "#3b82f6" : "#d1d5db", position: "relative", transition: "background .15s"
        }
      }, React.createElement("span", {
        style: { position: "absolute", top: 2, left: !disabled ? 20 : 2, width: 18, height: 18, borderRadius: 9, background: "var(--dsw-alias-bg-base,#fff)", boxShadow: "0 1px 2px rgba(0,0,0,.2)", transition: "left .15s" }
      }));
      return React.createElement(WidgetCard, {
        key: id,
        icon: icons.resolveNode(w.icon, 14) ?? "\u{1F9E9}",
        title: title,
        toggle: toggle,
        collapsible: decl.collapsible === true
      },
        disabled ? React.createElement("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary,#999)" } }, "已禁用：不会出现在工作台列表") : null,
        React.createElement("div", { "aria-disabled": disabled || undefined, style: { opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : undefined, display: "flex", flexDirection: "column", gap: 6 } },
          decl.render !== undefined
            ? React.createElement(decl.render, {
                get: function () { return service.getWidgetSettings(id); },
                set: function (k, v) { service.setWidgetSettings(id, { [k]: v }); },
                reset: function () { service.resetWidgetSettings(id); }
              })
            : fields.map(function (field) {
                return row(id + ":" + field.key, field.label, widgetFieldControl(field, block[field.key], function (v) {
                  service.setWidgetSettings(id, { [field.key]: v });
                }));
              })
        )
      );
    });
    // 插件设置框始终显示：有声明 settings 的插件 → 卡片网格；无 → 空线框 + 占位提示
    return React.createElement("div", { style: boxStyle },
      React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary,#333)" } }, "插件设置"),
      widgetSettingsCards.length === 0
        ? React.createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary,#999)", padding: "4px 0" } }, "暂无插件设置")
        : React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, alignItems: "start" } }, widgetSettingsCards)
    );
  }

  return { PluginSettingsSection: PluginSettingsSection };
}

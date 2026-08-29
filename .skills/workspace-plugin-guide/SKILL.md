---
name: workspace-plugin-guide
description: workspace 服务 API、WidgetDescriptor、声明式设置、主题跟随、最佳实践
---

# 插件开发指南

> 第三方插件如何给工作台注册 widget（工具面板）：`workspace` 服务 API、`WidgetDescriptor`、
> 声明式设置、主题跟随、最佳实践。

## 1. 接入方式

- 依赖 `workspace` 服务：`const inject = ['workspace']`，`apply(ctx)` 里经
  `ctx.workspace.registerWidget(desc)` 注册。
- 必须**先装配工作台主插件**，否则 `ctx.workspace` 不存在 → 插件 `pending`。
- `registerWidget` 返回 disposer（卸载 / HMR 安全）；重复 id 告警并忽略。

### 1.1 最小示例（完整可跑）

```js
// 插件骨架：deps.React 由宿主注入（esbuild 打包，不 import react）
export function createPlugin(deps) {
  const React = deps.React
  const inject = ['workspace']            // 依赖 workspace 服务

  function apply(ctx) {
    ctx.effect(() => {
      return ctx.workspace.registerWidget({
        id: 'my-plugin:panel',            // 全局唯一
        title: '我的面板',
        icon: (size) => '📌',             // 或返回 SVG / JSX
        region: 'center',                 // left / center / right / bottom
        order: 100,
        component: (props) => {           // props: { active, ctx, service, instanceId }
          return React.createElement('div', { style: { padding: 12 } }, '你好，工作台')
        },
      })
    }, 'my-plugin: widget')
  }

  return { apply, inject }
}
```

- 装进 web profile 后，工作台侧边栏底部出现「我的面板」入口；点开即可在 center 区域看到标签 + 内容。
- **完整参考实现**：`dsh-workspace-market/dsh-workspace-terminal`（多开 `multi:true`、
  声明式设置 `settings`、主题跟随、懒加载——看它的 `src/client/plugin.ts`）。

## 2. `WidgetDescriptor`

```ts
{
  id: string;                        // 全局唯一，如 'my-plugin:panel'
  title: string | (() => string);
  icon?: ReactNode | ((size) => ReactNode);  // 标签图标；默认 🧩
  region?: 'left'|'center'|'right'|'bottom'; // 首次注册默认区域（默认 center）
  order?: number;                    // 区域内标签顺序（升序，默认 100）
  component?: (props) => ReactNode;  // 同步组件（轻量 widget）
  loadComponent?: () => Promise<Component>;  // 懒加载（重组件，首次激活才加载）
  multi?: boolean;                   // 可多开实例
  settings?: WidgetSettingsDeclaration;      // 声明式设置
}
```

组件 props：`{ active, ctx, service, instanceId }`（`active`=是否当前激活；
`ctx`=dsh ctx（经工作台注入 `theme` 等）；`service`=workspace 服务；`instanceId`=实例 id，
多开用它区分实例 / 拼独立资源）。

## 3. 声明式设置（`settings`）

```ts
settings?: {
  fields?: Array<
    | { type:'number'; key; label; min?; max? }
    | { type:'switch'; key; label }
    | { type:'select'; key; label; options:[{value,label}] }
    | { type:'text';  key; label; placeholder? }
  >;
  render?: (handles: { get(); set(k,v); reset() }) => ReactNode;  // 完全自定义面板
  collapsible?: boolean;   // 设置卡片是否手风琴折叠（默认展开；true=默认收起，头带 ▼/▲）
}
```

- 值持久化到 `pluginSettings[widgetId]`（独立 localStorage 键）；主插件在 dsh 设置页
  「工作台 → 插件设置」分区按 widget 分组渲染成卡片（两列布局）。
- 设置页里 widget 卡片可经启停开关禁用（禁用后从工作台「+」列表隐藏，持久化）。

## 4. 常用服务方法

| 方法 | 说明 |
|---|---|
| `openWidget(widgetId, {mode?,region?,paneId?})` | 单实例 → 聚焦/补建；多实例 → 新建；返回实例 id |
| `closeTab(instanceId)` | 关闭一个 tab 实例（实例 id 全局唯一，自动定位所在面板） |
| `insertTabBefore(instanceId, beforeId)` | 拖到标签上：插到该标签前（同 pane 重排 / 跨 pane 移入） |
| `moveTab(instanceId, paneId, mode?)` | 中心落点：移入该 pane |
| `splitPane(region, paneId, dir, instanceId, mode?, before?)` | 边缘落点：拆分成新 pane |
| `getWidgets()` / `getWidget(id)` | 读注册表 |
| `getWidgetSettings(id)` / `setWidgetSettings(id, patch)` / `resetWidgetSettings(id)` | 声明式设置读写 |
| `setWidgetDisabled(id, disabled)` | 从「+」列表隐藏 / 恢复 |
| `layout.*` | 布局控制（区域尺寸 / 预设 / 面板开关 / 分割线 / 分屏开关） |

## 5. 主题跟随

- widget 组件经 `props.ctx.theme` 读主题（前提：工作台已 `inject 'theme'`）。
- 读当前方案：`props.ctx.theme.getTheme()?.active?.colorScheme`（已是 light/dark）。
- 响应切换：`props.ctx.theme.onThemeChange((snap) => …)`（订阅变化时重渲染）。
- 优先级：**用户显式设置 > dsh 主题**。
- 样式一律用 dsh token（见主题样式规范），别硬编码颜色。

## 6. 最佳实践

- **懒加载**：重组件用 `loadComponent`（首次激活才加载，避免启动全部加载）。
- **多开**：声明 `multi: true`，用 `instanceId` 区分实例 / 拼独立资源 URL。
- **状态保留**：标签切换 keep-alive，widget 内部状态（表单 / iframe / 连接）保留。
- **宿主能力**：需要终端 / 文件 / 进程等宿主能力时，由提供能力的插件自己暴露 Remote 端点
  （typert 严格 codegen），widget 经 `ctx.remote.<ns>.*` 调用。

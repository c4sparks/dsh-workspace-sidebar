---
name: workspace-dev-conventions
description: 依赖注入、inject、构建、代码结构、分屏高度链、文档同步
---

# 开发约定

> 写代码前的约定：依赖注入、inject、构建、代码结构、样式高度链、文档同步。

## 1. 依赖注入（DI）

- **业务代码不 `import` 运行时 react / 外部包**；React 经 `createPlugin(deps)` / 各
  `createX(deps)` 注入（`@deepseek-ai/*` 为宿主 external，factory 的 `require` 解析）。
- 各模块用工厂函数 + 返回组件 / 服务：`createX({ React, icons, service, … }) → { … }`。

## 2. client `inject`

保持 `['slots', 'remote', 'connection', 'theme']`：

| 服务 | 用途 |
|---|---|
| `slots` | 注册 footer / 设置槽位 |
| `remote` / `connection` | widget 经 `ctx.remote` / `ctx.connection` 访问网关 / 连接（删掉会静默失效） |
| `theme` | widget 读 `ctx.theme` 跟随主题（删掉 → `cannot get property "theme" without inject`，组件崩溃、slot 崩） |

## 3. 构建

- `pnpm run typecheck`（tsc --noEmit）+ `node scripts/build.mjs`（重建 `lib/`）。
- 宿主直接加载 `lib/`，改 `src/` 后必须重建。
- `scripts/build.mjs`：client 打 iife，`external: ['react','react/jsx-runtime','@deepseek-ai/*']`，
  banner 包进 `window.__ModuleLoader__.load({ id, factory: (require) => … })`；
  `define NODE_ENV=production`。
- 内联进 client 的第三方库（allotment / dnd-kit / react-dom）经 esbuild bundle 进
  `lib/client.js`；`react` 保持 external 走宿主 factory。

## 4. 代码结构

- 纯逻辑（store / service / registry / split-tree / tab-drag / types）**无 React**。
- React 视图（workspace-view / split-pane / dnd / footer / settings / plugin-settings）经
  `createX(deps)` 注入 React。
- 设置分区拆两个文件：`settings.ts`（L1 布局配置）+ `plugin-settings.tsx`（L2 插件设置卡片）——
  后续针对插件设置的改动只改 `plugin-settings.tsx`。
- dsh 官方 API 全部走 `adapter.ts` 防腐层（dsh API 变更只改这里）。

## 5. 分屏 / 拖拽高度链（改布局时必看）

- allotment 只给「`.split-view-container > .split-view-view`（直接子级）」设 `height:100%`，
  每个 pane 内部还有一层嵌套的 `.split-view-view`（内容包裹层）——必须注入
  `.split-view-view > .split-view-view{height:100%;width:100%}`，否则分屏内容塌成内容高、
  只剩标题。
- leaf 的 `PaneDropTarget` / 内层 div 需 `height:100%`；Allotment 外包
  `flex:1;height:100%` 容器；**嵌套分屏（path 非空）用 `Allotment.Pane` 包裹**（父 Allotment
  只认 Pane 子节点）。
- 停靠面板 div **不设 `overflow:hidden`**（否则边缘分割线被裁掉一半）；内容由
  pane / regionBody 各自 `overflow:hidden` 裁剪。
- widget 内容容器 `widgetPane` 隐藏滚动条（`scrollbar-width:none` + `::-webkit-scrollbar`），
  避免面板打开时滚动条闪烁；内容仍可滚。

## 6. 主题 / 样式

- 一律用 dsh token（见主题样式规范）；禁止硬编码颜色；固定自定义蓝 `#3b82f6`。
- 设置区边框用 `1.5px solid color-mix(...)`（例外，深色可见）。

## 7. 文档同步

- 改实现后同步本 `.skills/` 分类文档（架构功能 / UI布局 / 交互 / 主题样式 / 插件开发指南 /
  开发约定），保持唯一基准最新。
- 变更记录 / 问答决策各自维护为历史记录（changelog / chat），不并入 `.skills/` 基准。

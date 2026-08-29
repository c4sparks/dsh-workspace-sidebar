---
name: workspace-architecture
description: 工作台定位、设计动机、模块结构、状态模型、数据流与持久化
compatibility: DSH @deepseek-ai/dsh web 端
---

# 架构功能

> 本插件的定位、设计动机、模块结构、状态模型、数据流与持久化。

## 1. 定位

- **工作台 = 覆盖层**：从 dsh 侧边栏底部入口（`sidebar.footer.action`）展开的**帧级覆盖层**，
  不接管 dsh 根布局（不 disable `ui-layout`、不重写 `ctx.layout` / 主题）。
- **区域**：全屏模式下分 左 / 中 / 右 / 底 四区域；停靠模式（左/右/底）各自独立、可同时打开。
- **标签页 + 分屏**：每个 pane 有 TabBar（标签可拖）+ 内容区；拖拽可拆分/移动/重排。
- **设置分区**：注册进 dsh 设置页 `settings.section` 槽位，分「布局配置」（L1）与「插件设置」（L2）。
- **服务化 + 按需加载**：widget 组件在首次激活对应标签时才加载（`loadComponent`），减少启动开销。

## 1.1 设计动机（为什么自建区域 / 模式布局）

**核心：dsh 官方没提供「可承载任意 widget 的区域布局槽位」，所以必须自建覆盖层布局。**

- **dsh 官方提供的 UI 位置只有入口级**：侧边栏 footer 动作（`sidebar.footer.action`）、
  设置分区（`settings.section`）、侧车等。dsh 的主内容区是**对话区**，没有「把第三方 widget
  停靠在对话区左/右/底、或拆分成多面板」的官方槽位。
- **区域（左 / 中 / 右 / 底）= 经典 IDE 工作台模型**：中心主区 + 左/右/底辅助面板
  （放工具面板 / 输出 / 任务等），是工具类产品用户熟悉的布局。用 `position:fixed` **覆盖层**
  叠在对话区上实现，对话状态保留在幕后、随时可回。
- **模式（全屏 / 左 / 右 / 底）= 同一布局引擎的四种打开方式**：
  - **全屏**：工作台接管主内容区（覆盖层），四区域同屏——「工作台 / 管理后台」视角；
  - **左 / 右 / 底停靠**：面板从侧边栏右缘 / 右侧 / 底部**浮现**，**对话区保留**
    （被推挤 / 留白）——「边聊边用工具」的轻量视角。
  - 一个 `modeState` 数据结构服务全部模式；停靠面板可同时开（`multiPanel`），互不干扰。
- **为什么不改 dsh 根布局**：侵入性最小、最稳——不 disable `ui-layout`、不重写
  `ctx.layout` / 主题，dsh 升级兼容；「占据 / 让位」由覆盖层 + 推挤（`push-layout`）实现。

## 2. 支持的版本（兼容矩阵）

| DSH 版本 | 状态 | 说明 |
|---|---|---|
| `@deepseek-ai/dsh` 0.1.1-rc.2 | ✅ 已实测 | 当前安装运行（`dsh-base` / `dsh-web-app` 同版） |
| `0.1.2-alpha.1` | ✅ 已实测 | deepseek-harness 源码仓库 `pnpm dsh web` 实测：工作台 + 终端全功能正常、零报错 |

- 依赖官方服务：`slots`（`sidebar.footer.action` / `settings.section`）、`remote` / `connection`、
  `theme`；React 19。
- **升级注意**：DSH 升级需回归上述槽位与主题 token（见主题样式规范）；源码非 git 仓库时构建需
  `DSH_CLIENT_COMMIT_HASH=<任意hash> pnpm run build`。

## 3. 项目目录结构

```
dsh-workspace-sidebar/
├── cordis.patch.yml          # bundle patch（防双挂载守卫）
├── package.json              # main=lib/index.js；exports['./client']
├── tsconfig.json / pnpm-workspace.yaml / pnpm-lock.yaml
├── README.md
├── scripts/
│   └── build.mjs             # esbuild 构建 src → lib（client iife + host esm）
├── src/
│   ├── index.ts              # host 入口（ESM，无依赖）
│   └── client/
│       ├── index.ts          # client bundle entry（factory 里 require("react")）
│       ├── plugin.ts         # 插件主体：装配 slots / 设置 / 服务；inject
│       ├── adapter.ts        # dsh 官方 API 防腐层
│       ├── constants.ts      # 常量 / 预设
│       ├── types.ts          # 共享类型（状态 / 分屏树 / 服务接口）
│       ├── css.d.ts          # CSS module 类型声明
│       ├── store.ts          # 布局存储（纯逻辑，无 React）
│       ├── service.ts        # workspace 服务（widget + 布局 + 分屏/标签）
│       ├── registry.ts       # widget 注册表
│       ├── scope.ts          # 延迟服务代理（apply 后即当前服务）
│       ├── hooks.ts          # React hooks（useViewport / useSidebarRight / usePointerDrag）
│       ├── icons.ts          # Lucide 图标 + portal / resolveNode
│       ├── workspace-view.ts # 覆盖层视图（Toolbar / TabBar / 区域渲染 / DndWorkspace 包装）
│       ├── split-pane.tsx    # 分屏树渲染（allotment）+ 面板 droppable + 吸附区覆盖层 + DragHint
│       ├── split-tree.ts     # 分屏树纯逻辑（splitNodeAt / closeNodeAt / leavesOf / sanitize）
│       ├── tab-drag.ts       # 拖拽落点语义层（zoneAt / dropOverlayStyle / applyDrop）
│       ├── dnd.ts            # 拖拽事件层（dnd-kit：DndContext / 传感器 / DragOverlay / 碰撞检测）
│       ├── footer.ts         # 侧边栏底部入口（工作台按钮 + 模式图标）
│       ├── settings.ts       # 设置分区 L1（布局配置）；渲染 L2 插件设置
│       ├── plugin-settings.tsx # 设置分区 L2（插件设置卡片：两列 + 手风琴 + 启停 + 字段）
│       ├── settings-nav-icon.ts # 设置页左导航图标（LayoutDashboard）
│       ├── push-layout.ts    # 推挤主布局（停靠面板让位）
│       ├── styles.ts         # 样式注入（作用域化，跟随 dsh token）
│       └── test-seam.ts      # 测试接缝（?workspace-test 暴露 service）
├── tests/                    # 冒烟测试脚本
├── lib/                      # 构建产物（宿主直接加载）
└── .skills/                  # 技能文档（权威参考）
```

## 4. 模块职责

| 模块 | 职责 |
|---|---|
| `plugin.ts` | 插件主体：装配 slots / 设置 / 服务；`inject` 声明依赖服务 |
| `adapter.ts` | dsh 官方 API 防腐层（窄 `DshAdapter` 接口） |
| `store.ts` | 纯逻辑布局存储（不可变更新 + 订阅 + 防抖持久化） |
| `service.ts` | `workspace` 服务（widget 注册 + 布局控制 + 分屏/标签操作） |
| `registry.ts` | widget 注册表 |
| `types.ts` | 共享类型（`WorkspaceState` / `SplitNode` / `WidgetDescriptor` / 服务接口） |
| `scope.ts` | 延迟服务代理（apply 后即当前服务） |
| `hooks.ts` | React hooks（`useViewport` / `useSidebarRight` / `usePointerDrag`） |
| `icons.ts` | Lucide 图标内嵌 SVG（`lucideIcon` / `resolveNode` / `createPortalToBody`） |
| `workspace-view.ts` | 覆盖层视图（Toolbar / TabBar / 区域渲染 / DndWorkspace 包装） |
| `split-pane.tsx` | 分屏树渲染（allotment）+ 面板 droppable + 吸附区覆盖层 + DragHint |
| `split-tree.ts` | 分屏树纯逻辑（`splitNodeAt` / `closeNodeAt` / `leavesOf` / sanitize） |
| `tab-drag.ts` | 拖拽落点语义层（`zoneAt` / `dropOverlayStyle` / `applyDrop` / 共享吸附区状态） |
| `dnd.ts` | 拖拽事件层（dnd-kit：DndContext / 传感器 / DragOverlay / 碰撞检测 / 落点管线） |
| `footer.ts` | 侧边栏底部入口（工作台按钮 + 模式图标） |
| `settings.ts` | 设置分区 L1（布局配置）；渲染 L2 插件设置 |
| `plugin-settings.tsx` | 设置分区 L2（插件设置卡片：两列 + 手风琴 + 启停 + 声明式字段） |
| `settings-nav-icon.ts` | 设置页左导航图标（LayoutDashboard 标记 + CSS） |
| `push-layout.ts` | 推挤主布局（停靠右/底推挤，拖动禁用过渡） |
| `styles.ts` | 样式注入（作用域化，跟随 dsh 主题 token） |
| `test-seam.ts` | 测试接缝（`?workspace-test` 暴露 service / registerTestWidget） |

## 5. 依赖注入约定

- **业务代码不 `import` 运行时 react / 外部包**：React 经 `createPlugin(deps)` / 各
  `createX(deps)` 注入；`@deepseek-ai/*` 为宿主 external。
- `scripts/build.mjs`：client 打 iife，`external: ['react','react/jsx-runtime','@deepseek-ai/*']`，
  banner 包进 `window.__ModuleLoader__.load({ id, factory: (require) => … })`；
  `define NODE_ENV=production`（内联的 react-dom 走生产版）。

## 6. 状态模型

### 6.1 顶层 `WorkspaceState`

```ts
{
  v: 1;
  open: boolean;                 // 覆盖层是否打开（瞬态，不持久化）
  panels: { fullscreen, left, right, bottom };  // 面板开关（瞬态）
  multiPanel: boolean;           // 左/右/底可同时展示
  preset: 'workbench'|'focus'|'fullscreen';
  regionSizes: { left, right, bottom };  // 全屏区域尺寸（0=隐藏）
  leftW / rightW / bottomH: number;      // 停靠面板尺寸
  dockMaxRatio: number; dividerWidth: number; dividerColor: string;
  placement: Record<string, Region>;     // widget → 区域意图
  disabledWidgets: Record<string, boolean>;
  splitEnabled: boolean;
  modeState: Record<Mode, ModeState>;    // 每面板的打开实例 + 分屏树
}
```

### 6.2 `modeState[mode]`（每面板独立）

```ts
interface ModeState {
  splits: Partial<Record<Region, SplitNode>>;  // 分屏树（未拆分区域无条目）
  panes: Record<string, PaneState>;            // paneId → { tabs: TabRef[]; active }
  paneOfWidget: Record<string, string>;        // tab 实例 id → paneId
  activeTab: Partial<Record<Region, string|null>>; // 兼容镜像（运行时不再写）
}
```

### 6.3 分屏树 `SplitNode`

```ts
type SplitNode =
  | { kind: 'leaf'; paneId: string }
  | { kind: 'split'; dir: 'row'|'col'; weights: number[]; children: SplitNode[] };
```

- `dir='row'` → 左右；`dir='col'` → 上下；weights 初始 `[1,1]`，分隔条拖拽后归一化。
- 叶子 pane 有 `TabBar`（多标题）+ 内容区；可递归嵌套。

### 6.4 标签实例

- tab 是**实例**：单实例 `id===widgetId`；多开附加实例 `id=widgetId:instN`。
- `panes` 是已打开实例的**唯一事实来源**（状态驱动布局：状态树 → allotment 渲染对应 pane）。

## 7. 数据流

1. 操作（点击 / 拖拽 / + 新建）→ `service` 方法（`openWidget` / `splitPane` / `moveTab` /
   `insertTabBefore` / `closeTab` …）。
2. → `store` 不可变更新 `state` → `emit()`（订阅者通知 + 防抖持久化）。
3. → React `useSyncExternalStore` 重渲染 → 视图按 `modeState[].splits/panes` 渲染。

## 8. 持久化

- `WS_KEY`（`dsh-workspace-sidebar:workspace:v1`）：`modeState` + 布局项；
  `open` / `panels` 不持久化（重启收起）；sanitize 校验分屏树合法性（叶子 paneId 有效、
  weights 合法、children ≥ 2），非法回落。
- `WIDGET_SETTINGS_KEY`：`pluginSettings[widgetId]`（声明式设置，独立键，schema 升级不牵连布局）。

## 9. 布局控制（`service.layout`）

- 读 / 写布局项（区域尺寸、预设、面板开关、停靠尺寸、分割线、`splitEnabled`、`multiPanel`）。
- `reset()` 重置布局（清 localStorage）；`flushSave()` 立即持久化。

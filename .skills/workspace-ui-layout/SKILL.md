---
name: workspace-ui-layout
description: 工作台区域/模式、工具栏、标签页、设置页布局、面板几何与动效
---

# UI 布局

> 覆盖层的区域 / 模式、工具栏、标签页、设置页布局、面板几何。

## 1. 区域（Region）与模式（Mode）

### 1.1 四种模式

| Mode | 形态 | 打开时 |
|---|---|---|
| `fullscreen` | 全屏覆盖层 | 接管主内容区，四区域同屏（独占） |
| `left` | 左侧停靠 | 面板从侧边栏右缘浮现，对话区右移/留白 |
| `right` | 右侧停靠 | 面板在右，对话区左推（完整可见） |
| `bottom` | 底部停靠 | 面板在底，对话区上推（完整可见） |

- `multiPanel`（默认关）：开 = 左/右/底可**同时同屏**（底面板夹在左右之间）；关 = 一次一个。
- 全屏独占：开全屏关停靠，开停靠关全屏。
- `open`/`panels` 不持久化（重启收起）；`modeState` 各面板插件集合持久化。

### 1.2 全屏四区域

| 区域 | 默认尺寸 | 说明 |
|---|---|---|
| `left` | 280px | 左侧辅助面板（`regionSizes.left`，0=隐藏） |
| `center` | flex 自适应 | 主区 |
| `right` | 320px | 右侧辅助面板（`regionSizes.right`） |
| `bottom` | 240px | 底部面板（`regionSizes.bottom`） |

- 窄屏（overlay < `NARROW_BREAKPOINT` 900px）自动隐藏右/底区域。
- 区域间用 6px 分隔条（sash）拖拽调宽/高，可见线 = `dividerWidth`（1–6px，默认 1），
  hover 变蓝（`state-business-primary`）。

## 2. 工具栏（标题栏）

- **高度 34px**（比 30px 模式按钮大一点点）；窄面板时可横向滚动（滚动条隐藏）。
- 左：4 个模式图标（全屏 / 左 / 右 / 底），纯 Lucide 图标（不内放文字），hover 显示中文 title；
  - 激活图标**固定蓝 `#3b82f6`**（自定义，不跟随主题）；hover 背景 `interactive-bg-hover`。
- 右：✕ 关闭（全屏 = 关整个工作台；停靠 = 只关当前面板）。

## 3. 标签页（TabBar）

- 每 pane 一个 TabBar：标签（点击切换）+ ✕（关闭该实例）+ 末尾 **+**（打开 widget 选择弹层）。
- 标签可**拖拽**（分屏 / 移动 / 重排，见交互规范 §3）；多开实例显示稳定编号（`#N`）。
- `+` 弹层：portaled 到 body（避开 tabbar 裁剪），fixed 锚在按钮下方，列出可用 widget
  （禁用的隐藏）。

## 4. 设置页布局

- **工作台**标题 + 简介 + 两个框：
  - **布局配置**（L1）：`SETTINGS_FIELDS` schema 渲染（停靠占比 / 分割线粗细 / 分割线颜色 /
    左/右/底同时展示 / 分屏拖拽 / 重置默认值）。
  - **插件设置**（L2，独立文件 `plugin-settings.tsx`）：各插件卡片 **一行两个**（网格）；
    卡片背景 `bg-layer-1`（深色下与页面区分）；hover/选中背景加深 `interactive-bg-hover`；
    声明 `collapsible:true` 的插件卡片带 ▼/▲ 可折叠（默认收起），其它恒展开。

## 5. 面板几何

- 覆盖层 `position:fixed`，`left: sidebarRight`（dsh 侧边栏右缘，经 `useSidebarRight` 测量，
  未测到用 `SIDEBAR_RIGHT_FALLBACK` 280），宽 = 主内容区，高 = viewport。
- 停靠面板从 `left: sidebarRight` 起，宽/高可拖（左拖右缘、右拖左缘、底拖上缘），范围放开到
  几乎占满（留 `MODE_EDGE_MARGIN`）。
- 停靠面板 `position:fixed`，**不设 `overflow:hidden`**（否则边缘分割线被裁掉一半，见
  交互规范 §4）；内容由 pane / regionBody 各自 `overflow:hidden` 裁剪。

## 6. 动效

- 进入：按模式方向**滑入 + 淡入**（`dsws-enter-<mode>` keyframe，0.2s）。
- 尺寸变化（拖宽/高、窗口变化）：几何 `transition`（`left/top/width/height` 0.25s）。
- 拖动中禁用 CSS transition（`dragActive` → overlay / `#root` 过渡 `none`），丝滑跟手。

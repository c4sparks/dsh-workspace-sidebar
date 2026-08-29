---
name: workspace-interaction
description: 工作台打开/关闭、标签操作、拖拽分屏全流程
---

# 交互规范

> 打开/关闭、标签操作、拖拽分屏全流程。

## 1. 打开 / 关闭

| 动作 | 行为 |
|---|---|
| 侧边栏底部「工作台」按钮 | 打开工作台（全屏独占）/ 再点收起；与其它侧车入口互斥 |
| 全屏模式右上角 **✕** | 关闭整个工作台 |
| 停靠面板（左/右/底）**✕** | **只收起当前面板**，其余同屏保留 |
| **ESC** | 收起全部回到对话 |
| 模式图标（全屏/左/右/底） | 点 = 开关：开且同模式→收起；开且异模式→切换 |

## 2. 标签页

- 点击标签切换（组件状态 keep-alive，切换时表单/iframe 状态保留）。
- 标签右侧 **✕** 关闭该实例；单实例 widget 关掉后隐藏、可经「+」重开。
- TabBar 末尾 **+** 打开 widget 选择弹层：重开已关闭的、或为多开 widget 新建实例。
- **多开**（`multi: true`）：+ 点一次加一个实例，各实例互相独立（收到独立 `instanceId`）；
  TabBar 为多开实例显示稳定编号（`#N`）。

## 3. 拖拽分屏

### 3.1 手势

- 标签 `useSortable`；PointerSensor（鼠标：**6px** 位移阈值激活，区分点击）/ TouchSensor
  （触摸：150ms 长按）。
- 拖拽激活后：源标签 `opacity:0.4`，`DragOverlay` 拖影跟随指针（图标 + 标题浮层）。
- 点击（位移 <6px）正常激活标签；拖拽结束松开即落点。

### 3.2 落点三种

| 落点 | 行为 | 服务方法 |
|---|---|---|
| **标签上** | 插到该标签**之前**（同 pane 重排 / 跨 pane 移入） | `insertTabBefore(instanceId, beforeId)` |
| **面板边缘**（25% zone） | 拆成两个 pane，被拖实例进新 pane 并激活 | `splitPane(region, paneId, dir, instanceId, {mode, before})` |
| **面板中心**（50%） | 移入该 pane，不拆分 | `moveTab(instanceId, paneId, mode)` |

### 3.3 吸附区划分（`zoneAt`，先横后纵）

```
          x < 0.25            0.25–0.75              x > 0.75
      ┌──────────────┬──────────────────────┬──────────────┐
      │    left      │                      │    right     │
      │  拆分到左侧   │        center        │   拆分到右侧  │
      │              │       移入此面板      │              │
      │  y < 0.25:   │                      │  y > 0.75:   │
      │    up 拆分到上方                     │    down 拆分到下方
      └──────────────┴──────────────────────┴──────────────┘
```

- 边缘 25% = 拆分方向；中心 50% = 移入。
- 吸附区覆盖层：边缘对应侧 **40%** 半透明蓝块 + `2px dashed` 边框；中心整层淡蓝
  （`pointer-events:none`，z-index 1000）。
- 浮动提示 DragHint：跟随指针（+14,+20），黑底白字，文案 = zone 名。

### 3.4 越界 / 落在分隔条上

- `over=null` 时**保留上一吸附区**、仅跟随指针（边缘盲区修复）；真正清除只发生在
  `onDragEnd` / `onDragCancel`。

### 3.5 拆分后

- 新 pane 有自己的 TabBar（多标题）——被拖实例进新 pane 并激活。
- 两个面板内容区**满高渲染**（allotment 内层 `.split-view-view` 已填满，见开发约定 §5）。
- 分隔条（sash）可拖调权重（`setSplitNodeWeights`）。
- pane 右上 **✕** 关闭该 pane：其内 tab 一并关闭（不合并回其它面板）；父 split 只剩一个
  孩子时折叠回单面板。
- 每个 pane 都可继续拖/拆 → **任意递归嵌套**。

### 3.6 命中机制

- dnd-kit `pointerWithin` 碰撞检测 + 自定义 `workspaceCollisionDetection`（标签落点
  `kind='tab'` 优先于面板 `kind='pane'`）。
- 拖拽中指针实时坐标用 window pointermove 跟踪（吸附区 zone 需要原始坐标）。

## 4. 实现索引

| 行为 | 位置 |
|---|---|
| zone 判定 / 覆盖层样式 / 落点生效 | `tab-drag.ts` → `zoneAt` / `dropOverlayStyle` / `applyDrop` |
| 拖拽事件层（DndContext / 传感器 / 拖影 / 落点管线） | `dnd.ts` → `createDndWorkspace` / `workspaceCollisionDetection` |
| 标签可拖 + 重排落点 | `workspace-view.ts` → `TabView`（useSortable）+ `TabBar`（SortableContext） |
| 面板 droppable + 吸附区覆盖层 | `split-pane.tsx` → `PaneDropTarget` / `DragHint` |
| 分屏树渲染（allotment + sash + ✕） | `split-pane.tsx` → `SplitRegion` |
| 分屏树纯逻辑 | `split-tree.ts` → `splitNodeAt` / `closeNodeAt` / `leavesOf` |
| 拆分 / 移动 / 重排 / 关闭 / 权重 | `service.ts` + `store.ts` → `splitPane` / `moveTabToPane` / `insertTabBefore` / `closePane` / `setSplitNodeWeights` |

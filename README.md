# dsh-workspace-sidebar

工作台主插件：DeepSeek Harness 侧边栏入口 + 帧级工作台覆盖层（左 / 中 / 右 / 底区域）。

## 介绍

为 DeepSeek Harness 打造的经典 IDE 级工作台框架

本插件为 DeepSeek Harness 提供了一套非侵入式的**主体布局框架**，复刻经典工作台模型。在侧边栏入口之上，叠加了一个帧级覆盖层工作台，将屏幕划分为左、中、右、底四个核心区域。

- 全能工作区：四个区域均可自由放置任意工具面板，原生支持标签页管理、拖拽分屏及多种停靠模式，满足复杂开发场景需求。

- 无缝切换：对话区完整保留在幕后，用户可随时一键唤回，实现“工作台”与“对话”的双模无缝流转。

- 零侵入设计：插件**不接管 DeepSeek Harness 根布局**（不 disable `ui-layout`，不重写原生不重写布局 / 主题），以最低的侵入性实现功能扩展，确保与 DeepSeek Harness 未来版本的兼容与平滑升级。


## 功能

- **可自定义的工作台布局**：把工具面板放到对应区域（左 / 中 / 右 / 底），按需组合自己的工作台；
  拖拽分屏任意拆分 / 移动 / 重排，布局持久化（刷新保留）。
- **插件即插即用（需满足工作台插件规范）**：第三方插件按规范 `registerWidget` 注册
  （`WidgetDescriptor`：id / title / icon / region / 组件），即可出现在对应区域并参与拖拽分屏；
- **四区域**：全屏模式下 左 / 中 / 右 / 底 四区域，各放独立 widget 面板；
- **标签页 + 多开**：每面板多个标签（点击切换 / ✕ 关闭 / + 新建）；`multi` widget 可开多个实例（互不干扰）；
- **拖拽分屏**：标签拖到面板边缘=拆分、中心=移入、标签上=重排；分隔条拖调权重；任意递归嵌套；
- **停靠模式**：左 / 右 / 底面板浮现、对话区保留（边聊边用工具），可同时同屏；
- **声明式设置**：widget 声明 `settings`，设置页统一渲染（两列卡片 + 手风琴 + 启停开关）；
- **自适应主题**：跟随 DeepSeek Harness 浅色 / 深色 / 跟随系统；
- **服务化 + 按需加载**：组件懒加载，首次激活才加载。

> ⚠️ **不保证**：仅保证**遵循工作台插件规范**（`registerWidget` / `WidgetDescriptor`）的插件能正常
> 放置到对应区域并参与拖拽分屏；**不遵循规范的第三方组件不保证能显示 / 正常工作**。

## 安装

```bash
cd <本插件目录>
pnpm install 
pnpm run build
dsh plugin --profile web add <本插件目录>
```

## 卸载

```bash
dsh plugin --profile web remove dsh-workspace-sidebar
```

## 快速开始（使用）

1. `dsh web` 启动后，DeepSeek Harness 侧边栏底部出现「🗂 工作台」按钮；
2. 点击展开**全屏工作台**（四区域同屏）；
3. 在 TabBar 点 **+** 打开 widget（或拖标签到面板边缘**拆分**、中心**移入**、标签上**重排**）；
4. 再点按钮 / **✕** / **ESC** 收起（停靠面板 ✕ 只收起当前面板）。

> 给工作台加你自己的工具面板：见 [`.skills/workspace-plugin-guide/SKILL.md`](.skills/workspace-plugin-guide/SKILL.md)（含最小示例）。

## 使用

- **打开 / 关闭**：侧边栏底部按钮展开（全屏独占）；全屏 ✕ / ESC 关闭整个；停靠面板 ✕ 只关当前面板；与其它侧车入口互斥。
- **模式切换**：工具栏全屏 / 左 / 右 / 底（开停靠关全屏；停靠可同时开「左/右/底同屏」）。
- **标签**：点击切换（keep-alive 保留状态）、✕ 关闭、+ 新建；**多开** widget 可开多个实例（`#N` 编号）。
- **拖拽分屏**：拖标签到面板边缘=拆分、中心=移入、标签上=插到其前；分隔条拖调权重；pane 右上 ✕ 关闭该面板（其内 tab 一并关闭）。
- **设置**：DeepSeek Harness 设置页「工作台」分区——布局配置（L1）+ 各插件设置（L2，两列卡片 + 手风琴 + 启停开关）。


## 开发

```bash
pnpm install
pnpm run typecheck   # tsc --noEmit
pnpm run build       # esbuild src → lib（client iife + host esm）
```

> ⚠️ 宿主直接加载 `lib/` 构建产物：**改 `src/` 后必须 `pnpm run build` 重建**。

## 冒烟验证

`dsh web` 启动后侧边栏底部应出现「🗂 工作台」按钮；`dsh web` 带 `?workspace-test` 打开页面可在控制台调用：

```js
window.__dshWorkspaceTest__.registerTestWidget()   // 注册 test:alpha / beta / gamma / multi
window.__dshWorkspaceTest__.getState()
```

## 文档（参考）

规范统一维护在 **`.skills/`**（自包含、按分类）：

| 文档 | 内容 |
|---|---|
| [`.skills/README.md`](.skills/README.md) | 索引 + 快速导航 |
| [`.skills/workspace-architecture/SKILL.md`](.skills/workspace-architecture/SKILL.md) | 架构功能、状态模型、**支持的版本（§2）** |
| [`.skills/workspace-ui-layout/SKILL.md`](.skills/workspace-ui-layout/SKILL.md) | 区域/模式、工具栏、标签页、设置页布局 |
| [`.skills/workspace-interaction/SKILL.md`](.skills/workspace-interaction/SKILL.md) | 打开关闭、标签操作、拖拽分屏全流程 |
| [`.skills/workspace-theme/SKILL.md`](.skills/workspace-theme/SKILL.md) | 主题/样式规范（DeepSeek Harness token 对照、禁硬编码色） |
| [`.skills/workspace-plugin-guide/SKILL.md`](.skills/workspace-plugin-guide/SKILL.md) | 第三方 widget 接入 |
| [`.skills/workspace-dev-conventions/SKILL.md`](.skills/workspace-dev-conventions/SKILL.md) | 开发约定（DI / inject / 构建 / 高度链） |


## 支持版本

| DeepSeek Harness 版本 | 状态 |
|---|---|
| `@deepseek-ai/dsh` 0.1.1-rc.2 | ✅ 已实测 |
| `@deepseek-ai/dsh` 0.1.2-alpha.1（源码仓库） | ✅ 已实测（工作台 + 终端全功能正常） |

> 兼容矩阵统一维护在 [`.skills/workspace-architecture/SKILL.md`](.skills/workspace-architecture/SKILL.md) §2；升级 DeepSeek Harness 需回归槽位与主题 token。


## 插件市场
[参考dsh-workspace-market](https://github.com/c4sparks/dsh-workspace-market.git)

提供了该工作台插件的案例可供参考


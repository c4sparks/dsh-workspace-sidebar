# dsh-workspace-sidebar · 技能文档（分类规范）

> 本项目**权威参考**，按分类整理，改动/设计前先查对应文档。
> 内容只描述工作台**自身**，不涉及任何第三方插件。
> 与实现同步维护；改实现后需同步对应文档。

## 文档索引

| 技能（目录） | 内容 | 什么时候看 |
|---|---|---|
| [workspace-architecture](workspace-architecture/SKILL.md) | 定位、设计动机、模块结构、状态模型、数据流、持久化 | 改结构 / 理解数据 / 加模块 |
| [workspace-ui-layout](workspace-ui-layout/SKILL.md) | 四区域/四模式、工具栏、标签页、设置页布局、面板几何 | 改布局 / 加 UI 元素 / 面板尺寸 |
| [workspace-interaction](workspace-interaction/SKILL.md) | 打开关闭、标签操作、拖拽分屏全流程（落点/吸附区/越界/拆分后） | 改交互 / 拖拽 / 分屏 |
| [workspace-theme](workspace-theme/SKILL.md) | DSH token 对照、禁硬编码色、固定自定义、widget 跟随主题 | 写任何颜色 / 样式 |
| [workspace-plugin-guide](workspace-plugin-guide/SKILL.md) | `workspace` 服务 API、`WidgetDescriptor`、声明式设置、主题跟随 | 给工作台注册 widget / 扩展 |
| [workspace-dev-conventions](workspace-dev-conventions/SKILL.md) | 依赖注入、inject、构建、代码结构、类型/命名、文档同步 | 写代码前 / 改模块 / 构建 |

## 快速导航

- 想知道「为什么自建区域/模式」→ [workspace-architecture](workspace-architecture/SKILL.md) §1.1
- 想知道「区域怎么布局、模式怎么切」→ [workspace-ui-layout](workspace-ui-layout/SKILL.md) §2
- 想知道「拖拽分屏怎么用」→ [workspace-interaction](workspace-interaction/SKILL.md) §3
- 想知道「深色下颜色怎么对」→ [workspace-theme](workspace-theme/SKILL.md) §2
- 想给工作台加一个工具面板 → [workspace-plugin-guide](workspace-plugin-guide/SKILL.md)

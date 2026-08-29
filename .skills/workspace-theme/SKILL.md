---
name: workspace-theme
description: DSH token 对照、禁硬编码色、固定自定义、widget 跟随主题
---

# 主题样式规范

> 浅色 / 深色 / 跟随系统。所有涉及颜色、背景、边框、主题响应的改动都必须遵循本规范。
> 违反它会导致深色下不可见（深底深字 / 白块 / 淡线框）。

## 1. 核心原则：用 dsh 的 token，不自己封装主题层

- dsh 的 `ThemePresenter` 已负责：把 **`system` 解析成 light/dark**（上游完成）、设
  `html { color-scheme }`、`body[data-ds-dark-theme]`、把 `--dsw-alias-*` **内联到 body**。
- 插件 UI 是 body 后代，**直接用 `var(--dsw-alias-*)` 自动跟随浅/深/跟随系统**。
- **不**自己再封装一层主题变量 / 主题类。

## 2. DSH token 对照表（用对名，别用错）

| 语义 | ✅ 用这个 | ❌ 别用（dsh 没有，会兜底浅色） |
|---|---|---|
| 主文字 | `--dsw-alias-label-primary` | `--dsw-alias-fg` |
| 次要文字 | `--dsw-alias-label-secondary` | `--dsw-alias-fg-2` |
| 弱文字/占位 | `--dsw-alias-label-tertiary` | `--dsw-alias-fg-3` |
| 基础背景 | `--dsw-alias-bg-base` | — |
| 浮层/卡片背景 | `--dsw-alias-bg-layer-1`（2/3 更高层） | `--dsw-alias-bg-elevated` |
| hover 背景 | `--dsw-alias-interactive-bg-hover` | `--dsw-alias-bg-hover` / `--dsw-alias-bg-active` |
| 边框 | `--dsw-alias-border-l1` / `l2` / `l3` | — |
| 主强调色（蓝） | `--dsw-alias-state-business-primary` | `--dsw-alias-focus` |

用法示例：`color: var(--dsw-alias-label-primary, #333)`——token 正常解析时用 dsh 值，
兜底只在 dsh 无主题时生效（可保留，但不要依赖它）。

## 3. 禁止硬编码颜色

- 文字 / 背景 / 边框**必须用 token**，禁止写死 `#333`、`#444`、`#666`、`#999`、`#fff`、
  `#d1d5db` 等固定色。
- **例外**（语义色 / 主题中性，深浅通用）：
  - 状态色：绿 `#16a34a`、红 `#dc2626`；
  - 半透明浮层 / 遮罩：`rgba(0,0,0,.x)`（拖拽提示、picker 遮罩、关闭按钮）；
  - 开关滑块白点 `#fff`、开关开态蓝 `#3b82f6`；
  - **固定自定义：激活模式图标蓝 `#3b82f6`**（`-modeBtnActive` / `-footerModeActive` 的
    `color`）——故意固定写死，**不跟随 dsh token**（分隔线 / sash 的 hover 蓝仍跟随 dsh）；
  - **设置页线框例外**：设置区边框用 `1.5px solid color-mix(in srgb,
    var(--dsw-alias-label-secondary) 25%, transparent)`（dsh 边框深色下只有白 6~10%，
    几乎看不见，设置页用更明显的）。
- 新增颜色先想：深色下这个元素可见吗？写死浅色值 = 深色下可能深底深字或白块。

## 4. widget 跟随主题

- 前提：工作台插件 `inject` 含 **`theme`**，`scope.ctx.theme` 才对 widget 可用（否则
  `cannot get property "theme" without inject` → 组件崩溃、slot 崩）。
- 读当前方案：`ctx.theme.getTheme()?.active?.colorScheme`（已是 light/dark，system 已解析）。
- 响应切换：`ctx.theme.onThemeChange((snap) => …)`。
- 优先级：**用户显式设置 > dsh 主题**。

## 5. 验证

- 改完主题相关样式后，**切深色**确认所有元素可见（文字 / 背景 / hover / 边框）。
- 可临时改 `~/.dsh/settings.yaml` 的 `ui-theme.preference` 为 `dark` 实测（**记得还原**），
  或无头 Chrome 模拟 `body[data-ds-dark-theme]` + 深色 `--dsw-alias-*` 检查计算样式。

## 6. 历史教训

| 问题 | 根因 | 教训 |
|---|---|---|
| 深色工作台文字看不见 | 用 dsh 不存在的 `--dsw-alias-fg` → 兜底 `#333`（深底深字） | 必须用 `label-primary` |
| 侧车按钮/设置分区深色看不清 | 硬编码 `#111/#444/#666/#fff` | 禁止硬编码 |
| 终端等点开看不到、侧车 footer 崩 | widget 读 `props.ctx.theme` 但工作台未 inject `theme` | `inject` 含 `theme` |
| 吸附区覆盖层 right/down 画错位置 | `inset:0` 简写与 `left/top:auto` 长属性覆盖冲突 | 显式 `top/right/bottom/left:0` |

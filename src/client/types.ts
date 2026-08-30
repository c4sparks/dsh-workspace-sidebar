/**
 * dsh-workspace-sidebar — 共享类型（host + client，纯类型，构建时擦除）。
 */
import type { ReactNode } from "react";

/**
 * 宿主 client ctx 的最小接口（本插件实际用到的子集；经 adapter 防腐层访问，
 * 真实宿主 ctx 结构上满足它）。用于收紧 plugin / scope / adapter 里的 `any`。
 */
export interface DshClientCtx {
  effect(fn: () => void | (() => void), label?: string): void;
  slots: {
    inject(name: string, cb: () => unknown): () => void;
    register(options: unknown, component: unknown): () => void;
  };
  reflect: {
    provide(name: string, value: unknown): () => void;
  };
}

/** 工作台区域。 */
export type Region = "left" | "center" | "right" | "bottom";

/** 工作台覆盖层模式：全屏推挤 / 左侧停靠 / 右侧停靠 / 底部停靠。 */
export type Mode = "fullscreen" | "left" | "right" | "bottom";

/** 布局预设（仅全屏模式生效：决定区域内布局）。 */
export type PresetId = "workbench" | "focus" | "fullscreen";

/** 每个注册 widget 组件收到的 props。 */
export interface WidgetComponentProps {
  /** 是否为本区域当前激活标签。 */
  active: boolean;
  /** dsh 客户端 ctx（透传，供 widget 自行取服务）。 */
  ctx: any;
  /** 工作台服务（可选便捷引用）。 */
  service?: WorkspaceService;
  /** 该 tab 实例的唯一 id（多开时为 `widgetId:instN`；单实例恒为 widgetId）。多开 widget 用它区分实例。 */
  instanceId?: string;
}

/** widget 组件类型（同步组件或懒加载解析出的组件）。 */
export type WidgetComponent = (props: WidgetComponentProps) => ReactNode;

/** 一个由本插件或第三方插件注册的 widget 描述符。 */
export interface WidgetDescriptor {
  /** 全局唯一 id（如 'my-plugin:panel'）。 */
  id: string;
  title: string | (() => string);
  /** 标签图标：emoji / JSX / 图标函数；默认 🧩。 */
  icon?: ReactNode | ((size: number) => ReactNode);
  /** 首次注册时的默认区域（默认 center）。持久化 placement 优先。 */
  region?: Region;
  /** 区域内标签顺序（升序，默认 100）。 */
  order?: number;
  /**
   * 同步组件（轻量 widget）。与 loadComponent 二选一（同时给出时优先 component）。
   * 服务化 + 按需加载：重 widget 请用 loadComponent，组件代码在首次激活该标签
   * 时才加载，避免启动时全部加载。
   */
  component?: WidgetComponent;
  /**
   * 懒加载组件（重 widget）：首次激活该标签时才调用，返回解析出的组件（通常
   * 内部 `await import('./MyWidget.js')` 动态加载）。解析结果会被缓存，切走再
   * 切回不重复加载。
   */
  loadComponent?: () => Promise<WidgetComponent>;
  /** 声明式设置（§6）：主插件在 dsh 设置页「工作台」分区按 widget 分组渲染。 */
  settings?: WidgetSettingsDeclaration;
  /**
   * 是否可多开（同一 widget 可开出多个 tab 实例）。默认 false = 单实例（重复打开聚焦已有）。
   * 多开 widget 在 TabBar 出现「+」按钮可新建实例；每个实例收到独立的 `instanceId` prop。
   */
  multi?: boolean;
}

/** 声明式设置字段（判别联合：渲染器按 type 穷尽分发）。 */
export type WidgetSettingField =
  | { type: "number"; key: string; label: string; min?: number; max?: number }
  | { type: "switch"; key: string; label: string }
  | { type: "select"; key: string; label: string; options: { value: string; label: string }[] }
  | { type: "text"; key: string; label: string; placeholder?: string };

/** widget 声明式设置：主插件统一渲染控件 + pluginSettings[widgetId] 持久化。 */
export interface WidgetSettingsDeclaration {
  /** 主插件统一渲染的声明式控件（判别联合）。 */
  fields?: readonly WidgetSettingField[];
  /** 可选：完全自定义设置面板（拿到该 widget 的读写手柄）。 */
  render?: (handles: WidgetSettingsHandles) => ReactNode;
  /**
   * 设置卡片是否**手风琴折叠**（设置页「插件设置」卡片默认展开，头带 ▼/▲ 点击折叠）。
   * 默认 false = 卡片始终展开显示配置；true = 默认折叠，点击头部/箭头展开。
   * 各插件按需声明（如终端想收起来让卡片更紧凑）。
   */
  collapsible?: boolean;
}

/** 自定义设置面板的读写手柄（绑定该 widget 的 pluginSettings 块）。 */
export interface WidgetSettingsHandles {
  get(): Readonly<Record<string, unknown>>;
  set(key: string, value: unknown): void;
  reset(): void;
}

/** 覆盖层面板开关：左 / 右 / 底可同时打开（各自独立）；全屏独占（开时关停靠）。 */
export interface PanelsState {
  fullscreen: boolean;
  left: boolean;
  right: boolean;
  bottom: boolean;
}

/** 持久化工作台状态（schema v1）。 */
export interface WorkspaceState {
  v: 1;
  /** 覆盖层是否打开（= 任一面板开；瞬态镜像，不持久化，加载恒 false）。 */
  open: boolean;
  /** 各面板开关（瞬态，不持久化；重启收起）。 */
  panels: PanelsState;
  /** 左/右/底是否可**同时展示**（持久化）。默认 false = 独立互斥（开一个关其它）；true = 可同屏。 */
  multiPanel: boolean;
  preset: PresetId;
  /** 左/右/底区域尺寸 px；0 = 隐藏。center 为 flex 自适应。 */
  regionSizes: { left: number; right: number; bottom: number };
  /** 左侧停靠面板宽度（px）。 */
  leftW: number;
  /** 右侧停靠面板宽度（px）。 */
  rightW: number;
  /** 底部停靠面板高度（px）。 */
  bottomH: number;
  /** 停靠面板最大可拖占主内容区的比例（0.1–1；1=可拖到全屏/顶部）。 */
  dockMaxRatio: number;
  /** 分割线粗细（px，1–6）。 */
  dividerWidth: number;
  /** 分割线颜色（CSS 颜色；空字符串 = dsh token 默认）。 */
  dividerColor: string;
  /** 全屏（大屏）页面是否显示区域分割线（默认 false = 无可见分割线；停靠面板不受影响）。 */
  fullscreenDividers: boolean;
  /** 全屏中心区 tab 是否纵向排列（左侧菜单布局；默认 false = 横向顶部标签）。 */
  verticalTabs: boolean;
  /** widget id → 全屏区域意图；共享（只有全屏有区域）。 */
  placement: Record<string, Region>;
  /** 被禁用的 widget（`+` 选择列表隐藏；持久化）。 */
  disabledWidgets: Record<string, boolean>;
  /** 是否启用分屏拖拽（默认 true；关 = 不可拖拽拆分，已有分屏只读保留）。 */
  splitEnabled: boolean;
  /**
   * 每个面板（全屏 / 左侧 / 右侧 / 底部）的「已打开 tab 实例」集合——**各自独立**。
   * store/service 的 pane 操作都**显式指定 mode**（`modeState[mode]`），多面板同屏互不影响。
   */
  modeState: Record<Mode, ModeState>;
}

/** 一个模式的布局状态：分屏树 + 打开的 tab 实例（该模式的唯一事实来源）。 */
export interface ModeState {
  /** 分屏树：仅当区域被拆分时存在（未拆分 = undefined，区域用 `panes[region:main]` 表示单面板）。 */
  splits: Partial<Record<Region, SplitNode>>;
  /** pane 状态（paneId → 该 pane 的 tab 实例 + 激活）。每个有打开 tab 的区域都有
   *  一个 `region:main` pane；分屏时额外有拆分出的 pane。 */
  panes: Record<string, PaneState>;
  /** tab 实例 id → paneId（本模式内；单实例时 instanceId === widgetId）。 */
  paneOfWidget: Record<string, string>;
  /** 每个区域当前激活的**实例 id**。降级为仅 sanitize 推导的镜像，运行时不再写。 */
  activeTab: Partial<Record<Region, string | null>>;
}

/** 分屏树节点：leaf（分屏面板）或 split（横/纵、children + weights）。 */
export type SplitNode =
  | { kind: 'leaf'; paneId: string }
  | { kind: 'split'; dir: 'row' | 'col'; weights: number[]; children: SplitNode[] };

/** 一个分屏 pane 的状态（该 pane 内的 tab 实例列表 + 激活实例）。 */
export interface PaneState {
  /** tab 实例列表（同一 widget 可多开 → 多个实例 TabRef）。 */
  tabs: TabRef[];
  /** 激活实例 id（null = 空 pane）。 */
  active: string | null;
}

/** 一个 tab 实例：id（实例唯一，单实例 = widgetId；多开附加实例 = `widgetId:instN`）+ widgetId（来源插件描述符）。 */
export interface TabRef {
  id: string;
  widgetId: string;
}

/** TabBar 渲染单元：一个打开的 tab 实例（实例 id + 来源描述符解析）。 */
export interface TabItem {
  id: string;
  widgetId: string;
  desc: WidgetDescriptor;
}

/**
 * 布局控制面（store 直接满足；经 `service.layout` 暴露）。
 * 新增布局字段/配置项时只改 WorkspaceState + LayoutControl + store
 * （state / setter / sanitize），不必再往 WorkspaceService 加平铺 setter。
 * 注意：打开/关闭（open/toggle）属服务级瞬态行为（含侧车互斥广播），不在本面。
 */
export interface LayoutControl {
  getState(): WorkspaceState;
  subscribeState(fn: () => void): () => void;
  setRegionSize(region: Exclude<Region, "center">, px: number): void;
  setPreset(preset: PresetId): void;
  /** 打开/收起某面板（左/右/底可同时开；开 fullscreen 时互斥关停靠）。`open` 镜像自动同步。 */
  setPanels(patch: Partial<PanelsState>): void;
  /** 设置左/右/底是否可同时展示（false = 独立互斥，开一个关其它）。 */
  setMultiPanel(on: boolean): void;
  /** 设置是否启用分屏拖拽（false = 不可拖拽拆分）。 */
  setSplitEnabled(on: boolean): void;
  /** 设置左侧 / 右侧停靠宽度（px）、底部停靠高度（px），范围放开到几乎占满。 */
  setModeSize(mode: "left" | "right" | "bottom", px: number): void;
  setDockMaxRatio(ratio: number): void;
  setDividerWidth(px: number): void;
  setDividerColor(color: string): void;
  /** 全屏页面是否显示区域分割线（false = 不显示；停靠面板不受影响）。 */
  setFullscreenDividers(on: boolean): void;
  /** 全屏中心区 tab 纵向排列开关。 */
  setVerticalTabs(on: boolean): void;
  /** 重置布局：内存恢复默认 + 清除 localStorage（同步，不依赖 reload）。 */
  reset(): void;
  flushSave(): void;
}

/**
 * 公开的 `workspace` 服务（ctx.reflect.provide('workspace', …)）。
 * 布局读取/配置走 `layout`（可扩展面）；下方的平铺布局 setter 为向后兼容别名。
 * 所有 tab 实例操作（openWidget/closeTab/getTabRefs/getTabs/setActiveWidget/分屏）
 * 都作用于**指定面板**（`modeState[mode]`，`mode` 默认当前打开面板，缺省 fullscreen）。
 * 左 / 右 / 底面板可**同时打开**、各自独立；全屏独占。
 */
export interface WorkspaceService {
  /** 布局控制面（store 直通；新增布局字段走这里）。 */
  readonly layout: LayoutControl;
  /** 注册 widget；重复 id 告警并忽略（返回 no-op disposer）；正常返回幂等 disposer（cordis 在 fiber 卸载时自动调用）。
   *  首次注册仅记录 placement 意图，**不自动开 tab 实例**——widget 一律由用户在工作台点「+」打开；
   *  重复注册 / 已注册过 → 不动任何 tab。 */
  registerWidget(desc: WidgetDescriptor): () => void;
  /** 卸载 widget；不存在则 no-op；被卸载 widget 的激活实例顺位提升。已打开的实例不自动删除（HMR 安全）。 */
  unregisterWidget(id: string): void;
  getWidgets(): readonly WidgetDescriptor[];
  getWidget(id: string): WidgetDescriptor | undefined;
  /** 启用 / 禁用某 widget（禁用后从「+」选择列表隐藏；持久化）。 */
  setWidgetDisabled(id: string, disabled: boolean): void;
  /** 某 widget 是否被禁用。 */
  isWidgetDisabled(id: string): boolean;
  /**
   * 打开（或聚焦）某 widget 的 tab 实例（面板 `opts.mode`，默认当前打开面板）：
   * - 每面板单实例（默认）：该面板已有实例 → 聚焦；否则补建（每面板至多一个）。
   * - 多实例（`multi:true`）：总是新建一个实例 tab。
   * 返回实例 id（未注册的 widget 返回 undefined）。
   */
  openWidget(widgetId: string, opts?: { mode?: Mode; region?: Region; paneId?: string }): string | undefined;
  /** 关闭一个 tab 实例（实例 id 全局唯一，自动定位所在面板；单实例 widget 关掉后隐藏、可重开）。 */
  closeTab(instanceId: string): void;
  /** 某 widget 在整个工作台（跨全面板）的已打开实例总数（多开标签计数用）。 */
  getWidgetInstanceCount(widgetId: string): number;
  /** 某面板某区域所有 pane 里按 pane 顺序排的打开实例列表（无实例返回空数组）。 */
  getTabRefs(region: Region, mode?: Mode): readonly TabRef[];
  /** 某面板某区域内已打开实例对应的 widget 描述符（按实例出现顺序、按 widgetId 去重）。 */
  getTabs(region: Region, mode?: Mode): readonly WidgetDescriptor[];
  /** 注册表变化订阅。 */
  subscribe(fn: () => void): () => void;
  getState(): WorkspaceState;
  /** 布局状态变化订阅（panels / 尺寸 / 预设 / placement / 激活）。 */
  subscribeState(fn: () => void): () => void;
  /** 打开：全屏面板（独占）。 */
  open(): void;
  /** 开关：开则全部收起；否则全屏打开。 */
  toggle(): void;
  /** 收起全部面板。 */
  close(): void;
  isOpen(): boolean;
  /** 激活某面板某区域的标签（id 为 tab 实例 id；经 paneOfWidget 路由到该面板对应 pane）。 */
  setActiveWidget(region: Region, id: string, mode?: Mode): void;
  /** 把 widget 移到某面板某区域：更新 placement 意图 + 移动该面板该 widget 的全部打开实例。 */
  setWidgetRegion(id: string, region: Region, mode?: Mode): void;
  setRegionSize(region: Exclude<Region, "center">, px: number): void;
  setPreset(preset: PresetId): void;
  /** 面板开关：开着→收起该面板；关着→打开（开停靠关全屏，开全屏关全部停靠）。 */
  toggleMode(mode: Mode): void;
  /** 设置左侧 / 右侧停靠宽度（px）、底部停靠高度（px）。 */
  setModeSize(mode: "left" | "right" | "bottom", px: number): void;
  /** 重置工作台布局（内存恢复默认 + 清 localStorage）。 */
  resetLayout(): void;
  /** 停靠面板最大可拖占比（0.1–1）。 */
  setDockMaxRatio(ratio: number): void;
  /** 分割线粗细（px）。 */
  setDividerWidth(px: number): void;
  /** 分割线颜色（CSS 颜色；空串 = dsh token 默认）。 */
  setDividerColor(color: string): void;
  /** 全屏页面是否显示区域分割线（false = 不显示；停靠面板不受影响）。 */
  setFullscreenDividers(on: boolean): void;
  /** 全屏中心区 tab 纵向排列开关。 */
  setVerticalTabs(on: boolean): void;
  // ---- 分屏（见 docs/分屏设计.md；均作用于指定面板 mode）----
  /** 读某面板各区域分屏树（未拆分的区域无条目）。 */
  getSplits(mode?: Mode): Readonly<Partial<Record<Region, SplitNode>>>;
  /** 拆分某面板区域的面板：把被拖拽的 tab 实例移入新面板（dir=row 左右 / col 上下，before=新面板放前）。 */
  splitPane(region: Region, paneId: string, dir: 'row' | 'col', instanceId: string, mode?: Mode, before?: boolean): void;
  /** 把一个 tab 实例移到某面板的某 pane（center 落点：不拆分，直接移入）。 */
  moveTab(instanceId: string, paneId: string, mode?: Mode): void;
  /** 把一个 tab 实例插到另一个 tab 实例前（同 pane 重排 / 跨 pane 移入；拖到标签上时用）。 */
  insertTabBefore(instanceId: string, beforeId: string): void;
  /** 关闭某面板某分屏面板（父 split 只剩一个时折叠为单面板，清空 splits[region]）。 */
  closePane(region: Region, paneId: string, mode?: Mode): void;
  /** 把某 widget 在某面板的全部打开实例移到另一分屏面板（保持 API 兼容）。 */
  moveWidgetToPane(widgetId: string, paneId: string, mode?: Mode): void;
  /** 调整某面板分屏树某 split 节点权重（分隔条拖拽；path=从根到该 split 的子索引，index=分隔条位置）。 */
  setSplitWeights(region: Region, path: number[], index: number, ratio: number, mode?: Mode): void;
  /** 整体设置某面板某 split 节点权重（allotment onChange 用）。 */
  setSplitNodeWeights(region: Region, path: number[], weights: number[], mode?: Mode): void;
  /** 读某 widget 的设置块（`pluginSettings[id]`；无则空对象）。 */
  getWidgetSettings(id: string): Readonly<Record<string, unknown>>;
  /** 写某 widget 的设置块（合并 patch；仅 JSON 可序列化值）。 */
  setWidgetSettings(id: string, patch: Record<string, unknown>): void;
  /** 清空某 widget 的设置块。 */
  resetWidgetSettings(id: string): void;
  /** 设置块变化订阅。 */
  subscribeWidgetSettings(fn: () => void): () => void;
  /** 设置块单调版本号（useSyncExternalStore 快照用）。 */
  getSettingsVersion(): number;
  readonly version: string;
}

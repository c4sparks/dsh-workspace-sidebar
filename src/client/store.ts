/**
 * dsh-workspace-sidebar — 纯逻辑布局存储（无 React 依赖）。
 *
 * WorkspaceStore 持有可变 state（不可变更新 + 订阅通知 + 防抖持久化），React
 * 侧通过 useSyncExternalStore 读取。持久化 schema v1，加载时 sanitize 兜底，
 * open / panels 恒不持久化。
 *
 * 面板模型（v4）：左 / 右 / 底**可同时打开**、各自独立；全屏独占（开时关停靠）。
 * 每个面板有自己的「已打开 tab 实例」集合（`modeState[mode]`）。所有 pane 操作
 * 都**显式指定 mode**（`modeState[mode]`）——多面板同屏时每个面板操作互不影响。
 * 实例 id 跨面板全局唯一（`removeTab`/`getPaneForInstance` 自动定位所在面板）。
 */
import {
  BOTTOM_MAX_FRACTION, BOTTOM_MODE_DEFAULT, BOTTOM_MODE_MAX, BOTTOM_MODE_MIN, BOTTOM_MIN,
  DOCK_DEFAULT, DOCK_MAX, DOCK_MIN, LEFT_DEFAULT, LEFT_MAX, LEFT_MIN,
  MODES, PERSIST_DEBOUNCE_MS, PRESETS,
  REGION_BOTTOM_MAX, RIGHT_MAX, RIGHT_MIN, WIDGET_SETTINGS_KEY, WS_KEY
} from "./constants";
import type { LayoutControl, Mode, ModeState, PanelsState, PaneState, PresetId, Region, SplitNode, TabRef, WorkspaceState } from "./types";
import { closeNodeAt, leavesOf, sanitizeSplitNode, splitNodeAt } from "./split-tree";

export function clampWidth(px: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(px)));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const REGIONS: Region[] = ["left", "center", "right", "bottom"];

/** 空的模式状态（无拆分、无打开实例）。 */
function emptyModeState(): ModeState {
  return { splits: {}, panes: {}, paneOfWidget: {}, activeTab: {} };
}

/** 默认面板开关：全关（瞬态）。 */
function emptyPanels(): PanelsState {
  return { fullscreen: false, left: false, right: false, bottom: false };
}

/** 默认工作台状态（schema v1；4 面板各自独立的打开实例集合）。 */
export function defaultWorkspace(): WorkspaceState {
  return {
    v: 1,
    open: false,
    panels: emptyPanels(),
    multiPanel: false,
    preset: "workbench",
    regionSizes: { left: LEFT_DEFAULT, right: 0, bottom: 0 },
    leftW: DOCK_DEFAULT,
    rightW: DOCK_DEFAULT,
    bottomH: BOTTOM_MODE_DEFAULT,
    dockMaxRatio: 1,
    dividerWidth: 1,
    dividerColor: "",
    fullscreenDividers: false,
    placement: {},
    disabledWidgets: {},
    splitEnabled: true,
    modeState: {
      fullscreen: emptyModeState(),
      left: emptyModeState(),
      right: emptyModeState(),
      bottom: emptyModeState()
    }
  };
}

/**
 * 校验 + 归一化一个面板的 ModeState。
 * `materializeFromPlacement` 仅用于**旧平铺数据迁移**（旧数据只有 placement 无 panes）：
 * 从 placement 为每个区域具象化 `region:main` pane。新面板数据 panes 已持久化，无需。
 */
function sanitizeModeState(raw: unknown, placement: Record<string, Region>, materializeFromPlacement: boolean): ModeState {
  const out = emptyModeState();
  if (!isPlainObject(raw)) return out;
  if (isPlainObject(raw.splits)) {
    for (const [r, tree] of Object.entries(raw.splits)) {
      if (REGIONS.indexOf(r as Region) >= 0 && isPlainObject(tree)) {
        const t = sanitizeSplitNode(tree as SplitNode);
        if (t !== null) out.splits[r as Region] = t;
      }
    }
  }
  // pane → tab 实例列表（TabRef[]）：旧字符串 tab / 新对象 tab 均收，按实例 id 去重
  if (isPlainObject(raw.panes)) {
    for (const [paneId, p] of Object.entries(raw.panes)) {
      if (!isPlainObject(p) || !Array.isArray(p.tabs)) continue;
      const tabs: TabRef[] = [];
      const seen = new Set<string>();
      for (const t of p.tabs) {
        let ref: TabRef | null = null;
        if (typeof t === "string") {
          ref = { id: t, widgetId: t };                 // 旧数据：字符串即实例 id == widgetId
        } else if (isPlainObject(t) && typeof t.widgetId === "string") {
          ref = { id: typeof t.id === "string" && t.id !== "" ? t.id : t.widgetId, widgetId: t.widgetId };
        }
        if (ref !== null && !seen.has(ref.id)) { seen.add(ref.id); tabs.push(ref); }
      }
      const active = (typeof p.active === "string" && seen.has(p.active)) ? p.active : (tabs[0]?.id ?? null);
      out.panes[paneId] = { tabs: tabs, active: active };
    }
  }
  for (const r of REGIONS) {
    if (out.splits[r] !== undefined) {
      // 分屏区域：activeTab 镜像 = 首个叶子 pane 的激活实例（legacy 读取兼容）
      const firstLeaf = leavesOf(out.splits[r]!)[0];
      out.activeTab[r] = firstLeaf ? (out.panes[firstLeaf]?.active ?? null) : null;
      continue;
    }
    if (out.panes[r + ":main"] !== undefined) {
      out.activeTab[r] = out.panes[r + ":main"].active;
      continue;
    }
    // 仅迁移场景：从 placement 具象化 `region:main`（closePane 折叠合并结果不能被覆盖）
    if (!materializeFromPlacement) { out.activeTab[r] = null; continue; }
    const wids = Object.keys(placement).filter((w) => placement[w] === r);
    if (wids.length === 0) { out.activeTab[r] = null; continue; }
    const tabs: TabRef[] = wids.map((w) => ({ id: w, widgetId: w }));
    const active = (typeof out.activeTab[r] === "string" && tabs.some((t) => t.id === out.activeTab[r]))
      ? out.activeTab[r] : (tabs[0].id ?? null);
    out.panes[r + ":main"] = { tabs: tabs, active: active };
    out.activeTab[r] = active;
  }
  // 统一 paneOfWidget（instanceId → paneId）：迁移旧条目（校验 pane 存在）+ 补全全部实例
  if (isPlainObject(raw.paneOfWidget)) {
    for (const [wid, paneId] of Object.entries(raw.paneOfWidget)) {
      if (typeof paneId === "string" && out.panes[paneId] !== undefined) out.paneOfWidget[wid] = paneId;
    }
  }
  for (const [paneId, p] of Object.entries(out.panes)) {
    for (const t of p.tabs) out.paneOfWidget[t.id] = paneId;
  }
  return out;
}

/** 校验 + 归一化已解析的持久化 blob；非法字段回落默认。 */
export function sanitizeWorkspace(parsed: unknown): WorkspaceState {
  const d = defaultWorkspace();
  if (!isPlainObject(parsed) || parsed.v !== 1) return d;
  const out: WorkspaceState = { ...d };
  if (typeof parsed.preset === "string" && PRESETS[parsed.preset as PresetId]) {
    out.preset = parsed.preset as PresetId;
  }
  if (parsed.multiPanel === true) out.multiPanel = true;
  if (parsed.splitEnabled === false) out.splitEnabled = false;
  // open / panels 恒不持久化
  out.open = false;
  out.panels = emptyPanels();
  const rs = isPlainObject(parsed.regionSizes) ? parsed.regionSizes : {};
  out.regionSizes = {
    left: typeof rs.left === "number" && isFinite(rs.left) ? (rs.left === 0 ? 0 : clampWidth(rs.left, LEFT_MIN, LEFT_MAX)) : d.regionSizes.left,
    right: typeof rs.right === "number" && isFinite(rs.right) ? (rs.right === 0 ? 0 : clampWidth(rs.right, RIGHT_MIN, RIGHT_MAX)) : d.regionSizes.right,
    bottom: typeof rs.bottom === "number" && isFinite(rs.bottom) ? (rs.bottom === 0 ? 0 : clampWidth(rs.bottom, BOTTOM_MIN, REGION_BOTTOM_MAX)) : d.regionSizes.bottom
  };
  if (typeof parsed.leftW === "number" && isFinite(parsed.leftW)) {
    out.leftW = clampWidth(parsed.leftW, DOCK_MIN, DOCK_MAX);
  }
  if (typeof parsed.rightW === "number" && isFinite(parsed.rightW)) {
    out.rightW = clampWidth(parsed.rightW, DOCK_MIN, DOCK_MAX);
  }
  if (typeof parsed.bottomH === "number" && isFinite(parsed.bottomH)) {
    out.bottomH = clampWidth(parsed.bottomH, BOTTOM_MODE_MIN, BOTTOM_MODE_MAX);
  }
  if (typeof parsed.dockMaxRatio === "number" && isFinite(parsed.dockMaxRatio)) {
    out.dockMaxRatio = clampWidth(parsed.dockMaxRatio * 100, 10, 100) / 100;
  }
  if (typeof parsed.dividerWidth === "number" && isFinite(parsed.dividerWidth)) {
    out.dividerWidth = clampWidth(parsed.dividerWidth, 1, 6);
  }
  if (typeof parsed.dividerColor === "string") {
    out.dividerColor = parsed.dividerColor;
  }
  if (typeof parsed.fullscreenDividers === "boolean") {
    out.fullscreenDividers = parsed.fullscreenDividers;
  }
  out.placement = {};
  if (isPlainObject(parsed.placement)) {
    for (const [k, v] of Object.entries(parsed.placement)) {
      if (REGIONS.indexOf(v as Region) >= 0) out.placement[k] = v as Region;
    }
  }
  out.disabledWidgets = {};
  if (isPlainObject(parsed.disabledWidgets)) {
    for (const [k, v] of Object.entries(parsed.disabledWidgets)) {
      if (v === true) out.disabledWidgets[k] = true;
    }
  }
  // 面板状态：新模式数据逐面板 sanitize；旧平铺数据迁移进 fullscreen（区域只存在于全屏）
  out.modeState = {
    fullscreen: emptyModeState(),
    left: emptyModeState(),
    right: emptyModeState(),
    bottom: emptyModeState()
  };
  if (isPlainObject(parsed.modeState)) {
    for (const m of MODES) {
      out.modeState[m.id] = sanitizeModeState(parsed.modeState[m.id], out.placement, false);
    }
  } else {
    out.modeState.fullscreen = sanitizeModeState(parsed, out.placement, true);
  }
  return out;
}

export function loadWorkspace(): WorkspaceState {
  let ws = defaultWorkspace();
  try {
    const raw = localStorage.getItem(WS_KEY);
    if (raw !== null) ws = sanitizeWorkspace(JSON.parse(raw));
  } catch { /* storage 不可用 / 非法 JSON → 默认 */ }
  return ws;
}

/** 持久化时不写入 open / panels（transient）。 */
export function saveWorkspace(ws: WorkspaceState): void {
  try { localStorage.setItem(WS_KEY, JSON.stringify({ ...ws, open: false, panels: emptyPanels() })); }
  catch { /* storage 满 / 不可用 — 忽略 */ }
}

// ---- widget 声明式设置持久化（独立键，schema 升级不牵连布局）----

/** 仅收 JSON 可序列化值（递归）。 */
export function isJsonSerializable(v: unknown): boolean {
  return v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean"
    || (Array.isArray(v) && v.every(isJsonSerializable))
    || (isPlainObject(v) && Object.values(v).every(isJsonSerializable));
}

/** 校验 + 归一化 pluginSettings blob（丢弃非法块 / 非法值）。 */
export function sanitizeWidgetSettings(parsed: unknown): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  if (!isPlainObject(parsed)) return out;
  for (const [id, block] of Object.entries(parsed)) {
    if (!isPlainObject(block)) continue;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(block)) {
      if (isJsonSerializable(v)) clean[k] = v;
    }
    if (Object.keys(clean).length > 0) out[id] = clean;
  }
  return out;
}

export function loadWidgetSettings(): Record<string, Record<string, unknown>> {
  let s: Record<string, Record<string, unknown>> = {};
  try {
    const raw = localStorage.getItem(WIDGET_SETTINGS_KEY);
    if (raw !== null) s = sanitizeWidgetSettings(JSON.parse(raw));
  } catch { /* 不可用 / 非法 → 空 */ }
  return s;
}

export function saveWidgetSettings(s: Record<string, Record<string, unknown>>): void {
  try { localStorage.setItem(WIDGET_SETTINGS_KEY, JSON.stringify(s)); }
  catch { /* 忽略 */ }
}

/** 空块常量：缺失 id 的 getWidgetSettings 返回同一引用（useSyncExternalStore 快照稳定）。 */
const EMPTY_SETTINGS: Readonly<Record<string, unknown>> = {};

/** 布局存储：getState/subscribe + 各 setter（不可变更新 + 通知 + 防抖保存）。LayoutControl 见 types.ts。 */
export interface WorkspaceStore extends LayoutControl {
  /** 打开/收起面板开关（open 镜像自动同步）。 */
  setOpen(open: boolean): void;
  toggle(): void;
  /** 合并面板开关（左/右/底可同时开；open 镜像自动同步）。 */
  setPanels(patch: Partial<PanelsState>): void;
  /** 设置某面板某区域（单面板 `region:main`）的激活实例。旧 `setActiveTab` 的替代。 */
  setRegionActive(mode: Mode, region: Region, id: string | null): void;
  /** 已废弃：等价 `setRegionActive(mode, region, id)`。 */
  setActiveTab(mode: Mode, region: Region, id: string | null): void;
  /** 查某 tab 实例所在 paneId（跨面板扫描；实例 id 全局唯一）。 */
  getPaneForInstance(instanceId: string): string | undefined;
  setPlacement(id: string, region: Region): void;
  /** 启用 / 禁用某 widget（禁用后从「+」选择列表隐藏；持久化）。 */
  setWidgetDisabled(id: string, disabled: boolean): void;
  /** 某 widget 是否被禁用。 */
  isWidgetDisabled(id: string): boolean;
  // ---- widget 声明式设置（pluginSettings[id] 持久化块）----
  getWidgetSettings(id: string): Readonly<Record<string, unknown>>;
  setWidgetSettings(id: string, patch: Record<string, unknown>): void;
  resetWidgetSettings(id: string): void;
  subscribeWidgetSettings(fn: () => void): () => void;
  getSettingsVersion(): number;
  // ---- 分屏 + tab 实例（显式指定面板 mode）----
  getSplits(mode: Mode): Readonly<Partial<Record<Region, SplitNode>>>;
  /** 拆分某面板区域的面板：把被拖拽的 tab 实例移入新面板（不存在则创建）。before=true 新面板放前。 */
  splitPane(mode: Mode, region: Region, paneId: string, dir: 'row' | 'col', instanceId: string, before?: boolean): void;
  closePane(mode: Mode, region: Region, paneId: string): void;
  /** 把某面板一个 tab 实例移到另一分屏面板。 */
  moveTabToPane(mode: Mode, instanceId: string, paneId: string): void;
  /** 把一个 tab 实例插到另一个 tab 实例前（同 pane 重排 / 跨 pane 移入；拖到标签上时用）。 */
  insertTabBefore(instanceId: string, beforeId: string): void;
  /** 设置某面板某分屏面板的激活实例。 */
  setPaneActive(mode: Mode, paneId: string, id: string | null): void;
  /** 设置指定面板某分屏面板的激活实例（跨面板用：如插件卸载时提升其它面板的激活）。 */
  setModePaneActive(mode: Mode, paneId: string, id: string | null): void;
  /** 把某面板一个 tab 实例加入某 pane（不存在则创建；同实例已存在则仅聚焦；同时记 paneOfWidget）。 */
  addTabToPane(mode: Mode, paneId: string, tab: TabRef): void;
  /** 关闭一个 tab 实例（实例 id 全局唯一，自动定位所在面板；active 顺位下一个；空 pane 保留）。 */
  removeTab(instanceId: string): void;
  /** 调整某面板分屏树某 split 节点的权重（path = 从根到该 split 的子索引；index = 分隔条位置）。 */
  setSplitWeights(mode: Mode, region: Region, path: number[], index: number, ratio: number): void;
  /** 整体设置某面板某 split 节点的权重数组（allotment onChange 用）。 */
  setSplitNodeWeights(mode: Mode, region: Region, path: number[], weights: number[]): void;
}

export function createWorkspaceStore(): WorkspaceStore {
  let state = loadWorkspace();
  const listeners = new Set<() => void>();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  // widget 声明式设置（pluginSettings[id] 持久化块）
  let pluginSettings = loadWidgetSettings();
  const settingsListeners = new Set<() => void>();
  let settingsVersion = 0;
  let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let nextPaneSeq = 0; // 分屏 paneId 序列

  function emit(): void {
    for (const fn of listeners) fn();
    scheduleSave();
  }
  function scheduleSave(): void {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveTimer = null; saveWorkspace(state); }, PERSIST_DEBOUNCE_MS);
  }
  function flush(): void {
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
    saveWorkspace(state);
  }
  function emitSettings(): void {
    settingsVersion++;
    for (const fn of settingsListeners) fn();
    scheduleSettingsSave();
  }
  function scheduleSettingsSave(): void {
    if (settingsSaveTimer !== null) clearTimeout(settingsSaveTimer);
    settingsSaveTimer = setTimeout(function () { settingsSaveTimer = null; saveWidgetSettings(pluginSettings); }, PERSIST_DEBOUNCE_MS);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flush();
    });
  }

  function regionMax(region: Exclude<Region, "center">): number {
    if (region === "left") return LEFT_MAX;
    if (region === "right") return RIGHT_MAX;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    return Math.max(BOTTOM_MIN, Math.round(h * BOTTOM_MAX_FRACTION));
  }
  function regionMin(region: Exclude<Region, "center">): number {
    if (region === "left") return LEFT_MIN;
    if (region === "right") return RIGHT_MIN;
    return BOTTOM_MIN;
  }

  /** 某面板的打开实例状态（左/右/底可同时开，各自独立）。 */
  function msFor(mode: Mode): ModeState {
    return state.modeState[mode];
  }
  /** 定位某 tab 实例所在面板 + pane（实例 id 跨面板全局唯一）。 */
  function locateInstance(id: string): { mode: Mode; paneId: string } | undefined {
    for (const m of MODES) {
      const ms0 = state.modeState[m.id];
      const p = ms0.paneOfWidget[id];
      if (p !== undefined && ms0.panes[p] !== undefined) return { mode: m.id, paneId: p };
    }
    for (const m of MODES) {
      const ms0 = state.modeState[m.id];
      for (const [paneId, pn] of Object.entries(ms0.panes)) {
        if (pn.tabs.some((t) => t.id === id)) return { mode: m.id, paneId };
      }
    }
    return undefined;
  }

  /** 设置某面板某区域（单面板 `region:main`）的激活实例。空区域也建空 pane 记录。 */
  function setRegionActiveImpl(mode: Mode, region: Region, id: string | null): void {
    const ms0 = msFor(mode);
    const paneId = region + ":main";
    const p = ms0.panes[paneId];
    let panes;
    if (p !== undefined) {
      if (p.active === id) return;
      panes = { ...ms0.panes, [paneId]: { ...p, active: id } };
    } else {
      panes = { ...ms0.panes, [paneId]: { tabs: [], active: id } };
    }
    state = { ...state, modeState: { ...state.modeState, [mode]: { ...ms0, panes } } };
    emit();
  }

  return {
    getState: function () { return state; },
    subscribeState: function (fn) {
      listeners.add(fn);
      return function () { listeners.delete(fn); };
    },
    setOpen: function (open) {
      if (state.open === open) return;
      state = open
        ? { ...state, panels: { fullscreen: true, left: false, right: false, bottom: false }, open: true }
        : { ...state, panels: emptyPanels(), open: false };
      emit();
    },
    toggle: function () {
      state = state.open
        ? { ...state, panels: emptyPanels(), open: false }
        : { ...state, panels: { fullscreen: true, left: false, right: false, bottom: false }, open: true };
      emit();
    },
    setPanels: function (patch) {
      const panels = { ...state.panels, ...patch };
      const open = panels.fullscreen || panels.left || panels.right || panels.bottom;
      const changed = state.open !== open
        || Object.keys(patch).some(function (k) { return state.panels[k as keyof PanelsState] !== patch[k as keyof PanelsState]; });
      if (!changed) return;
      state = { ...state, panels: panels, open: open };
      emit();
    },
    setRegionActive: setRegionActiveImpl,
    setActiveTab: function (mode, region, id) { setRegionActiveImpl(mode, region, id); },
    getPaneForInstance: function (instanceId) { return locateInstance(instanceId)?.paneId; },
    addTabToPane: function (mode, paneId, tab) {
      const ms0 = msFor(mode);
      // 防重复：同实例已在其它 pane → 仅聚焦（实例 id 全局唯一；跨面板实例不重复加）
      const loc = locateInstance(tab.id);
      if (loc !== undefined && loc.paneId !== paneId) {
        if (loc.mode === mode) {
          const p2 = ms0.panes[loc.paneId];
          if (p2 !== undefined && p2.active !== tab.id) {
            state = { ...state, modeState: { ...state.modeState, [mode]: { ...ms0, panes: { ...ms0.panes, [loc.paneId]: { ...p2, active: tab.id } } } } };
            emit();
          }
        }
        return;
      }
      const p = ms0.panes[paneId];
      const nextPanes = { ...ms0.panes };
      if (p !== undefined) {
        if (p.tabs.some(function (t) { return t.id === tab.id; })) {
          // 已存在同实例：仅聚焦
          if (p.active === tab.id) return;
          nextPanes[paneId] = { ...p, active: tab.id };
        } else {
          nextPanes[paneId] = { tabs: p.tabs.concat(tab), active: tab.id };
        }
      } else {
        nextPanes[paneId] = { tabs: [tab], active: tab.id };
      }
      state = { ...state, modeState: { ...state.modeState, [mode]: { ...ms0, panes: nextPanes, paneOfWidget: { ...ms0.paneOfWidget, [tab.id]: paneId } } } };
      emit();
    },
    removeTab: function (instanceId) {
      const loc = locateInstance(instanceId);
      if (loc === undefined) return;
      const ms0 = msFor(loc.mode);
      const p = ms0.panes[loc.paneId];
      if (p === undefined) return;
      const tabs = p.tabs.filter(function (t) { return t.id !== instanceId; });
      if (tabs.length === p.tabs.length) return; // 实例不存在
      const active = p.active === instanceId ? (tabs[0]?.id ?? null) : p.active;
      const paneOfWidget = { ...ms0.paneOfWidget };
      delete paneOfWidget[instanceId];
      state = { ...state, modeState: { ...state.modeState, [loc.mode]: { ...ms0, panes: { ...ms0.panes, [loc.paneId]: { tabs: tabs, active: active } }, paneOfWidget: paneOfWidget } } };
      emit();
    },
    setRegionSize: function (region, px) {
      const next = px <= 0 ? 0 : clampWidth(px, regionMin(region), regionMax(region));
      if (state.regionSizes[region] === next) return;
      state = { ...state, regionSizes: { ...state.regionSizes, [region]: next } };
      emit();
    },
    setPreset: function (preset) {
      const p = PRESETS[preset];
      if (!p) return;
      state = { ...state, preset: preset, regionSizes: { ...p.regionSizes } };
      emit();
    },
    setMultiPanel: function (on) {
      if (state.multiPanel === on) return;
      state = { ...state, multiPanel: on };
      emit();
    },
    setSplitEnabled: function (on) {
      if (state.splitEnabled === on) return;
      state = { ...state, splitEnabled: on };
      emit();
    },
    setModeSize: function (mode, px) {
      if (mode === "bottom") {
        const max = (typeof window !== "undefined" ? window.innerHeight : 800);
        const next = clampWidth(px, BOTTOM_MODE_MIN, max);
        if (state.bottomH === next) return;
        state = { ...state, bottomH: next };
        emit();
        return;
      }
      const max = (typeof window !== "undefined" ? window.innerWidth : 1200);
      if (mode === "left") {
        const next = clampWidth(px, DOCK_MIN, max);
        if (state.leftW === next) return;
        state = { ...state, leftW: next };
      } else {
        const next = clampWidth(px, DOCK_MIN, max);
        if (state.rightW === next) return;
        state = { ...state, rightW: next };
      }
      emit();
    },
    setPlacement: function (id, region) {
      if (state.placement[id] === region) return;
      state = { ...state, placement: { ...state.placement, [id]: region } };
      emit();
    },
    setWidgetDisabled: function (id, disabled) {
      const cur = state.disabledWidgets[id] === true;
      if (cur === disabled) return;
      let nextState: WorkspaceState = {
        ...state,
        disabledWidgets: (function () { const n = { ...state.disabledWidgets }; if (disabled) n[id] = true; else delete n[id]; return n; })()
      };
      if (disabled) {
        // 禁用：关闭该 widget 在**所有面板**的所有打开实例（含 paneOfWidget / active 顺位）
        const modeState: Record<Mode, ModeState> = { ...nextState.modeState };
        for (const m of MODES) {
          const ms0 = modeState[m.id];
          const removeIds = new Set<string>();
          for (const p of Object.values(ms0.panes)) {
            for (const t of p.tabs) if (t.widgetId === id) removeIds.add(t.id);
          }
          if (removeIds.size === 0) continue;
          const panes: Record<string, PaneState> = {};
          for (const [paneId, p] of Object.entries(ms0.panes)) {
            const tabs = p.tabs.filter(function (t) { return !removeIds.has(t.id); });
            if (tabs.length !== p.tabs.length) {
              panes[paneId] = { tabs: tabs, active: (p.active !== null && tabs.some(function (t) { return t.id === p.active; })) ? p.active : (tabs[0]?.id ?? null) };
            } else {
              panes[paneId] = p;
            }
          }
          const paneOfWidget = { ...ms0.paneOfWidget };
          removeIds.forEach(function (instId) { delete paneOfWidget[instId]; });
          modeState[m.id] = { ...ms0, panes: panes, paneOfWidget: paneOfWidget };
        }
        nextState = { ...nextState, modeState: modeState };
      }
      state = nextState;
      emit();
    },
    isWidgetDisabled: function (id) { return state.disabledWidgets[id] === true; },
    reset: function () {
      state = defaultWorkspace();
      try { localStorage.removeItem(WS_KEY); } catch { /* ignore */ }
      emit();
    },
    setDockMaxRatio: function (ratio) {
      const next = clampWidth(ratio * 100, 10, 100) / 100;
      if (state.dockMaxRatio === next) return;
      state = { ...state, dockMaxRatio: next };
      emit();
    },
    setDividerWidth: function (px) {
      const next = clampWidth(px, 1, 6);
      if (state.dividerWidth === next) return;
      state = { ...state, dividerWidth: next };
      emit();
    },
    setDividerColor: function (color) {
      if (state.dividerColor === color) return;
      state = { ...state, dividerColor: color };
      emit();
    },
    setFullscreenDividers: function (on) {
      if (state.fullscreenDividers === on) return;
      state = { ...state, fullscreenDividers: on };
      emit();
    },
    getWidgetSettings: function (id) { return pluginSettings[id] ?? EMPTY_SETTINGS; },
    setWidgetSettings: function (id, patch) {
      const cur = pluginSettings[id] ?? {};
      const next: Record<string, unknown> = { ...cur };
      let changed = false;
      for (const [k, v] of Object.entries(patch)) {
        if (isJsonSerializable(v) && next[k] !== v) { next[k] = v; changed = true; }
      }
      if (!changed) return;
      pluginSettings = { ...pluginSettings, [id]: next };
      emitSettings();
    },
    resetWidgetSettings: function (id) {
      if (!(id in pluginSettings)) return;
      pluginSettings = { ...pluginSettings };
      delete pluginSettings[id];
      emitSettings();
    },
    subscribeWidgetSettings: function (fn) {
      settingsListeners.add(fn);
      return function () { settingsListeners.delete(fn); };
    },
    getSettingsVersion: function () { return settingsVersion; },
    // ---- 分屏 + tab 实例（显式指定面板 mode）----
    getSplits: function (mode) { return msFor(mode).splits; },
    splitPane: function (mode, region, paneId, dir, instanceId, before) {
      const ms0 = msFor(mode);
      let tree = ms0.splits[region];
      let oldPaneId = paneId;
      if (!tree) {
        oldPaneId = region + ":main"; // 首次拆分：旧面板 = 区域默认
        tree = { kind: 'leaf', paneId: oldPaneId };
      }
      // 被拖拽的 tab 实例（缺失兜底：从区域 placement 推导 widgetId）
      const oldP = ms0.panes[oldPaneId];
      let ref = oldP?.tabs.find((t) => t.id === instanceId);
      if (ref === undefined) {
        const fallbackWid = Object.keys(state.placement).find((w) => state.placement[w] === region);
        ref = { id: instanceId, widgetId: fallbackWid ?? instanceId };
      }
      const newPaneId = oldPaneId + ":s" + (nextPaneSeq++);
      const oldTabs = oldP?.tabs ?? [];
      const oldActive = oldP?.active ?? null;
      const newTree = splitNodeAt(tree, oldPaneId, dir, newPaneId, before !== true); // before=true 新面板放前（左/上落点）
      const nextPanes = { ...ms0.panes };
      // 被拖实例从旧面板移除；若它正是旧面板激活标签，active 顺位到下一个/置 null
      // （否则残留指向已移除实例，旧面板内容区无激活标签可渲染 → 只剩标题）
      const rest = oldTabs.filter((t) => t.id !== instanceId);
      nextPanes[oldPaneId] = { tabs: rest, active: oldActive === instanceId ? (rest[0]?.id ?? null) : oldActive };
      nextPanes[newPaneId] = { tabs: [ref], active: instanceId };
      state = { ...state, modeState: { ...state.modeState, [mode]: {
        ...ms0,
        splits: { ...ms0.splits, [region]: newTree },
        panes: nextPanes,
        paneOfWidget: { ...ms0.paneOfWidget, [instanceId]: newPaneId }
      } } };
      emit();
    },
    closePane: function (mode, region, paneId) {
      const ms0 = msFor(mode);
      const tree = ms0.splits[region];
      if (!tree) return;
      const closedTabs = ms0.panes[paneId]?.tabs ?? []; // TabRef[]
      const next = closeNodeAt(tree, paneId);
      if (next === null) return;
      const nextPanes = { ...ms0.panes };
      delete nextPanes[paneId];
      const nextPofW = { ...ms0.paneOfWidget };
      // 关闭面板 = 面板内的 tab 一并**关闭**（移除实例），不合并回剩余面板
      for (const t of closedTabs) delete nextPofW[t.id];
      if (next.kind === 'leaf') {
        const splits = { ...ms0.splits };
        delete splits[region];
        state = { ...state, modeState: { ...state.modeState, [mode]: { ...ms0, splits, panes: nextPanes, paneOfWidget: nextPofW } } };
      } else {
        state = { ...state, modeState: { ...state.modeState, [mode]: { ...ms0, splits: { ...ms0.splits, [region]: next }, panes: nextPanes, paneOfWidget: nextPofW } } };
      }
      emit();
    },
    moveTabToPane: function (mode, instanceId, paneId) {
      const ms0 = msFor(mode);
      const oldPaneId = ms0.paneOfWidget[instanceId];
      const ref = oldPaneId !== undefined ? (ms0.panes[oldPaneId]?.tabs.find((t) => t.id === instanceId) ?? null) : null;
      if (ref === null) return;
      const nextPanes = { ...ms0.panes };
      if (oldPaneId !== undefined && nextPanes[oldPaneId] !== undefined) {
        const old = nextPanes[oldPaneId];
        const rest = old.tabs.filter((t) => t.id !== instanceId);
        nextPanes[oldPaneId] = { tabs: rest, active: old.active === instanceId ? (rest[0]?.id ?? null) : old.active };
      }
      if (nextPanes[paneId] !== undefined) {
        const p = nextPanes[paneId];
        if (!p.tabs.some((t) => t.id === instanceId)) nextPanes[paneId] = { tabs: p.tabs.concat(ref), active: p.active ?? instanceId };
      } else {
        nextPanes[paneId] = { tabs: [ref], active: instanceId };
      }
      state = { ...state, modeState: { ...state.modeState, [mode]: { ...ms0, panes: nextPanes, paneOfWidget: { ...ms0.paneOfWidget, [instanceId]: paneId } } } };
      emit();
    },
    /** 把一个 tab 实例插到另一个 tab 实例前（同 pane 重排 / 跨 pane 移入）；
     *  作用于目标 pane 所在 mode；目标 pane 激活改为被拖实例。 */
    insertTabBefore: function (instanceId, beforeId) {
      const toLoc = locateInstance(beforeId);
      if (!toLoc) return;
      const ms0 = msFor(toLoc.mode);
      const tp0 = ms0.panes[toLoc.paneId];
      if (!tp0 || !tp0.tabs.some((t) => t.id === beforeId)) return;
      const fromLoc = locateInstance(instanceId);
      const fromPaneId = fromLoc?.paneId;
      const ref = fromPaneId !== undefined ? (ms0.panes[fromPaneId]?.tabs.find((t) => t.id === instanceId) ?? null) : null;
      if (ref === null) return;
      const nextPanes = { ...ms0.panes };
      // 从原 pane 移除（同 pane 时先移除，再按目标索引插入）
      if (fromPaneId !== undefined && nextPanes[fromPaneId] !== undefined) {
        const old = nextPanes[fromPaneId];
        const rest = old.tabs.filter((t) => t.id !== instanceId);
        nextPanes[fromPaneId] = { tabs: rest, active: old.active === instanceId ? (rest[0]?.id ?? null) : old.active };
      }
      const tp = nextPanes[toLoc.paneId];
      const beforeIdx = tp.tabs.findIndex((t) => t.id === beforeId);
      const tabs = tp.tabs.filter((t) => t.id !== instanceId);
      const at = Math.min(Math.max(beforeIdx, 0), tabs.length);
      nextPanes[toLoc.paneId] = { tabs: [...tabs.slice(0, at), ref, ...tabs.slice(at)], active: instanceId };
      state = { ...state, modeState: { ...state.modeState, [toLoc.mode]: { ...ms0, panes: nextPanes, paneOfWidget: { ...ms0.paneOfWidget, [instanceId]: toLoc.paneId } } } };
      emit();
    },
    setPaneActive: function (mode, paneId, id) {
      const ms0 = msFor(mode);
      const p = ms0.panes[paneId];
      if (!p || p.active === id) return;
      state = { ...state, modeState: { ...state.modeState, [mode]: { ...ms0, panes: { ...ms0.panes, [paneId]: { ...p, active: id } } } } };
      emit();
    },
    setModePaneActive: function (mode, paneId, id) {
      const ms0 = msFor(mode);
      const p = ms0.panes[paneId];
      if (!p || p.active === id) return;
      state = { ...state, modeState: { ...state.modeState, [mode]: { ...ms0, panes: { ...ms0.panes, [paneId]: { ...p, active: id } } } } };
      emit();
    },
    setSplitWeights: function (mode, region, path, index, ratio) {
      const ms0 = msFor(mode);
      const tree = ms0.splits[region];
      if (!tree) return;
      function setWeight(n: SplitNode, pathIdx: number): SplitNode {
        if (n.kind === 'leaf') return n;
        if (pathIdx >= path.length) {
          const weights = n.weights.slice();
          const r = Math.min(0.85, Math.max(0.15, ratio));
          weights[index] = r;
          weights[index + 1] = 1 - r;
          return { ...n, weights };
        }
        const childIdx = path[pathIdx];
        return { ...n, children: n.children.map((c, ci) => (ci === childIdx ? setWeight(c, pathIdx + 1) : c)) };
      }
      state = { ...state, modeState: { ...state.modeState, [mode]: { ...ms0, splits: { ...ms0.splits, [region]: setWeight(tree, 0) } } } };
      emit();
    },
    setSplitNodeWeights: function (mode, region, path, weights) {
      const ms0 = msFor(mode);
      const tree = ms0.splits[region];
      if (!tree) return;
      function setWeight(n: SplitNode, pathIdx: number): SplitNode {
        if (n.kind === 'leaf') return n;
        if (pathIdx >= path.length) return { ...n, weights: weights.slice() };
        const childIdx = path[pathIdx];
        return { ...n, children: n.children.map((c, ci) => (ci === childIdx ? setWeight(c, pathIdx + 1) : c)) };
      }
      state = { ...state, modeState: { ...state.modeState, [mode]: { ...ms0, splits: { ...ms0.splits, [region]: setWeight(tree, 0) } } } };
      emit();
    },
    flushSave: flush
  };
}

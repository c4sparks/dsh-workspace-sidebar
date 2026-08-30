/**
 * dsh-workspace-sidebar — 公开 `workspace` 服务（纯逻辑，无 React）。
 *
 * 面板模型（v4）：左 / 右 / 底**可同时打开**、各自独立；全屏独占（开时关停靠）。
 * 每个面板有自己的「已打开 tab 实例」集合（`modeState[mode]`）。所有 tab 操作
 * 都**显式指定面板 mode**（缺省取当前打开面板，兜底 fullscreen），互不影响。
 */
import { APP_ID, MODES, SERVICE_VERSION, SIDECAR_OPEN_EVENT } from "./constants";
import type { Mode, ModeState, Region, SplitNode, TabRef, WidgetDescriptor, WorkspaceService, WorkspaceState } from "./types";
import type { WorkspaceStore } from "./store";
import type { WidgetRegistry } from "./registry";

function broadcastOpen() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SIDECAR_OPEN_EVENT, { detail: APP_ID }));
  }
}

/** 某区域分屏树的所有叶子 paneId（未分屏返回空）。 */
function leavesOfSplit(splits: Partial<Record<Region, SplitNode>>, region: Region): string[] {
  const tree = splits[region];
  if (!tree) return [];
  const out: string[] = [];
  (function walk(n: SplitNode): void {
    if (n.kind === "leaf") out.push(n.paneId);
    else n.children.forEach(walk);
  })(tree);
  return out;
}

export function createWorkspaceService(registry: WidgetRegistry, store: WorkspaceStore): WorkspaceService {
  const REGIONS: Region[] = ["left", "center", "right", "bottom"];
  /** 缺省面板：当前打开的面板（全屏优先，其次任一停靠），兜底 fullscreen。 */
  function defaultMode(): Mode {
    const st = store.getState();
    if (st.panels.fullscreen) return "fullscreen";
    return (["left", "right", "bottom"] as Mode[]).find(function (m) { return st.panels[m]; }) ?? "fullscreen";
  }
  /** paneId 前缀即区域名（`left:main` / `center:main:s0` → left/center）。 */
  function regionOfPane(paneId: string): Region | undefined {
    const r = paneId.split(":")[0];
    return (REGIONS as string[]).indexOf(r) >= 0 ? (r as Region) : undefined;
  }
  /** 某面板某区域所有 pane 里按 pane 顺序排的打开实例（无实例返回空数组）。 */
  function getTabRefs(region: Region, mode?: Mode): TabRef[] {
    const st = store.getState();
    const m = st.modeState[mode ?? defaultMode()];
    if (m.splits[region]) {
      const out: TabRef[] = [];
      for (const pid of leavesOfSplit(m.splits, region)) {
        const p = m.panes[pid];
        if (p) out.push.apply(out, p.tabs);
      }
      return out;
    }
    return m.panes[region + ":main"]?.tabs ?? [];
  }
  /** 某 widget 在指定面板的全部打开实例。 */
  function openInstancesInMode(widgetId: string, mode: Mode): TabRef[] {
    const st = store.getState();
    const out: TabRef[] = [];
    for (const p of Object.values(st.modeState[mode].panes)) {
      for (const t of p.tabs) if (t.widgetId === widgetId) out.push(t);
    }
    return out;
  }
  /**
   * 复用最小空档实例 id（槽位制）：#1 = widgetId，#N(N≥2) = widgetId:inst<N-2>。
   * 关闭后编号回收（终端 #2 关了下次新建仍是 #2；#1 关了也复用回 #1，不跳号）。
   */
  function nextFreeInstanceId(widgetId: string): string {
    const st = store.getState();
    const used = new Set<number>(); // 已占用的槽位号（1 起）
    for (const m of MODES) {
      for (const p of Object.values(st.modeState[m.id].panes)) {
        for (const t of p.tabs) {
          if (t.widgetId === widgetId) {
            if (t.id === widgetId) used.add(1);
            else {
              const mm = /:inst(\d+)$/.exec(t.id);
              if (mm !== null) used.add(Number(mm[1]) + 2);
            }
          }
        }
      }
    }
    let slot = 1;
    while (used.has(slot)) slot++;
    return slot === 1 ? widgetId : widgetId + ":inst" + (slot - 2);
  }
  /** 某面板某区域内已打开实例对应的 widget 描述符（按实例出现顺序、按 widgetId 去重）。 */
  function getTabs(region: Region, mode?: Mode): WidgetDescriptor[] {
    const seen = new Set<string>();
    const out: WidgetDescriptor[] = [];
    for (const ref of getTabRefs(region, mode)) {
      if (seen.has(ref.widgetId)) continue;
      seen.add(ref.widgetId);
      const desc = registry.getWidget(ref.widgetId);
      if (desc) out.push(desc);
    }
    return out;
  }
  /**
   * 打开（或聚焦）某 widget 的 tab 实例（面板 `opts.mode`，缺省当前打开面板）：
   * - 单实例（默认）：该面板已有实例 → 聚焦；否则补建（每面板至多一个）。
   * - 多实例（`multi:true`）：总是新建一个实例 tab。
   * 实例 id 跨面板全局唯一（首个 = widgetId，之后复用最小空档 `widgetId:instN`，
   * 关闭后编号回收）。返回实例 id。
   */
  function openWidget(widgetId: string, opts?: { mode?: Mode; region?: Region; paneId?: string }): string | undefined {
    const desc = registry.getWidget(widgetId);
    if (!desc) return undefined;
    const st = store.getState();
    const mode = opts?.mode ?? defaultMode();
    const m = st.modeState[mode];
    const region = opts?.region ?? (mode === "fullscreen" ? (st.placement[widgetId] ?? desc.region ?? "center") : "center");
    if (desc.multi !== true) {
      const existing = openInstancesInMode(widgetId, mode)[0];
      if (existing) {
        if (opts?.region !== undefined || opts?.paneId !== undefined) {
          // 显式请求目标（TabBar「+」等主动打开）：实例已在别处 → 移动过去再聚焦。
          // 否则单实例会卡在不可见 pane（如全屏单画布下 right/bottom），点开无反应。
          // 目标 pane 与新建分支同口径：区域有分屏时取第一个叶子 pane。
          const wantPaneId = opts?.paneId ?? (m.splits[region] ? (leavesOfSplit(m.splits, region)[0] ?? region + ":main") : region + ":main");
          const curPaneId = store.getPaneForInstance(existing.id);
          if (curPaneId !== undefined && curPaneId !== wantPaneId) {
            store.moveTabToPane(mode, existing.id, wantPaneId);
          } else {
            store.addTabToPane(mode, wantPaneId, { id: existing.id, widgetId: widgetId });
          }
        } else {
          // 无显式目标（程序化 openWidget，如第三方直接调用）：保持原聚焦行为
          const paneId = store.getPaneForInstance(existing.id) ?? region + ":main";
          store.addTabToPane(mode, paneId, { id: existing.id, widgetId: widgetId });
        }
        return existing.id;
      }
    }
    const paneId = opts?.paneId ?? (m.splits[region] ? (leavesOfSplit(m.splits, region)[0] ?? region + ":main") : region + ":main");
    // 实例 id：槽位制复用最小空档（#1=widgetId；关闭后编号回收，不跳号）
    const id = nextFreeInstanceId(widgetId);
    if (st.placement[widgetId] === undefined) store.setPlacement(widgetId, regionOfPane(paneId) ?? region);
    store.addTabToPane(mode, paneId, { id: id, widgetId: widgetId });
    return id;
  }
  return {
    layout: store,
    registerWidget: function (desc) {
      const dispose = registry.register(desc);
      const st = store.getState();
      if (st.placement[desc.id] === undefined) {
        // 首次注册：仅记 placement 意图（默认打开区域），不自动开实例。
        // widget 一律由用户在工作台 TabBar 点「+」显式打开——全屏单画布下非 center
        // 区域不可见，自动开会把单实例卡在不可见 pane（点开无反应）。
        store.setPlacement(desc.id, desc.region ?? "center");
      }
      return dispose;
    },
    unregisterWidget: function (id) {
      if (!registry.getWidget(id)) return;
      // 该 widget 的激活实例所在 pane：active 顺位下一个实例（扫**全面板**；不删打开实例，HMR 安全）
      const st = store.getState();
      for (const m of MODES) {
        const ms0 = st.modeState[m.id];
        for (const [paneId, p] of Object.entries(ms0.panes)) {
          if (p.active !== null && p.tabs.some(function (t) { return t.id === p.active && t.widgetId === id; })) {
            const rest = p.tabs.filter(function (t) { return t.id !== p.active; });
            store.setModePaneActive(m.id, paneId, rest[0]?.id ?? null);
          }
        }
      }
      registry.unregister(id);
    },
    getWidgets: function () { return registry.getWidgets(); },
    getWidget: function (id) { return registry.getWidget(id); },
    setWidgetDisabled: function (id, disabled) { store.setWidgetDisabled(id, disabled); },
    isWidgetDisabled: function (id) { return store.isWidgetDisabled(id); },
    openWidget: openWidget,
    getWidgetInstanceCount: function (widgetId) {
      const st = store.getState();
      let n = 0;
      for (const m of MODES) {
        for (const p of Object.values(st.modeState[m.id].panes)) {
          for (const t of p.tabs) if (t.widgetId === widgetId) n++;
        }
      }
      return n;
    },
    closeTab: function (instanceId) { store.removeTab(instanceId); },
    getTabRefs: getTabRefs,
    getTabs: getTabs,
    subscribe: function (fn) { return registry.subscribe(fn); },
    getState: function () { return store.getState(); },
    subscribeState: function (fn) { return store.subscribeState(fn); },
    open: function () {
      // 打开即全屏面板（独占）
      store.setOpen(true);
      broadcastOpen();
    },
    toggle: function () {
      if (store.getState().open) store.setOpen(false);
      else { store.setOpen(true); broadcastOpen(); }
    },
    close: function () { store.setOpen(false); },
    isOpen: function () { return store.getState().open; },
    setActiveWidget: function (region, id, mode) {
      const m = mode ?? defaultMode();
      // id 全局定位 → 所在面板；面板不符则回落该面板区域激活
      const paneId = store.getPaneForInstance(id);
      if (paneId !== undefined) store.setPaneActive(m, paneId, id);
      else store.setRegionActive(m, region, id);
    },
    setWidgetRegion: function (id, region, mode) {
      const m = mode ?? defaultMode();
      const old = store.getState().placement[id];
      if (old === region) return;
      store.setPlacement(id, region);
      // 移动该 widget 在该面板的全部打开实例到 region 首个 pane
      const ms0 = store.getState().modeState[m];
      const paneId = ms0.splits[region] ? (leavesOfSplit(ms0.splits, region)[0] ?? region + ":main") : region + ":main";
      if (paneId) {
        for (const ref of openInstancesInMode(id, m)) store.moveTabToPane(m, ref.id, paneId);
      }
    },
    setRegionSize: function (region, px) { store.setRegionSize(region, px); },
    setPreset: function (preset) { store.setPreset(preset); },
    toggleMode: function (mode) {
      const s = store.getState();
      const wasOpen = s.open;
      if (s.panels[mode]) {
        store.setPanels({ [mode]: false });           // 开着 → 收起该面板
      } else if (mode === "fullscreen") {
        store.setPanels({ fullscreen: true, left: false, right: false, bottom: false }); // 全屏独占
      } else if (s.multiPanel) {
        store.setPanels({ [mode]: true, fullscreen: false }); // 同时展示：开该面板、关全屏，其它停靠保留
      } else {
        // 独立展示（默认）：开该面板并关掉所有其它停靠（含全屏）
        store.setPanels({ left: false, right: false, bottom: false, [mode]: true, fullscreen: false });
      }
      if (!wasOpen) broadcastOpen();
    },
    setModeSize: function (mode, px) { store.setModeSize(mode, px); },
    resetLayout: function () { store.reset(); },
    setDockMaxRatio: function (ratio) { store.setDockMaxRatio(ratio); },
    setDividerWidth: function (px) { store.setDividerWidth(px); },
    setDividerColor: function (color) { store.setDividerColor(color); },
    setFullscreenDividers: function (on) { store.setFullscreenDividers(on); },
    setVerticalTabs: function (on) { store.setVerticalTabs(on); },
    getWidgetSettings: function (id) { return store.getWidgetSettings(id); },
    setWidgetSettings: function (id, patch) { store.setWidgetSettings(id, patch); },
    resetWidgetSettings: function (id) { store.resetWidgetSettings(id); },
    subscribeWidgetSettings: function (fn) { return store.subscribeWidgetSettings(fn); },
    getSettingsVersion: function () { return store.getSettingsVersion(); },
    // ---- 分屏 + tab 实例（显式指定面板 mode）----
    getSplits: function (mode) { return store.getSplits(mode ?? defaultMode()); },
    splitPane: function (region, paneId, dir, instanceId, mode, before) { store.splitPane(mode ?? defaultMode(), region, paneId, dir, instanceId, before); },
    moveTab: function (instanceId, paneId, mode) { store.moveTabToPane(mode ?? defaultMode(), instanceId, paneId); },
    insertTabBefore: function (instanceId, beforeId) { store.insertTabBefore(instanceId, beforeId); },
    closePane: function (region, paneId, mode) { store.closePane(mode ?? defaultMode(), region, paneId); },
    moveWidgetToPane: function (widgetId, paneId, mode) {
      const m = mode ?? defaultMode();
      for (const ref of openInstancesInMode(widgetId, m)) store.moveTabToPane(m, ref.id, paneId);
    },
    setSplitWeights: function (region, path, index, ratio, mode) { store.setSplitWeights(mode ?? defaultMode(), region, path, index, ratio); },
    setSplitNodeWeights: function (region, path, weights, mode) { store.setSplitNodeWeights(mode ?? defaultMode(), region, path, weights); },
    version: SERVICE_VERSION
  };
}

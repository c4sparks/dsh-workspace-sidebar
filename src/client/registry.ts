/**
 * dsh-workspace-sidebar — 同步快照 widget 注册表（纯逻辑，无 React）。
 */
import type { WidgetDescriptor } from "./types";

export interface WidgetRegistry {
  register(desc: WidgetDescriptor): () => void;
  unregister(id: string): void;
  getWidgets(): readonly WidgetDescriptor[];
  getWidget(id: string): WidgetDescriptor | undefined;
  subscribe(fn: () => void): () => void;
}

/** 同步快照 widget 注册表（Map + listener 集 + 缓存排序数组）。 */
export function createWidgetRegistry(): WidgetRegistry {
  const widgets = new Map<string, WidgetDescriptor>();
  const listeners = new Set<() => void>();
  let sorted: WidgetDescriptor[] = [];
  function resort() {
    sorted = Array.from(widgets.values()).sort(function (a, b) {
      return (a.order || 100) - (b.order || 100);
    });
  }
  function notify() { for (const fn of listeners) fn(); }
  return {
    register: function (desc) {
      if (widgets.has(desc.id)) {
        // 重复 id：不抛错（hot-reload / 多插件同 id 不致崩 client），告警并返回 no-op disposer
        console.warn("workspace: widget \"" + desc.id + "\" already registered; ignoring duplicate");
        return function () {};
      }
      widgets.set(desc.id, desc);
      resort();
      notify();
      let disposed = false;
      return function () {
        if (disposed) return;
        disposed = true;
        widgets.delete(desc.id);
        resort();
        notify();
      };
    },
    unregister: function (id) {
      if (!widgets.has(id)) return;
      widgets.delete(id);
      resort();
      notify();
    },
    getWidgets: function () { return sorted; },
    getWidget: function (id) { return widgets.get(id); },
    subscribe: function (fn) {
      listeners.add(fn);
      return function () { listeners.delete(fn); };
    }
  };
}

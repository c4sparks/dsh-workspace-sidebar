/**
 * dsh-workspace-sidebar — dsh 官方 API 防腐层（anti-corruption layer）。
 *
 * 业务代码（plugin.ts）只依赖下面的窄 `DshAdapter` 接口；dsh 官方 API 一旦
 * 变更，修复只集中在 adapter.ts。本插件不接管 root / 不重写 ctx.layout / 不
 * 依赖主题，所以 adapter 只需封装 slots / reflect.provide / effect。
 */
import type * as React from "react";
import type { DshClientCtx } from "./types";

/** slots.register 的选项（本项目只用 name/id/order）。 */
export interface SlotRegisterOptions {
  name: string;
  id?: string;
  order?: number;
  [key: string]: unknown;
}

/** 插件主体依赖的窄接口。 */
export interface DshAdapter {
  /** cordis effect（运行 fn；fiber 卸载时 dispose）。 */
  effect(fn: () => void | (() => void), label?: string): void;
  /** ctx.slots.inject(name, cb) → disposer。 */
  injectSlot(name: string, cb: () => unknown): () => void;
  /** ctx.slots.register(options, component) → disposer。 */
  registerSlot(options: SlotRegisterOptions, component: React.ComponentType<any>): () => void;
  /** ctx.reflect.provide(name, value) → disposer（async disposer 压平成同步调用）。 */
  provide(name: string, value: unknown): () => void;
}

/** 由 dsh client ctx 构建 adapter。 */
export function createDshAdapter(ctx: DshClientCtx): DshAdapter {
  return {
    effect: function (fn, label) { return ctx.effect(fn, label); },
    injectSlot: function (name, cb) { return ctx.slots.inject(name, cb); },
    registerSlot: function (options, component) { return ctx.slots.register(options, component); },
    provide: function (name, value) { return ctx.reflect.provide(name, value) as unknown as () => void; }
  };
}

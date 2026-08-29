/**
 * dsh-workspace-sidebar — client bundle entry。
 *
 * 构建时 scripts/build.mjs 用 banner 包成：
 *   window.__ModuleLoader__.load({ id: 'dsh-workspace-sidebar', factory: (require) => { … } })
 * 因此本文件顶层可直接 require("react")（取 factory 的 require 参数）——这与宿主自己的
 * client 包同构（见 harness packages/client/tsdown.client.ts 的 intro/banner/footer）。
 */

/** factory 提供的 require（构建 banner 传入）。 */
declare const require: (id: string) => any;
/** banner intro 里声明的 module/exports。 */
declare const module: { exports: any };

import { createPlugin } from "./plugin";

const React: any = require("react");
const result = createPlugin({ React });
module.exports.apply = result.apply;
module.exports.inject = result.inject;

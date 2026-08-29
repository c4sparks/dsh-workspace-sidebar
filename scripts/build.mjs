#!/usr/bin/env node
/**
 * scripts/build.mjs — 构建 src/ 源码 → lib/ 产物。
 *
 * workspaceSidebar 插件不构建：宿主直接读 lib/index.js（package.json main），浏览器端原样
 * 服务 lib/client.js（exports["./client"]）。因此这里把可读源码（src/）打成一
 * 份 lib/client.js（workspaceSidebar 客户端模块系统要求的 window.__ModuleLoader__.load
 * 格式）与 lib/index.js（宿主入口，无依赖）。
 *
 * 关键约定（不要破坏）：
 *  - client 打包为 iife；workspaceSidebar 种子模块（react、@deepseek-ai/*）声明为 external，
 *    它们的 require 保留在 factory 闭包内（workspaceSidebar 调用 factory 时传入）。
 *  - 插件业务（src/client/plugin.ts）不得 import 任何外部包，只能通过
 *    createPlugin(deps) 接收种子模块（依赖注入）。
 *
 * 用法：npm run build（或 node scripts/build.mjs）
 */
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\\/g, "/");
const srcIndex = join(root, "src", "index.ts");
const srcClientEntry = join(root, "src", "client", "index.ts");
const outClient = join(root, "lib", "client.js");
const outIndex = join(root, "lib", "index.js");

await mkdir(join(root, "lib"), { recursive: true });

await build({
  entryPoints: [srcClientEntry],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2023"],
  outfile: outClient,
  external: ["react", "react/jsx-runtime", "@deepseek-ai/*"],
  loader: { ".css": "text" },
  // 内联进 client 的 react-dom / scheduler 走生产版（去掉 dev 分支与警告；react 本身
  // 仍 external，由宿主 factory require 提供，不受影响）。
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
  logLevel: "info",
  // 与宿主 client 包同构：banner 建 module/exports 并把整个 bundle 包进 loader.load 的
  // factory（使外部 require("react") 在 factory 内可解析——否则像 allotment 这类
  // import react 的库会把 require 提到 iife 顶层而挂掉）。
  banner: { js: "var module = { exports: {} }; var exports = module.exports; window.__ModuleLoader__.load({ id: \"dsh-workspace-sidebar\", factory: (require) => {" },
  footer: { js: "return module.exports; } });" }
});

// host entry: ESM, bundled (transpiles TS type annotations away)
await build({
  entryPoints: [srcIndex],
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["es2023"],
  outfile: outIndex,
  legalComments: "none",
  logLevel: "info"
});

console.log(`[build] ${outClient}\n[build] ${outIndex}`);

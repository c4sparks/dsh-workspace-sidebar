/** esbuild `.css` 按 text 内联：import 默认导出 CSS 文本。 */
declare module '*.css' {
  const content: string;
  export default content;
}

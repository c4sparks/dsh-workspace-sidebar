/**
 * dsh-workspace-sidebar — React hooks（经 createHooks(React) 注入 React，
 * 业务代码不直接 import 外部包）。
 */
import type * as ReactTypes from "react";
import { SIDEBAR_RIGHT_FALLBACK } from "./constants";

export interface DragCallbacks {
  onStart?: () => void;
  onDrag?: (dx: number, dy: number) => void;
  onEnd?: () => void;
}

export interface Hooks {
  useViewport(): { width: number; height: number };
  usePointerDrag(callbacks: DragCallbacks): {
    dragging: boolean;
    onPointerDown: ReactTypes.PointerEventHandler;
    onPointerMove: ReactTypes.PointerEventHandler;
    onPointerUp: ReactTypes.PointerEventHandler;
  };
  useSidebarRight(): number;
}

export function createHooks(React: typeof ReactTypes): Hooks {
  /** rAF-throttled viewport size（窗口尺寸；覆盖层为 fixed，跟随窗口）。 */
  function useViewport(): { width: number; height: number } {
    const sizeState = React.useState(function () {
      return { width: window.innerWidth, height: window.innerHeight };
    });
    const size = sizeState[0];
    const setSize = sizeState[1];
    React.useEffect(function () {
      let frame: number | null = null;
      function measure() {
        frame = null;
        setSize({ width: window.innerWidth, height: window.innerHeight });
      }
      function onResize() {
        if (frame === null) frame = requestAnimationFrame(measure);
      }
      window.addEventListener("resize", onResize);
      return function () {
        window.removeEventListener("resize", onResize);
        if (frame !== null) cancelAnimationFrame(frame);
      };
    }, []);
    return size;
  }

  /**
   * 一次 pointer-capture 拖拽句柄：pointerdown
   * 记原点，pointermove 累积最新 delta 并在下一帧上报，pointerup 冲刷最终 delta。
   */
  function usePointerDrag(callbacks: DragCallbacks): {
    dragging: boolean;
    onPointerDown: ReactTypes.PointerEventHandler;
    onPointerMove: ReactTypes.PointerEventHandler;
    onPointerUp: ReactTypes.PointerEventHandler;
  } {
    const draggingState = React.useState(false);
    const dragging = draggingState[0];
    const setDragging = draggingState[1];
    const origin = React.useRef({ x: 0, y: 0 });
    const latest = React.useRef({ x: 0, y: 0 });
    const frame = React.useRef<number | null>(null);
    const cb = React.useRef(callbacks);
    cb.current = callbacks;

    const onPointerDown = React.useCallback(function (e: ReactTypes.PointerEvent) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      origin.current = { x: e.clientX, y: e.clientY };
      latest.current = { x: e.clientX, y: e.clientY };
      if (cb.current.onStart) cb.current.onStart();
      setDragging(true);
    }, []);

    const onPointerMove = React.useCallback(function (e: ReactTypes.PointerEvent) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      latest.current = { x: e.clientX, y: e.clientY };
      if (frame.current === null) {
        frame.current = requestAnimationFrame(function () {
          frame.current = null;
          const d = latest.current;
          const o = origin.current;
          if (cb.current.onDrag) cb.current.onDrag(d.x - o.x, d.y - o.y);
        });
      }
    }, []);

    const onPointerUp = React.useCallback(function (e: ReactTypes.PointerEvent) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
      const d = latest.current;
      const o = origin.current;
      if (cb.current.onDrag) cb.current.onDrag(d.x - o.x, d.y - o.y);
      setDragging(false);
      if (cb.current.onEnd) cb.current.onEnd();
    }, []);

    return { dragging: dragging, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp };
  }

  /**
   * 持续测量 dsh 侧边栏右缘（rAF 循环，值变化才 setState）。
   * 主：宿主 frame 的 grid 第一列宽（dsh-web 布局，侧边栏折叠/展开跟随列宽，
   * 经 `[data-shell-overlay]` 锚点取 frame）；
   * 回退：`[data-slot="sidebar"]` 槽位 rect；
   * 初始/未测到：SIDEBAR_RIGHT_FALLBACK（不让覆盖层盖住侧边栏与按钮）。
   */
  function useSidebarRight(): number {
    const state = React.useState(SIDEBAR_RIGHT_FALLBACK);
    const right = state[0];
    const setRight = state[1];
    React.useEffect(function () {
      let raf = 0;
      let last = -1;
      function measure(): number | null {
        const frame = document.querySelector("[data-shell-overlay]")?.parentElement ?? null;
        if (frame) {
          const grid = getComputedStyle(frame).gridTemplateColumns;
          const track = grid.split(" ")[0];
          const px = Number.parseFloat(track);
          if (Number.isFinite(px)) return frame.getBoundingClientRect().left + px;
        }
        const sidebar = document.querySelector("[data-slot=\"sidebar\"]");
        if (sidebar) return sidebar.getBoundingClientRect().right;
        return null;
      }
      function loop() {
        raf = requestAnimationFrame(loop);
        const v = measure();
        // 仅接受 >=40px 的有效值（真实侧边栏至少是折叠细条 ~56px），
        // 其余情况保持兜底值，避免覆盖层盖住侧边栏/按钮。
        if (v !== null && v >= 40 && v !== last) { last = v; setRight(v); }
      }
      loop();
      return function () { cancelAnimationFrame(raf); };
    }, []);
    return right;
  }

  return { useViewport: useViewport, usePointerDrag: usePointerDrag, useSidebarRight: useSidebarRight };
}

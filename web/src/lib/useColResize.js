import { useEffect, useRef } from "react";

// Drag-to-resize for the grid columns of a tab: one hook per grid, handles
// carry data-side, widths persist to localStorage under `key`.
export default function useColResize(ref, key) {
  const dragging = useRef(false);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved) {
        for (const [side, w] of Object.entries(saved)) {
          if (w) grid.style.setProperty(`--${side}-w`, `${w}px`);
        }
      }
    } catch { /* none */ }
  }, [ref, key]);

  const onHandleDown = (e) => {
    e.preventDefault();
    const grid = ref.current;
    if (!grid) return;
    const side = e.currentTarget.dataset.side;
    const rect = grid.getBoundingClientRect();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const move = (ev) => {
      if (!dragging.current) return;
      ev.preventDefault();
      let w;
      if (side === "left") w = Math.min(Math.max(ev.clientX - rect.left, 180), rect.width * 0.35);
      else w = Math.min(Math.max(rect.right - ev.clientX, 180), rect.width * 0.45);
      grid.style.setProperty(`--${side}-w`, `${w}px`);
    };
    const up = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const cs = getComputedStyle(grid);
      try {
        localStorage.setItem(key, JSON.stringify({
          left: parseFloat(cs.getPropertyValue("--left-w")) || undefined,
          right: parseFloat(cs.getPropertyValue("--right-w")) || undefined,
        }));
      } catch { /* none */ }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  return onHandleDown;
}

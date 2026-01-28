import { useCallback, useRef, useState } from "react";

/**
 * Enables click-and-drag horizontal scrolling on a container.
 * - Works with mouse and touch
 * - Exposes a flag to suppress clicks when the user was dragging
 */
export function useDragScroll() {
  const ref = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const pointerDownRef = useRef(false);
  const movedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;

    // Only primary button for mouse
    if (e.pointerType === "mouse" && e.button !== 0) return;

    pointerDownRef.current = true;
    movedRef.current = false;
    setIsDragging(true);

    startXRef.current = e.clientX;
    startScrollLeftRef.current = el.scrollLeft;
    el.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    if (!pointerDownRef.current) return;

    const dx = e.clientX - startXRef.current;
    // Increase threshold to 10px to better differentiate between click and drag
    if (Math.abs(dx) > 10) movedRef.current = true;
    el.scrollLeft = startScrollLeftRef.current - dx;
  }, []);

  const endDrag = useCallback(() => {
    pointerDownRef.current = false;
    setIsDragging(false);
  }, []);

  const onPointerUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  const onPointerCancel = useCallback(() => {
    endDrag();
  }, [endDrag]);

  const suppressClickIfDragged = useCallback((e: React.MouseEvent) => {
    if (movedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    ref,
    isDragging,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture: suppressClickIfDragged,
    },
  };
}

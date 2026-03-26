import { useState, useCallback, useRef } from "react";
import { X, Move } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SlideMediaItem } from "./types";

interface DraggableMediaItemProps {
  item: SlideMediaItem;
  containerRef: React.RefObject<HTMLDivElement>;
  onUpdate: (id: string, updates: Partial<SlideMediaItem>) => void;
  onRemove: (id: string) => void;
  selected: boolean;
  onSelect: () => void;
}

export function DraggableMediaItem({
  item,
  containerRef,
  onUpdate,
  onRemove,
  selected,
  onSelect,
}: DraggableMediaItemProps) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const startRef = useRef({ x: 0, y: 0, itemX: 0, itemY: 0, itemW: 0, itemH: 0 });

  const getContainerRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? new DOMRect();
  }, [containerRef]);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    setDragging(true);
    const rect = getContainerRect();
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      itemX: item.x,
      itemY: item.y,
      itemW: item.width,
      itemH: item.height,
    };

    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startRef.current.x) / rect.width) * 100;
      const dy = ((ev.clientY - startRef.current.y) / rect.height) * 100;
      const newX = Math.max(0, Math.min(100 - item.width, startRef.current.itemX + dx));
      const newY = Math.max(0, Math.min(100 - item.height, startRef.current.itemY + dy));
      onUpdate(item.id, { x: newX, y: newY });
    };

    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [item, onUpdate, onSelect, getContainerRect]);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    const rect = getContainerRect();
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      itemX: item.x,
      itemY: item.y,
      itemW: item.width,
      itemH: item.height,
    };

    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startRef.current.x) / rect.width) * 100;
      const dy = ((ev.clientY - startRef.current.y) / rect.height) * 100;
      const newW = Math.max(5, Math.min(100 - item.x, startRef.current.itemW + dx));
      const newH = Math.max(5, Math.min(100 - item.y, startRef.current.itemH + dy));
      onUpdate(item.id, { width: newW, height: newH });
    };

    const onUp = () => {
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [item, onUpdate, getContainerRect]);

  return (
    <div
      className={cn(
        "absolute group",
        dragging && "cursor-grabbing",
        !dragging && "cursor-grab",
      )}
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        width: `${item.width}%`,
        height: `${item.height}%`,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Media content */}
      <div
        className="w-full h-full overflow-hidden rounded"
        onPointerDown={handleDragStart}
      >
        {item.type === "image" ? (
          <img
            src={item.url}
            alt=""
            className="w-full h-full object-cover pointer-events-none select-none"
            draggable={false}
          />
        ) : (
          <video
            src={item.url}
            className="w-full h-full object-cover pointer-events-none"
            muted
            loop
            autoPlay
            playsInline
          />
        )}
      </div>

      {/* Selection border + controls */}
      {selected && (
        <>
          <div className="absolute inset-0 border-2 border-primary rounded pointer-events-none" />

          {/* Move handle */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-full p-0.5 shadow">
            <Move className="h-3 w-3" />
          </div>

          {/* Remove button */}
          <button
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow hover:scale-110 transition-transform z-10"
            onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          >
            <X className="h-3 w-3" />
          </button>

          {/* Resize handle */}
          <div
            className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-sm cursor-se-resize shadow z-10"
            onPointerDown={handleResizeStart}
          />
        </>
      )}
    </div>
  );
}

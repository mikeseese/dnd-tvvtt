"use client";

import { useState, useCallback, useRef, useEffect, type JSX } from "react";
import { api } from "~/trpc/react";

const CELL_PX = 60;
const VIEWPORT_H = 500;

interface MapFormProps {
  campaignId: string;
  onDone: () => void;
}

export function MapForm({ campaignId, onDone }: MapFormProps): JSX.Element {
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Zoom & pan state – the image is transformed behind a fixed grid overlay
  const [zoom, setZoom] = useState(0.5);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef({ x: panX, y: panY });

  // Keep refs in sync for the wheel handler
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panRef.current = { x: panX, y: panY };
  }, [panX, panY]);

  const createMutation = api.gameMap.create.useMutation({ onSuccess: onDone });

  // Computed grid values in natural image coordinates
  const gridCellSize = CELL_PX / zoom;
  const gridOffsetX = -panX / zoom;
  const gridOffsetY = -panY / zoom;

  // Derive rows/cols to cover the full image
  const gridCols = imageWidth > 0 ? Math.ceil(imageWidth / gridCellSize) : 1;
  const gridRows = imageHeight > 0 ? Math.ceil(imageHeight / gridCellSize) : 1;

  // ── Wheel zoom (non-passive so we can preventDefault) ──────────────
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const prev = zoomRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const next = Math.max(0.02, Math.min(10, prev * factor));

      // Zoom towards the mouse position
      const px = panRef.current.x;
      const py = panRef.current.y;
      const newPanX = mx - (mx - px) * (next / prev);
      const newPanY = my - (my - py) * (next / prev);

      setZoom(next);
      setPanX(newPanX);
      setPanY(newPanY);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return (): void => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Drag-to-pan handlers ───────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      dragRef.current = { startX: e.clientX, startY: e.clientY, panX, panY };
    },
    [panX, panY]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPanX(dragRef.current.panX + (e.clientX - dragRef.current.startX));
      setPanY(dragRef.current.panY + (e.clientY - dragRef.current.startY));
    },
    [isDragging]
  );

  const stopDrag = useCallback(() => setIsDragging(false), []);

  // ── Image upload ───────────────────────────────────────────────────
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { url: string };
      setImageUrl(data.url);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  // ── Auto-fit image to viewport on load ─────────────────────────────
  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      setImageWidth(img.naturalWidth);
      setImageHeight(img.naturalHeight);

      const vw = viewportRef.current?.clientWidth ?? 600;
      const fitZoom =
        Math.min(vw / img.naturalWidth, VIEWPORT_H / img.naturalHeight) * 0.8;
      setZoom(fitZoom);
      setPanX((vw - img.naturalWidth * fitZoom) / 2);
      setPanY((VIEWPORT_H - img.naturalHeight * fitZoom) / 2);
    },
    []
  );

  // ── Reset view ─────────────────────────────────────────────────────
  const resetView = useCallback(() => {
    if (!imageWidth || !imageHeight) return;
    const vw = viewportRef.current?.clientWidth ?? 600;
    const fitZoom = Math.min(vw / imageWidth, VIEWPORT_H / imageHeight) * 0.8;
    setZoom(fitZoom);
    setPanX((vw - imageWidth * fitZoom) / 2);
    setPanY((VIEWPORT_H - imageHeight * fitZoom) / 2);
  }, [imageWidth, imageHeight]);

  // ── Submit ─────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!name.trim() || !imageUrl) return;
    createMutation.mutate({
      campaignId,
      name: name.trim(),
      imageUrl,
      imageWidth,
      imageHeight,
      gridOffsetX: Math.round(gridOffsetX * 100) / 100,
      gridOffsetY: Math.round(gridOffsetY * 100) / 100,
      gridCellSize: Math.round(gridCellSize * 100) / 100,
      gridRows,
      gridCols,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6"
    >
      <h3 className="mb-4 text-lg font-semibold">Add Map</h3>

      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
            Map Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            placeholder="Tavern, Dark Cave, etc."
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
            Map Image *
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploading}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-surface)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--color-text-primary)] file:cursor-pointer"
          />
          {uploading && (
            <span className="text-xs text-[var(--color-text-subtle)]">
              Uploading...
            </span>
          )}
        </div>

        {imageUrl && (
          <>
            {/* ── Interactive viewport ─────────────────────────────── */}
            <div className="space-y-2">
              <p className="text-xs text-[var(--color-text-subtle)]">
                Scroll to zoom &middot; Drag to pan &middot; Align the map to
                the green grid
              </p>

              <div
                ref={viewportRef}
                className="relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-black select-none"
                style={{
                  height: `${VIEWPORT_H}px`,
                  cursor: isDragging ? "grabbing" : "grab",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={stopDrag}
                onMouseLeave={stopDrag}
              >
                {/* Map image – transformed behind the grid */}
                <img
                  src={imageUrl}
                  alt="Map preview"
                  draggable={false}
                  onLoad={handleImageLoad}
                  className="absolute top-0 left-0 pointer-events-none"
                  style={{
                    transformOrigin: "0 0",
                    transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                    imageRendering: zoom > 2 ? "pixelated" : "auto",
                  }}
                />

                {/* Grid overlay – fixed to viewport */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: [
                      "linear-gradient(to right, rgba(0,255,0,0.25) 1px, transparent 1px)",
                      "linear-gradient(to bottom, rgba(0,255,0,0.25) 1px, transparent 1px)",
                    ].join(", "),
                    backgroundSize: `${CELL_PX}px ${CELL_PX}px`,
                  }}
                />

                {/* Zoom badge */}
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[0.65rem] text-white/80 pointer-events-none">
                  {Math.round(zoom * 100)}%
                </span>
              </div>
            </div>

            {/* ── Controls ─────────────────────────────────────────── */}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-subtle)]">
                  Zoom: {Math.round(zoom * 100)}%
                </label>
                <input
                  type="range"
                  min={2}
                  max={500}
                  value={Math.round(zoom * 100)}
                  onChange={(e) => {
                    const newZoom = Number(e.target.value) / 100;
                    const vw = viewportRef.current?.clientWidth ?? 600;
                    const cx = vw / 2;
                    const cy = VIEWPORT_H / 2;
                    setPanX(cx - (cx - panX) * (newZoom / zoom));
                    setPanY(cy - (cy - panY) * (newZoom / zoom));
                    setZoom(newZoom);
                  }}
                  className="w-full"
                />
              </div>
              <button
                type="button"
                onClick={resetView}
                className="rounded-lg px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition"
              >
                Reset View
              </button>
            </div>

            <p className="text-xs text-[var(--color-text-subtle)]">
              Grid: {gridCols}&times;{gridRows} cells &middot;{" "}
              {Math.round(gridCellSize)}px per cell
            </p>
          </>
        )}

        <button
          type="submit"
          disabled={createMutation.isPending || !imageUrl}
          className="self-start rounded-lg px-6 py-2 text-sm font-semibold transition theme-btn-accent disabled:opacity-50"
        >
          {createMutation.isPending ? "Saving..." : "Save Map"}
        </button>
      </div>
    </form>
  );
}

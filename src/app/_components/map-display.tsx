"use client";

import { useCallback, useEffect, useRef, useState, type JSX } from "react";

interface Token {
  id: string;
  characterId: string;
  x: number;
  y: number;
  character: {
    id: string;
    fullName: string;
    nickname: string | null;
    avatarImageUrl: string | null;
  };
}

interface MapData {
  id: string;
  name: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  gridOffsetX: number;
  gridOffsetY: number;
  gridCellSize: number;
  gridRows: number;
  gridCols: number;
}

interface MapDisplayProps {
  map: MapData;
  tokens: Token[];
  currentTurnCharacterId?: string | null;
  onClick?: (gridX: number, gridY: number) => void;
  className?: string;
}

export function MapDisplay({
  map,
  tokens,
  currentTurnCharacterId,
  onClick,
  className = "",
}: MapDisplayProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgNatural, setImgNatural] = useState({
    w: map.imageWidth || 1,
    h: map.imageHeight || 1,
  });

  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    },
    []
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onClick) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert click position to natural image coordinates
      const scaleX = imgNatural.w / rect.width;
      const scaleY = imgNatural.h / rect.height;
      const natX = clickX * scaleX;
      const natY = clickY * scaleY;

      // Convert to grid coordinates
      const gridX = Math.floor((natX - map.gridOffsetX) / map.gridCellSize);
      const gridY = Math.floor((natY - map.gridOffsetY) / map.gridCellSize);

      if (
        gridX >= 0 &&
        gridX < map.gridCols &&
        gridY >= 0 &&
        gridY < map.gridRows
      ) {
        onClick(gridX, gridY);
      }
    },
    [onClick, imgNatural, map]
  );

  const gridAreaStyle = {
    position: "absolute" as const,
    left: `${(map.gridOffsetX / imgNatural.w) * 100}%`,
    top: `${(map.gridOffsetY / imgNatural.h) * 100}%`,
    width: `${((map.gridCols * map.gridCellSize) / imgNatural.w) * 100}%`,
    height: `${((map.gridRows * map.gridCellSize) / imgNatural.h) * 100}%`,
    backgroundImage: [
      "linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px)",
      "linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)",
    ].join(", "),
    backgroundSize: `${100 / map.gridCols}% ${100 / map.gridRows}%`,
    border: "1px solid rgba(255,255,255,0.15)",
    pointerEvents: "none" as const,
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block overflow-hidden rounded-lg ${className}`}
      onClick={handleClick}
      style={{ cursor: onClick ? "crosshair" : "default" }}
    >
      <img
        src={map.imageUrl}
        alt={map.name}
        onLoad={handleImageLoad}
        className="block w-full h-auto"
        draggable={false}
      />
      {/* Grid overlay */}
      <div style={gridAreaStyle} />
      {/* Tokens */}
      {tokens.map((token) => {
        const isCurrentTurn = token.characterId === currentTurnCharacterId;
        const leftPct =
          ((map.gridOffsetX + token.x * map.gridCellSize) / imgNatural.w) * 100;
        const topPct =
          ((map.gridOffsetY + token.y * map.gridCellSize) / imgNatural.h) * 100;
        const widthPct = (map.gridCellSize / imgNatural.w) * 100;
        const heightPct = (map.gridCellSize / imgNatural.h) * 100;
        const displayName =
          token.character.nickname ?? token.character.fullName;

        return (
          <div
            key={token.id}
            className={`absolute flex flex-col items-center justify-center transition-all duration-300 ${
              isCurrentTurn ? "z-20" : "z-10"
            }`}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
            }}
          >
            <div
              className={`w-[80%] h-[80%] rounded-full border-2 flex items-center justify-center overflow-hidden text-xs font-bold ${
                isCurrentTurn
                  ? "border-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]"
                  : "border-white/60"
              }`}
              style={{
                backgroundColor: token.character.avatarImageUrl
                  ? "transparent"
                  : "var(--color-surface-strong)",
              }}
            >
              {token.character.avatarImageUrl ? (
                <img
                  src={token.character.avatarImageUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[0.5rem] leading-tight text-center px-0.5">
                  {displayName.slice(0, 3)}
                </span>
              )}
            </div>
            <span className="absolute -bottom-0.5 text-[0.4rem] leading-none font-semibold text-white px-1 rounded bg-black/70 whitespace-nowrap">
              {displayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import type { JSX } from "react";

interface InitiativeCharacter {
  id: string;
  fullName: string;
  nickname: string | null;
  avatarImageUrl: string | null;
}

interface InitiativeEntry {
  id: string;
  characterId: string;
  roll: number;
  character: InitiativeCharacter;
}

interface InitiativeTrackerProps {
  initiative: InitiativeEntry[];
  currentTurn: number;
  highlightCharacterId?: string | null;
  compact?: boolean;
  className?: string;
}

export function InitiativeTracker({
  initiative,
  currentTurn,
  highlightCharacterId,
  compact = false,
  className = "",
}: InitiativeTrackerProps): JSX.Element {
  if (initiative.length === 0) {
    return (
      <div className={`text-sm text-[var(--color-text-subtle)] ${className}`}>
        No initiative set
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 overflow-x-auto ${className}`}>
        {initiative.map((entry, index) => {
          const isCurrent = index === currentTurn;
          const isHighlighted = entry.characterId === highlightCharacterId;
          const name = entry.character.nickname ?? entry.character.fullName;

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                isCurrent
                  ? "bg-[var(--color-accent)] text-[var(--color-text-on-accent)]"
                  : isHighlighted
                    ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
              }`}
            >
              {isCurrent && <span>▸</span>}
              {entry.character.avatarImageUrl && (
                <img
                  src={entry.character.avatarImageUrl}
                  alt={name}
                  className="w-5 h-5 rounded-full object-cover"
                />
              )}
              <span>{name}</span>
              <span className="text-xs opacity-60">({entry.roll})</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {initiative.map((entry, index) => {
        const isCurrent = index === currentTurn;
        const isHighlighted = entry.characterId === highlightCharacterId;
        const name = entry.character.nickname ?? entry.character.fullName;

        return (
          <div
            key={entry.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              isCurrent
                ? "bg-[var(--color-accent)] text-[var(--color-text-on-accent)]"
                : isHighlighted
                  ? "bg-[var(--color-accent-muted)] border border-[var(--color-accent)]"
                  : "bg-[var(--color-surface)]"
            }`}
          >
            <span className="w-4">{isCurrent ? "▸" : ""}</span>
            {entry.character.avatarImageUrl && (
              <img
                src={entry.character.avatarImageUrl}
                alt={name}
                className="w-7 h-7 rounded-full object-cover"
              />
            )}
            <span className="flex-1 font-medium">{name}</span>
            <span
              className={`text-xs ${isCurrent ? "opacity-70" : "text-[var(--color-text-subtle)]"}`}
            >
              Roll: {entry.roll}
            </span>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState, useEffect, type JSX } from "react";
import { api } from "~/trpc/react";
import { ImageUpload } from "~/app/_components/image-upload";

interface CharacterData {
  id: string;
  fullName: string;
  nickname: string | null;
  playerName: string | null;
  level: number;
  characterClass: string;
  race: string;
  fullImageUrl: string | null;
  avatarImageUrl: string | null;
  externalLink: string | null;
  currentHp: number;
  maxHp: number;
  ac: number;
  campaignId: string;
}

interface CharacterFormProps {
  campaignId: string;
  editingCharacter?: CharacterData;
  onDone: () => void;
}

export function CharacterForm({
  campaignId,
  editingCharacter,
  onDone,
}: CharacterFormProps): JSX.Element {
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [level, setLevel] = useState(1);
  const [characterClass, setCharacterClass] = useState("");
  const [race, setRace] = useState("");
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null);
  const [externalLink, setExternalLink] = useState("");
  const [currentHp, setCurrentHp] = useState(10);
  const [maxHp, setMaxHp] = useState(10);
  const [ac, setAc] = useState(10);

  useEffect(() => {
    if (editingCharacter) {
      setFullName(editingCharacter.fullName);
      setNickname(editingCharacter.nickname ?? "");
      setPlayerName(editingCharacter.playerName ?? "");
      setLevel(editingCharacter.level);
      setCharacterClass(editingCharacter.characterClass);
      setRace(editingCharacter.race);
      setFullImageUrl(editingCharacter.fullImageUrl);
      setAvatarImageUrl(editingCharacter.avatarImageUrl);
      setExternalLink(editingCharacter.externalLink ?? "");
      setCurrentHp(editingCharacter.currentHp);
      setMaxHp(editingCharacter.maxHp);
      setAc(editingCharacter.ac);
    }
  }, [editingCharacter]);

  const createMutation = api.character.create.useMutation({
    onSuccess: onDone,
  });
  const updateMutation = api.character.update.useMutation({
    onSuccess: onDone,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      fullName: fullName.trim(),
      nickname: nickname.trim() || null,
      playerName: playerName.trim() || null,
      level,
      characterClass: characterClass.trim(),
      race: race.trim(),
      fullImageUrl,
      avatarImageUrl,
      externalLink: externalLink.trim() || null,
      currentHp,
      maxHp,
      ac,
    };

    if (editingCharacter) {
      updateMutation.mutate({ id: editingCharacter.id, ...data });
    } else {
      createMutation.mutate({ campaignId, ...data });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6"
    >
      <h3 className="mb-4 text-lg font-semibold">
        {editingCharacter ? "Edit Character" : "Add Character"}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
            Full Name *
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
            Nickname
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
            Player Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
            Level
          </label>
          <input
            type="number"
            value={level}
            onChange={(e) => setLevel(parseInt(e.target.value) || 1)}
            min={1}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
            Class *
          </label>
          <input
            type="text"
            value={characterClass}
            onChange={(e) => setCharacterClass(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            placeholder="Fighter, Wizard, etc."
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
            Race *
          </label>
          <input
            type="text"
            value={race}
            onChange={(e) => setRace(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            placeholder="Human, Elf, etc."
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
            Current HP
          </label>
          <input
            type="number"
            value={currentHp}
            onChange={(e) => setCurrentHp(parseInt(e.target.value) || 0)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
            Max HP
          </label>
          <input
            type="number"
            value={maxHp}
            onChange={(e) => setMaxHp(parseInt(e.target.value) || 0)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
            AC
          </label>
          <input
            type="number"
            value={ac}
            onChange={(e) => setAc(parseInt(e.target.value) || 0)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
            External Character Sheet URL
          </label>
          <input
            type="url"
            value={externalLink}
            onChange={(e) => setExternalLink(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            placeholder="https://dndbeyond.com/..."
          />
        </div>
        <ImageUpload
          value={avatarImageUrl}
          onChange={setAvatarImageUrl}
          label="Avatar Image"
        />
        <ImageUpload
          value={fullImageUrl}
          onChange={setFullImageUrl}
          label="Full Image"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 rounded-lg px-6 py-2 text-sm font-semibold transition theme-btn-accent disabled:opacity-50"
      >
        {isPending
          ? "Saving..."
          : editingCharacter
            ? "Update Character"
            : "Add Character"}
      </button>
    </form>
  );
}

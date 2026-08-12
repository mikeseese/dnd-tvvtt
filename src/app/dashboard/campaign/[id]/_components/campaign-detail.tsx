"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { CharacterForm } from "./character-form";
import { MapForm } from "./map-form";

type CampaignData = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  characters: Array<{
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
    createdAt: Date;
    updatedAt: Date;
  }>;
  maps: Array<{
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
    campaignId: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  sessions: Array<{
    id: string;
    name: string;
    shortCode: string;
    status: string;
    campaignId: string;
    activeMapId: string | null;
    activeEncounterId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

type Tab = "characters" | "maps" | "sessions";

export function CampaignDetail({
  initialData,
}: {
  initialData: CampaignData;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>("characters");
  const [showCharForm, setShowCharForm] = useState(false);
  const [showMapForm, setShowMapForm] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [selectedMapIds, setSelectedMapIds] = useState<string[]>([]);
  const [editingCharId, setEditingCharId] = useState<string | null>(null);

  const utils = api.useUtils();
  const campaign = api.campaign.getById.useQuery(
    { id: initialData.id },
    { initialData }
  );

  const deleteChar = api.character.delete.useMutation({
    onSuccess: () => utils.campaign.getById.invalidate({ id: initialData.id }),
  });

  const deleteMap = api.gameMap.delete.useMutation({
    onSuccess: () => utils.campaign.getById.invalidate({ id: initialData.id }),
  });

  const createSession = api.gameSession.create.useMutation({
    onSuccess: () => {
      setShowSessionForm(false);
      setSessionName("");
      setSelectedMapIds([]);
      utils.campaign.getById.invalidate({ id: initialData.id });
    },
  });

  const data = campaign.data!;
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "characters", label: "Characters", count: data.characters.length },
    { key: "maps", label: "Maps", count: data.maps.length },
    { key: "sessions", label: "Sessions", count: data.sessions.length },
  ];

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim() || selectedMapIds.length === 0) return;
    createSession.mutate({
      campaignId: data.id,
      name: sessionName.trim(),
      mapIds: selectedMapIds,
    });
  };

  const toggleMapSelection = (mapId: string) => {
    setSelectedMapIds((prev) =>
      prev.includes(mapId)
        ? prev.filter((id) => id !== mapId)
        : [...prev, mapId]
    );
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-sm text-[var(--color-text-subtle)] hover:text-[var(--color-text-primary)]"
        >
          ← Campaigns
        </Link>
        <span className="text-[var(--color-text-subtle)]">/</span>
        <h1 className="text-2xl font-bold">{data.name}</h1>
      </div>

      {data.description && (
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          {data.description}
        </p>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-[var(--color-surface)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--color-panel-strong)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Characters Tab */}
      {activeTab === "characters" && (
        <div>
          <button
            onClick={() => {
              setShowCharForm(!showCharForm);
              setEditingCharId(null);
            }}
            className="mb-4 rounded-lg px-4 py-2 text-sm font-semibold transition theme-btn-accent"
          >
            {showCharForm ? "Cancel" : "+ Add Character"}
          </button>

          {showCharForm && (
            <CharacterForm
              campaignId={data.id}
              editingCharacter={
                editingCharId
                  ? data.characters.find((c) => c.id === editingCharId)
                  : undefined
              }
              onDone={() => {
                setShowCharForm(false);
                setEditingCharId(null);
                utils.campaign.getById.invalidate({ id: data.id });
              }}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.characters.map((char) => (
              <div
                key={char.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4"
              >
                <div className="flex items-start gap-3">
                  {char.avatarImageUrl && (
                    <img
                      src={char.avatarImageUrl}
                      alt={char.fullName}
                      className="w-12 h-12 rounded-full object-cover border border-[var(--color-border)]"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{char.fullName}</h4>
                    {char.nickname && (
                      <p className="text-xs text-[var(--color-text-subtle)]">
                        &ldquo;{char.nickname}&rdquo;
                      </p>
                    )}
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Lv. {char.level} {char.race} {char.characterClass}
                    </p>
                    {char.playerName && (
                      <p className="text-xs text-[var(--color-text-subtle)]">
                        Player: {char.playerName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-[var(--color-text-muted)]">
                  <span>
                    HP: {char.currentHp}/{char.maxHp}
                  </span>
                  <span>AC: {char.ac}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  {char.externalLink && (
                    <a
                      href={char.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--color-accent)] hover:underline"
                    >
                      Character Sheet ↗
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setEditingCharId(char.id);
                      setShowCharForm(true);
                    }}
                    className="text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-text-primary)]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this character?")) {
                        deleteChar.mutate({ id: char.id });
                      }
                    }}
                    className="text-xs text-[var(--color-danger)] hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maps Tab */}
      {activeTab === "maps" && (
        <div>
          <button
            onClick={() => setShowMapForm(!showMapForm)}
            className="mb-4 rounded-lg px-4 py-2 text-sm font-semibold transition theme-btn-accent"
          >
            {showMapForm ? "Cancel" : "+ Add Map"}
          </button>

          {showMapForm && (
            <MapForm
              campaignId={data.id}
              onDone={() => {
                setShowMapForm(false);
                utils.campaign.getById.invalidate({ id: data.id });
              }}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.maps.map((map) => (
              <div
                key={map.id}
                className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] overflow-hidden"
              >
                <div className="h-40 overflow-hidden">
                  <img
                    src={map.imageUrl}
                    alt={map.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h4 className="font-semibold">{map.name}</h4>
                  <p className="text-xs text-[var(--color-text-subtle)]">
                    Grid: {map.gridCols}×{map.gridRows} • Cell:{" "}
                    {map.gridCellSize}px
                  </p>
                  <button
                    onClick={() => {
                      if (confirm("Delete this map?")) {
                        deleteMap.mutate({ id: map.id });
                      }
                    }}
                    className="mt-2 text-xs text-[var(--color-danger)] hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === "sessions" && (
        <div>
          <button
            onClick={() => setShowSessionForm(!showSessionForm)}
            disabled={data.maps.length === 0}
            className="mb-4 rounded-lg px-4 py-2 text-sm font-semibold transition theme-btn-accent disabled:opacity-50"
            title={
              data.maps.length === 0
                ? "Create at least one map first"
                : undefined
            }
          >
            {showSessionForm ? "Cancel" : "+ New Session"}
          </button>

          {data.maps.length === 0 && (
            <p className="mb-4 text-sm text-[var(--color-text-subtle)]">
              Add at least one map before creating a session.
            </p>
          )}

          {showSessionForm && (
            <form
              onSubmit={handleCreateSession}
              className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6"
            >
              <h3 className="mb-4 text-lg font-semibold">Create Session</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
                    Session Name *
                  </label>
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                    placeholder="Session 1: Into the Dungeon"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text-muted)]">
                    Select Maps *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {data.maps.map((map) => (
                      <button
                        key={map.id}
                        type="button"
                        onClick={() => toggleMapSelection(map.id)}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                          selectedMapIds.includes(map.id)
                            ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"
                        }`}
                      >
                        {map.name}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={
                    createSession.isPending || selectedMapIds.length === 0
                  }
                  className="self-start rounded-lg px-6 py-2 text-sm font-semibold transition theme-btn-accent disabled:opacity-50"
                >
                  {createSession.isPending ? "Creating..." : "Create Session"}
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-col gap-3">
            {data.sessions.map((session) => (
              <Link
                key={session.id}
                href={`/dashboard/campaign/${data.id}/session/${session.id}`}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 transition hover:border-[var(--color-border-strong)]"
              >
                <div>
                  <h4 className="font-semibold">{session.name}</h4>
                  <p className="text-xs text-[var(--color-text-subtle)]">
                    Code: {session.shortCode}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    session.status === "active"
                      ? "bg-[var(--color-success)]/20 text-[var(--color-success)]"
                      : session.status === "completed"
                        ? "bg-[var(--color-text-subtle)]/20 text-[var(--color-text-subtle)]"
                        : "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                  }`}
                >
                  {session.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

interface CampaignSummary {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { characters: number; maps: number; sessions: number };
}

export function CampaignList({
  initialCampaigns,
}: {
  initialCampaigns: CampaignSummary[];
}): JSX.Element {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const utils = api.useUtils();
  const campaigns = api.campaign.list.useQuery(undefined, {
    initialData: initialCampaigns,
  });

  const createMutation = api.campaign.create.useMutation({
    onSuccess: async () => {
      setShowCreate(false);
      setName("");
      setDescription("");
      await utils.campaign.list.invalidate();
    },
  });

  const deleteMutation = api.campaign.delete.useMutation({
    onSuccess: async () => {
      await utils.campaign.list.invalidate();
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition theme-btn-accent"
        >
          {showCreate ? "Cancel" : "+ New Campaign"}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6"
        >
          <h3 className="mb-4 text-lg font-semibold">Create Campaign</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                placeholder="My Epic Campaign"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                rows={3}
                placeholder="A tale of adventure..."
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="self-start rounded-lg px-6 py-2 text-sm font-semibold transition theme-btn-accent disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Create Campaign"}
            </button>
          </div>
        </form>
      )}

      {campaigns.data?.length === 0 && !showCreate && (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <p className="text-lg text-[var(--color-text-muted)]">
            No campaigns yet
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-subtle)]">
            Create your first campaign to get started
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.data?.map((campaign) => (
          <div
            key={campaign.id}
            className="group relative rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 transition hover:border-[var(--color-border-strong)]"
          >
            {campaign.imageUrl && (
              <img
                src={campaign.imageUrl}
                alt={campaign.name}
                className="mb-3 h-32 w-full rounded-lg object-cover"
              />
            )}
            <Link href={`/dashboard/campaign/${campaign.id}`}>
              <h3 className="text-lg font-semibold hover:text-[var(--color-accent)] transition-colors">
                {campaign.name}
              </h3>
            </Link>
            {campaign.description && (
              <p className="mt-1 text-sm text-[var(--color-text-muted)] line-clamp-2">
                {campaign.description}
              </p>
            )}
            <div className="mt-3 flex gap-4 text-xs text-[var(--color-text-subtle)]">
              <span>{campaign._count.characters} characters</span>
              <span>{campaign._count.maps} maps</span>
              <span>{campaign._count.sessions} sessions</span>
            </div>
            <button
              onClick={() => {
                if (confirm("Delete this campaign? This cannot be undone.")) {
                  deleteMutation.mutate({ id: campaign.id });
                }
              }}
              className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 text-xs text-[var(--color-danger)] hover:underline transition-opacity"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { JSX } from "react";
import { api } from "~/trpc/server";
import { CampaignList } from "./_components/campaign-list";

export default async function DashboardPage(): Promise<JSX.Element> {
  const campaigns = await api.campaign.list();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Campaigns</h1>
          <p className="mt-1 text-sm text-[var(--color-text-subtle)]">
            Create and manage your TTRPG campaigns
          </p>
        </div>
      </div>
      <CampaignList initialCampaigns={campaigns} />
    </div>
  );
}

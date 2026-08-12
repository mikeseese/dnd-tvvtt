import type { JSX } from "react";
import { api } from "~/trpc/server";
import { CampaignDetail } from "./_components/campaign-detail";

export default async function CampaignPage(
  props: { params: Promise<{ id: string }> }
): Promise<JSX.Element> {
  const { id } = await props.params;
  const campaign = await api.campaign.getById({ id });

  return <CampaignDetail initialData={campaign} />;
}

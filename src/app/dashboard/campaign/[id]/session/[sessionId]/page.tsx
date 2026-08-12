import type { JSX } from "react";
import { api } from "~/trpc/server";
import { DmSessionView } from "./_components/dm-session-view";

export default async function DmSessionPage(
  props: { params: Promise<{ id: string; sessionId: string }> }
): Promise<JSX.Element> {
  const { id, sessionId } = await props.params;
  const session = await api.gameSession.getById({ id: sessionId });

  return <DmSessionView initialData={session} campaignId={id} />;
}

import { notFound } from "next/navigation";
import type { JSX } from "react";
import { db } from "~/server/db";
import { JoinHandler } from "./_components/join-handler";

export default async function ShortCodePage(
  props: { params: Promise<{ shortCode: string }> }
): Promise<JSX.Element> {
  const { shortCode } = await props.params;

  // Validate format (6 alphanumeric chars, uppercase)
  if (!/^[A-Z2-9]{6}$/.test(shortCode.toUpperCase())) {
    notFound();
  }

  const session = await db.gameSession.findUnique({
    where: { shortCode: shortCode.toUpperCase() },
    include: { campaign: { select: { name: true } } },
  });

  if (!session) {
    notFound();
  }

  return (
    <JoinHandler
      shortCode={session.shortCode}
      sessionName={session.name}
      campaignName={session.campaign.name}
      sessionStatus={session.status}
    />
  );
}

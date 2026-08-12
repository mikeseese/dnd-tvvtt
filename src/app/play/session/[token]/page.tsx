import type { JSX } from "react";
import { PlayerView } from "./_components/player-view";

export default async function PlayerSessionPage(
  props: { params: Promise<{ token: string }> }
): Promise<JSX.Element> {
  const { token } = await props.params;
  return <PlayerView token={token} />;
}

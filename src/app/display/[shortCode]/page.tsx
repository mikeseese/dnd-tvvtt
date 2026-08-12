import type { JSX } from "react";
import { DisplayView } from "./_components/display-view";

export default async function DisplayPage(
  props: { params: Promise<{ shortCode: string }> }
): Promise<JSX.Element> {
  const { shortCode } = await props.params;
  return <DisplayView shortCode={shortCode.toUpperCase()} />;
}

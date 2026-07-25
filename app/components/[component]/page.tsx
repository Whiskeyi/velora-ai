import { notFound } from "next/navigation";
import { COMPONENT_KEYS, isSampleKey } from "../../component-registry";
import { ComponentDetailClient } from "../../showcase-client";

export function generateStaticParams() {
  return COMPONENT_KEYS.map((component) => ({ component }));
}

export default async function ComponentPage({
  params,
}: {
  params: Promise<{ component: string }>;
}) {
  const { component } = await params;
  if (!isSampleKey(component)) notFound();
  return <ComponentDetailClient componentKey={component} />;
}

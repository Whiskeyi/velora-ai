import "../../app/globals.css";
import "../../packages/react/src/velora.css";
import "../../packages/react/src/rich-content.css";
import { isSampleKey } from "../../app/component-registry";

async function bootstrapPages(): Promise<void> {
  const [{ createRoot }, { ComponentDetailClient, ShowcaseClient }] = await Promise.all([
    import("react-dom/client"),
    import("../../app/showcase-client"),
  ]);
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Velora Pages root element was not found");
  }

  const componentMatch = window.location.pathname.match(/\/components\/([^/]+)\/?$/);
  const componentKey = componentMatch?.[1];

  createRoot(rootElement).render(
    componentKey && isSampleKey(componentKey) ? (
      <ComponentDetailClient componentKey={componentKey} />
    ) : (
      <ShowcaseClient />
    ),
  );
}

const viteEnvironment = (import.meta as ImportMeta & { env?: { SSR?: boolean } }).env;

if (viteEnvironment?.SSR !== true && typeof document !== "undefined") {
  void bootstrapPages();
}

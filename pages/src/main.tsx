import { createRoot } from "react-dom/client";

import "../../app/globals.css";
import "../../packages/react/src/velora.css";
import {
  ComponentDetailClient,
  ShowcaseClient,
  isSampleKey,
} from "../../app/showcase-client";

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

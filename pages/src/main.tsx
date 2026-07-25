import { createRoot } from "react-dom/client";

import "../../app/globals.css";
import "../../packages/react/src/velora.css";
import { ShowcaseClient } from "../../app/showcase-client";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Velora Pages root element was not found");
}

createRoot(rootElement).render(<ShowcaseClient />);

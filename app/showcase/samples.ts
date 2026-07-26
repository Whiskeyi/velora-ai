import type { SampleKey } from "../component-registry";
import type { Sample } from "./model";
import { SHOWCASE_SAMPLES } from "./samples-data.mjs";

export { SHOWCASE_SAMPLES };

export const SHOWCASE_SAMPLE_BY_KEY = Object.fromEntries(
  SHOWCASE_SAMPLES.map((sample) => [sample.key, sample]),
) as Readonly<Record<SampleKey, Sample>>;

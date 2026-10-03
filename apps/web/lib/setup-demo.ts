import type { SetupState } from "@lakshly/shared";
import type { LakshlyDataset } from "@lakshly/parsers";
/** The compiler replaces this public build flag; fixtures are loaded only in a shots build. */
export async function loadSetupDemo(search: string): Promise<{ setup: SetupState; dataset: LakshlyDataset } | null> {
  if (process.env.NEXT_PUBLIC_LAKSHLY_SHOTS !== "1") return null;
  if (new URLSearchParams(search).get("setupDemo") !== "midway") return null;
  const [state, data] = await Promise.all([
    import("../../../packages/shared/setup/__fixtures__/state.midway.json"),
    import("../../../packages/shared/setup/__fixtures__/dataset.after-import.json"),
  ]);
  return { setup: structuredClone(state.default) as SetupState, dataset: structuredClone(data.default) as LakshlyDataset };
}

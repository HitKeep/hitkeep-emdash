import type { PluginDescriptor } from "emdash";

export function hitkeepPlugin(): PluginDescriptor {
  return { id: "hitkeep", version: "0.1.0", format: "native", entrypoint: "@hitkeep/emdash/plugin" };
}

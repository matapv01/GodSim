import { createPluginRuntimeStore } from "openclaw/plugin-sdk";
import type { PluginRuntime } from "openclaw/plugin-sdk";

const { setRuntime: setTownRuntime, getRuntime: getTownRuntime } =
  createPluginRuntimeStore<PluginRuntime>(
    "Agentshire runtime not initialized — plugin not registered",
  );

export { setTownRuntime, getTownRuntime };

import api from "./api";

export async function fetchBrainTerminalInfo() {
  const { data } = await api.get("/ai-brain/code-terminal/info");
  return data;
}

export async function syncBrainCodeWorkspace(files, projectId) {
  const { data } = await api.post("/ai-brain/code-workspace/sync", { files, projectId });
  return data;
}

export async function execBrainTerminalCommand({ command, shell, files, projectId }) {
  const { data } = await api.post("/ai-brain/code-terminal/exec", {
    command,
    shell,
    files,
    projectId
  });
  return data;
}

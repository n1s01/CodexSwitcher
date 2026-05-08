import { invoke } from "@tauri-apps/api/core";

export type CodexDirValidation = {
  valid: boolean;
  missing_files: string[];
};

export function getCodexDirectoryPath() {
  return invoke<string>("get_codex_directory_path");
}

export function validateCodexDirectoryPath(path: string) {
  return invoke<CodexDirValidation>("validate_codex_directory_path", { path });
}

export function setCodexDirectoryPath(path: string) {
  return invoke<void>("set_codex_directory_path", { path });
}

import * as fs from "node:fs/promises";
import { ensureRuntimeDirs, getRuntimePaths } from "./config";
import { writeProtectedFile } from "./output-security";

export type JournalDispatch = {
  dispatchId: string;
  threadId: string;
  threadSessionId: string;
  externalAgentId: string;
  repoKey: string;
  pid: number | null;
  startedAt: string;
};

type JournalData = {
  activeDispatches: JournalDispatch[];
};

export class Journal {
  private data: JournalData = { activeDispatches: [] };

  async load() {
    const paths = await ensureRuntimeDirs();
    try {
      const raw = await fs.readFile(paths.journalPath, "utf8");
      this.data = JSON.parse(raw) as JournalData;
    } catch {
      this.data = { activeDispatches: [] };
      await this.persist();
    }
  }

  listActive() {
    return [...this.data.activeDispatches];
  }

  async add(dispatch: JournalDispatch) {
    this.data.activeDispatches = this.data.activeDispatches.filter(
      (entry) => entry.dispatchId !== dispatch.dispatchId,
    );
    this.data.activeDispatches.push(dispatch);
    await this.persist();
  }

  async remove(dispatchId: string) {
    this.data.activeDispatches = this.data.activeDispatches.filter(
      (entry) => entry.dispatchId !== dispatchId,
    );
    await this.persist();
  }

  private async persist() {
    const paths = getRuntimePaths();
    await writeProtectedFile(
      paths.journalPath,
      JSON.stringify(this.data, null, 2) + "\n",
    );
  }
}

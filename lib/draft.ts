import { mkdir, writeFile, unlink, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DRAFT_DIR = join(tmpdir(), "sparkrun-ui-drafts");
const MAX_AGE_MS = 30 * 60 * 1000;

async function ensureDir() {
  await mkdir(DRAFT_DIR, { recursive: true });
}

function safeId(id: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid draftId");
  return id;
}

export async function writeDraft(draftId: string, yaml: string): Promise<string> {
  await ensureDir();
  await reapStale();
  const path = join(DRAFT_DIR, `${safeId(draftId)}.yaml`);
  await writeFile(path, yaml, "utf8");
  return path;
}

export async function deleteDraft(draftId: string): Promise<void> {
  try {
    await unlink(join(DRAFT_DIR, `${safeId(draftId)}.yaml`));
  } catch {
    // ignore
  }
}

async function reapStale(): Promise<void> {
  const now = Date.now();
  try {
    const files = await readdir(DRAFT_DIR);
    await Promise.all(
      files.map(async (file) => {
        const fp = join(DRAFT_DIR, file);
        try {
          const s = await stat(fp);
          if (now - s.mtimeMs > MAX_AGE_MS) await unlink(fp);
        } catch {
          // ignore
        }
      }),
    );
  } catch {
    // ignore
  }
}

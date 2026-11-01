import fs from 'fs';
import path from 'path';

/** Most recently used legacy or current quest records, without creating state. */
export default function questSessionIds(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => /^[a-f0-9-]{36}\.json$/.test(name))
    .map((name) => ({
      id: name.slice(0, -5),
      modified: fs.statSync(path.join(directory, name)).mtimeMs,
    }))
    .sort((a, b) => b.modified - a.modified || a.id.localeCompare(b.id))
    .map((item) => item.id);
}

import type { TrainingMaterials } from '../../../shared/training-materials';
import { api } from './training-api';
import { loadTaskBrief } from './task-brief-cache';

// Session-only, bounded, and account-scoped. Revalidate after ten minutes so
// updated study materials do not remain stale for the lifetime of the app.
const TTL_MS = 10 * 60 * 1000;
const entries = new Map<
  string,
  {
    expires: number;
    value?: TrainingMaterials;
    pending: Promise<TrainingMaterials>;
  }
>();
const keyFor = (userId: string, day: number, filename: string | null) =>
  JSON.stringify([userId, day, filename]);

export function cachedMaterials(
  userId: string,
  day: number,
  filename: string | null,
) {
  const entry = entries.get(keyFor(userId, day, filename));
  return entry && entry.expires > Date.now() ? (entry.value ?? null) : null;
}

export function loadMaterials(
  userId: string,
  day: number,
  filename: string | null,
): Promise<TrainingMaterials> {
  const key = keyFor(userId, day, filename);
  const cached = entries.get(key);
  if (cached && cached.expires > Date.now()) return cached.pending;
  const pending = api('study-task-materials', day)
    .then(async (data: TrainingMaterials) => {
      if (!data || !Array.isArray(data.documents) || !Array.isArray(data.files))
        throw new Error('Task instructions could not be loaded.');
      const document = data.documents[0];
      if (document?.kind === 'pdf') await loadTaskBrief(document);
      if (entries.get(key)?.pending === pending) entries.get(key)!.value = data;
      return data;
    })
    .catch((error: unknown) => {
      if (entries.get(key)?.pending === pending) entries.delete(key);
      throw error;
    });
  entries.set(key, { expires: Date.now() + TTL_MS, pending });
  if (entries.size > 14) entries.delete(entries.keys().next().value!);
  return pending;
}

import type { TrainingDocument } from '../../../shared/training-materials';
import extractPdfText from './extract-pdf-text';
import parseTaskBrief, { type TaskBrief } from './task-brief';

// Key by the actual content, so a changed PDF never reuses an old brief.
const entries = new Map<
  string,
  { value?: TaskBrief; pending: Promise<TaskBrief> }
>();
const keyFor = (document: TrainingDocument) =>
  JSON.stringify([document.name, document.content]);
export function cachedTaskBrief(document: TrainingDocument): TaskBrief | null {
  return entries.get(keyFor(document))?.value ?? null;
}
export function loadTaskBrief(document: TrainingDocument): Promise<TaskBrief> {
  const key = keyFor(document);
  const cached = entries.get(key);
  if (cached) return cached.pending;
  const pending = extractPdfText(document.content)
    .then((text) => {
      const brief = parseTaskBrief(text, document.name);
      if (entries.get(key)?.pending === pending)
        entries.get(key)!.value = brief;
      return brief;
    })
    .catch((error: unknown) => {
      if (entries.get(key)?.pending === pending) entries.delete(key);
      throw error;
    });
  entries.set(key, { pending });
  if (entries.size > 14) entries.delete(entries.keys().next().value!);
  return pending;
}

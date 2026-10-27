import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import {
  emptyToolProgress,
  type ToolChapterProgress,
} from '../../shared/tool-exploration';

export default class ToolChapterStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  private file(user: string) {
    return path.join(
      this.root,
      `${createHash('sha256').update(user).digest('hex')}.json`,
    );
  }

  read(user: string): ToolChapterProgress {
    try {
      const data = JSON.parse(fs.readFileSync(this.file(user), 'utf8'));
      return {
        externalInformation: data.externalInformation === true,
        approved: data.approved === true,
        denied: data.denied === true,
        completedAt:
          data.externalInformation === true &&
          data.approved === true &&
          data.denied === true &&
          typeof data.completedAt === 'string'
            ? data.completedAt
            : null,
      };
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT')
        return emptyToolProgress();
      throw new Error('Could not read Chapter 1 progress.');
    }
  }

  hit(user: string, goal: 'externalInformation' | 'approved' | 'denied') {
    const progress = this.read(user);
    progress[goal] = true;
    if (
      progress.externalInformation &&
      progress.approved &&
      progress.denied &&
      !progress.completedAt
    )
      progress.completedAt = new Date().toISOString();
    fs.mkdirSync(this.root, { recursive: true });
    fs.writeFileSync(`${this.file(user)}.tmp`, JSON.stringify(progress));
    fs.renameSync(`${this.file(user)}.tmp`, this.file(user));
    return progress;
  }
}

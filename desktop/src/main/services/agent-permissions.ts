import { randomUUID } from 'crypto';
import type { PermissionRequest } from '../../shared/agent-execution';

export interface ActionApproval {
  toolCallId: string;
  tool: string;
  arguments: Record<string, unknown>;
  directory: string;
}

/** Trusted pending requests live in main, never in renderer or model state. */
export default class AgentPermissions {
  private readonly pending = new Map<
    string,
    (status: PermissionRequest['status']) => void
  >();

  private readonly publish: (request: PermissionRequest) => void;

  constructor(publish: (request: PermissionRequest) => void) {
    this.publish = publish;
  }

  request(
    input: Omit<PermissionRequest, 'id' | 'status'>,
    signal: AbortSignal,
  ): Promise<boolean> {
    if (signal.aborted) return Promise.resolve(false);
    const request: PermissionRequest = {
      ...input,
      id: randomUUID(),
      status: 'pending',
    };
    return new Promise((resolve) => {
      const cancel = () => this.pending.get(request.id)?.('cancelled');
      const finish = (status: PermissionRequest['status']) => {
        if (!this.pending.delete(request.id)) return;
        signal.removeEventListener('abort', cancel);
        this.publish({ ...request, status });
        resolve(status === 'allowed');
      };
      this.pending.set(request.id, finish);
      signal.addEventListener('abort', cancel, { once: true });
      this.publish(request);
    });
  }

  answer(id: string, allow: unknown) {
    if (typeof allow !== 'boolean')
      throw new Error('Invalid permission decision.');
    const finish = this.pending.get(id);
    if (!finish)
      throw new Error('This permission request is no longer active.');
    finish(allow ? 'allowed' : 'denied');
  }

  cancel() {
    [...this.pending.values()].forEach((finish) => finish('cancelled'));
  }
}

import type { CampaignRepository } from './repository';

/** The browser releases this liveness lock when a page closes. Persisted
 * generation/revision checks remain authoritative for every campaign write. */
export class WriterSession {
  private releaseHold: (() => void) | undefined;
  private acquiring: Promise<boolean> | undefined;
  private epoch = 0;
  private firstCheck = true;
  onLost: (() => void) | undefined;
  constructor(
    readonly repository: CampaignRepository,
    private readonly locks = typeof navigator === 'undefined' ? undefined : navigator.locks,
  ) {}
  async acquire(takeOver = false): Promise<boolean> {
    if (this.acquiring) {
      const acquired = await this.acquiring;
      if (acquired || !takeOver) return acquired;
    }
    const operation = this.request(takeOver);
    this.acquiring = operation;
    try {
      return await operation;
    } finally {
      if (this.acquiring === operation) this.acquiring = undefined;
    }
  }
  private async request(takeOver: boolean): Promise<boolean> {
    const recoverClosedPage = this.firstCheck;
    this.firstCheck = false;
    if (!this.repository.database || !this.locks) return this.repository.acquire(takeOver);
    if (this.releaseHold) return this.repository.acquire(takeOver, true);
    return new Promise<boolean>((resolve, reject) => {
      let granted = false;
      const epoch = this.epoch;
      const request = this.locks?.request(
        'resonance-bastion-v1.writer',
        takeOver ? { steal: true } : { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            this.repository.writer = undefined;
            resolve(false);
            return;
          }
          try {
            if (!(await this.repository.acquire(takeOver, true, recoverClosedPage))) {
              resolve(false);
              return;
            }
            if (epoch !== this.epoch) {
              this.repository.writer = undefined;
              resolve(false);
              return;
            }
            await new Promise<void>((release) => {
              this.releaseHold = release;
              granted = true;
              resolve(true);
            });
          } catch (error) {
            reject(error);
          }
        },
      );
      void request?.catch((error) => {
        if (epoch === this.epoch) {
          this.release();
          if (granted) this.onLost?.();
        }
        if (!granted) reject(error);
      });
    });
  }
  release(): void {
    this.epoch++;
    this.repository.writer = undefined;
    const release = this.releaseHold;
    this.releaseHold = undefined;
    release?.();
  }
}

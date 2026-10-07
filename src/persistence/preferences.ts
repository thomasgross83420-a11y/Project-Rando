import { z } from 'zod';
import type { Database } from './database';
import { audioSettings, audioDefaults } from '../audio/mixer';

// Blueprint §§18,26C: global presentation only, outside campaign Undo/Redo.
export const preferencesSchema = z
  .object({
    schema: z.literal(1),
    uiScale: z.union([z.literal(18), z.literal(27), z.literal(36)]),
    reducedEffects: z.boolean(),
    highContrast: z.boolean(),
    audio: audioSettings.default(audioDefaults),
  })
  .strict();
export type Preferences = z.infer<typeof preferencesSchema>;
export class PreferencesStore {
  value: Preferences = {
    schema: 1,
    uiScale: 18,
    reducedEffects: matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: false,
    audio: { ...audioDefaults },
  };
  private revision = 0;
  private savedRevision = -1;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    readonly database: Database | undefined,
    readonly report: (s: string) => void,
  ) {}
  async load(): Promise<void> {
    if (!this.database) {
      this.apply();
      this.savedRevision = this.revision;
      return;
    }
    const stored = await this.database.read<unknown>('meta', 'preferences.v1');
    if (stored !== undefined) {
      const parsed = preferencesSchema.safeParse(stored);
      if (!parsed.success) {
        this.savedRevision = this.revision;
        this.apply();
        throw new Error(
          'Invalid preferences retained; defaults apply until an explicit setting change',
        );
      }
      this.value = parsed.data;
      this.savedRevision = this.revision;
    }
    this.apply();
    if (stored === undefined) await this.save();
  }
  apply(): void {
    document.documentElement.style.fontSize = `${this.value.uiScale}px`;
    document.documentElement.classList.toggle('reduced-effects', this.value.reducedEffects);
    document.documentElement.classList.toggle('high-contrast', this.value.highContrast);
  }
  change(patch: Partial<Omit<Preferences, 'schema'>>): void {
    this.value = preferencesSchema.parse({ ...this.value, ...patch });
    this.apply();
    this.revision++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), 250);
  }
  async save(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.revision === this.savedRevision) return;
    if (!this.database) {
      this.report('Temporary Session preferences apply only during this session.');
      return;
    }
    const revision = this.revision,
      snapshot = structuredClone(this.value);
    try {
      await this.database.transaction(['meta'], 'readwrite', (tx, done) => {
        tx.objectStore('meta').put(snapshot, 'preferences.v1');
        done(undefined);
      });
      if (revision === this.revision) {
        this.savedRevision = revision;
        this.report('Presentation preferences saved. Campaign data unchanged.');
      }
    } catch (e) {
      this.report(
        `Preferences not saved: ${String(e)}. Current presentation retained. Use Retry Save Preferences.`,
      );
    }
  }
}

import { z } from 'zod';

/** §28E counters: canonical decimal unsigned 64-bit, including zero. */
export const sequenceSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,19})$/)
  .refine((s) => BigInt(s) <= 18446744073709551615n, 'Unsigned 64-bit sequence overflow');

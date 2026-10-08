/** Shared metadata keys for ordinary attempts and their committed receipts. */
export const runStateKey = (slot: number) => `run.slot.${slot}`;
export const runReceiptsKey = (slot: number) => `receipts.slot.${slot}`;

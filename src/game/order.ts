/** Canonical identifiers use code-unit order, independently of device locale. */
export const compareIDs = (a: string, b: string): number => (a === b ? 0 : a < b ? -1 : 1);

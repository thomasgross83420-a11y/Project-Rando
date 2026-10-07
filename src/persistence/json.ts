/** Parse bounded JSON without losing duplicate keys or accepting prototype keys.
 * JSON.parse alone loses duplicate-member evidence before schema validation.
 */
export const BACKUP_BYTES = 32 * 1024 * 1024;
export function parseBackupJSON(text: string): unknown {
  if (new TextEncoder().encode(text).byteLength > BACKUP_BYTES)
    throw new Error('Backup exceeds the 32 MiB limit');
  let pos = 0;
  let nodes = 0;
  const whitespace = () => {
    while (' \t\r\n'.includes(text[pos] ?? '\0')) pos++;
  };
  const fail = (): never => {
    throw new Error(`Invalid backup JSON near character ${pos}`);
  };
  const string = (): string => {
    const start = pos++;
    while (pos < text.length) {
      const c = text[pos++];
      if (c === '\\') pos++;
      else if (c === '"') return JSON.parse(text.slice(start, pos)) as string;
    }
    return fail();
  };
  const number = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
  const read = (depth: number): unknown => {
    if (depth > 32 || ++nodes > 1000000)
      throw new Error('Backup nesting or collection limit exceeded');
    whitespace();
    const c = text[pos];
    if (c === '"') return string();
    if (c === '{') {
      pos++;
      const value: Record<string, unknown> = Object.create(null);
      whitespace();
      if (text[pos] === '}') {
        pos++;
        return value;
      }
      for (;;) {
        whitespace();
        if (text[pos] !== '"') return fail();
        const key = string();
        if (['__proto__', 'prototype', 'constructor'].includes(key))
          throw new Error('Prototype-bearing backup keys are not allowed');
        if (Object.hasOwn(value, key)) throw new Error(`Duplicate backup key: ${key}`);
        whitespace();
        if (text[pos++] !== ':') return fail();
        value[key] = read(depth + 1);
        whitespace();
        const end = text[pos++];
        if (end === '}') return value;
        if (end !== ',') return fail();
      }
    }
    if (c === '[') {
      pos++;
      const value: unknown[] = [];
      whitespace();
      if (text[pos] === ']') {
        pos++;
        return value;
      }
      for (;;) {
        value.push(read(depth + 1));
        whitespace();
        const end = text[pos++];
        if (end === ']') return value;
        if (end !== ',') return fail();
      }
    }
    for (const [token, value] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const)
      if (text.startsWith(token, pos)) {
        pos += token.length;
        return value;
      }
    number.lastIndex = pos;
    const token = number.exec(text);
    if (!token) return fail();
    pos = number.lastIndex;
    const value = Number(token[0]);
    if (!Number.isFinite(value)) return fail();
    return value;
  };
  const value = read(0);
  whitespace();
  if (pos !== text.length) return fail();
  return value;
}

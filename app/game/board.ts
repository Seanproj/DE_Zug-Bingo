// Board geometry: row-major indices, lines = rows, columns, two diagonals.

export interface Line {
  /** r0..r{n-1}, c0..c{n-1}, d0 (↘), d1 (↙) */
  id: string;
  cells: number[];
}

const cache = new Map<number, Line[]>();

export function boardLines(size: number): Line[] {
  const hit = cache.get(size);
  if (hit) return hit;
  const range = [...Array(size).keys()];
  const lines: Line[] = [
    ...range.map((r) => ({ id: `r${r}`, cells: range.map((c) => r * size + c) })),
    ...range.map((c) => ({ id: `c${c}`, cells: range.map((r) => r * size + c) })),
    { id: 'd0', cells: range.map((i) => i * size + i) },
    { id: 'd1', cells: range.map((i) => i * size + (size - 1 - i)) },
  ];
  cache.set(size, lines);
  return lines;
}

export const centerIndex = (size: number) => (size * size - 1) / 2;

/** For each cell, the lines passing through it. */
export function linesByCell(size: number): Line[][] {
  const byCell: Line[][] = Array.from({ length: size * size }, () => []);
  for (const line of boardLines(size)) for (const i of line.cells) byCell[i]!.push(line);
  return byCell;
}

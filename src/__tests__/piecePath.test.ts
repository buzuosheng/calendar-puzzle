import { describe, expect, it } from 'vitest';
import { parseShape, PIECE_IDS, PIECE_SHAPES, ORIENTATIONS } from '../pieces';
import { polyominoOutline, roundedPolyominoPath } from '../piecePath';

describe('polyominoOutline', () => {
  it('traces a single cell as a 4-vertex square', () => {
    expect(polyominoOutline([{ r: 0, c: 0 }])).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
    ]);
  });

  it('collapses the straight I tetromino to a rectangle', () => {
    const verts = polyominoOutline(parseShape(PIECE_SHAPES.I));
    expect(verts).toHaveLength(4);
  });

  it('keeps the U-notch as one loop with two concave corners', () => {
    const verts = polyominoOutline(parseShape(PIECE_SHAPES.U));
    expect(verts).toHaveLength(8);
  });
});

describe('roundedPolyominoPath', () => {
  it('emits a single closed path of rounded corners', () => {
    const d = roundedPolyominoPath(parseShape(PIECE_SHAPES.I), 40);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.includes('A')).toBe(true);
    expect((d.match(/A/g) ?? []).length).toBe(4);
    expect((d.match(/Z/g) ?? []).length).toBe(1);
  });

  it('rounds both convex and concave corners on U', () => {
    const d = roundedPolyominoPath(parseShape(PIECE_SHAPES.U), 40);
    expect(d.includes(' 0 0 0 ')).toBe(true);
    expect(d.includes(' 0 0 1 ')).toBe(true);
  });

  it('builds a closed silhouette for every piece orientation', () => {
    for (const id of PIECE_IDS) {
      for (const ori of ORIENTATIONS[id]) {
        const d = roundedPolyominoPath(ori, 28);
        expect(d.startsWith('M'), `${id} path`).toBe(true);
        expect(d.endsWith('Z'), `${id} closed`).toBe(true);
        expect((d.match(/A/g) ?? []).length, `${id} arcs`).toBeGreaterThanOrEqual(4);
      }
    }
  });
});

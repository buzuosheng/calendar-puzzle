import { describe, expect, it } from 'vitest';
import { PIECE_IDS, PIECE_SHAPES, ORIENTATIONS, uniqueOrientations, pieceSize, parseShape } from '../pieces';

const EXPECTED_ORIENTATIONS: Record<string, number> = {
  O: 2,
  L: 8,
  N: 8,
  P: 8,
  U: 4,
  V: 4,
  Y: 8,
  Z: 4,
};

describe('piece orientations', () => {
  it('keeps the official eight-piece DragonFjord set totaling 41 cells', () => {
    const total = PIECE_IDS.reduce((sum, id) => sum + pieceSize(id), 0);
    expect(PIECE_IDS).toHaveLength(8);
    expect(total).toBe(41);
    expect(PIECE_IDS).toEqual(['O', 'L', 'N', 'P', 'U', 'V', 'Y', 'Z']);
  });

  it('parses each ASCII shape to the correct number of cells', () => {
    for (const id of PIECE_IDS) {
      expect(parseShape(PIECE_SHAPES[id])).toHaveLength(pieceSize(id));
    }
  });

  it('generates unique orientations only, with expected counts', () => {
    for (const id of PIECE_IDS) {
      const oris = uniqueOrientations(PIECE_SHAPES[id]);
      const keys = oris.map((ori) => ori.map((cell) => `${cell.r},${cell.c}`).join(';'));
      expect(new Set(keys).size, `${id} has duplicate orientations`).toBe(keys.length);
      expect(oris.length, `${id} orientation count`).toBe(EXPECTED_ORIENTATIONS[id]);
      expect(ORIENTATIONS[id]).toHaveLength(EXPECTED_ORIENTATIONS[id]!);
    }
  });

  it('normalizes every orientation so min row and min col are 0', () => {
    for (const id of PIECE_IDS) {
      for (const ori of ORIENTATIONS[id]) {
        expect(Math.min(...ori.map((cell) => cell.r))).toBe(0);
        expect(Math.min(...ori.map((cell) => cell.c))).toBe(0);
      }
    }
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadGlobal(filename, globalName) {
  const code = readFileSync(resolve(__dirname, '..', 'js', filename), 'utf-8');
  const script = new Function(`${code}; return ${globalName};`);
  return script();
}

describe('Storage', () => {
  let Storage;

  beforeEach(() => {
    Storage = loadGlobal('storage.js', 'Storage');
    localStorage.clear();
  });

  describe('save / load', () => {
    it('saves and loads state from localStorage', () => {
      const state = {
        floors: [{
          id: 'ground',
          name: 'Ground',
          zMin: 0,
          zMax: 3,
          imageData: null,
          scale: { pixelsPerMeter: 100 },
          rooms: [{ id: 'r1', name: 'Room 1', color: '#f00', points: [[0, 0], [1, 1]] }],
          nodes: [{ id: 'n1', name: 'Node 1', point: [1, 2, 1.5], floors: ['ground'] }],
        }],
        activeFloorId: 'ground',
      };

      Storage.save(state);
      const loaded = Storage.load();

      expect(loaded).not.toBeNull();
      expect(loaded.floors).toHaveLength(1);
      expect(loaded.floors[0].name).toBe('Ground');
      expect(loaded.floors[0].rooms[0].name).toBe('Room 1');
      expect(loaded.floors[0].nodes[0].point).toEqual([1, 2, 1.5]);
      expect(loaded.activeFloorId).toBe('ground');
    });
  });

  describe('load', () => {
    it('returns null when nothing is saved', () => {
      expect(Storage.load()).toBeNull();
    });

    it('returns null on corrupted data', () => {
      localStorage.setItem('espresense-planner', '{invalid json');
      expect(Storage.load()).toBeNull();
    });
  });

  describe('clear', () => {
    it('removes saved data', () => {
      localStorage.setItem('espresense-planner', '{"test":1}');
      Storage.clear();
      expect(localStorage.getItem('espresense-planner')).toBeNull();
    });
  });
});

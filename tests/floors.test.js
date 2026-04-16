import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load the source file as a script in jsdom
function loadModule(filename) {
  const code = readFileSync(resolve(__dirname, '..', 'js', filename), 'utf-8');
  const fn = new Function(code + `; return typeof ${filename.replace('.js', '').charAt(0).toUpperCase() + filename.replace('.js', '').slice(1)} !== 'undefined' ? ${filename.replace('.js', '').charAt(0).toUpperCase() + filename.replace('.js', '').slice(1)} : null;`);
  return fn();
}

// Simpler approach: eval the file and extract the global
function loadGlobal(filename, globalName) {
  const code = readFileSync(resolve(__dirname, '..', 'js', filename), 'utf-8');
  const script = new Function(`${code}; return ${globalName};`);
  return script();
}

describe('Floors', () => {
  let Floors;

  beforeEach(() => {
    Floors = loadGlobal('floors.js', 'Floors');
    Floors.colorIndex = 0;
  });

  describe('createFloor', () => {
    it('creates a floor with default values', () => {
      const floor = Floors.createFloor('Ground Floor');
      expect(floor.id).toBe('ground_floor');
      expect(floor.name).toBe('Ground Floor');
      expect(floor.zMin).toBe(0);
      expect(floor.zMax).toBe(3);
      expect(floor.rooms).toEqual([]);
      expect(floor.nodes).toEqual([]);
      expect(floor.imageData).toBeNull();
      expect(floor.scale).toBeNull();
    });

    it('sanitizes id from name', () => {
      const floor = Floors.createFloor('1st Floor!');
      expect(floor.id).toBe('1st_floor');
    });

    it('stores image data when provided', () => {
      const floor = Floors.createFloor('Test', 'data:image/png;base64,abc');
      expect(floor.imageData).toBe('data:image/png;base64,abc');
    });
  });

  describe('createRoom', () => {
    it('creates a room with name, points, and auto color', () => {
      const room = Floors.createRoom('Living Room', [[0, 0], [5, 0], [5, 3], [0, 3]]);
      expect(room.id).toBe('living_room');
      expect(room.name).toBe('Living Room');
      expect(room.points).toHaveLength(4);
      expect(room.color).toBeTruthy();
    });

    it('uses custom color when provided', () => {
      const room = Floors.createRoom('Kitchen', [[0, 0]], '#ff0000');
      expect(room.color).toBe('#ff0000');
    });
  });

  describe('createNode', () => {
    it('creates a node with position and floor assignment', () => {
      const node = Floors.createNode('Hallway Node', 2.5, 1.5, 1.2, ['ground']);
      expect(node.id).toBe('hallway_node');
      expect(node.name).toBe('Hallway Node');
      expect(node.point).toEqual([2.5, 1.5, 1.2]);
      expect(node.floors).toEqual(['ground']);
    });
  });

  describe('addRoom / removeRoom', () => {
    it('adds and removes rooms from a floor', () => {
      const floor = Floors.createFloor('Test');
      const room = Floors.createRoom('R1', [[0, 0], [1, 0], [1, 1], [0, 1]]);
      Floors.addRoom(floor, room);
      expect(floor.rooms).toHaveLength(1);

      Floors.removeRoom(floor, room.id);
      expect(floor.rooms).toHaveLength(0);
    });
  });

  describe('addNode / removeNode', () => {
    it('adds and removes nodes from a floor', () => {
      const floor = Floors.createFloor('Test');
      const node = Floors.createNode('N1', 1, 1, 1, ['test']);
      Floors.addNode(floor, node);
      expect(floor.nodes).toHaveLength(1);

      Floors.removeNode(floor, node.id);
      expect(floor.nodes).toHaveLength(0);
    });
  });

  describe('computeBounds', () => {
    it('computes bounding box from room points', () => {
      const floor = Floors.createFloor('Test');
      floor.zMin = 0;
      floor.zMax = 3;
      Floors.addRoom(floor, Floors.createRoom('A', [[1.2, 0.5], [5.8, 0.5], [5.8, 4.3], [1.2, 4.3]]));
      Floors.addRoom(floor, Floors.createRoom('B', [[6, 1], [8.5, 1], [8.5, 3], [6, 3]]));

      const bounds = Floors.computeBounds(floor);
      expect(bounds).toEqual([[1, 0, 0], [9, 5, 3]]);
    });

    it('returns default bounds when no rooms exist', () => {
      const floor = Floors.createFloor('Empty');
      const bounds = Floors.computeBounds(floor);
      expect(bounds).toEqual([[0, 0, 0], [10, 10, 3]]);
    });
  });

  describe('getActiveFloor', () => {
    it('returns the floor matching activeFloorId', () => {
      const state = {
        floors: [
          Floors.createFloor('A'),
          Floors.createFloor('B'),
        ],
        activeFloorId: 'b',
      };
      const active = Floors.getActiveFloor(state);
      expect(active.name).toBe('B');
    });

    it('falls back to first floor if id not found', () => {
      const state = {
        floors: [Floors.createFloor('A')],
        activeFloorId: 'nonexistent',
      };
      const active = Floors.getActiveFloor(state);
      expect(active.name).toBe('A');
    });
  });

  describe('nextColor', () => {
    it('cycles through colors', () => {
      const c1 = Floors.nextColor();
      const c2 = Floors.nextColor();
      expect(c1).not.toBe(c2);
      expect(c1).toMatch(/^#/);
    });
  });
});

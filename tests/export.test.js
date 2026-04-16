import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import jsyaml from 'js-yaml';

function loadGlobal(filename, globalName) {
  const code = readFileSync(resolve(__dirname, '..', 'js', filename), 'utf-8');
  const script = new Function(`${code}; return ${globalName};`);
  return script();
}

describe('Export', () => {
  let Export, Floors;

  beforeEach(() => {
    // Make jsyaml available globally (as in the browser)
    globalThis.jsyaml = jsyaml;
    Floors = loadGlobal('floors.js', 'Floors');
    globalThis.Floors = Floors;
    Export = loadGlobal('export.js', 'Export');
  });

  it('generates valid YAML with rooms and nodes', () => {
    const floor = Floors.createFloor('Ground Floor');
    Floors.addRoom(floor, Floors.createRoom('Kitchen', [[0, 0], [4, 0], [4, 3], [0, 3]]));
    Floors.addNode(floor, Floors.createNode('Node Kitchen', 2, 1.5, 1.2, ['ground_floor']));

    const state = { floors: [floor], activeFloorId: 'ground_floor' };
    const yaml = Export.generate(state);
    const parsed = jsyaml.load(yaml);

    expect(parsed.floors).toHaveLength(1);
    expect(parsed.floors[0].id).toBe('ground_floor');
    expect(parsed.floors[0].rooms[0].name).toBe('Kitchen');
    expect(parsed.floors[0].rooms[0].points).toEqual([[0, 0], [4, 0], [4, 3], [0, 3]]);
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0].name).toBe('Node Kitchen');
    expect(parsed.nodes[0].point).toEqual([2, 1.5, 1.2]);
  });

  it('sets flip_y to false', () => {
    const state = { floors: [Floors.createFloor('F')], activeFloorId: 'f' };
    const yaml = Export.generate(state);
    const parsed = jsyaml.load(yaml);
    expect(parsed.map.flip_y).toBe(false);
  });

  it('computes bounds from room points', () => {
    const floor = Floors.createFloor('Test');
    Floors.addRoom(floor, Floors.createRoom('Big', [[1.5, 2], [7.3, 2], [7.3, 6.8], [1.5, 6.8]]));

    const state = { floors: [floor], activeFloorId: 'test' };
    const yaml = Export.generate(state);
    const parsed = jsyaml.load(yaml);

    expect(parsed.floors[0].bounds[0]).toEqual([1, 2, 0]);
    expect(parsed.floors[0].bounds[1]).toEqual([8, 7, 3]);
  });

  it('includes devices and locators', () => {
    const state = { floors: [Floors.createFloor('F')], activeFloorId: 'f' };
    const yaml = Export.generate(state);
    const parsed = jsyaml.load(yaml);

    expect(parsed.devices).toEqual([{ name: '*' }]);
    expect(parsed.locators.nearest_node.enabled).toBe(true);
  });

  it('handles multi-floor with nodes', () => {
    const f1 = Floors.createFloor('Ground');
    const f2 = Floors.createFloor('First');
    f2.zMin = 3;
    f2.zMax = 6;
    Floors.addNode(f1, Floors.createNode('N1', 1, 1, 1, ['ground']));
    Floors.addNode(f2, Floors.createNode('N2', 2, 2, 4, ['first']));

    const state = { floors: [f1, f2], activeFloorId: 'ground' };
    const yaml = Export.generate(state);
    const parsed = jsyaml.load(yaml);

    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.floors).toHaveLength(2);
    expect(parsed.locators.nadaraya_watson.floors).toEqual(['ground', 'first']);
  });
});

// floors.js — Gestion des étages
const Floors = {
  COLORS: [
    '#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#ef4444', '#22c55e', '#f97316', '#3b82f6',
  ],

  colorIndex: 0,

  nextColor() {
    const c = this.COLORS[this.colorIndex % this.COLORS.length];
    this.colorIndex++;
    return c;
  },

  createFloor(name, imageData) {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return {
      id: id || 'floor_' + Date.now(),
      name,
      zMin: 0,
      zMax: 3,
      imageData: imageData || null,
      scale: null, // { pixelsPerMeter, refLine: {x1,y1,x2,y2,meters} }
      rooms: [],
      nodes: [],
    };
  },

  getActiveFloor(state) {
    return state.floors.find(f => f.id === state.activeFloorId) || state.floors[0];
  },

  addRoom(floor, room) {
    floor.rooms.push(room);
  },

  removeRoom(floor, roomId) {
    floor.rooms = floor.rooms.filter(r => r.id !== roomId);
  },

  addNode(floor, node) {
    floor.nodes.push(node);
  },

  removeNode(floor, nodeId) {
    floor.nodes = floor.nodes.filter(n => n.id !== nodeId);
  },

  createRoom(name, points, color) {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return {
      id: id || 'room_' + Date.now(),
      name,
      color: color || this.nextColor(),
      points, // [[x_meters, y_meters], ...]
    };
  },

  createNode(name, x, y, z, floorIds) {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return {
      id: id || 'node_' + Date.now(),
      name,
      point: [x, y, z],
      floors: floorIds,
    };
  },

  computeBounds(floor) {
    let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
    for (const room of floor.rooms) {
      for (const [x, y] of room.points) {
        xMin = Math.min(xMin, x);
        yMin = Math.min(yMin, y);
        xMax = Math.max(xMax, x);
        yMax = Math.max(yMax, y);
      }
    }
    if (!isFinite(xMin)) return [[0, 0, floor.zMin], [10, 10, floor.zMax]];
    return [
      [Math.floor(xMin), Math.floor(yMin), floor.zMin],
      [Math.ceil(xMax), Math.ceil(yMax), floor.zMax],
    ];
  },

  renderFloorTabs(state, container, onSwitch) {
    container.innerHTML = '';
    for (const floor of state.floors) {
      const tab = document.createElement('button');
      tab.className = 'floor-tab' + (floor.id === state.activeFloorId ? ' active' : '');
      tab.textContent = floor.name;
      tab.addEventListener('click', () => onSwitch(floor.id));
      container.appendChild(tab);
    }
  },
};

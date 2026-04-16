// storage.js — Persistance LocalStorage
const Storage = {
  KEY: 'espresense-planner',

  save(state) {
    try {
      const data = {
        floors: state.floors.map(f => ({
          id: f.id,
          name: f.name,
          zMin: f.zMin,
          zMax: f.zMax,
          imageData: f.imageData,
          scale: f.scale,
          rooms: f.rooms,
          nodes: f.nodes,
        })),
        activeFloorId: state.activeFloorId,
      };
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Storage load failed:', e);
      return null;
    }
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },

  exportJSON(state) {
    const data = {
      floors: state.floors.map(f => ({
        id: f.id,
        name: f.name,
        zMin: f.zMin,
        zMax: f.zMax,
        imageData: f.imageData,
        scale: f.scale,
        rooms: f.rooms,
        nodes: f.nodes,
      })),
      activeFloorId: state.activeFloorId,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'espresense-project.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result));
        } catch {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
};

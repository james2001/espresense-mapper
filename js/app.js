// app.js — Orchestration principale
const App = {
  state: {
    floors: [],
    activeFloorId: null,
  },
  currentTool: 'select',
  currentStep: 'upload', // upload | calibrate | editor
  _imgWidth: 0,
  _imgHeight: 0,

  init() {
    Upload.init();
    this.bindGlobalEvents();

    // Essayer de charger depuis LocalStorage
    const saved = Storage.load();
    if (saved && saved.floors && saved.floors.length > 0) {
      this.state = saved;
      const floor = Floors.getActiveFloor(this.state);
      if (floor && floor.imageData) {
        const img = new Image();
        img.onload = () => {
          this._imgWidth = img.naturalWidth;
          this._imgHeight = img.naturalHeight;
          this.goToStep('editor');
          Editor.init(floor.imageData, img.naturalWidth, img.naturalHeight, floor.scale);
          Editor.renderAll(floor);
          Floors.renderFloorTabs(this.state, document.getElementById('floor-tabs'), (id) => this.switchFloor(id));
          this.updateSidebar();
        };
        img.src = floor.imageData;
        return;
      }
    }
  },

  // === Navigation entre étapes ===
  goToStep(step) {
    this.currentStep = step;
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    document.getElementById('step-' + step).classList.add('active');
  },

  // === Callbacks depuis upload ===
  onImageLoaded(imageData, imgWidth, imgHeight) {
    this._imgWidth = imgWidth;
    this._imgHeight = imgHeight;

    // Créer le premier étage si nécessaire
    if (this.state.floors.length === 0) {
      const floor = Floors.createFloor('Ground Floor', imageData);
      this.state.floors.push(floor);
      this.state.activeFloorId = floor.id;
    } else {
      const floor = Floors.getActiveFloor(this.state);
      floor.imageData = imageData;
    }

    this.goToStep('calibrate');
    Calibrate.init(imageData, imgWidth, imgHeight);
  },

  // === Callback depuis calibration ===
  onCalibrated(scale) {
    const floor = Floors.getActiveFloor(this.state);
    floor.scale = scale;

    this.goToStep('editor');
    Editor.init(floor.imageData, this._imgWidth, this._imgHeight, scale);
    Editor.renderAll(floor);
    Floors.renderFloorTabs(this.state, document.getElementById('floor-tabs'), (id) => this.switchFloor(id));
    this.updateSidebar();
    this.autoSave();
  },

  // === Outil courant ===
  setTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Cleanup previous tool state
    Rooms.stopDrawing();
    Rooms.deselectRoom();
    Nodes.stopPlacing();
    Nodes.deselectNode();
    Editor.drawLayer.innerHTML = '';

    if (tool === 'room') {
      Rooms.startDrawing();
      Editor.container.style.cursor = 'crosshair';
    } else if (tool === 'node') {
      Nodes.startPlacing();
      Editor.container.style.cursor = 'crosshair';
    } else if (tool === 'calibrate') {
      Editor.startRecalibration();
    } else {
      Editor.container.style.cursor = 'default';
    }
  },

  // === Events globaux ===
  bindGlobalEvents() {
    // Tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
    });

    // Canvas clicks (délégué à l'outil actif)
    document.getElementById('canvas-container').addEventListener('click', (e) => {
      if (Editor.isPanning) return;
      if (this.currentTool === 'room') {
        Rooms.onCanvasClick(e);
      } else if (this.currentTool === 'node') {
        Nodes.onCanvasClick(e);
      } else if (this.currentTool === 'select') {
        Rooms.onCanvasClick(e);
        Nodes.onSelectClick(e);
      }
    });

    document.getElementById('canvas-container').addEventListener('dblclick', (e) => {
      Rooms.onCanvasDblClick(e);
    });

    document.getElementById('canvas-container').addEventListener('mousemove', (e) => {
      Rooms.onCanvasMouseMove(e);
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.currentStep !== 'editor') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'v': this.setTool('select'); break;
        case 'r': this.setTool('room'); break;
        case 'n': this.setTool('node'); break;
        case 'c': this.setTool('calibrate'); break;
        case 'escape':
          if (Rooms.isDrawing) {
            Rooms.stopDrawing();
            this.setTool('select');
          }
          break;
        case 'delete':
        case 'backspace':
          if (Rooms.selectedRoomId) Rooms.deleteSelectedRoom();
          else if (Nodes.selectedNodeId) Nodes.deleteSelectedNode();
          break;
      }
    });

    // Bouton export
    document.getElementById('btn-export').addEventListener('click', () => {
      Export.show(this.state);
    });

    // Bouton add floor
    document.getElementById('add-floor').addEventListener('click', () => {
      this.addFloor();
    });

    // Save / Load / Reset
    document.getElementById('btn-save').addEventListener('click', () => {
      Storage.exportJSON(this.state);
      this.showToast('Project exported');
    });

    document.getElementById('btn-load').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const data = await Storage.importJSON(file);
          this.state = data;
          const floor = Floors.getActiveFloor(this.state);
          if (floor && floor.imageData) {
            const img = new Image();
            img.onload = () => {
              this._imgWidth = img.naturalWidth;
              this._imgHeight = img.naturalHeight;
              this.goToStep('editor');
              Editor.init(floor.imageData, img.naturalWidth, img.naturalHeight, floor.scale);
              Editor.renderAll(floor);
              Floors.renderFloorTabs(this.state, document.getElementById('floor-tabs'), (id) => this.switchFloor(id));
              this.updateSidebar();
            };
            img.src = floor.imageData;
          }
          this.showToast('Project loaded');
        } catch (err) {
          this.showToast('Erreur : ' + err.message);
        }
      });
      input.click();
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      if (confirm('Delete entire project and start over?')) {
        Storage.clear();
        this.state = { floors: [], activeFloorId: null };
        this.goToStep('upload');
      }
    });

    // Modal
    document.getElementById('modal-cancel').addEventListener('click', () => {
      this.hideModal();
      // Si on annule pendant le dessin d'une pièce, on revient en mode select
      if (Rooms.isDrawing) {
        Rooms.stopDrawing();
        this.setTool('select');
      }
    });
  },

  // === Floor management ===
  switchFloor(floorId) {
    this.state.activeFloorId = floorId;
    const floor = Floors.getActiveFloor(this.state);

    if (!floor.imageData) {
      // Need to upload an image for this floor
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            floor.imageData = ev.target.result;
            this._imgWidth = img.naturalWidth;
            this._imgHeight = img.naturalHeight;

            if (!floor.scale) {
              // Calibration needed
              this.goToStep('calibrate');
              Calibrate.init(floor.imageData, img.naturalWidth, img.naturalHeight);
            } else {
              Editor.updateImage(floor.imageData, img.naturalWidth, img.naturalHeight, floor.scale);
              Editor.renderAll(floor);
            }
            this.updateSidebar();
            Floors.renderFloorTabs(this.state, document.getElementById('floor-tabs'), (id) => this.switchFloor(id));
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
      input.click();
      return;
    }

    const img = new Image();
    img.onload = () => {
      this._imgWidth = img.naturalWidth;
      this._imgHeight = img.naturalHeight;
      Editor.updateImage(floor.imageData, img.naturalWidth, img.naturalHeight, floor.scale);
      Editor.renderAll(floor);
      Floors.renderFloorTabs(this.state, document.getElementById('floor-tabs'), (id) => this.switchFloor(id));
      this.updateSidebar();
    };
    img.src = floor.imageData;
  },

  addFloor() {
    const extraHTML = `
      <label>Min height Z (meters)</label>
      <input type="number" id="floor-zmin-input" step="0.1" value="0">
      <label>Max height Z (meters)</label>
      <input type="number" id="floor-zmax-input" step="0.1" value="3">
    `;

    this.showModal('Floor name', '', (name, extraData) => {
      if (!name) return;

      const zMin = parseFloat(extraData['floor-zmin-input']) || 0;
      const zMax = parseFloat(extraData['floor-zmax-input']) || 3;

      const floor = Floors.createFloor(name);
      floor.zMin = zMin;
      floor.zMax = zMax;
      this.state.floors.push(floor);
      this.state.activeFloorId = floor.id;
      Floors.renderFloorTabs(this.state, document.getElementById('floor-tabs'), (id) => this.switchFloor(id));
      this.switchFloor(floor.id);
      this.autoSave();
    }, '1st Floor', extraHTML);
  },

  // === Sidebar update ===
  updateSidebar() {
    const floor = Floors.getActiveFloor(this.state);
    if (!floor) return;
    Rooms.renderList(floor);
    Nodes.renderList(floor);
  },

  // === Modal ===
  _modalCallback: null,

  showModal(title, placeholder, callback, defaultValue, extraHTML) {
    this._modalCallback = callback;
    document.getElementById('modal-title').textContent = title;
    const input = document.getElementById('modal-input');
    input.placeholder = placeholder || '';
    input.value = defaultValue || '';
    document.getElementById('modal-extra').innerHTML = extraHTML || '';
    document.getElementById('modal-overlay').classList.remove('hidden');

    setTimeout(() => input.focus(), 50);

    const confirmHandler = () => {
      const val = input.value.trim();
      const cb = this._modalCallback;
      // Collect extra inputs BEFORE hiding (which clears modal-extra)
      const extraData = {};
      document.querySelectorAll('#modal-extra input').forEach(inp => {
        if (inp.id) extraData[inp.id] = inp.value;
      });
      this.hideModal();
      if (cb) cb(val, extraData);
    };

    // Remove old listeners
    const confirmBtn = document.getElementById('modal-confirm');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', confirmHandler);

    // Enter key
    input.onkeydown = (e) => {
      if (e.key === 'Enter') confirmHandler();
      if (e.key === 'Escape') this.hideModal();
    };
  },

  hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-extra').innerHTML = '';
    this._modalCallback = null;
  },

  // === Toast ===
  showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  },

  // === Auto-save ===
  autoSave() {
    Storage.save(this.state);
  },
};

// Démarrage
document.addEventListener('DOMContentLoaded', () => App.init());

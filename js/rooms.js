// rooms.js — Dessin et édition des pièces (polygones)
const Rooms = {
  isDrawing: false,
  currentPoints: [],  // [{x, y}] in image pixels
  previewLine: null,
  firstPointEl: null,
  selectedRoomId: null,
  dragVertex: null,
  _clickTimer: null,
  _pendingClick: null,

  startDrawing() {
    this.isDrawing = true;
    this.currentPoints = [];
    this._clickTimer = null;
    this._pendingClick = null;
    Editor.drawLayer.innerHTML = '';
  },

  stopDrawing() {
    this.isDrawing = false;
    this.currentPoints = [];
    this._clickTimer = null;
    this._pendingClick = null;
    Editor.drawLayer.innerHTML = '';
  },

  onCanvasClick(e) {
    if (!this.isDrawing) {
      this.onSelectClick(e);
      return;
    }

    // Debounce: attendre pour distinguer clic simple / double-clic
    if (this._clickTimer) {
      clearTimeout(this._clickTimer);
      this._clickTimer = null;
      this._pendingClick = null;
      return; // ignore second click of dblclick
    }

    this._pendingClick = e;
    this._clickTimer = setTimeout(() => {
      this._clickTimer = null;
      if (!this._pendingClick || !this.isDrawing) return;
      this._handleSingleClick(this._pendingClick);
      this._pendingClick = null;
    }, 200);
  },

  _handleSingleClick(e) {
    const pt = Editor.screenToSVG(e);

    // Fermer le polygone si clic sur le premier point
    if (this.currentPoints.length >= 3 && this.firstPointEl) {
      const firstPt = this.currentPoints[0];
      const threshold = Math.max(Editor.imgWidth, Editor.imgHeight) * 0.015;
      const dx = pt.x - firstPt.x;
      const dy = pt.y - firstPt.y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        this.closePolygon();
        return;
      }
    }

    this.currentPoints.push(pt);
    this.renderDrawing();
  },

  onCanvasDblClick(e) {
    // Annuler le clic en attente
    if (this._clickTimer) {
      clearTimeout(this._clickTimer);
      this._clickTimer = null;
      this._pendingClick = null;
    }

    if (this.isDrawing && this.currentPoints.length >= 3) {
      e.preventDefault();
      this.closePolygon();
    }
  },

  onCanvasMouseMove(e) {
    if (!this.isDrawing || this.currentPoints.length === 0) return;

    const pt = Editor.screenToSVG(e);
    // Update preview line
    if (this.previewLine) {
      this.previewLine.setAttribute('x2', pt.x);
      this.previewLine.setAttribute('y2', pt.y);
    }
  },

  renderDrawing() {
    Editor.drawLayer.innerHTML = '';
    const r = Math.max(Editor.imgWidth, Editor.imgHeight) * 0.004;
    const sw = Math.max(Editor.imgWidth, Editor.imgHeight) * 0.0015;

    // Lignes entre les points
    for (let i = 0; i < this.currentPoints.length - 1; i++) {
      const a = this.currentPoints[i];
      const b = this.currentPoints[i + 1];
      const line = Editor.createSVG('line', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        class: 'drawing-line',
        'stroke-width': sw,
      });
      Editor.drawLayer.appendChild(line);
    }

    // Points
    this.currentPoints.forEach((pt, i) => {
      const circle = Editor.createSVG('circle', {
        cx: pt.x, cy: pt.y, r,
        class: 'drawing-point',
      });
      if (i === 0) {
        circle.setAttribute('r', r * 1.5);
        this.firstPointEl = circle;
      }
      Editor.drawLayer.appendChild(circle);
    });

    // Preview line from last point to cursor
    if (this.currentPoints.length > 0) {
      const last = this.currentPoints[this.currentPoints.length - 1];
      this.previewLine = Editor.createSVG('line', {
        x1: last.x, y1: last.y, x2: last.x, y2: last.y,
        class: 'drawing-line',
        'stroke-width': sw,
      });
      Editor.drawLayer.appendChild(this.previewLine);
    }
  },

  closePolygon() {
    const pixelPoints = [...this.currentPoints];
    this.stopDrawing();

    // Convertir en mètres
    const meterPoints = pixelPoints.map(pt => Editor.pxToMeters(pt.x, pt.y));

    App.showModal('Room name', '', (name) => {
      if (!name) return;
      const floor = Floors.getActiveFloor(App.state);
      const room = Floors.createRoom(name, meterPoints);
      Floors.addRoom(floor, room);
      Editor.renderAll(floor);
      App.updateSidebar();
      App.autoSave();
      App.setTool('select');
    }, 'Living Room');
  },

  // === Sélection et édition ===
  onSelectClick(e) {
    const target = e.target;
    const roomId = target.getAttribute('data-room-id') ||
      target.closest('[data-room-id]')?.getAttribute('data-room-id');

    if (roomId) {
      this.selectRoom(roomId);
    } else if (!target.classList.contains('vertex-handle')) {
      this.deselectRoom();
    }
  },

  selectRoom(roomId) {
    this.selectedRoomId = roomId;
    const floor = Floors.getActiveFloor(App.state);
    const room = floor.rooms.find(r => r.id === roomId);
    if (!room) return;

    Editor.renderRoomVertices(room);
    this.bindVertexDrag(room);
    App.updateSidebar();
  },

  deselectRoom() {
    this.selectedRoomId = null;
    Editor.clearVertexHandles();
    App.updateSidebar();
  },

  bindVertexDrag(room) {
    const handles = Editor.drawLayer.querySelectorAll('.vertex-handle');
    handles.forEach((handle) => {
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const idx = parseInt(handle.getAttribute('data-vertex-index'));
        this.dragVertex = { room, index: idx, handle };
        Editor.container.style.cursor = 'grabbing';

        const onMove = (ev) => {
          const pt = Editor.screenToSVG(ev);
          const [mx, my] = Editor.pxToMeters(pt.x, pt.y);
          room.points[idx] = [mx, my];
          handle.setAttribute('cx', pt.x);
          handle.setAttribute('cy', pt.y);

          // Mettre à jour le polygone visuellement
          const floor = Floors.getActiveFloor(App.state);
          Editor.renderRooms(floor.rooms);
        };

        const onUp = () => {
          this.dragVertex = null;
          Editor.container.style.cursor = '';
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          App.autoSave();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    });
  },

  deleteSelectedRoom() {
    if (!this.selectedRoomId) return;
    const floor = Floors.getActiveFloor(App.state);
    Floors.removeRoom(floor, this.selectedRoomId);
    this.deselectRoom();
    Editor.renderAll(floor);
    App.updateSidebar();
    App.autoSave();
  },

  // Sidebar list
  renderList(floor) {
    const ul = document.getElementById('room-list');
    ul.innerHTML = '';
    for (const room of floor.rooms) {
      const li = document.createElement('li');
      li.className = room.id === this.selectedRoomId ? 'selected' : '';

      li.innerHTML = `
        <span class="item-color" style="background:${room.color}"></span>
        <span class="item-name">${room.name}</span>
        <button class="item-delete" title="Delete">&times;</button>
      `;

      li.addEventListener('click', (e) => {
        if (!e.target.classList.contains('item-delete')) {
          this.selectRoom(room.id);
        }
      });

      li.querySelector('.item-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedRoomId = room.id;
        this.deleteSelectedRoom();
      });

      ul.appendChild(li);
    }
  },
};

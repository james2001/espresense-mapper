// editor.js — Canvas SVG principal avec zoom, pan, grille
const Editor = {
  svg: null,
  container: null,
  imgWidth: 0,
  imgHeight: 0,
  imageData: null,
  scale: null, // { pixelsPerMeter }

  // Zoom/pan state
  viewBox: { x: 0, y: 0, w: 0, h: 0 },
  isPanning: false,
  panStart: { x: 0, y: 0 },
  zoomLevel: 1,

  // Layers
  gridLayer: null,
  imageEl: null,
  roomLayer: null,
  nodeLayer: null,
  drawLayer: null,

  init(imageData, imgWidth, imgHeight, scale) {
    this.svg = document.getElementById('editor-svg');
    this.container = document.getElementById('canvas-container');
    this.imageData = imageData;
    this.imgWidth = imgWidth;
    this.imgHeight = imgHeight;
    this.scale = scale;

    this.viewBox = { x: 0, y: 0, w: imgWidth, h: imgHeight };
    this.zoomLevel = 1;

    this.buildSVG();
    this.bindEvents();
    this.updateGrid();
    this.updateZoomDisplay();
  },

  buildSVG() {
    const svg = this.svg;
    svg.innerHTML = '';
    this.applyViewBox();

    // Image de fond
    this.imageEl = this.createSVG('image', {
      href: this.imageData,
      width: this.imgWidth,
      height: this.imgHeight,
    });
    svg.appendChild(this.imageEl);

    // Couche grille
    this.gridLayer = this.createSVG('g', { class: 'grid-layer' });
    svg.appendChild(this.gridLayer);

    // Couche pièces
    this.roomLayer = this.createSVG('g', { class: 'room-layer' });
    svg.appendChild(this.roomLayer);

    // Couche nodes
    this.nodeLayer = this.createSVG('g', { class: 'node-layer' });
    svg.appendChild(this.nodeLayer);

    // Couche dessin temporaire
    this.drawLayer = this.createSVG('g', { class: 'draw-layer' });
    svg.appendChild(this.drawLayer);
  },

  createSVG(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'href') el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', v);
        else el.setAttribute(k, v);
      }
    }
    return el;
  },

  applyViewBox() {
    const vb = this.viewBox;
    this.svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  },

  // === Coordinate conversions ===
  // Image pixels → meters
  pxToMeters(px, py) {
    const ppm = this.scale.pixelsPerMeter;
    return [
      Math.round((px / ppm) * 100) / 100,
      Math.round((py / ppm) * 100) / 100,
    ];
  },

  // Meters → image pixels
  metersToPx(mx, my) {
    const ppm = this.scale.pixelsPerMeter;
    return [mx * ppm, my * ppm];
  },

  // Screen event → image pixels
  screenToSVG(e) {
    const ctm = this.svg.getScreenCTM().inverse();
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(ctm);
    return { x: svgPt.x, y: svgPt.y };
  },

  // === Grid ===
  updateGrid() {
    this.gridLayer.innerHTML = '';
    if (!document.getElementById('toggle-grid').checked) return;

    const ppm = this.scale.pixelsPerMeter;
    const totalW = this.imgWidth;
    const totalH = this.imgHeight;

    // Lignes verticales (chaque mètre)
    for (let x = 0; x <= totalW; x += ppm) {
      const isMajor = Math.round(x / ppm) % 5 === 0;
      const line = this.createSVG('line', {
        x1: x, y1: 0, x2: x, y2: totalH,
        class: isMajor ? 'grid-line-major' : 'grid-line',
      });
      this.gridLayer.appendChild(line);
    }

    // Lignes horizontales (chaque mètre)
    for (let y = 0; y <= totalH; y += ppm) {
      const isMajor = Math.round(y / ppm) % 5 === 0;
      const line = this.createSVG('line', {
        x1: 0, y1: y, x2: totalW, y2: y,
        class: isMajor ? 'grid-line-major' : 'grid-line',
      });
      this.gridLayer.appendChild(line);
    }
  },

  // === Zoom / Pan ===
  bindEvents() {
    const container = this.container;

    // Zoom molette
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      const pt = this.screenToSVG(e);
      this.zoom(factor, pt.x, pt.y);
    }, { passive: false });

    // Pan (clic milieu ou espace+clic)
    container.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.panStart.x;
        const dy = e.clientY - this.panStart.y;
        const rect = this.svg.getBoundingClientRect();
        const scaleX = this.viewBox.w / rect.width;
        const scaleY = this.viewBox.h / rect.height;
        this.viewBox.x -= dx * scaleX;
        this.viewBox.y -= dy * scaleY;
        this.applyViewBox();
        this.panStart = { x: e.clientX, y: e.clientY };
      }

      // Affichage coordonnées curseur
      if (this.scale) {
        const pt = this.screenToSVG(e);
        const [mx, my] = this.pxToMeters(pt.x, pt.y);
        document.getElementById('cursor-coords').textContent =
          `x: ${mx.toFixed(2)}m  y: ${my.toFixed(2)}m`;
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.container.style.cursor = '';
      }
    });

    // Boutons zoom
    document.getElementById('zoom-in').addEventListener('click', () => {
      this.zoom(1 / 1.3, this.imgWidth / 2, this.imgHeight / 2);
    });
    document.getElementById('zoom-out').addEventListener('click', () => {
      this.zoom(1.3, this.imgWidth / 2, this.imgHeight / 2);
    });
    document.getElementById('zoom-fit').addEventListener('click', () => this.fitView());

    // Toggle grille
    document.getElementById('toggle-grid').addEventListener('change', () => this.updateGrid());
  },

  zoom(factor, cx, cy) {
    const vb = this.viewBox;
    const newW = vb.w * factor;
    const newH = vb.h * factor;

    // Limite zoom
    if (newW < this.imgWidth * 0.05 || newW > this.imgWidth * 5) return;

    vb.x = cx - (cx - vb.x) * factor;
    vb.y = cy - (cy - vb.y) * factor;
    vb.w = newW;
    vb.h = newH;

    this.zoomLevel = this.imgWidth / newW;
    this.applyViewBox();
    this.updateZoomDisplay();
  },

  fitView() {
    this.viewBox = { x: 0, y: 0, w: this.imgWidth, h: this.imgHeight };
    this.zoomLevel = 1;
    this.applyViewBox();
    this.updateZoomDisplay();
  },

  updateZoomDisplay() {
    document.getElementById('zoom-level').textContent = Math.round(this.zoomLevel * 100) + '%';
  },

  // === Rendering rooms & nodes ===
  renderAll(floor) {
    this.renderRooms(floor.rooms);
    this.renderNodes(floor.nodes);
  },

  renderRooms(rooms) {
    this.roomLayer.innerHTML = '';
    for (const room of rooms) {
      this.renderRoom(room);
    }
  },

  renderRoom(room) {
    const g = this.createSVG('g', { 'data-room-id': room.id });

    // Polygon
    const pointsStr = room.points
      .map(([mx, my]) => this.metersToPx(mx, my).join(','))
      .join(' ');

    const polygon = this.createSVG('polygon', {
      points: pointsStr,
      fill: room.color,
      'fill-opacity': '0.25',
      stroke: room.color,
      'stroke-width': Math.max(this.imgWidth, this.imgHeight) * 0.002,
      class: 'room-polygon',
      'data-room-id': room.id,
    });
    g.appendChild(polygon);

    // Label au centre
    const center = this.polygonCenter(room.points);
    const [cx, cy] = this.metersToPx(center[0], center[1]);
    const label = this.createSVG('text', {
      x: cx, y: cy,
      class: 'room-label',
      'font-size': Math.max(this.imgWidth, this.imgHeight) * 0.015,
    });
    label.textContent = room.name;
    g.appendChild(label);

    this.roomLayer.appendChild(g);
  },

  renderRoomVertices(room) {
    // Supprimer les anciens handles
    this.drawLayer.querySelectorAll('.vertex-handle').forEach(el => el.remove());

    const handleRadius = Math.max(this.imgWidth, this.imgHeight) * 0.004;

    room.points.forEach((pt, i) => {
      const [px, py] = this.metersToPx(pt[0], pt[1]);
      const circle = this.createSVG('circle', {
        cx: px, cy: py,
        r: handleRadius,
        fill: room.color,
        stroke: 'white',
        'stroke-width': handleRadius * 0.5,
        class: 'vertex-handle',
        'data-room-id': room.id,
        'data-vertex-index': i,
      });
      this.drawLayer.appendChild(circle);
    });
  },

  clearVertexHandles() {
    this.drawLayer.querySelectorAll('.vertex-handle').forEach(el => el.remove());
  },

  renderNodes(nodes) {
    this.nodeLayer.innerHTML = '';
    for (const node of nodes) {
      this.renderNode(node);
    }
  },

  renderNode(node) {
    const [px, py] = this.metersToPx(node.point[0], node.point[1]);
    const size = Math.max(this.imgWidth, this.imgHeight) * 0.008;

    const g = this.createSVG('g', {
      class: 'node-marker',
      'data-node-id': node.id,
      transform: `translate(${px}, ${py})`,
    });

    // Losange
    const diamond = this.createSVG('polygon', {
      points: `0,${-size} ${size},0 0,${size} ${-size},0`,
      fill: '#22c55e',
      stroke: 'white',
      'stroke-width': size * 0.25,
    });
    g.appendChild(diamond);

    // Label
    const label = this.createSVG('text', {
      x: 0, y: -size * 1.8,
      class: 'node-label',
      'font-size': Math.max(this.imgWidth, this.imgHeight) * 0.012,
    });
    label.textContent = node.name;
    g.appendChild(label);

    this.nodeLayer.appendChild(g);
  },

  // === Helpers ===
  polygonCenter(points) {
    let cx = 0, cy = 0;
    for (const [x, y] of points) {
      cx += x;
      cy += y;
    }
    return [cx / points.length, cy / points.length];
  },

  // Recalibration dans l'éditeur
  startRecalibration() {
    this.recalPoints = [];
    this.container.style.cursor = 'crosshair';
    this._recalHandler = (e) => this._onRecalClick(e);
    this.svg.addEventListener('click', this._recalHandler);
    App.showToast('Click 2 points to recalibrate');
  },

  _onRecalClick(e) {
    const pt = this.screenToSVG(e);
    this.recalPoints.push(pt);

    const r = Math.max(this.imgWidth, this.imgHeight) * 0.005;
    const circle = this.createSVG('circle', {
      cx: pt.x, cy: pt.y, r,
      class: 'calibrate-point',
    });
    this.drawLayer.appendChild(circle);

    if (this.recalPoints.length === 2) {
      this.svg.removeEventListener('click', this._recalHandler);

      const line = this.createSVG('line', {
        x1: this.recalPoints[0].x, y1: this.recalPoints[0].y,
        x2: this.recalPoints[1].x, y2: this.recalPoints[1].y,
        class: 'calibrate-line',
        'stroke-width': Math.max(this.imgWidth, this.imgHeight) * 0.003,
      });
      this.drawLayer.appendChild(line);

      App.showModal('Real distance (meters)', '', (val) => {
        const meters = parseFloat(val);
        if (!meters || meters <= 0) {
          this.drawLayer.querySelectorAll('.calibrate-point, .calibrate-line').forEach(el => el.remove());
          return;
        }
        const dx = this.recalPoints[1].x - this.recalPoints[0].x;
        const dy = this.recalPoints[1].y - this.recalPoints[0].y;
        const pixelDist = Math.sqrt(dx * dx + dy * dy);
        this.scale.pixelsPerMeter = pixelDist / meters;

        const floor = Floors.getActiveFloor(App.state);
        floor.scale = this.scale;
        this.updateGrid();
        this.renderAll(floor);
        this.drawLayer.querySelectorAll('.calibrate-point, .calibrate-line').forEach(el => el.remove());
        App.showToast(`Scale recalibrated: ${Math.round(this.scale.pixelsPerMeter)} px/m`);
        App.setTool('select');
      }, '3.5');
    }
  },

  // Update image (for floor switch)
  updateImage(imageData, imgWidth, imgHeight, scale) {
    this.imageData = imageData;
    this.imgWidth = imgWidth;
    this.imgHeight = imgHeight;
    this.scale = scale;
    this.viewBox = { x: 0, y: 0, w: imgWidth, h: imgHeight };
    this.zoomLevel = 1;
    this.buildSVG();
    this.updateGrid();
    this.updateZoomDisplay();
  },
};

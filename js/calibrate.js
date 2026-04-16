// calibrate.js — Calibration de l'échelle (2 points + distance réelle)
// Features: place points, drag to reposition with zoom lens, right-click to delete
const Calibrate = {
  svg: null,
  imgWidth: 0,
  imgHeight: 0,
  imageData: null,
  points: [],      // [{x, y}] in image pixels
  pointEls: [],    // SVG circle elements
  lineEl: null,    // SVG line element
  interactLayer: null,
  lensLayer: null,

  // Zoom/pan state
  viewBox: { x: 0, y: 0, w: 0, h: 0 },
  isPanning: false,
  panStart: { x: 0, y: 0 },

  // Drag state
  dragIndex: -1,
  isDragging: false,

  // Lens config
  LENS_RADIUS: 80,   // pixels on screen
  LENS_ZOOM: 4,      // magnification factor

  init(imageData, imgWidth, imgHeight) {
    this.svg = document.getElementById('calibrate-svg');
    this.imageData = imageData;
    this.imgWidth = imgWidth;
    this.imgHeight = imgHeight;
    this.points = [];
    this.pointEls = [];
    this.lineEl = null;
    this.dragIndex = -1;
    this.isDragging = false;
    this.viewBox = { x: 0, y: 0, w: imgWidth, h: imgHeight };

    this.render();
    this.bindEvents();
  },

  render() {
    const svg = this.svg;
    svg.innerHTML = '';
    this.applyViewBox();
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Clip path for lens
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', 'lens-clip');
    const clipCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    clipCircle.setAttribute('r', '1'); // will be updated dynamically
    clipPath.appendChild(clipCircle);
    defs.appendChild(clipPath);
    svg.appendChild(defs);

    // Image de fond
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.imageData);
    img.setAttribute('width', this.imgWidth);
    img.setAttribute('height', this.imgHeight);
    svg.appendChild(img);

    // Couche interactive (line + points)
    this.interactLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(this.interactLayer);

    // Couche lens (zoom magnifier)
    this.lensLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.lensLayer.setAttribute('class', 'lens-layer');
    this.lensLayer.style.display = 'none';
    svg.appendChild(this.lensLayer);
  },

  applyViewBox() {
    const vb = this.viewBox;
    this.svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  },

  bindEvents() {
    // Remove old listeners by replacing the SVG event target area
    const container = this.svg.parentElement;

    // Click to place points
    this.svg.addEventListener('click', (e) => {
      if (this.isDragging || this.isPanning) return;
      this.onClick(e);
    });

    // Right-click to delete point
    this.svg.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.onRightClick(e);
    });

    // Mouse down for drag or pan
    this.svg.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        // Pan
        e.preventDefault();
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
        return;
      }
      if (e.button === 0) {
        this.onMouseDown(e);
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
        return;
      }
      if (this.isDragging) {
        this.onDragMove(e);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        container.style.cursor = '';
        return;
      }
      if (this.isDragging) {
        this.onDragEnd(e);
      }
    });

    // Zoom with wheel
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      const pt = this.svgPoint(e);
      this.zoom(factor, pt.x, pt.y);
    }, { passive: false });

    // Buttons
    document.getElementById('calibrate-validate').addEventListener('click', () => this.onValidate());
    document.getElementById('calibrate-skip').addEventListener('click', () => this.onSkip());
    document.getElementById('calibrate-distance').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.onValidate();
    });
  },

  zoom(factor, cx, cy) {
    const vb = this.viewBox;
    const newW = vb.w * factor;
    const newH = vb.h * factor;
    if (newW < this.imgWidth * 0.05 || newW > this.imgWidth * 5) return;
    vb.x = cx - (cx - vb.x) * factor;
    vb.y = cy - (cy - vb.y) * factor;
    vb.w = newW;
    vb.h = newH;
    this.applyViewBox();
    this.updateDrawing();
  },

  // === Point placement ===
  onClick(e) {
    if (this.points.length >= 2) return;
    const pt = this.svgPoint(e);
    this.points.push(pt);
    this.updateDrawing();
    this.updateUI();
  },

  // === Right-click delete ===
  onRightClick(e) {
    const pt = this.svgPoint(e);
    const hitIndex = this.hitTestPoint(pt);
    if (hitIndex >= 0) {
      this.points.splice(hitIndex, 1);
      this.updateDrawing();
      this.updateUI();
    }
  },

  // === Drag to reposition ===
  onMouseDown(e) {
    const pt = this.svgPoint(e);
    const hitIndex = this.hitTestPoint(pt);
    if (hitIndex >= 0) {
      e.preventDefault();
      e.stopPropagation();
      this.dragIndex = hitIndex;
      this.isDragging = true;
      this.svg.parentElement.style.cursor = 'grabbing';
      this.showLens(pt);
    }
  },

  onDragMove(e) {
    const pt = this.svgPoint(e);
    this.points[this.dragIndex] = pt;

    // Update circle position
    if (this.pointEls[this.dragIndex]) {
      this.pointEls[this.dragIndex].setAttribute('cx', pt.x);
      this.pointEls[this.dragIndex].setAttribute('cy', pt.y);
    }

    // Update line
    if (this.lineEl && this.points.length === 2) {
      this.lineEl.setAttribute('x1', this.points[0].x);
      this.lineEl.setAttribute('y1', this.points[0].y);
      this.lineEl.setAttribute('x2', this.points[1].x);
      this.lineEl.setAttribute('y2', this.points[1].y);
    }

    this.showLens(pt);
  },

  onDragEnd() {
    this.isDragging = false;
    this.dragIndex = -1;
    this.svg.parentElement.style.cursor = '';
    this.hideLens();
  },

  // === Lens (zoom magnifier) ===
  showLens(pt) {
    this.lensLayer.style.display = '';
    this.lensLayer.innerHTML = '';

    // Calculate lens radius in SVG units
    const rect = this.svg.getBoundingClientRect();
    const svgScale = this.viewBox.w / rect.width;
    const lensR = this.LENS_RADIUS * svgScale;

    // Clipped group
    const clipId = 'lens-clip-active';

    // Create defs with clip
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    clipCircle.setAttribute('cx', pt.x);
    clipCircle.setAttribute('cy', pt.y - lensR * 1.5);
    clipCircle.setAttribute('r', lensR);
    clipPath.appendChild(clipCircle);
    defs.appendChild(clipPath);
    this.lensLayer.appendChild(defs);

    // Lens background (dark circle)
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('cx', pt.x);
    bg.setAttribute('cy', pt.y - lensR * 1.5);
    bg.setAttribute('r', lensR);
    bg.setAttribute('fill', '#000');
    bg.setAttribute('stroke', '#6366f1');
    bg.setAttribute('stroke-width', lensR * 0.05);
    this.lensLayer.appendChild(bg);

    // Zoomed image inside clip
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('clip-path', `url(#${clipId})`);

    const lensCenter = { x: pt.x, y: pt.y - lensR * 1.5 };

    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.imageData);
    img.setAttribute('width', this.imgWidth * this.LENS_ZOOM);
    img.setAttribute('height', this.imgHeight * this.LENS_ZOOM);
    img.setAttribute('x', lensCenter.x - pt.x * this.LENS_ZOOM);
    img.setAttribute('y', lensCenter.y - pt.y * this.LENS_ZOOM);
    g.appendChild(img);

    // Crosshair in lens
    const chSize = lensR * 0.15;
    const chStroke = lensR * 0.02;
    const chColor = '#ef4444';
    const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    vLine.setAttribute('x1', lensCenter.x);
    vLine.setAttribute('y1', lensCenter.y - chSize);
    vLine.setAttribute('x2', lensCenter.x);
    vLine.setAttribute('y2', lensCenter.y + chSize);
    vLine.setAttribute('stroke', chColor);
    vLine.setAttribute('stroke-width', chStroke);
    g.appendChild(vLine);

    const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hLine.setAttribute('x1', lensCenter.x - chSize);
    hLine.setAttribute('y1', lensCenter.y);
    hLine.setAttribute('x2', lensCenter.x + chSize);
    hLine.setAttribute('y2', lensCenter.y);
    hLine.setAttribute('stroke', chColor);
    hLine.setAttribute('stroke-width', chStroke);
    g.appendChild(hLine);

    this.lensLayer.appendChild(g);

    // Lens border
    const border = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    border.setAttribute('cx', lensCenter.x);
    border.setAttribute('cy', lensCenter.y);
    border.setAttribute('r', lensR);
    border.setAttribute('fill', 'none');
    border.setAttribute('stroke', '#6366f1');
    border.setAttribute('stroke-width', lensR * 0.04);
    this.lensLayer.appendChild(border);
  },

  hideLens() {
    this.lensLayer.style.display = 'none';
    this.lensLayer.innerHTML = '';
  },

  // === Hit test ===
  hitTestPoint(pt) {
    const threshold = Math.max(this.imgWidth, this.imgHeight) * 0.015;
    for (let i = 0; i < this.points.length; i++) {
      const dx = pt.x - this.points[i].x;
      const dy = pt.y - this.points[i].y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) return i;
    }
    return -1;
  },

  // === Drawing ===
  updateDrawing() {
    this.interactLayer.innerHTML = '';
    this.pointEls = [];
    this.lineEl = null;

    const pointRadius = Math.max(this.imgWidth, this.imgHeight) * 0.005;
    const strokeW = Math.max(this.imgWidth, this.imgHeight) * 0.003;

    // Line between points
    if (this.points.length === 2) {
      this.lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      this.lineEl.setAttribute('x1', this.points[0].x);
      this.lineEl.setAttribute('y1', this.points[0].y);
      this.lineEl.setAttribute('x2', this.points[1].x);
      this.lineEl.setAttribute('y2', this.points[1].y);
      this.lineEl.setAttribute('class', 'calibrate-line');
      this.lineEl.setAttribute('stroke-width', strokeW);
      this.interactLayer.appendChild(this.lineEl);
    }

    // Points
    for (let i = 0; i < this.points.length; i++) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', this.points[i].x);
      circle.setAttribute('cy', this.points[i].y);
      circle.setAttribute('r', pointRadius);
      circle.setAttribute('class', 'calibrate-point');
      circle.style.cursor = 'grab';
      this.interactLayer.appendChild(circle);
      this.pointEls.push(circle);
    }
  },

  updateUI() {
    if (this.points.length === 2) {
      document.getElementById('calibrate-text').textContent = 'What is the real distance between these 2 points?';
      document.getElementById('calibrate-input').classList.remove('hidden');
      document.getElementById('calibrate-distance').focus();
    } else {
      document.getElementById('calibrate-text').textContent =
        this.points.length === 0
          ? 'Click two points with a known distance (e.g. a wall)'
          : 'Click a second point — right-click to delete';
      document.getElementById('calibrate-input').classList.add('hidden');
    }
  },

  // === Coordinate conversion ===
  svgPoint(e) {
    const ctm = this.svg.getScreenCTM().inverse();
    const clientPt = this.svg.createSVGPoint();
    clientPt.x = e.clientX;
    clientPt.y = e.clientY;
    return clientPt.matrixTransform(ctm);
  },

  // === Validation ===
  onValidate() {
    const meters = parseFloat(document.getElementById('calibrate-distance').value);
    if (!meters || meters <= 0) return;

    const dx = this.points[1].x - this.points[0].x;
    const dy = this.points[1].y - this.points[0].y;
    const pixelDist = Math.sqrt(dx * dx + dy * dy);
    const pixelsPerMeter = pixelDist / meters;

    const scale = {
      pixelsPerMeter,
      refLine: {
        x1: this.points[0].x,
        y1: this.points[0].y,
        x2: this.points[1].x,
        y2: this.points[1].y,
        meters,
      },
    };

    App.onCalibrated(scale);
  },

  onSkip() {
    const scale = { pixelsPerMeter: 100, refLine: null };
    App.onCalibrated(scale);
  },

  reset() {
    this.points = [];
    this.pointEls = [];
    this.lineEl = null;
    document.getElementById('calibrate-input').classList.add('hidden');
    document.getElementById('calibrate-text').textContent =
      'Click two points with a known distance (e.g. a wall)';
    document.getElementById('calibrate-distance').value = '';
    if (this.interactLayer) this.interactLayer.innerHTML = '';
  },
};

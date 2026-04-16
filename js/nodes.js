// nodes.js — Placement et édition des nodes ESPresense
const Nodes = {
  isPlacing: false,
  selectedNodeId: null,
  dragNode: null,

  startPlacing() {
    this.isPlacing = true;
  },

  stopPlacing() {
    this.isPlacing = false;
  },

  onCanvasClick(e) {
    if (!this.isPlacing) {
      this.onSelectClick(e);
      return;
    }

    const pt = Editor.screenToSVG(e);
    const [mx, my] = Editor.pxToMeters(pt.x, pt.y);

    const extraHTML = `
      <label>Height Z (meters)</label>
      <input type="number" id="node-z-input" step="0.1" min="0" value="1.5">
    `;

    App.showModal('Node name', '', (name, extraData) => {
      if (!name) return;
      const z = parseFloat(extraData['node-z-input']) || 1.5;
      const floor = Floors.getActiveFloor(App.state);
      const node = Floors.createNode(name, mx, my, z, [floor.id]);
      Floors.addNode(floor, node);
      Editor.renderAll(floor);
      App.updateSidebar();
      App.autoSave();
      App.setTool('select');
    }, 'Node 1', extraHTML);
  },

  onSelectClick(e) {
    const target = e.target;
    const nodeG = target.closest('[data-node-id]');
    if (nodeG) {
      const nodeId = nodeG.getAttribute('data-node-id');
      this.selectNode(nodeId);
    } else {
      this.deselectNode();
    }
  },

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    this.bindNodeDrag(nodeId);
    App.updateSidebar();
  },

  deselectNode() {
    this.selectedNodeId = null;
    App.updateSidebar();
  },

  bindNodeDrag(nodeId) {
    const nodeG = Editor.nodeLayer.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeG) return;

    const floor = Floors.getActiveFloor(App.state);
    const node = floor.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Remove old listeners by cloning
    const newG = nodeG.cloneNode(true);
    nodeG.parentNode.replaceChild(newG, nodeG);

    newG.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      Editor.container.style.cursor = 'grabbing';

      const onMove = (ev) => {
        const pt = Editor.screenToSVG(ev);
        const [mx, my] = Editor.pxToMeters(pt.x, pt.y);
        node.point[0] = mx;
        node.point[1] = my;
        newG.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
      };

      const onUp = () => {
        Editor.container.style.cursor = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        App.autoSave();
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  },

  deleteSelectedNode() {
    if (!this.selectedNodeId) return;
    const floor = Floors.getActiveFloor(App.state);
    Floors.removeNode(floor, this.selectedNodeId);
    this.deselectNode();
    Editor.renderAll(floor);
    App.updateSidebar();
    App.autoSave();
  },

  // Sidebar list
  renderList(floor) {
    const ul = document.getElementById('node-list');
    ul.innerHTML = '';
    for (const node of floor.nodes) {
      const li = document.createElement('li');
      li.className = node.id === this.selectedNodeId ? 'selected' : '';

      li.innerHTML = `
        <span class="item-color" style="background:#22c55e"></span>
        <span class="item-name">${node.name} <small style="color:var(--text-muted)">(z:${node.point[2]}m)</small></span>
        <button class="item-delete" title="Delete">&times;</button>
      `;

      li.addEventListener('click', (e) => {
        if (!e.target.classList.contains('item-delete')) {
          this.selectNode(node.id);
        }
      });

      li.querySelector('.item-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedNodeId = node.id;
        this.deleteSelectedNode();
      });

      ul.appendChild(li);
    }
  },
};

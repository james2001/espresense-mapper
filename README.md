# ESPresense Mapper

A visual floor plan editor that generates [ESPresense Companion](https://espresense.com/companion) configuration. Upload your floor plan, draw rooms, place BLE nodes, and export a ready-to-use `config.yaml`.

**[Try it live](https://james2001.github.io/espresense-mapper/)**

## Features

- **Upload** any floor plan image (PNG, JPG, WebP, SVG)
- **Calibrate** the scale by tracing a known distance with a zoom lens for precision
- **Draw rooms** as polygons directly on the plan
- **Place nodes** with name, position, and height (Z)
- **Multi-floor** support with per-floor images and calibration
- **Export YAML** configuration compatible with ESPresense Companion
- **Zoom & pan** with mouse wheel and Alt+click
- **Auto-save** to LocalStorage + project export/import as JSON
- **100% client-side** — your data never leaves your browser

## Quick Start

1. Open the app in your browser
2. Drop your floor plan image
3. **Calibrate**: trace a line along a wall with a known length, enter the distance in meters
4. **Draw rooms**: select the Room tool (R), click corners, double-click to close
5. **Place nodes**: select the Node tool (N), click to place, set name and height
6. **Export**: click "Export YAML", copy or download `config.yaml`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select tool |
| R | Room drawing tool |
| N | Node placement tool |
| C | Recalibrate |
| Esc | Cancel current drawing |
| Delete | Delete selected room/node |
| Alt+Click | Pan the canvas |
| Scroll | Zoom in/out |

## Development

No build step required. The app is pure HTML/CSS/JavaScript.

```bash
# Serve locally
python3 -m http.server 8765
# or
npx serve .

# Lint
npm install
npm run lint

# Test
npm test
```

## YAML Output Format

The generated configuration follows the [ESPresense Companion config format](https://espresense.com/companion/configuration):

```yaml
floors:
  - id: ground_floor
    name: Ground Floor
    bounds: [[0, 0, 0], [12, 9, 3]]
    rooms:
      - name: Living Room
        points:
          - [0.5, 0.5]
          - [5, 0.5]
          - [5, 4]
          - [0.5, 4]

nodes:
  - name: Node Living Room
    point: [2.5, 2, 1.5]
    floors: ["ground_floor"]
```

## License

[MIT](LICENSE)

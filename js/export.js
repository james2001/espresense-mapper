// export.js — Génération du YAML pour ESPresense Companion
const Export = {
  generate(state) {
    const config = {
      mqtt: {
        host: '# votre_broker_mqtt',
        port: 1883,
        // username: 'mqtt_user',
        // password: 'mqtt_pass',
      },
      gps: {
        latitude: 0,
        longitude: 0,
        elevation: 0,
      },
      map: {
        flip_y: false,
      },
      timeout: 30,
      away_timeout: 120,
    };

    // Floors
    config.floors = state.floors.map(floor => {
      const bounds = Floors.computeBounds(floor);
      const floorConfig = {
        id: floor.id,
        name: floor.name,
        bounds: bounds,
        rooms: floor.rooms.map(room => ({
          name: room.name,
          points: room.points.map(([x, y]) => [
            Math.round(x * 100) / 100,
            Math.round(y * 100) / 100,
          ]),
        })),
      };
      return floorConfig;
    });

    // Nodes
    config.nodes = [];
    for (const floor of state.floors) {
      for (const node of floor.nodes) {
        config.nodes.push({
          name: node.name,
          point: [
            Math.round(node.point[0] * 100) / 100,
            Math.round(node.point[1] * 100) / 100,
            Math.round(node.point[2] * 100) / 100,
          ],
          floors: node.floors,
        });
      }
    }

    // Devices
    config.devices = [{ name: '*' }];

    // Locators
    config.locators = {
      nadaraya_watson: {
        enabled: true,
        floors: state.floors.map(f => f.id),
      },
      nearest_node: {
        enabled: true,
      },
    };

    return jsyaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
    });
  },

  show(state) {
    const yaml = this.generate(state);
    document.getElementById('export-content').textContent = yaml;
    document.getElementById('export-panel').classList.remove('hidden');

    document.getElementById('export-copy').onclick = () => {
      navigator.clipboard.writeText(yaml).then(() => {
        App.showToast('YAML copied to clipboard');
      });
    };

    document.getElementById('export-download').onclick = () => {
      const blob = new Blob([yaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'config.yaml';
      a.click();
      URL.revokeObjectURL(url);
    };

    document.getElementById('export-close').onclick = () => {
      document.getElementById('export-panel').classList.add('hidden');
    };
  },
};

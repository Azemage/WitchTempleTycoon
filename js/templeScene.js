const TILE = 32;
const T = {
  FLOOR_STONE: 0, FLOOR_WOOD: 1, WALL: 2, CARPET: 3, DOOR: 4,
  CAULDRON: 5, TABLE: 6, COUNTER: 7, GRASS: 8, PATH: 9, TREE: 10, STALL: 11,
};

const STATION_BY_SECTEUR = {
  potions: T.CAULDRON,
  sorts: T.TABLE,
  baguettes: T.TABLE,
  talismans: T.TABLE,
  divination: T.COUNTER,
  rituels: T.CAULDRON,
};

function buildTempleLayout(rooms) {
  const roomW = 6;
  const roomH = 6;
  const corridor = 1;
  const gateCorridor = 3;
  const cols = rooms.length;
  const width = cols * roomW + (cols - 1) * corridor + 2 + gateCorridor;
  const height = roomH + 2;

  const grid = Array.from({ length: height }, () => Array(width).fill(T.FLOOR_STONE));

  for (let x = 0; x < width; x += 1) { grid[0][x] = T.WALL; grid[height - 1][x] = T.WALL; }
  for (let y = 0; y < height; y += 1) { grid[y][0] = T.WALL; grid[y][width - 1] = T.WALL; }

  const stations = [];
  let cursorX = 1;
  rooms.forEach((room, idx) => {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = cursorX; x < cursorX + roomW; x += 1) {
        const isBorder = y === 1 || ((x === cursorX || x === cursorX + roomW - 1) && y !== height - 2);
        grid[y][x] = isBorder ? T.WALL : T.FLOOR_WOOD;
      }
    }
    // bottom row of the room stays open floor, forming a hallway shared with the corridor
    const doorX = cursorX + Math.floor(roomW / 2);
    grid[height - 2][doorX] = T.DOOR;

    const stationTile = STATION_BY_SECTEUR[room.secteurId] ?? T.TABLE;
    const stationX = cursorX + Math.floor(roomW / 2);
    const stationY = 3;
    grid[stationY][stationX] = stationTile;
    stations.push({ tileX: stationX, tileY: stationY, nom: room.nom, roomId: room.id });

    cursorX += roomW + corridor;
    if (idx < rooms.length - 1) {
      for (let y = 1; y < height - 1; y += 1) grid[y][cursorX - 1] = T.CARPET;
    }
  });

  const gateY = Math.floor(height / 2);
  const gateX = width - 2;
  grid[gateY][gateX] = T.DOOR;

  return { grid, stations, gate: { tileX: gateX, tileY: gateY }, width, height };
}

function buildTownLayout() {
  const width = 16;
  const height = 10;
  const grid = Array.from({ length: height }, () => Array(width).fill(T.GRASS));

  for (let x = 0; x < width; x += 1) { grid[0][x] = T.WALL; grid[height - 1][x] = T.WALL; }
  for (let y = 0; y < height; y += 1) { grid[y][0] = T.WALL; grid[y][width - 1] = T.WALL; }

  const midY = Math.floor(height / 2);
  for (let y = 1; y < height - 1; y += 1) grid[y][Math.floor(width / 2)] = T.PATH;
  for (let x = 1; x < width - 1; x += 1) grid[midY][x] = T.PATH;

  const stallSpots = [
    { x: 4, y: 3, nom: 'Étal d\'ingrédients' },
    { x: 11, y: 3, nom: 'Étal de potions' },
    { x: 7, y: 7, nom: 'Étal de curiosités' },
  ];
  stallSpots.forEach((s) => { grid[s.y][s.x] = T.STALL; });

  [[2, 2], [13, 2], [2, 7], [13, 7]].forEach(([x, y]) => { grid[y][x] = T.TREE; });

  const gateY = midY;
  grid[gateY][0] = T.DOOR;

  return {
    grid,
    width,
    height,
    stalls: stallSpots.map((s) => ({ tileX: s.x, tileY: s.y, nom: s.nom })),
    gate: { tileX: 0, tileY: gateY },
  };
}

export function initTemple(state, callbacks) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'temple-canvas',
    width: 480,
    height: 256,
    pixelArt: true,
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: new TempleScene(state, callbacks),
  });
}

export class TempleScene extends Phaser.Scene {
  constructor(state, callbacks) {
    super('TempleScene');
    this.gameState = state;
    this.callbacks = callbacks;
  }

  preload() {
    this.load.spritesheet('tiles', 'assets/tiles/tileset.png', { frameWidth: TILE, frameHeight: TILE });
    this.load.spritesheet('player', 'assets/sprites/player.png', { frameWidth: TILE, frameHeight: TILE });
  }

  create() {
    const mode = this.gameState._templeMode || 'temple';
    this.mode = mode;

    let grid;
    let width;
    let height;
    let spawn;

    if (mode === 'town') {
      const { grid: g, width: w, height: h, stalls, gate } = buildTownLayout();
      grid = g; width = w; height = h;
      this.zones = [
        ...stalls.map((s) => ({ ...s, onEnter: () => this.callbacks.onMarket() })),
        { ...gate, nom: 'Retour au temple', onEnter: () => this.switchTo('temple') },
      ];
      spawn = { x: TILE * 1.5, y: gate.tileY * TILE + TILE / 2 };
    } else {
      const rooms = this.gameState.rooms.map((room) => {
        const type = this.gameState.data.salles.types_salles.find((t) => t.id === room.typeId);
        return { id: room.id, nom: type?.nom || room.typeId, secteurId: type?.secteur_associe_id };
      });
      const { grid: g, stations, gate, width: w, height: h } = buildTempleLayout(rooms);
      grid = g; width = w; height = h;
      this.zones = [
        ...stations.map((s) => ({ ...s, onEnter: () => this.callbacks.onInteract(s.roomId) })),
        { ...gate, nom: 'Aller en ville', onEnter: () => this.switchTo('town') },
      ];
      spawn = { x: TILE * 2, y: (height - 2) * TILE };
    }

    const map = this.make.tilemap({ data: grid, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    const layer = map.createLayer(0, tileset, 0, 0);
    layer.setCollision([T.WALL, T.CAULDRON, T.TABLE, T.COUNTER, T.STALL, T.TREE]);

    this.physics.world.bounds.width = width * TILE;
    this.physics.world.bounds.height = height * TILE;
    this.cameras.main.setBounds(0, 0, width * TILE, height * TILE);

    this.player = this.physics.add.sprite(spawn.x, spawn.y, 'player', 0);
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(20, 16).setOffset(6, 14);
    this.physics.add.collider(this.player, layer);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E');

    const dirs = { down: 0, left: 3, right: 6, up: 9 };
    Object.entries(dirs).forEach(([name, base]) => {
      this.anims.create({
        key: `walk-${name}`,
        frames: [base, base + 1, base, base + 2].map((f) => ({ key: 'player', frame: f })),
        frameRate: 6,
        repeat: -1,
      });
    });
    this.lastFacing = 'down';

    this.promptText = this.add.text(0, 0, '', {
      fontSize: '12px', color: '#fff', backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
    }).setDepth(10).setVisible(false);

    this.activeZone = null;
    this.input.keyboard.on('keydown-E', () => {
      if (this.activeZone) this.activeZone.onEnter();
    });
  }

  switchTo(mode) {
    this.gameState._templeMode = mode;
    this.scene.restart();
  }

  update() {
    const speed = 130;
    const body = this.player.body;
    body.setVelocity(0);
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    if (left) { body.setVelocityX(-speed); this.lastFacing = 'left'; }
    else if (right) { body.setVelocityX(speed); this.lastFacing = 'right'; }
    if (up) { body.setVelocityY(-speed); this.lastFacing = 'up'; }
    else if (down) { body.setVelocityY(speed); this.lastFacing = 'down'; }
    body.velocity.normalize().scale(speed);

    const moving = left || right || up || down;
    if (moving) {
      this.player.anims.play(`walk-${this.lastFacing}`, true);
    } else {
      this.player.anims.stop();
      this.player.setFrame({ down: 0, left: 3, right: 6, up: 9 }[this.lastFacing]);
    }

    const px = Math.floor(this.player.x / TILE);
    const py = Math.floor(this.player.y / TILE);
    const nearest = this.zones.find((z) => Math.abs(z.tileX - px) <= 1 && Math.abs(z.tileY - py) <= 1) || null;
    this.activeZone = nearest;

    if (nearest) {
      this.promptText.setText(`[E] ${nearest.nom}`);
      this.promptText.setPosition(this.player.x - 30, this.player.y - 34);
      this.promptText.setVisible(true);
    } else {
      this.promptText.setVisible(false);
    }
  }
}

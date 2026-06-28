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

function buildLayout(rooms) {
  const roomW = 6;
  const roomH = 6;
  const corridor = 1;
  const cols = rooms.length;
  const width = cols * roomW + (cols - 1) * corridor + 2 + 4; // +4 for market area on the right
  const height = roomH + 2;

  const grid = Array.from({ length: height }, () => Array(width).fill(T.FLOOR_STONE));

  // outer border walls
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
    // bottom row of the room stays open floor, forming a hallway shared with the corridor/market
    const doorX = cursorX + Math.floor(roomW / 2);
    grid[height - 2][doorX] = T.DOOR;

    const stationTile = STATION_BY_SECTEUR[room.secteurId] ?? T.TABLE;
    const stationX = cursorX + Math.floor(roomW / 2);
    const stationY = 3;
    grid[stationY][stationX] = stationTile;
    stations.push({ roomId: room.id, nom: room.nom, tileX: stationX, tileY: stationY });

    cursorX += roomW + corridor;
    if (idx < rooms.length - 1) {
      for (let y = 1; y < height - 1; y += 1) grid[y][cursorX - 1] = T.CARPET;
    }
  });

  // market area (right side, outside)
  const marketX0 = cursorX;
  for (let y = 0; y < height; y += 1) {
    for (let x = marketX0; x < width; x += 1) grid[y][x] = T.GRASS;
  }
  const marketStallX = marketX0 + 2;
  const marketStallY = Math.floor(height / 2);
  grid[marketStallY][marketStallX] = T.STALL;
  grid[1][marketX0] = T.PATH;
  for (let y = 1; y < height - 1; y += 1) grid[y][marketX0] = T.PATH;

  return { grid, stations, market: { tileX: marketStallX, tileY: marketStallY }, width, height };
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
    const rooms = this.gameState.rooms.map((room) => {
      const type = this.gameState.data.salles.types_salles.find((t) => t.id === room.typeId);
      return { id: room.id, nom: type?.nom || room.typeId, secteurId: type?.secteur_associe_id };
    });
    const { grid, stations, market, width, height } = buildLayout(rooms);
    this.stations = stations;
    this.market = market;

    const map = this.make.tilemap({ data: grid, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    const layer = map.createLayer(0, tileset, 0, 0);
    layer.setCollision([T.WALL, T.CAULDRON, T.TABLE, T.COUNTER, T.STALL, T.TREE]);

    this.physics.world.bounds.width = width * TILE;
    this.physics.world.bounds.height = height * TILE;
    this.cameras.main.setBounds(0, 0, width * TILE, height * TILE);

    this.player = this.physics.add.sprite(TILE * 2, (height - 2) * TILE, 'player', 0);
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(20, 16).setOffset(6, 14);
    this.physics.add.collider(this.player, layer);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E');

    this.promptText = this.add.text(0, 0, '', {
      fontSize: '12px', color: '#fff', backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
    }).setDepth(10).setVisible(false);

    this.activeZone = null;
    this.input.keyboard.on('keydown-E', () => {
      if (this.activeZone === 'market') this.callbacks.onMarket();
      else if (this.activeZone) this.callbacks.onInteract(this.activeZone);
    });
  }

  update() {
    const speed = 130;
    const body = this.player.body;
    body.setVelocity(0);
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    if (left) { body.setVelocityX(-speed); this.player.setFrame(3); }
    else if (right) { body.setVelocityX(speed); this.player.setFrame(6); }
    if (up) { body.setVelocityY(-speed); this.player.setFrame(9); }
    else if (down) { body.setVelocityY(speed); this.player.setFrame(0); }
    body.velocity.normalize().scale(speed);

    const px = Math.floor(this.player.x / TILE);
    const py = Math.floor(this.player.y / TILE);
    let nearest = null;
    this.stations.forEach((s) => {
      if (Math.abs(s.tileX - px) <= 1 && Math.abs(s.tileY - py) <= 1) nearest = s;
    });
    if (!nearest && Math.abs(this.market.tileX - px) <= 1 && Math.abs(this.market.tileY - py) <= 1) {
      nearest = { roomId: 'market', nom: 'Marché' };
      this.activeZone = 'market';
    } else {
      this.activeZone = nearest ? nearest.roomId : null;
    }

    if (nearest) {
      this.promptText.setText(`[E] ${nearest.nom}`);
      this.promptText.setPosition(this.player.x - 30, this.player.y - 34);
      this.promptText.setVisible(true);
    } else {
      this.promptText.setVisible(false);
    }
  }
}

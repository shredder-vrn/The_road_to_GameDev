// Константы состояний игры
const GAME_STATE = {
  RUNNING: 0,
  FINISHED: 1
};

// Добавленная задача для игрока
const TASK = {
  CURRENT_TASK: "позвони в отдел кадров"
};

// Глобальные константы
const DEPTH_LAYERS = {
  BACKGROUND: 0,
  WALLS: 1,
  OBJECTS_BASE: 10,
  PLAYER_BASE: 50,
  HINT: 9998,
  WIN_SCREEN: 9999
};
let player;
let cursors;
let interactionManager;
let gameState = GAME_STATE.RUNNING;
const gameEvents = new Phaser.Events.EventEmitter();
const GAME_WORLD_SIZE = 2000;
const PLAYER_SPEED = 10;
const PLAYER_BODY_WIDTH = 125;
const PLAYER_BODY_HEIGHT = 70;
const PLAYER_ORIGIN_Y = 0.85;

class InteractionManager {
  constructor(scene) {
    this.scene = scene;
    this.interactiveObjects = [];
    this.currentFocus = null;
    this.hint = null;
    this.setupInput();
  }

  setupInput() {
    this.interactKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.scene.input.on('pointerdown', (pointer) => {
      if (this.currentFocus && gameState === GAME_STATE.RUNNING) {
        gameEvents.emit('objectInteracted', this.currentFocus);
      }
    });
  }

  addInteractiveObject(obj) {
    if (!obj) {
      console.error('Попытка добавить неопределённый объект');
      return;
    }
    this.interactiveObjects.push(obj);
    obj.setInteractive();
    console.log(`Добавлен интерактивный объект: ${obj.texture.key}`);
  }

  update() {
    if (gameState !== GAME_STATE.RUNNING) return;
    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && this.currentFocus) {
      gameEvents.emit('objectInteracted', this.currentFocus);
    }
    this.updateFocus();
  }

  updateFocus() {
    if (!player || this.interactiveObjects.length === 0) return;
    // Закомментированные строки, подсвечивающие коллайдеры
    // this.interactiveObjects.forEach(obj => obj.clearTint());
    let closest = null;
    let minDist = Infinity;
    this.interactiveObjects.forEach(obj => {
      if (!obj.body) {
        console.warn('Объект без физического тела:', obj);
        return;
      }
      const dist = Phaser.Math.Distance.Between(
        player.x, player.y,
        obj.x, obj.y
      );
      if (dist < 200 && dist < minDist) {
        minDist = dist;
        closest = obj;
      }
    });
    this.currentFocus = closest;
    if (this.currentFocus) {
      // this.currentFocus.setTint(0x00ff00);
      this.showHint();
    } else {
      this.hideHint();
    }
  }

  showHint() {
    if (!this.hint) {
      const camera = this.scene.cameras.main;
      this.hint = this.scene.add.text(
        camera.centerX, 
        camera.height - 50, 
        'Нажмите X для взаимодействия',
        { 
          fontSize: '32px', 
          fill: '#ffffff', 
          backgroundColor: '#000000',
          padding: { x: 20, y: 10 }
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_LAYERS.HINT);
    }
    this.hint.setVisible(true);
  }

  hideHint() {
    if (this.hint) this.hint.setVisible(false);
  }

  destroy() {
    if (this.hint) {
      this.hint.destroy();
      this.hint = null;
    }
  }
}

class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  preload() {
    this.load.image('menu_bg', 'assets/sprites/menu_bg.png');
  }

  create() {
    this.add.image(0, 0, 'menu_bg').setOrigin(0).setDisplaySize(1400, 900);
    const playButton = this.add.text(700, 400, 'Играть', { fontSize: '32px', fill: '#fff' })
      .setOrigin(0.5)
      .setInteractive();
    const aboutButton = this.add.text(700, 500, 'Об авторе', { fontSize: '32px', fill: '#fff' })
      .setOrigin(0.5)
      .setInteractive();
    const exitButton = this.add.text(700, 600, 'Выход', { fontSize: '32px', fill: '#fff' })
      .setOrigin(0.5)
      .setInteractive();

    playButton.on('pointerdown', () => this.scene.start('GameScene'));
    aboutButton.on('pointerdown', () => alert('Игру создал Shredder_vrn'));
    exitButton.on('pointerdown', () => window.close());
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.sounds = {
      footstep: null,
      interact: null,
      objects: {}
    };
    this.lastStepTime = 0;
    this.winScreen = null;
  }

  preload() {
    this.load.atlas('walk', 'assets/sprites/walk_sheet.png', 'assets/sprites/walk_atlas.json');
    this.load.image('room', 'assets/sprites/room.jpg');
    this.load.image('bed', 'assets/sprites/bed.png');
    this.load.image('tv', 'assets/sprites/tv.png');
    this.load.image('phone', 'assets/sprites/phone.png');

    // Загрузка звуков
    this.load.audio('footstep', 'assets/sounds/footstep.wav');
    this.load.audio('interact', 'assets/sounds/interact.wav');
    this.load.audio('phone_sound', 'assets/sounds/phone.wav');
    this.load.audio('tv_sound', 'assets/sounds/tv.wav');
    this.load.audio('bed_sound', 'assets/sounds/bed.wav');
  }

  create() {
    gameState = GAME_STATE.RUNNING;

    // Инициализация звуков с настройками
    this.sounds.footstep = this.sound.add('footstep', { volume: 0.3 });
    this.sounds.interact = this.sound.add('interact', { volume: 0.5 });
    this.sounds.objects = {
      'bed': this.sound.add('bed_sound', { volume: 0.4 }),
      'tv': this.sound.add('tv_sound', { volume: 0.4 }),
      'phone': this.sound.add('phone_sound', { volume: 0.5 })
    };

    createBackground(this);
    setupDebug(this);
    createWalls(this);
    createPlayer(this);

    interactionManager = new InteractionManager(this);

    createFurniture(this);
    setupInput(this);
    setupCamera(this);
    createAnimations(this);
    this.setupGameEvents();

    // Отображение текущей задачи
    this.taskText = this.add.text(20, 20, `Задача: ${TASK.CURRENT_TASK}`, {
      fontSize: '24px',
      fill: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setScrollFactor(0).setDepth(DEPTH_LAYERS.HINT);
  }

  setupGameEvents() {
    gameEvents.on('objectInteracted', (obj) => {
      if (!obj || !obj.getData || gameState !== GAME_STATE.RUNNING) {
        console.error('Некорректный объект взаимодействия или игра завершена');
        return;
      }
      const type = obj.getData('type');
      console.log(`Взаимодействие с объектом типа: ${type}`);

      // Воспроизводим общий звук взаимодействия
      if (this.sounds.interact) {
        this.sounds.interact.play();
      }

      // Воспроизводим специфичный звук для объекта
      if (this.sounds.objects[type]) {
        this.sounds.objects[type].play();
      }

      switch (type) {
        case 'bed':
          console.log('Спать на кровати');
          break;
        case 'tv':
          console.log('Смотреть телевизор');
          break;
        case 'phone':
          console.log('Использовать телефон');
          this.showWinScreen();
          break;
      }
    });
  }

  update(time) {
    if (!player || gameState !== GAME_STATE.RUNNING) return;

    this.handlePlayerMovement(time);
    handlePlayerAnimation();
    updateDepths();

    if (interactionManager) {
      interactionManager.update();
    }
  }

  handlePlayerMovement(time) {
    player.setVelocity(0);
    let isMoving = false;

    if (cursors.left.isDown) {
      player.setVelocityX(-PLAYER_SPEED);
      player.flipX = true;
      isMoving = true;
    } else if (cursors.right.isDown) {
      player.setVelocityX(PLAYER_SPEED);
      player.flipX = false;
      isMoving = true;
    }

    if (cursors.up.isDown) {
      player.setVelocityY(-PLAYER_SPEED);
      isMoving = true;
    } else if (cursors.down.isDown) {
      player.setVelocityY(PLAYER_SPEED);
      isMoving = true;
    }

    // Воспроизведение звуков шагов
    if (isMoving && this.sounds.footstep && time > this.lastStepTime + 200) {
      this.sounds.footstep.play();
      this.lastStepTime = time;
    }
  }

  showWinScreen() {
    gameState = GAME_STATE.FINISHED;

    // Скрываем подсказку взаимодействия
    if (interactionManager) {
      interactionManager.hideHint();
    }

    // Создаем затемнение с анимацией
    const overlay = this.add.graphics()
      .fillStyle(0x000000, 0.7)
      .fillRect(0, 0, this.cameras.main.width, this.cameras.main.height)
      .setScrollFactor(0)
      .setDepth(DEPTH_LAYERS.WIN_SCREEN);

    // Создаем элементы финального экрана
    const winText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 100,
      'ПОБЕДА!',
      { 
        fontSize: '72px', 
        fill: '#ff0',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 5
      }
    )
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(DEPTH_LAYERS.WIN_SCREEN);

    const menuButton = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 50,
      'В меню',
      { 
        fontSize: '32px', 
        fill: '#fff',
        backgroundColor: '#333',
        padding: { x: 20, y: 10 }
      }
    )
    .setOrigin(0.5)
    .setInteractive()
    .setScrollFactor(0)
    .setDepth(DEPTH_LAYERS.WIN_SCREEN);

    // Добавляем обработчик клика по кнопке
    menuButton.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });

    // Сохраняем ссылки для возможного удаления
    this.winScreen = { overlay, winText, menuButton };
  }

  destroy() {
    if (interactionManager) {
      interactionManager.destroy();
      interactionManager = null;
    }

    gameEvents.removeAllListeners();
  }
}

const config = {
  type: Phaser.Canvas,
  width: 1400,
  height: 900,
  backgroundColor: '#ffffff',
  parent: 'game',
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 0 },
      debug: true
    }
  },
  scene: [MenuScene, GameScene]
};

const game = new Phaser.Game(config);

// === Вспомогательные функции ===

function createWalls(scene) {
  const walls = [
    [1000, 0, 2000, 1320, 0xffff00],
    [1000, 2000, 2000, 300, 0x0000ff],
    [0, 1000, 140, 2000, 0xff0000],
    [0, 1500, 380, 1000, 0xff0000],
    [0, 0, 1500, 1750, 0xffff00],
    [0, 1300, 900, 600, 0xffff00],
    [700, 1320, 150, 530, 0xffff00],
    [760, 0, 30, 3160, 0xffff00],
    [2050, 1000, 400, 2000, 0x00ff00],
    [1850, 610, 400, 500, 0x00ff00]
  ];
  walls.forEach(wall => {
    createWall(scene, ...wall);
  });

  const tiltedWalls = [
    [1550, 680, 400, 30, 55, 0xffffff],
    [880, 680, 400, 30, -55, 0xffffff]
  ];

  tiltedWalls.forEach(wall => {
    createTiltedWall(scene, ...wall);
  });
}

function createFurniture(scene) {
  const furniture = [
    ['bed', 1220, 1380, 650, 450, 540, 180, 0.545, 0.65, 'bed'],
    ['tv', 1220, 1000, 650, 500, 420, 100, 0.55, 0.6, 'tv'],
    ['phone', 1550, 1420, 190, 390, 125, 100, 0.37, 0.725, 'phone']
  ];

  furniture.forEach(item => {
    const [key, x, y, dispW, dispH, bodyW, bodyH, origX, origY, type] = item;
    const obj = scene.add.sprite(x, y, key)
      .setDisplaySize(dispW, dispH)
      .setDepth(y);

    scene.matter.add.gameObject(obj, {
      shape: { type: 'rectangle', width: bodyW, height: bodyH },
      isStatic: true
    });

    obj.setOrigin(origX, origY);
    obj.setData('type', type);

    if (interactionManager) {
      interactionManager.addInteractiveObject(obj);
    }
  });
}

function createWall(scene, x, y, width, height, color) {
  const wall = scene.add.rectangle(x, y, width, height, color);
  wall.setAlpha(0);
  scene.matter.add.gameObject(wall, { isStatic: true });
  return wall;
}

function createTiltedWall(scene, x, y, width, height, angleDeg, color) {
  const wall = scene.add.rectangle(x, y, width, height, color);
  wall.setAlpha(0);
  const radians = Phaser.Math.DegToRad(angleDeg);
  const body = Phaser.Physics.Matter.Matter.Bodies.rectangle(
    x, y, width, height, { isStatic: true, angle: radians }
  );
  scene.matter.add.gameObject(wall).setExistingBody(body).setPosition(x, y);
  return wall;
}

function createPlayer(scene) {
  const body = Phaser.Physics.Matter.Matter.Bodies.rectangle(
    1200, 1700, PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT
  );

  player = scene.matter.add.sprite(500, 500, 'walk', 0);
  player.setExistingBody(body);
  player.setOrigin(0.5, PLAYER_ORIGIN_Y);
  player.setFixedRotation();
  player.setDepth(DEPTH_LAYERS.PLAYER_BASE);
}

function createBackground(scene) {
  const bg = scene.add.image(0, 0, 'room')
    .setOrigin(0, 0)
    .setDisplaySize(GAME_WORLD_SIZE, GAME_WORLD_SIZE)
    .setDepth(DEPTH_LAYERS.BACKGROUND);
  return bg;
}

function setupDebug(scene) {
  scene.matter.world.drawDebug = false;
  scene.matter.world.debugGraphic.setVisible(false);
}

function setupInput(scene) {
  cursors = scene.input.keyboard.createCursorKeys();
}

function setupCamera(scene) {
  const camera = scene.cameras.main;
  camera.startFollow(player);
  camera.setBounds(0, 0, GAME_WORLD_SIZE, GAME_WORLD_SIZE);
  camera.setFollowOffset(0, 0);
  camera.setLerp(0.1, 0.1);
}

function createAnimations(scene) {
  scene.anims.create({
    key: 'run',
    frames: scene.anims.generateFrameNumbers('walk', { start: 1, end: 3 }),
    frameRate: 10,
    repeat: -1
  });

  scene.anims.create({
    key: 'idle',
    frames: [{ key: 'walk', frame: 0 }],
    repeat: 0
  });
}

function handlePlayerAnimation() {
  const isMoving = cursors.left.isDown || cursors.right.isDown || cursors.up.isDown || cursors.down.isDown;
  const animationKey = isMoving ? 'run' : 'idle';

  if (player.anims.currentAnimKey !== animationKey) {
    player.anims.play(animationKey, true);
  }
}

function updateDepths() {
  if (player) {
    player.setDepth(player.y);
  }
}

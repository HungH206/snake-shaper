import * as Phaser from 'phaser';
import { Scene, GameObjects } from 'phaser';
import {
  GRID_SIZE,
  MAX_REWINDS,
  REWIND_POP,
  buildTargetSet,
  type Coord,
  type Difficulty,
  type LevelConfig,
} from '../shared/puzzles';
import { PALETTE, CSS, FONT } from '../shared/theme';
import type { LeaderboardResponse, LeaderboardSubmitRequest } from '../shared/api';

// ---------------------------------------------------------------------------
// Pure game engine (moved out of SnakeGameScene so every screen can share it).
// ---------------------------------------------------------------------------

type GameStatus = 'PLAYING' | 'CRASHED' | 'WON' | 'GAMEOVER';
type CellStatus = 'EMPTY' | 'TARGET' | 'OCCUPIED';
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface SnakeShaperState {
  gridState: CellStatus[][];
  snakeBody: Coord[];
  targetSilhouette: Coord[];
  rewindsLeft: number;
  gameStatus: GameStatus;
  finalNode: Coord;
}

type Action =
  | { type: 'MOVE'; dir: Direction }
  | { type: 'APPLY_REWIND' }
  | { type: 'RESET'; level: LevelConfig };

const DIR_DELTA: Record<Direction, Coord> = {
  UP: [-1, 0],
  DOWN: [1, 0],
  LEFT: [0, -1],
  RIGHT: [0, 1],
};

function initState(level: LevelConfig): SnakeShaperState {
  const grid: CellStatus[][] = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill('EMPTY' as CellStatus));
  level.targets.forEach(([r, c]) => {
    const row = grid[r];
    if (row) row[c] = 'TARGET';
  });
  const startRow = grid[level.start[0]];
  if (startRow) startRow[level.start[1]] = 'OCCUPIED';

  return {
    gridState: grid,
    snakeBody: [level.start],
    targetSilhouette: level.targets,
    rewindsLeft: MAX_REWINDS,
    gameStatus: 'PLAYING',
    finalNode: level.finalNode,
  };
}

function checkWin(grid: CellStatus[][], head: Coord, targets: Coord[], fin: Coord): boolean {
  if (head[0] !== fin[0] || head[1] !== fin[1]) return false;
  return targets.every(([r, c]) => grid[r]?.[c] === 'OCCUPIED');
}

function reducer(state: SnakeShaperState, action: Action): SnakeShaperState {
  switch (action.type) {
    case 'RESET':
      return initState(action.level);

    case 'APPLY_REWIND': {
      if (state.gameStatus !== 'CRASHED' || state.rewindsLeft <= 0) return state;
      const popCount = Math.min(REWIND_POP, state.snakeBody.length - 1);
      if (popCount === 0) return state;
      const toRestore = state.snakeBody.slice(-popCount);
      const newBody = state.snakeBody.slice(0, -popCount);
      const tSet = buildTargetSet(state.targetSilhouette);
      const newGrid = state.gridState.map((row) => [...row]);
      toRestore.forEach(([r, c]) => {
        const row = newGrid[r];
        if (row) row[c] = tSet.has(`${r},${c}`) ? 'TARGET' : 'EMPTY';
      });
      return {
        ...state,
        gridState: newGrid,
        snakeBody: newBody,
        rewindsLeft: state.rewindsLeft - 1,
        gameStatus: 'PLAYING',
      };
    }

    case 'MOVE': {
      if (state.gameStatus !== 'PLAYING') return state;
      const head = state.snakeBody[state.snakeBody.length - 1];
      if (!head) return state;
      const prev = state.snakeBody.length > 1 ? state.snakeBody[state.snakeBody.length - 2] : null;
      const [hr, hc] = head;
      const [dr, dc] = DIR_DELTA[action.dir];
      const nr = hr + dr;
      const nc = hc + dc;

      if (prev && nr === prev[0] && nc === prev[1]) {
        const tSet = buildTargetSet(state.targetSilhouette);
        const newGrid = state.gridState.map((row) => [...row]);
        const row = newGrid[hr];
        if (row) row[hc] = tSet.has(`${hr},${hc}`) ? 'TARGET' : 'EMPTY';
        return { ...state, gridState: newGrid, snakeBody: state.snakeBody.slice(0, -1) };
      }

      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) {
        return { ...state, gameStatus: state.rewindsLeft > 0 ? 'CRASHED' : 'GAMEOVER' };
      }

      if (state.gridState[nr]?.[nc] === 'OCCUPIED') {
        return { ...state, gameStatus: state.rewindsLeft > 0 ? 'CRASHED' : 'GAMEOVER' };
      }

      const newGrid = state.gridState.map((row) => [...row]);
      const targetRow = newGrid[nr];
      if (targetRow) targetRow[nc] = 'OCCUPIED';
      const newBody: Coord[] = [...state.snakeBody, [nr, nc]];
      const won = checkWin(newGrid, [nr, nc], state.targetSilhouette, state.finalNode);
      return {
        ...state,
        gridState: newGrid,
        snakeBody: newBody,
        gameStatus: won ? 'WON' : 'PLAYING',
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Layout — compact so header + board + controls fit the 1024x768 design frame.
// ---------------------------------------------------------------------------

const CELL = 26;
const GAP = 3;
const STEP = CELL + GAP;
const BOARD = GRID_SIZE * CELL + (GRID_SIZE - 1) * GAP;
const CENTER_X = 512;

interface OverlayButton {
  bg: GameObjects.Rectangle;
  text: GameObjects.Text;
  width: number;
}

export interface PlayFieldOptions {
  level: LevelConfig;
  /** Y at which the play region begins (leaves room above for a scene header). */
  top: number;
  /** Called when the player wins and taps Continue. */
  onComplete?: () => void;
  /** Called when the player taps the ← Hub back control. */
  onExit?: () => void;
  /** When true, wins submit a score and the win overlay shows a Leaderboard button. */
  leaderboard?: boolean;
}

/**
 * Embeddable play surface: board, on-screen D-pad, Rewind/Reset, progress bar,
 * difficulty pill and rewind indicator. Owns its own game state via `reducer`.
 * Scenes render their own header above it and hand it a `top` offset.
 */
export class PlayField {
  private scene: Scene;
  private level: LevelConfig;
  private state: SnakeShaperState;
  private onComplete: (() => void) | undefined;
  private onExit: (() => void) | undefined;

  private readonly boardX: number;
  private readonly boardY: number;

  private root: GameObjects.Container;
  private boardGroup!: GameObjects.Container;
  private pathGraphics!: GameObjects.Graphics;
  private cells: GameObjects.Rectangle[] = [];

  private statusText!: GameObjects.Text;
  private progressFill!: GameObjects.Rectangle;
  private progressLabel!: GameObjects.Text;
  private diffPillBg!: GameObjects.Rectangle;
  private diffPillText!: GameObjects.Text;
  private rewindIcons: GameObjects.Text[] = [];

  private overlay!: GameObjects.Rectangle;
  private overlayText!: GameObjects.Text;
  private btnPrimary!: OverlayButton;
  private btnClose!: OverlayButton;
  private btnLeaderboard!: OverlayButton;
  private overlayDismissed = false;
  private moveCount = 0;

  private readonly leaderboardEnabled: boolean;
  private lbPanel!: GameObjects.Container;
  private lbTitle!: GameObjects.Text;
  private lbStatus!: GameObjects.Text;
  private lbRows: GameObjects.Text[] = [];
  private lbYou!: GameObjects.Text;

  private keyHandler: (event: KeyboardEvent) => void;
  private pointerUpHandler: () => void;

  constructor(scene: Scene, opts: PlayFieldOptions) {
    this.scene = scene;
    this.level = opts.level;
    this.onComplete = opts.onComplete;
    this.onExit = opts.onExit;
    this.leaderboardEnabled = opts.leaderboard ?? false;
    this.state = initState(this.level);

    this.boardX = Math.round(CENTER_X - BOARD / 2);
    this.boardY = opts.top + 30;

    this.root = scene.add.container(0, 0);

    this.buildTopBar(opts.top);
    this.buildBoard();
    this.buildProgress();
    this.buildDpad();
    this.buildActionButtons();
    this.buildOverlay();
    this.buildLeaderboardPanel();

    this.keyHandler = (event: KeyboardEvent) => this.onKey(event);
    scene.input.keyboard?.on('keydown', this.keyHandler);
    this.pointerUpHandler = () => {};
    scene.input.on('pointerup', this.pointerUpHandler);

    this.updateUI();
  }

  /** Swap to a different level in place (used by the tutorial level tabs). */
  loadLevel(level: LevelConfig) {
    this.level = level;
    this.dispatch({ type: 'RESET', level });
  }

  destroy() {
    this.scene.input.keyboard?.off('keydown', this.keyHandler);
    this.scene.input.off('pointerup', this.pointerUpHandler);
    this.root.destroy(true);
  }

  // --- construction ---------------------------------------------------------

  private buildTopBar(top: number) {
    const y = top + 8;

    const back = this.scene.add.text(this.boardX, y, '← Hub', {
      fontFamily: FONT.mono,
      fontSize: '15px',
      color: CSS.mutedForeground,
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.onExit?.());
    this.root.add(back);

    // Rewind indicator — one glyph per rewind, dimmed as they're spent.
    const rightEdge = this.boardX + BOARD;
    for (let i = 0; i < MAX_REWINDS; i += 1) {
      const icon = this.scene.add.text(rightEdge - i * 22, y, '⏪', {
        fontFamily: FONT.mono,
        fontSize: '16px',
        color: CSS.destructive,
      }).setOrigin(1, 0.5);
      this.rewindIcons.push(icon);
      this.root.add(icon);
    }

    // Difficulty pill, to the left of the rewind icons.
    const pillX = rightEdge - MAX_REWINDS * 22 - 12;
    this.diffPillBg = this.scene.add.rectangle(pillX, y, 78, 24, PALETTE.card, 0.95)
      .setOrigin(1, 0.5);
    this.diffPillText = this.scene.add.text(pillX - 39, y, this.level.difficulty, {
      fontFamily: FONT.mono,
      fontSize: '13px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.root.add(this.diffPillBg);
    this.root.add(this.diffPillText);
  }

  private buildBoard() {
    this.boardGroup = this.scene.add.container(this.boardX, this.boardY);
    this.pathGraphics = this.scene.add.graphics();
    this.boardGroup.add(this.pathGraphics);
    this.root.add(this.boardGroup);

    for (let r = 0; r < GRID_SIZE; r += 1) {
      for (let c = 0; c < GRID_SIZE; c += 1) {
        const rect = this.scene.add.rectangle(c * STEP, r * STEP, CELL, CELL, PALETTE.cellEmpty, 0.45)
          .setOrigin(0, 0)
          .setStrokeStyle(1, PALETTE.cellBorder);
        this.boardGroup.add(rect);
        this.cells.push(rect);
      }
    }
  }

  private buildProgress() {
    const y = this.boardY + BOARD + 12;
    this.statusText = this.scene.add.text(this.boardX, y, '', {
      fontFamily: FONT.mono,
      fontSize: '14px',
      color: CSS.mutedForeground,
    }).setOrigin(0, 0.5);
    this.progressLabel = this.scene.add.text(this.boardX + BOARD, y, '', {
      fontFamily: FONT.mono,
      fontSize: '14px',
      color: CSS.accent,
    }).setOrigin(1, 0.5);

    const barY = y + 16;
    const track = this.scene.add.rectangle(this.boardX, barY, BOARD, 6, PALETTE.muted, 1).setOrigin(0, 0.5);
    this.progressFill = this.scene.add.rectangle(this.boardX, barY, 0, 6, PALETTE.primary, 1).setOrigin(0, 0.5);
    this.root.add([this.statusText, this.progressLabel, track, this.progressFill]);
  }

  private buildDpad() {
    const cx = CENTER_X;
    const topY = this.boardY + BOARD + 58;
    const bw = 50;
    const bh = 42;
    const spread = 58;
    this.makeButton(cx, topY, bw, bh, '▲', PALETTE.primary, () => this.move('UP'));
    this.makeButton(cx - spread, topY + 48, bw, bh, '◀', PALETTE.primary, () => this.move('LEFT'));
    this.makeButton(cx, topY + 48, bw, bh, '▼', PALETTE.primary, () => this.move('DOWN'));
    this.makeButton(cx + spread, topY + 48, bw, bh, '▶', PALETTE.primary, () => this.move('RIGHT'));
  }

  private buildActionButtons() {
    const y = this.boardY + BOARD + 170;
    this.makeButton(CENTER_X - 92, y, 160, 38, '⏪ Rewind (Z)', PALETTE.accent, () =>
      this.dispatch({ type: 'APPLY_REWIND' })
    );
    this.makeButton(CENTER_X + 92, y, 160, 38, '↻ Reset (R)', PALETTE.mutedForeground, () =>
      this.dispatch({ type: 'RESET', level: this.level })
    );
  }

  private makeButton(x: number, y: number, w: number, h: number, label: string, color: number, onClick: () => void) {
    const bg = this.scene.add.rectangle(x, y, w, h, PALETTE.card, 0.95).setStrokeStyle(1.5, color);
    const text = this.scene.add.text(x, y, label, {
      fontFamily: FONT.mono,
      fontSize: '15px',
      color: `#${color.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    text.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', onClick);
    text.on('pointerdown', onClick);
    this.root.add([bg, text]);
  }

  private buildOverlay() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.overlay = this.scene.add.rectangle(0, 0, w, h, PALETTE.overlayScrim, 0.84).setOrigin(0, 0).setVisible(false);
    this.root.add(this.overlay);

    this.overlayText = this.scene.add.text(w / 2, h / 2 - 34, '', {
      fontFamily: FONT.mono,
      fontSize: '30px',
      color: CSS.destructive,
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    this.btnPrimary = this.makeOverlayButton('Continue', 150, PALETTE.primary, CSS.primary, () => this.onOverlayAction());
    this.btnLeaderboard = this.makeOverlayButton('🏆 Leaderboard', 180, PALETTE.accent, CSS.accent, () => this.openLeaderboard());
    this.btnClose = this.makeOverlayButton('Close (X)', 130, PALETTE.mutedForeground, CSS.mutedForeground, () => this.dismissOverlay());
    this.root.add(this.overlayText);
  }

  private makeOverlayButton(label: string, width: number, stroke: number, textColor: string, onClick: () => void): OverlayButton {
    const bg = this.scene.add.rectangle(0, 0, width, 40, PALETTE.card, 0.98).setStrokeStyle(1.5, stroke).setVisible(false);
    const text = this.scene.add.text(0, 0, label, {
      fontFamily: FONT.mono,
      fontSize: '16px',
      color: textColor,
      fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    bg.setInteractive({ useHandCursor: true });
    text.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', onClick);
    text.on('pointerdown', onClick);
    this.root.add([bg, text]);
    return { bg, text, width };
  }

  private layoutOverlayButtons(buttons: OverlayButton[], y: number) {
    const gap = 16;
    const total = buttons.reduce((sum, b) => sum + b.width, 0) + gap * (buttons.length - 1);
    let x = CENTER_X - total / 2;
    for (const b of buttons) {
      const cx = x + b.width / 2;
      b.bg.setPosition(cx, y).setVisible(true);
      b.text.setPosition(cx, y).setVisible(true);
      x += b.width + gap;
    }
  }

  private dismissOverlay() {
    this.overlayDismissed = true;
    this.updateUI();
  }

  // --- leaderboard ----------------------------------------------------------

  private buildLeaderboardPanel() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.lbPanel = this.scene.add.container(0, 0).setVisible(false);

    const scrim = this.scene.add.rectangle(0, 0, w, h, PALETTE.overlayScrim, 0.94).setOrigin(0, 0).setInteractive();
    const cardW = 520;
    const cardH = 452;
    const cardX = w / 2;
    const cardY = h / 2;
    const card = this.scene.add.rectangle(cardX, cardY, cardW, cardH, PALETTE.card, 1).setStrokeStyle(2, PALETTE.accent);

    const left = cardX - cardW / 2 + 28;
    const top = cardY - cardH / 2 + 24;

    this.lbTitle = this.scene.add.text(cardX, top, '', {
      fontFamily: FONT.mono,
      fontSize: '20px',
      color: CSS.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.lbStatus = this.scene.add.text(cardX, top + 44, '', {
      fontFamily: FONT.mono,
      fontSize: '15px',
      color: CSS.mutedForeground,
    }).setOrigin(0.5, 0);

    this.lbPanel.add([scrim, card, this.lbTitle, this.lbStatus]);

    for (let i = 0; i < 10; i += 1) {
      const row = this.scene.add.text(left, top + 44 + i * 30, '', {
        fontFamily: FONT.mono,
        fontSize: '15px',
        color: CSS.foreground,
      });
      this.lbRows.push(row);
      this.lbPanel.add(row);
    }

    this.lbYou = this.scene.add.text(cardX, cardY + cardH / 2 - 76, '', {
      fontFamily: FONT.mono,
      fontSize: '15px',
      color: CSS.primary,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.lbPanel.add(this.lbYou);

    const closeBg = this.scene.add.rectangle(cardX, cardY + cardH / 2 - 34, 140, 38, PALETTE.card, 0.98).setStrokeStyle(1.5, PALETTE.mutedForeground);
    const closeText = this.scene.add.text(cardX, cardY + cardH / 2 - 34, 'Close', {
      fontFamily: FONT.mono,
      fontSize: '15px',
      color: CSS.mutedForeground,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    closeBg.setInteractive({ useHandCursor: true });
    closeText.setInteractive({ useHandCursor: true });
    const close = () => this.lbPanel.setVisible(false);
    closeBg.on('pointerdown', close);
    closeText.on('pointerdown', close);
    this.lbPanel.add([closeBg, closeText]);

    this.root.add(this.lbPanel);
  }

  private openLeaderboard() {
    this.lbPanel.setVisible(true);
    this.lbTitle.setText(`🏆 ${this.level.name}`);
    this.lbRows.forEach((row) => row.setText(''));
    this.lbYou.setText('');
    this.lbStatus.setText('loading…').setVisible(true);

    fetch(`/api/leaderboard/${this.level.id}`)
      .then((res) => res.json() as Promise<LeaderboardResponse>)
      .then((data) => this.renderLeaderboard(data))
      .catch(() => this.lbStatus.setText('could not load leaderboard'));
  }

  private renderLeaderboard(data: LeaderboardResponse) {
    if (data.entries.length === 0) {
      this.lbStatus.setText('No scores yet — be the first!').setVisible(true);
    } else {
      this.lbStatus.setVisible(false);
      data.entries.forEach((entry, i) => {
        const row = this.lbRows[i];
        if (row) {
          const name = entry.username.length > 22 ? `${entry.username.slice(0, 21)}…` : entry.username;
          row.setText(`${String(entry.rank).padStart(2, ' ')}.  ${name.padEnd(24, ' ')}${entry.moves} moves`);
          row.setColor(data.you && entry.username === data.you.username ? CSS.primary : CSS.foreground);
        }
      });
    }

    if (data.you) {
      this.lbYou.setText(`You · #${data.you.rank} of ${data.total} · ${data.you.moves} moves`);
    } else {
      this.lbYou.setText('Sign in on Reddit to be ranked');
    }
  }

  private async submitScore() {
    const body: LeaderboardSubmitRequest = { levelId: this.level.id, moves: this.moveCount };
    try {
      await fetch('/api/leaderboard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // Network hiccup — the win still stands locally; score just isn't recorded.
    }
  }

  // --- input ----------------------------------------------------------------

  private onKey(event: KeyboardEvent) {
    const map: Record<string, Direction> = {
      ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
      w: 'UP', W: 'UP', s: 'DOWN', S: 'DOWN', a: 'LEFT', A: 'LEFT', d: 'RIGHT', D: 'RIGHT',
    };
    const dir = map[event.key];
    if (dir) {
      event.preventDefault();
      this.move(dir);
      return;
    }
    if (event.key === 'z' || event.key === 'Z') this.dispatch({ type: 'APPLY_REWIND' });
    if (event.key === 'r' || event.key === 'R') this.dispatch({ type: 'RESET', level: this.level });
  }

  private move(dir: Direction) {
    this.dispatch({ type: 'MOVE', dir });
  }

  private dispatch(action: Action) {
    const prev = this.state;
    this.state = reducer(this.state, action);
    if (action.type === 'RESET') this.moveCount = 0;
    else if (action.type === 'MOVE' && this.state !== prev) this.moveCount += 1;

    if (prev.gameStatus !== 'WON' && this.state.gameStatus === 'WON' && this.leaderboardEnabled) {
      void this.submitScore();
    }

    this.updateUI();
  }

  private onOverlayAction() {
    if (this.state.gameStatus === 'WON') {
      this.onComplete?.();
    } else {
      this.dispatch({ type: 'RESET', level: this.level });
    }
  }

  // --- rendering ------------------------------------------------------------

  private diffColor(d: Difficulty): number {
    return d === 'Easy' ? PALETTE.primary : d === 'Hard' ? PALETTE.destructive : PALETTE.accent;
  }

  private updateUI() {
    const targetSet = buildTargetSet(this.state.targetSilhouette);
    const finalKey = `${this.state.finalNode[0]},${this.state.finalNode[1]}`;
    this.cells.forEach((cell, index) => {
      const row = Math.floor(index / GRID_SIZE);
      const col = index % GRID_SIZE;
      const key = `${row},${col}`;
      const isTarget = targetSet.has(key);
      const isFinal = key === finalKey;
      const isOccupied = this.state.gridState[row]?.[col] === 'OCCUPIED';
      cell.setFillStyle(isOccupied ? PALETTE.primary : isTarget ? PALETTE.target : PALETTE.cellEmpty, isOccupied ? 0.95 : isTarget ? 0.18 : 0.45);
      cell.setStrokeStyle(isOccupied ? 2 : 1, isFinal ? PALETTE.accent : isTarget ? PALETTE.target : PALETTE.cellBorder);
    });

    this.pathGraphics.clear();
    if (this.state.snakeBody.length > 1) {
      const points = this.state.snakeBody.map(([r, c]) => new Phaser.Math.Vector2(c * STEP + CELL / 2, r * STEP + CELL / 2));
      this.pathGraphics.lineStyle(6, this.state.gameStatus === 'CRASHED' ? PALETTE.destructive : PALETTE.primary, 0.7);
      this.pathGraphics.beginPath();
      points.forEach((point, index) => {
        if (index === 0) this.pathGraphics.moveTo(point.x, point.y);
        else this.pathGraphics.lineTo(point.x, point.y);
      });
      this.pathGraphics.strokePath();
    }

    const covered = this.state.targetSilhouette.filter(([r, c]) => this.state.gridState[r]?.[c] === 'OCCUPIED').length;
    const total = this.state.targetSilhouette.length;
    this.progressLabel.setText(`${covered}/${total}`);
    this.progressFill.setSize(total > 0 ? (BOARD * covered) / total : 0, 6);
    this.statusText.setText(this.statusMessage());

    // Difficulty pill.
    const dc = this.diffColor(this.level.difficulty);
    this.diffPillBg.setStrokeStyle(1.5, dc);
    this.diffPillText.setText(this.level.difficulty).setColor(`#${dc.toString(16).padStart(6, '0')}`);

    // Rewind indicator.
    this.rewindIcons.forEach((icon, i) => {
      icon.setColor(i < this.state.rewindsLeft ? CSS.destructive : CSS.mutedForeground);
      icon.setAlpha(i < this.state.rewindsLeft ? 1 : 0.35);
    });

    // Win / game-over overlay (CRASHED stays inline so the player can rewind).
    const finished = this.state.gameStatus === 'WON' || this.state.gameStatus === 'GAMEOVER';
    if (this.state.gameStatus === 'PLAYING') this.overlayDismissed = false;

    const allButtons = [this.btnPrimary, this.btnLeaderboard, this.btnClose];
    if (finished && !this.overlayDismissed) {
      const won = this.state.gameStatus === 'WON';
      this.overlay.setVisible(true).setInteractive();
      this.overlayText.setText(won ? 'SHAPED!' : 'GAME OVER')
        .setColor(won ? CSS.primary : CSS.destructive)
        .setVisible(true);
      this.btnPrimary.text.setText(won ? 'Continue' : 'Try again').setColor(won ? CSS.primary : CSS.destructive);
      this.btnPrimary.bg.setStrokeStyle(1.5, won ? PALETTE.primary : PALETTE.destructive);

      const row: OverlayButton[] = won && this.leaderboardEnabled
        ? [this.btnPrimary, this.btnLeaderboard, this.btnClose]
        : [this.btnPrimary, this.btnClose];
      allButtons.forEach((b) => {
        b.bg.setVisible(false);
        b.text.setVisible(false);
      });
      this.layoutOverlayButtons(row, this.scene.scale.height / 2 + 34);
    } else {
      this.overlay.setVisible(false).disableInteractive();
      this.overlayText.setVisible(false);
      allButtons.forEach((b) => {
        b.bg.setVisible(false);
        b.text.setVisible(false);
      });
    }
  }

  private statusMessage(): string {
    switch (this.state.gameStatus) {
      case 'CRASHED':
        return 'crashed! rewind (Z) or reset (R)';
      case 'WON':
        return 'shaped!';
      case 'GAMEOVER':
        return 'out of rewinds — reset (R)';
      default:
        return this.state.snakeBody.length <= 1 ? 'start moving…' : 'trace the shape';
    }
  }
}

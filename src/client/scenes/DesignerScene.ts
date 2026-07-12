import { Scene, GameObjects } from 'phaser';
import { GRID_SIZE, type Coord, type LevelConfig } from '../../shared/puzzles';
import { PALETTE, CSS, FONT } from '../../shared/theme';

type Tool = 'PAINT' | 'ERASE' | 'START' | 'END';

const CELL = 36;
const GAP = 4;
const STEP = CELL + GAP;
const BOARD = GRID_SIZE * CELL + (GRID_SIZE - 1) * GAP;
const BOARD_X = Math.round((1024 - BOARD) / 2);
const BOARD_Y = 165;

const MIN_TARGETS = 3;

const TOOLS: { tool: Tool; label: string; icon: string; color: number; css: string }[] = [
  { tool: 'PAINT', label: 'Paint', icon: '✎', color: PALETTE.purple, css: CSS.purple },
  { tool: 'ERASE', label: 'Erase', icon: '⌫', color: PALETTE.mutedForeground, css: CSS.mutedForeground },
  { tool: 'START', label: 'Start', icon: '●', color: PALETTE.primary, css: CSS.primary },
  { tool: 'END', label: 'End', icon: '◆', color: PALETTE.accent, css: CSS.accent },
];

export class DesignerScene extends Scene {
  private tool: Tool = 'PAINT';
  private painted: boolean[][] = [];
  private start: Coord | null = null;
  private finalNode: Coord | null = null;
  private isDrawing = false;

  private cellRects: GameObjects.Rectangle[][] = [];
  private chipBorders = new Map<Tool, GameObjects.Rectangle>();
  private chipLabels = new Map<Tool, GameObjects.Text>();
  private startMarker!: GameObjects.Arc;
  private endMarker!: GameObjects.Rectangle;

  private valTargets!: GameObjects.Text;
  private valStart!: GameObjects.Text;
  private valEnd!: GameObjects.Text;
  private valDistinct!: GameObjects.Text;
  private counterNumber!: GameObjects.Text;
  private playBg!: GameObjects.Rectangle;
  private playLabel!: GameObjects.Text;

  constructor() {
    super('Designer');
  }

  create() {
    this.tool = 'PAINT';
    this.painted = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    this.start = null;
    this.finalNode = null;
    this.isDrawing = false;
    this.cellRects = [];
    this.chipBorders.clear();
    this.chipLabels.clear();

    this.cameras.main.setBackgroundColor(CSS.backgroundAlt);

    this.buildHeader();
    this.buildToolbar();
    this.buildBoard();
    this.buildValidationPanel();
    this.buildCounter();
    this.buildPlayButton();
    this.buildFooter();

    this.input.on('pointerup', () => {
      this.isDrawing = false;
    });

    this.setTool('PAINT');
    this.renderCells();
    this.renderValidation();
  }

  private buildHeader() {
    const back = this.add.text(40, 30, '← Hub', {
      fontFamily: FONT.mono,
      fontSize: '16px',
      color: CSS.mutedForeground,
    }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('Hub'));

    this.add.text(512, 38, '✎ Grid Designer', {
      fontFamily: FONT.mono,
      fontSize: '24px',
      color: CSS.foreground,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    const clearBg = this.add.rectangle(984, 44, 96, 34, PALETTE.card, 0.95)
      .setOrigin(1, 0.5)
      .setStrokeStyle(1, PALETTE.destructive);
    const clearLabel = this.add.text(936, 44, '✕ Clear', {
      fontFamily: FONT.mono,
      fontSize: '15px',
      color: CSS.destructive,
    }).setOrigin(0.5);
    clearBg.setInteractive({ useHandCursor: true });
    clearLabel.setInteractive({ useHandCursor: true });
    const onClear = () => this.clearAll();
    clearBg.on('pointerdown', onClear);
    clearLabel.on('pointerdown', onClear);
  }

  private buildToolbar() {
    const chipW = 132;
    const chipH = 46;
    const gap = 14;
    const total = TOOLS.length * chipW + (TOOLS.length - 1) * gap;
    const startX = Math.round((1024 - total) / 2);
    const y = 100;

    TOOLS.forEach((t, index) => {
      const cx = startX + index * (chipW + gap) + chipW / 2;
      const border = this.add.rectangle(cx, y, chipW, chipH, PALETTE.card, 0.95)
        .setStrokeStyle(2, PALETTE.cellBorder);
      const label = this.add.text(cx, y, `${t.icon}  ${t.label}`, {
        fontFamily: FONT.mono,
        fontSize: '17px',
        color: CSS.mutedForeground,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      border.setInteractive({ useHandCursor: true });
      label.setInteractive({ useHandCursor: true });
      const pick = () => this.setTool(t.tool);
      border.on('pointerdown', pick);
      label.on('pointerdown', pick);
      this.chipBorders.set(t.tool, border);
      this.chipLabels.set(t.tool, label);
    });
  }

  private buildBoard() {
    for (let r = 0; r < GRID_SIZE; r += 1) {
      const row: GameObjects.Rectangle[] = [];
      for (let c = 0; c < GRID_SIZE; c += 1) {
        const rect = this.add.rectangle(BOARD_X + c * STEP, BOARD_Y + r * STEP, CELL, CELL, PALETTE.cellEmpty, 0.35)
          .setOrigin(0, 0)
          .setStrokeStyle(1, PALETTE.cellBorder)
          .setInteractive({ useHandCursor: true });
        rect.on('pointerdown', () => this.onCellDown(r, c));
        rect.on('pointerover', () => this.onCellOver(r, c));
        row.push(rect);
      }
      this.cellRects.push(row);
    }

    // Markers reused across renders — positioned/hidden in renderCells().
    this.startMarker = this.add.circle(0, 0, CELL / 2 - 6, PALETTE.primary).setVisible(false);
    this.endMarker = this.add.rectangle(0, 0, CELL - 14, CELL - 14, PALETTE.accent)
      .setAngle(45)
      .setVisible(false);
  }

  private buildValidationPanel() {
    const x = 150;
    const y = BOARD_Y + BOARD + 24;
    this.add.rectangle(x, y, 380, 120, PALETTE.card, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.cellBorder);

    const rowStyle = { fontFamily: FONT.mono, fontSize: '15px', color: CSS.mutedForeground } as const;
    this.valTargets = this.add.text(x + 20, y + 16, '', rowStyle);
    this.valStart = this.add.text(x + 20, y + 42, '', rowStyle);
    this.valEnd = this.add.text(x + 20, y + 68, '', rowStyle);
    this.valDistinct = this.add.text(x + 20, y + 94, '', rowStyle);
  }

  private buildCounter() {
    const x = 820;
    const y = BOARD_Y + BOARD + 24;
    this.add.text(x, y, 'cells painted', {
      fontFamily: FONT.mono,
      fontSize: '14px',
      color: CSS.mutedForeground,
    }).setOrigin(0.5, 0);
    this.counterNumber = this.add.text(x, y + 22, '0', {
      fontFamily: FONT.mono,
      fontSize: '40px',
      color: CSS.purple,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
  }

  private buildPlayButton() {
    const x = 820;
    const y = BOARD_Y + BOARD + 92;
    this.playBg = this.add.rectangle(x, y, 160, 52, PALETTE.card, 0.95)
      .setStrokeStyle(2, PALETTE.mutedForeground);
    this.playLabel = this.add.text(x, y, '▶ Play', {
      fontFamily: FONT.mono,
      fontSize: '20px',
      color: CSS.mutedForeground,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.playBg.on('pointerdown', () => this.play());
    this.playLabel.on('pointerdown', () => this.play());
  }

  private buildFooter() {
    this.add.text(512, 748, 'click or drag to paint · use tools to set start ● and end ◆', {
      fontFamily: FONT.mono,
      fontSize: '13px',
      color: CSS.mutedForeground,
    }).setOrigin(0.5);
  }

  private setTool(tool: Tool) {
    this.tool = tool;
    TOOLS.forEach((t) => {
      const active = t.tool === tool;
      this.chipBorders.get(t.tool)?.setStrokeStyle(2, active ? t.color : PALETTE.cellBorder);
      this.chipLabels.get(t.tool)?.setColor(active ? t.css : CSS.mutedForeground);
    });
  }

  private onCellDown(r: number, c: number) {
    this.isDrawing = true;
    this.applyTool(r, c);
  }

  private onCellOver(r: number, c: number) {
    if (this.isDrawing && (this.tool === 'PAINT' || this.tool === 'ERASE')) {
      this.applyTool(r, c);
    }
  }

  private applyTool(r: number, c: number) {
    const row = this.painted[r];
    if (!row) return;
    switch (this.tool) {
      case 'PAINT':
        row[c] = true;
        break;
      case 'ERASE':
        row[c] = false;
        if (this.start && this.start[0] === r && this.start[1] === c) this.start = null;
        if (this.finalNode && this.finalNode[0] === r && this.finalNode[1] === c) this.finalNode = null;
        break;
      case 'START':
        this.start = [r, c];
        break;
      case 'END':
        this.finalNode = [r, c];
        break;
    }
    this.renderCells();
    this.renderValidation();
  }

  private cellCenter([r, c]: Coord): { x: number; y: number } {
    return { x: BOARD_X + c * STEP + CELL / 2, y: BOARD_Y + r * STEP + CELL / 2 };
  }

  private renderCells() {
    for (let r = 0; r < GRID_SIZE; r += 1) {
      const paintedRow = this.painted[r] ?? [];
      const rectRow = this.cellRects[r] ?? [];
      for (let c = 0; c < GRID_SIZE; c += 1) {
        const rect = rectRow[c];
        if (!rect) continue;
        if (paintedRow[c]) {
          rect.setFillStyle(PALETTE.purple, 0.85);
          rect.setStrokeStyle(1, PALETTE.purple);
        } else {
          rect.setFillStyle(PALETTE.cellEmpty, 0.35);
          rect.setStrokeStyle(1, PALETTE.cellBorder);
        }
      }
    }

    if (this.start) {
      const { x, y } = this.cellCenter(this.start);
      this.startMarker.setPosition(x, y).setVisible(true);
    } else {
      this.startMarker.setVisible(false);
    }

    if (this.finalNode) {
      const { x, y } = this.cellCenter(this.finalNode);
      this.endMarker.setPosition(x, y).setVisible(true);
    } else {
      this.endMarker.setVisible(false);
    }
  }

  private countPainted(): number {
    return this.painted.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  }

  private renderValidation() {
    const painted = this.countPainted();
    const hasTargets = painted >= MIN_TARGETS;
    const hasStart = this.start !== null;
    const hasEnd = this.finalNode !== null;
    const distinct =
      this.start !== null &&
      this.finalNode !== null &&
      !(this.start[0] === this.finalNode[0] && this.start[1] === this.finalNode[1]);

    this.setRow(this.valTargets, hasTargets, `Target cells: ${painted} (need ≥ ${MIN_TARGETS})`);
    this.setRow(this.valStart, hasStart, hasStart ? 'Start set' : 'Start not set — use ● Start tool');
    this.setRow(this.valEnd, hasEnd, hasEnd ? 'End set' : 'End not set — use ◆ End tool');
    this.setRow(this.valDistinct, distinct, 'Start ≠ End');

    this.counterNumber.setText(String(painted));

    const valid = hasTargets && hasStart && hasEnd && distinct;
    this.setPlayEnabled(valid);
  }

  private setRow(text: GameObjects.Text, ok: boolean, label: string) {
    text.setText(`${ok ? '✓' : '○'}  ${label}`);
    text.setColor(ok ? CSS.foreground : CSS.mutedForeground);
  }

  private setPlayEnabled(enabled: boolean) {
    this.playBg.setStrokeStyle(2, enabled ? PALETTE.primary : PALETTE.mutedForeground);
    this.playBg.setAlpha(enabled ? 1 : 0.5);
    this.playLabel.setColor(enabled ? CSS.primary : CSS.mutedForeground).setAlpha(enabled ? 1 : 0.5);
    if (enabled) {
      this.playBg.setInteractive({ useHandCursor: true });
      this.playLabel.setInteractive({ useHandCursor: true });
    } else {
      this.playBg.disableInteractive();
      this.playLabel.disableInteractive();
    }
  }

  private clearAll() {
    this.painted = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    this.start = null;
    this.finalNode = null;
    this.renderCells();
    this.renderValidation();
  }

  private play() {
    const targets: Coord[] = [];
    for (let r = 0; r < GRID_SIZE; r += 1) {
      const row = this.painted[r] ?? [];
      for (let c = 0; c < GRID_SIZE; c += 1) {
        if (row[c]) targets.push([r, c]);
      }
    }
    if (!this.start || !this.finalNode || targets.length < MIN_TARGETS) return;

    const level: LevelConfig = {
      id: 999,
      name: 'Custom',
      shape: '✏',
      difficulty: 'Medium',
      start: this.start,
      finalNode: this.finalNode,
      targets,
    };
    this.scene.start('SnakeGame', { level, onComplete: () => this.scene.start('Hub') });
  }
}

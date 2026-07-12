import { Scene } from 'phaser';

// Faces to warm up before the first canvas text renders. Phaser draws text to
// the canvas immediately, so a web font that isn't loaded yet paints with the
// fallback and never repaints — hence the preload here.
const FONT_FACES = [
  '400 16px "Outfit"',
  '700 16px "Outfit"',
  '400 16px "JetBrains Mono"',
  '700 16px "JetBrains Mono"',
];

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  create() {
    void this.ensureFonts().then(() => this.scene.start('Hub'));
  }

  private async ensureFonts(): Promise<void> {
    const fontSet = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fontSet) return;
    try {
      // Race the load against a timeout so a CSP block on Google Fonts (or an
      // offline webview) falls back to system fonts instead of stalling boot.
      await Promise.race([
        Promise.all(FONT_FACES.map((face) => fontSet.load(face))).then(() => fontSet.ready),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 3000);
        }),
      ]);
    } catch {
      // Fonts unavailable — proceed with the monospace/sans fallbacks.
    }
  }
}

# Lil Shaper

Lil Shaper is a Devvit web game for Reddit. It reimagines Snake as a grid-shaping puzzle: guide the snake through a 10x10 board, cover every target cell, and finish on the marked endpoint without trapping yourself.

The app runs as a Devvit custom post with a lightweight inline splash view and a Phaser-powered expanded game view.

## Features

### Game Modes

- **Hub**: Main menu with live date/time, puzzle previews, and entry points for each mode.
- **Tutorial**: Four hand-crafted lessons: The L-Turn, The Crescent, The Zigzag, and The Serpentine.
- **Daily Challenge**: A rotating daily puzzle selected from the daily pool.
- **Grid Designer**: A custom puzzle editor where players can paint target cells, erase cells, set a start point, set an end point, validate the puzzle, play it, share it, or publish it.
- **Community Puzzles**: A catalog of the latest Redditor-made puzzles, loaded from Redis and playable in the app.
- **Shared Puzzle Support**: Custom puzzles can be encoded into a portable `snake-shaper-puzzle:` payload for sharing.

### Gameplay

- 10x10 puzzle board.
- Target cells that must all be covered.
- Required final cell that must be reached after filling the shape.
- Snake movement with arrow keys, WASD, and on-screen directional controls.
- Free undo when moving directly back into the previous cell.
- Crash detection for walls and self-collisions.
- Three rewinds per run.
- Rewind removes up to five snake segments after a crash.
- Reset control for restarting the current puzzle.
- Progress bar showing filled target cells.
- Difficulty pill for Easy, Medium, and Hard puzzles.
- Win and game-over overlays.

### Social And Reddit Features

- Devvit custom post creation from a subreddit menu action.
- Automatic post creation on app install.
- Result sharing through Reddit comments when possible.
- Fallback sharing through Devvit share sheet and clipboard.
- Duplicate comment prevention per post, level, and username.
- Reddit username attribution for community puzzles.
- Community puzzle publishing for signed-in Reddit users.
- Community catalog deduplication by author and puzzle fingerprint.

### Leaderboards

- Leaderboards rank completions by fewest moves.
- Supports daily, weekly, and all-time scopes.
- Stores player best scores in Redis sorted sets.
- Shows top 10 entries plus the current player's own rank when available.
- Anonymous players can complete puzzles, but are not ranked.

### Backend API

The server is a Hono app running in Devvit's serverless environment.

- `GET /api/init`: Returns post context, username, and a Redis-backed counter.
- `POST /api/increment`: Increments the sample counter.
- `POST /api/decrement`: Decrements the sample counter.
- `GET /api/puzzles`: Returns tutorial levels, daily pool, and the current daily puzzle.
- `POST /api/leaderboard/submit`: Submits a completion score.
- `GET /api/leaderboard/:levelId?scope=daily|weekly|all`: Reads leaderboard entries.
- `POST /api/share/comment`: Posts or returns an existing result comment.
- `POST /api/community-puzzles`: Publishes a validated custom puzzle.
- `GET /api/community-puzzles`: Lists the latest community puzzles.

### Devvit Menu, Forms, And Triggers

- Subreddit moderator menu item: **Create a new post**.
- Install trigger: creates a Lil Shaper custom post when the app is installed.
- Example form handler exists at `/internal/form/example-submit`.

## Tech Stack

- **Devvit** `0.13.8`
- **Node.js** `>=22.2.0`
- **Phaser** `4.2.0`
- **Vite** `8.1.3`
- **Hono** `4.12.28`
- **TypeScript** `6.0.3`
- **Redis** through `@devvit/web/server`
- **Reddit API** through `@devvit/web/server`

## Project Structure

```text
src/client/
  game.html              Expanded game entrypoint
  splash.html            Inline feed entrypoint
  game.ts                Phaser bootstrapping
  splash.ts              Opens expanded mode
  PlayField.ts           Shared gameplay engine and UI surface
  scenes/                Phaser scenes for hub, tutorial, daily, designer, community, and gameplay

src/server/
  index.ts               Hono server entrypoint
  routes/api.ts          Game API, leaderboards, sharing, community puzzles
  routes/menu.ts         Devvit menu action handlers
  routes/forms.ts        Example form handler
  routes/triggers.ts     App install trigger handlers
  core/post.ts           Custom post creation helper

src/shared/
  puzzles.ts             Level data and puzzle constants
  customPuzzle.ts        Custom puzzle encoding/decoding
  share.ts               Result share text formatting
  api.ts                 Shared request/response types
  theme.ts               Shared color and font tokens
```

## Requirements

- Node.js `22.2.0` or newer.
- npm.
- Reddit account with Devvit access.
- Devvit CLI login for upload, playtest, and publish commands.

## Setup

Install dependencies:

```bash
npm install
```

Log in to Devvit:

```bash
npm run login
```

Start a Reddit playtest session:

```bash
npm run dev
```

The app is configured to use the development subreddit in `devvit.json`:

```json
"dev": {
  "subreddit": "snake_shaper_dev"
}
```

## Scripts

- `npm run dev`: Runs `devvit playtest`.
- `npm run build`: Builds the client and server with Vite.
- `npm run type-check`: Runs TypeScript project checks.
- `npm run lint`: Runs ESLint on `src/**/*.ts` and `src/**/*.tsx`.
- `npm run deploy`: Runs type-check, lint, then `devvit upload`.
- `npm run launch`: Uploads and then runs `devvit publish`.
- `npm run login`: Logs in to Devvit.
- `npm run prettier`: Formats the repository with Prettier.

## Build And Upload

The Devvit CLI is installed locally in this project. Use npm scripts or `npx`; do not assume a global `devvit` command exists.

Recommended upload command:

```bash
npm run deploy
```

Direct upload command:

```bash
npx devvit upload
```

Publish for review:

```bash
npm run launch
```

## App Configuration

`devvit.json` defines:

- Inline post entrypoint: `src/client/splash.html`
- Expanded game entrypoint: `src/client/game.html`
- Server bundle entrypoint: `dist/server/index.cjs`
- Reddit permission: `SUBMIT_COMMENT` as user
- Subreddit menu actions
- App install trigger
- Vite build/watch scripts

## Data Storage

Redis is used for:

- Sample counter state.
- Leaderboard sorted sets.
- Daily and weekly leaderboard scopes.
- Result comment deduplication.
- Community puzzle index and puzzle payload storage.

Community puzzle validation enforces:

- At least three target cells.
- Targets inside the 10x10 grid.
- Start and final cells inside the grid.
- Start and final cells must both be included in the target shape.
- Duplicate target cells are removed.

## Controls

- Arrow keys or WASD: Move.
- On-screen D-pad: Move.
- `Z`: Rewind after a crash.
- `R`: Reset the current puzzle.
- Moving backward into the previous snake cell: Free undo.

## Notes

- `devvit upload` requires Devvit authentication and network access.
- If your shell says `devvit: command not found`, run `npm run deploy` or `npx devvit upload`.
- `npm install` currently reports npm audit findings. Review with `npm audit` before applying broad fixes, especially fixes that may introduce breaking dependency changes.

## License

BSD-3-Clause. See [LICENSE](LICENSE).

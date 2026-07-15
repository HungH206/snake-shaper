import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  CommunityPuzzle,
  CommunityPuzzleListResponse,
  CommunityPuzzleSubmitRequest,
  CommunityPuzzleSubmitResponse,
  DecrementResponse,
  IncrementResponse,
  InitResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardScope,
  LeaderboardSubmitRequest,
  LeaderboardSubmitResponse,
  PuzzleBundleResponse,
  ShareAttemptRequest,
  ShareAttemptResponse,
} from '../../shared/api';
import { DAILY_POOL, GRID_SIZE, LEVELS, MAX_REWINDS, getDailyLevel, type Coord, type LevelConfig } from '../../shared/puzzles';
import { buildChallengeShareText } from '../../shared/share';

type ErrorResponse = {
  status: 'error';
  message: string;
};

export const api = new Hono();

api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  try {
    const [count, username] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername(),
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId: postId,
      count: count ? parseInt(count) : 0,
      username: username ?? 'anonymous',
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = 'Unknown error during initialization';
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    return c.json<ErrorResponse>(
      { status: 'error', message: errorMessage },
      400
    );
  }
});

api.post('/increment', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', 1);
  return c.json<IncrementResponse>({
    count,
    postId,
    type: 'increment',
  });
});

api.post('/decrement', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', -1);
  return c.json<DecrementResponse>({
    count,
    postId,
    type: 'decrement',
  });
});

api.get('/puzzles', (c) => {
  const daily = getDailyLevel();
  return c.json<PuzzleBundleResponse>({
    levels: LEVELS,
    dailyPool: DAILY_POOL,
    daily,
  });
});

const LEADERBOARD_SIZE = 10;
const SCORE_TIME_DIVISOR = 1_000_000_000_000_000;
const lbKey = (levelId: number) => `lb:${levelId}`;
const dailyLbKey = (date: string, levelId: number) => `lb:daily:${date}:${levelId}`;
const weeklyLbKey = (week: string, levelId: number) => `lb:weekly:${week}:${levelId}`;
const shareKey = (postId: string, levelId: number, username: string) => `share:${postId}:${levelId}:${username}`;
const COMMUNITY_INDEX_KEY = 'community:puzzles:index';
const COMMUNITY_DATA_KEY = 'community:puzzles:data';
const COMMUNITY_PAGE_SIZE = 12;
const COMMUNITY_MAX_TARGETS = GRID_SIZE * GRID_SIZE;
const allPlayableLevels = [...LEVELS, ...DAILY_POOL];

function isCoord(value: unknown): value is Coord {
  return Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1]) &&
    value[0] >= 0 &&
    value[0] < GRID_SIZE &&
    value[1] >= 0 &&
    value[1] < GRID_SIZE;
}

function sanitizeCommunityLevel(level: LevelConfig): LevelConfig | null {
  if (!Array.isArray(level.targets) || level.targets.length < 3 || level.targets.length > COMMUNITY_MAX_TARGETS) return null;
  if (!isCoord(level.start) || !isCoord(level.finalNode)) return null;

  const seen = new Set<string>();
  const targets: Coord[] = [];
  for (const target of level.targets) {
    if (!isCoord(target)) return null;
    const key = `${target[0]},${target[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(target);
  }

  if (!seen.has(`${level.start[0]},${level.start[1]}`)) return null;
  if (!seen.has(`${level.finalNode[0]},${level.finalNode[1]}`)) return null;

  return {
    id: 999,
    name: 'Community Puzzle',
    shape: '✏',
    difficulty: 'Medium',
    start: level.start,
    finalNode: level.finalNode,
    targets,
  };
}

function puzzleFingerprint(level: LevelConfig): string {
  const targets = level.targets
    .map(([row, col]) => `${row}${col}`)
    .sort()
    .join('');
  return `${level.start[0]}${level.start[1]}:${level.finalNode[0]}${level.finalNode[1]}:${targets}`;
}

function stablePuzzleId(username: string, level: LevelConfig): string {
  return `${username}:${puzzleFingerprint(level)}`;
}

function dateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function weekKey(now: Date): string {
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = weekStart.getUTCDay() || 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - day + 1);
  return dateKey(weekStart);
}

function rankedScore(moves: number, completedAt: number): number {
  return moves + completedAt / SCORE_TIME_DIVISOR;
}

function movesFromScore(score: number): number {
  return Math.trunc(score);
}

function completedAtFromScore(score: number): number {
  const moves = movesFromScore(score);
  return Math.round((score - moves) * SCORE_TIME_DIVISOR);
}

function leaderboardKey(scope: LeaderboardScope, levelId: number, now: Date): string {
  switch (scope) {
    case 'daily':
      return dailyLbKey(dateKey(now), levelId);
    case 'weekly':
      return weeklyLbKey(weekKey(now), levelId);
    default:
      return lbKey(levelId);
  }
}

function leaderboardLabel(scope: LeaderboardScope, now: Date): string {
  switch (scope) {
    case 'daily':
      return `Daily · ${dateKey(now)}`;
    case 'weekly':
      return `Week of ${weekKey(now)}`;
    default:
      return 'All-time';
  }
}

async function submitToLeaderboard(key: string, username: string, moves: number, completedAt: number): Promise<number> {
  const score = rankedScore(moves, completedAt);
  const current = await redis.zScore(key, username);
  if (current === undefined || score < current) {
    await redis.zAdd(key, { member: username, score });
    return moves;
  }

  return movesFromScore(current);
}

function parseLeaderboardScope(value: string | undefined): LeaderboardScope {
  return value === 'daily' || value === 'weekly' || value === 'all' ? value : 'all';
}

api.post('/leaderboard/submit', async (c) => {
  const { levelId, moves } = await c.req.json<LeaderboardSubmitRequest>();

  if (!Number.isInteger(levelId) || !Number.isInteger(moves) || moves <= 0) {
    return c.json<ErrorResponse>({ status: 'error', message: 'levelId and moves must be positive integers' }, 400);
  }

  const username = await reddit.getCurrentUsername();
  if (!username) {
    // Anonymous players can't be ranked, but their win still counts locally.
    return c.json<LeaderboardSubmitResponse>({ ok: false, best: null });
  }

  const completedAt = Date.now();
  const now = new Date(completedAt);
  const best = await submitToLeaderboard(lbKey(levelId), username, moves, completedAt);
  await Promise.all([
    submitToLeaderboard(dailyLbKey(dateKey(now), levelId), username, moves, completedAt),
    submitToLeaderboard(weeklyLbKey(weekKey(now), levelId), username, moves, completedAt),
  ]);

  return c.json<LeaderboardSubmitResponse>({ ok: true, best });
});

api.get('/leaderboard/:levelId', async (c) => {
  const levelId = parseInt(c.req.param('levelId'), 10);
  if (!Number.isInteger(levelId)) {
    return c.json<ErrorResponse>({ status: 'error', message: 'invalid levelId' }, 400);
  }

  const scope = parseLeaderboardScope(c.req.query('scope'));
  const now = new Date();
  const key = leaderboardKey(scope, levelId, now);
  const [rows, total, username] = await Promise.all([
    redis.zRange(key, 0, LEADERBOARD_SIZE - 1, { by: 'rank' }),
    redis.zCard(key),
    reddit.getCurrentUsername(),
  ]);

  const entries: LeaderboardEntry[] = rows.map((row, index) => ({
    username: row.member,
    moves: movesFromScore(row.score),
    rank: index + 1,
    completedAt: completedAtFromScore(row.score),
  }));

  let you: LeaderboardEntry | null = null;
  if (username) {
    const [myScore, myRank] = await Promise.all([redis.zScore(key, username), redis.zRank(key, username)]);
    if (myScore !== undefined && myRank !== undefined) {
      you = {
        username,
        moves: movesFromScore(myScore),
        rank: myRank + 1,
        completedAt: completedAtFromScore(myScore),
      };
    }
  }

  return c.json<LeaderboardResponse>({
    levelId,
    scope,
    label: leaderboardLabel(scope, now),
    entries,
    you,
    total,
  });
});

api.post('/share/comment', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }

  const { levelId, moves, rewindsUsed } = await c.req.json<ShareAttemptRequest>();
  if (
    !Number.isInteger(levelId) ||
    !Number.isInteger(moves) ||
    !Number.isInteger(rewindsUsed) ||
    moves <= 0 ||
    rewindsUsed < 0 ||
    rewindsUsed > MAX_REWINDS
  ) {
    return c.json<ErrorResponse>({ status: 'error', message: 'invalid attempt stats' }, 400);
  }

  const level = allPlayableLevels.find((candidate) => candidate.id === levelId);
  if (!level) {
    return c.json<ErrorResponse>({ status: 'error', message: 'unknown level' }, 400);
  }

  const username = await reddit.getCurrentUsername();
  if (!username) {
    return c.json<ErrorResponse>({ status: 'error', message: 'sign in to post your result' }, 401);
  }

  const key = shareKey(postId, levelId, username);
  const existingUrl = await redis.get(key);
  if (existingUrl) {
    return c.json<ShareAttemptResponse>({
      ok: true,
      status: 'already-posted',
      commentUrl: existingUrl,
    });
  }

  const text = buildChallengeShareText(level, { moves, rewindsUsed });
  const comment = await reddit.submitComment({
    id: postId,
    text,
    runAs: 'USER',
  });

  await redis.set(key, comment.url);

  return c.json<ShareAttemptResponse>({
    ok: true,
    status: 'posted',
    commentUrl: comment.url,
  });
});

api.post('/community-puzzles', async (c) => {
  const username = await reddit.getCurrentUsername();
  if (!username) {
    return c.json<ErrorResponse>({ status: 'error', message: 'sign in to publish a puzzle' }, 401);
  }

  const { level } = await c.req.json<CommunityPuzzleSubmitRequest>();
  const sanitized = sanitizeCommunityLevel(level);
  if (!sanitized) {
    return c.json<ErrorResponse>({ status: 'error', message: 'invalid puzzle' }, 400);
  }

  const id = stablePuzzleId(username, sanitized);
  const existing = await redis.hGet(COMMUNITY_DATA_KEY, id);
  if (existing) {
    const puzzle = JSON.parse(existing) as CommunityPuzzle;
    return c.json<CommunityPuzzleSubmitResponse>({ ok: true, status: 'already-published', puzzle });
  }

  const createdAt = Date.now();
  const puzzle: CommunityPuzzle = {
    id,
    author: username,
    createdAt,
    level: sanitized,
  };

  await Promise.all([
    redis.hSet(COMMUNITY_DATA_KEY, { [puzzle.id]: JSON.stringify(puzzle) }),
    redis.zAdd(COMMUNITY_INDEX_KEY, { member: puzzle.id, score: -createdAt }),
  ]);

  return c.json<CommunityPuzzleSubmitResponse>({ ok: true, status: 'published', puzzle });
});

api.get('/community-puzzles', async (c) => {
  const rows = await redis.zRange(COMMUNITY_INDEX_KEY, 0, COMMUNITY_PAGE_SIZE - 1, { by: 'rank' });
  const ids = rows.map((row) => row.member);
  if (ids.length === 0) {
    return c.json<CommunityPuzzleListResponse>({ puzzles: [] });
  }

  const values = await redis.hMGet(COMMUNITY_DATA_KEY, ids);
  const seenFingerprints = new Set<string>();
  const puzzles = values.flatMap((value) => {
    if (!value) return [];
    try {
      const puzzle = JSON.parse(value) as CommunityPuzzle;
      const key = `${puzzle.author}:${puzzleFingerprint(puzzle.level)}`;
      if (seenFingerprints.has(key)) return [];
      seenFingerprints.add(key);
      return [puzzle];
    } catch {
      return [];
    }
  });

  return c.json<CommunityPuzzleListResponse>({ puzzles });
});

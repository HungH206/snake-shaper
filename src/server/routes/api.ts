import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardSubmitRequest,
  LeaderboardSubmitResponse,
  PuzzleBundleResponse,
} from '../../shared/api';
import { DAILY_POOL, LEVELS, getDailyLevel } from '../../shared/puzzles';

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
const lbKey = (levelId: number) => `lb:${levelId}`;

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

  const key = lbKey(levelId);
  const current = await redis.zScore(key, username);
  const best = current === undefined ? moves : Math.min(current, moves);
  if (current === undefined || moves < current) {
    await redis.zAdd(key, { member: username, score: moves });
  }

  return c.json<LeaderboardSubmitResponse>({ ok: true, best });
});

api.get('/leaderboard/:levelId', async (c) => {
  const levelId = parseInt(c.req.param('levelId'), 10);
  if (!Number.isInteger(levelId)) {
    return c.json<ErrorResponse>({ status: 'error', message: 'invalid levelId' }, 400);
  }

  const key = lbKey(levelId);
  const [rows, total, username] = await Promise.all([
    redis.zRange(key, 0, LEADERBOARD_SIZE - 1, { by: 'rank' }),
    redis.zCard(key),
    reddit.getCurrentUsername(),
  ]);

  const entries: LeaderboardEntry[] = rows.map((row, index) => ({
    username: row.member,
    moves: row.score,
    rank: index + 1,
  }));

  let you: LeaderboardEntry | null = null;
  if (username) {
    const [myScore, myRank] = await Promise.all([redis.zScore(key, username), redis.zRank(key, username)]);
    if (myScore !== undefined && myRank !== undefined) {
      you = { username, moves: myScore, rank: myRank + 1 };
    }
  }

  return c.json<LeaderboardResponse>({ levelId, entries, you, total });
});

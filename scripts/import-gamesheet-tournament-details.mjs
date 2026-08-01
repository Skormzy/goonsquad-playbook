import { access, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eventsPath = path.join(root, 'src', 'stats', 'tournamentEvents.json');
const outputPath = path.join(root, 'src', 'stats', 'tournamentGameDetails.json');
const chromeCandidates = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

async function findChrome() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error('Chrome or Edge is required to import public GameSheet game details.');
}

function titleCase(value) {
  const text = String(value || '').trim();
  if (!text || text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/(^|[\s'-])([a-z])/gu, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function playerName(player) {
  return [titleCase(player?.firstName), titleCase(player?.lastName)].filter(Boolean).join(' ');
}

function publicStats(stats = {}) {
  return Object.fromEntries(Object.entries(stats).filter(([, value]) => (
    typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' || value === null
  )));
}

function normalizeRoster(lineups = {}, teams = {}) {
  const roster = {};
  const byId = new Map();

  for (const [apiSide, side] of [['visitor', 'away'], ['home', 'home']]) {
    const lineup = lineups?.[apiSide] || {};
    const team = teams?.[apiSide]?.title || side;
    const goalieIds = new Set((lineup.goalies || []).map((goalie) => String(goalie.id)));
    const players = [...(lineup.players || []), ...(lineup.goalies || [])].map((player) => {
      const isGoalie = goalieIds.has(String(player.id));
      const normalized = {
        id: String(player.id),
        name: playerName(player),
        number: String(player.number ?? ''),
        position: isGoalie ? 'G' : String(player.position || ''),
        stats: publicStats(player.stats),
      };
      byId.set(String(player.id), { ...normalized, side, team });
      return normalized;
    });

    roster[side] = {
      team,
      players: players.filter((player) => player.position !== 'G'),
      goalies: players.filter((player) => player.position === 'G'),
    };
  }

  return { roster, byId };
}

function personReference(value, byId) {
  if (value === null || value === undefined || value === '') return null;
  const id = typeof value === 'object' ? value.id : value;
  const player = byId.get(String(id));
  return player
    ? { id: player.id, name: player.name, number: player.number, team: player.team, side: player.side }
    : { id: String(id), name: '', number: '', team: '', side: '' };
}

function normalizeGame(raw, eventGame) {
  const data = raw?.data || {};
  const { roster, byId } = normalizeRoster(data.lineups, data.teams);
  const goals = [];
  const penalties = [];

  for (const [apiSide, side] of [['visitor', 'away'], ['home', 'home']]) {
    const team = data.teams?.[apiSide]?.title || eventGame[`${side}Team`] || side;
    for (const goal of data.boxScore?.goals?.[apiSide] || []) {
      goals.push({
        id: String(goal.id ?? `${side}-${goal.period}-${goal.clockTime}`),
        side,
        team,
        period: String(goal.period || ''),
        clockTime: String(goal.clockTime || ''),
        scorer: personReference(goal.scorer, byId),
        assist1: personReference(goal.assist1, byId),
        assist2: personReference(goal.assist2, byId),
        goalie: personReference(goal.goalie, byId),
        powerPlay: Boolean(goal.ppg),
        shortHanded: Boolean(goal.shg),
        gameWinner: Boolean(goal.gwg),
        emptyNet: Boolean(goal.en),
      });
    }

    for (const entry of data.boxScore?.penalties?.[apiSide] || []) {
      const penalty = entry.penalty || {};
      penalties.push({
        id: `${side}-${penalty.period || ''}-${penalty.clockTime || ''}-${entry.penalized?.id || entry.penalized || penalty.code || ''}`,
        side,
        team,
        period: String(penalty.period || ''),
        clockTime: String(penalty.clockTime || ''),
        code: String(penalty.code || ''),
        label: String(penalty.label || penalty.code || 'Penalty'),
        minutes: Number(penalty.length || 0),
        duration: String(penalty.duration || ''),
        class: String(penalty.penalty_class || ''),
        major: Boolean(penalty.major),
        player: personReference(entry.penalized, byId),
        servedBy: personReference(entry.served_by, byId),
      });
    }
  }

  return {
    gameId: String(data.game?.id || eventGame.sourceGameId),
    eventGameId: eventGame.id,
    officialGameNumber: Number(data.game?.number || eventGame.officialGameNumber),
    status: String(data.game?.status || eventGame.status || ''),
    scheduledStartTime: data.game?.scheduledStartTime || '',
    location: data.game?.location || eventGame.location || '',
    sourceUrl: eventGame.sourceUrl || `https://gamesheetstats.com/seasons/14928/games/${eventGame.sourceGameId}`,
    teams: {
      away: data.teams?.visitor?.title || eventGame.awayTeam,
      home: data.teams?.home?.title || eventGame.homeTeam,
    },
    score: {
      away: data.score?.visitor || { final: eventGame.awayScore },
      home: data.score?.home || { final: eventGame.homeScore },
    },
    periods: data.game?.periods || {},
    goals,
    penalties,
    roster,
    goalieShifts: {
      away: data.boxScore?.goalieShifts?.visitor || [],
      home: data.boxScore?.goalieShifts?.home || [],
    },
    shootoutAttempts: {
      away: data.boxScore?.shootoutAttempts?.visitor || [],
      home: data.boxScore?.shootoutAttempts?.home || [],
    },
  };
}

async function fetchDetail(page, sourceGameId) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await page.evaluate(async (gameId) => {
      const response = await fetch(`/api/games/game/${gameId}/detail`, { credentials: 'include' });
      const body = await response.text();
      return { ok: response.ok, status: response.status, body };
    }, sourceGameId);

    if (result.ok) return JSON.parse(result.body);
    lastError = new Error(`Game ${sourceGameId} returned HTTP ${result.status}: ${result.body.slice(0, 180)}`);
    await page.waitForTimeout(600 * attempt);
  }
  throw lastError;
}

const eventArchive = JSON.parse(await readFile(eventsPath, 'utf8'));
const targets = Object.entries(eventArchive).flatMap(([tournamentId, archive]) => (
  (archive.eventGames || [])
    .filter((game) => game.sourceGameId)
    .map((game) => ({ tournamentId, game }))
));

if (!targets.length) throw new Error('No tournament GameSheet game IDs were found.');

const executablePath = await findChrome();
const userDataDir = path.join(os.tmpdir(), 'goonsquad-gamesheet-import-profile');
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath,
  headless: false,
  viewport: { width: 1280, height: 800 },
  args: [
    '--window-position=-32000,-32000',
    '--start-minimized',
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

const page = context.pages()[0] || await context.newPage();
const first = targets[0].game;
await page.goto(first.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForFunction(() => !document.title.toLowerCase().includes('just a moment'), null, { timeout: 90_000 });

const output = {
  _meta: {
    provider: 'GameSheet',
    importedAt: new Date().toISOString(),
    gameCount: targets.length,
  },
};

for (let index = 0; index < targets.length; index += 1) {
  const { tournamentId, game } = targets[index];
  const raw = await fetchDetail(page, game.sourceGameId);
  output[tournamentId] ||= { games: {} };
  output[tournamentId].games[game.id] = normalizeGame(raw, game);
  process.stdout.write(`Imported ${index + 1}/${targets.length}: ${game.id}\n`);
  await page.waitForTimeout(140);
}

await context.close();
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

const games = Object.values(output)
  .filter((value) => value?.games)
  .flatMap((value) => Object.values(value.games));
const goals = games.reduce((total, game) => total + game.goals.length, 0);
const penalties = games.reduce((total, game) => total + game.penalties.length, 0);
process.stdout.write(`Wrote ${games.length} games, ${goals} goals, and ${penalties} penalties to ${path.relative(root, outputPath)}.\n`);

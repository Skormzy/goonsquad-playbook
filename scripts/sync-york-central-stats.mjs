import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const SOURCE_CONFIGS = Object.freeze({
  'york-central': Object.freeze({
    key: 'york-central',
    idPrefix: 'ycbhl',
    externalIdPrefix: '',
    seasonIdPrefix: '',
    baseUrl: 'https://www.yorkcentralbhl.com',
    startTeamPath: '/team/7250-goonsquad',
    sourceName: 'York Central Ball Hockey League',
    outputFile: '../src/stats/yorkCentralSnapshot.json',
    historical: false,
  }),
  'greater-toronto': Object.freeze({
    key: 'greater-toronto',
    idPrefix: 'gtbhl',
    externalIdPrefix: 'gtbhl:',
    seasonIdPrefix: 'gtbhl-',
    baseUrl: 'https://www.greatertorontobhl.com',
    startTeamPath: '/team/3878-goonsquad',
    sourceName: 'Greater Toronto Ball Hockey League',
    outputFile: '../src/stats/greaterTorontoSnapshot.json',
    historical: true,
  }),
});
const requestedSource = process.argv.find((argument) => argument.startsWith('--source='))?.split('=')[1]
  || process.env.STATS_SOURCE;
const SOURCE_KEY = requestedSource === 'greater-toronto' ? 'greater-toronto' : 'york-central';
const SOURCE = SOURCE_CONFIGS[SOURCE_KEY];
const BASE_URL = SOURCE.baseUrl;
const START_TEAM_PATH = SOURCE.startTeamPath;
const OUTPUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  SOURCE.outputFile,
);
const SEASON_PATTERN = /^(summer|spring|winter|fall)\s+\d{4}(?:-\d{4})?\s+-\s+/i;
const SEASON_TERM_ORDER = Object.freeze({ Winter: 1, Spring: 2, Summer: 3, Fall: 4 });
const MONTHS = Object.freeze({
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
});

function clean(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function integer(value) {
  const parsed = Number.parseInt(clean(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decimal(value) {
  const parsed = Number.parseFloat(clean(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleSeason(value) {
  const normalized = clean(value).toLowerCase();
  return normalized ? `${normalized[0].toUpperCase()}${normalized.slice(1)}` : '';
}

function scheduleTeamName(value, division = '', disambiguated = false) {
  const schedule = clean(value).toUpperCase();
  const day = /\bMON(?:DAY)?\b/.test(schedule)
    ? 'Monday'
    : /\bSUN(?:DAY)?\b/.test(schedule)
      ? 'Sunday'
      : clean(value).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  const tier = clean(division).match(/\bTIER\s+([^\s(]+)/i)?.[1] ?? '';
  return `${day}${disambiguated && tier ? ` Tier ${tier}` : ''} Team`;
}

function sourceExternalId(value) {
  const id = clean(value);
  return id ? `${SOURCE.externalIdPrefix}${id}` : '';
}

function sourceEntityId(kind, value) {
  return `${SOURCE.idPrefix}-${kind}-${value}`;
}

function absoluteUrl(value) {
  return new URL(value, BASE_URL).toString();
}

async function fetchHtml(url, attempt = 1) {
  const response = await fetch(absoluteUrl(url), {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'GoonSquadPlaybookStatsSync/1.0 (team statistics archive)',
    },
  });
  if (response.ok) return response.text();
  if (attempt < 3 && response.status >= 500) {
    await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    return fetchHtml(url, attempt + 1);
  }
  throw new Error(`${SOURCE.sourceName} request failed (${response.status}) for ${absoluteUrl(url)}`);
}

function extractExternalId(value, kind) {
  const pattern = kind === 'player'
    ? /\/player\/[^/]+\/(\d+)-/
    : new RegExp(`/${kind}/(\\d+)-`);
  return clean(value).match(pattern)?.[1] ?? '';
}

function seasonYearForMonth(seasonName, month) {
  const years = seasonName.match(/\d{4}/g)?.map(Number) ?? [];
  if (years.length < 2) return years[0] ?? new Date().getFullYear();
  return month >= 7 ? years[0] : years[1];
}

function parseGameDate(dateText, timeText, seasonName) {
  const match = clean(dateText).match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\.\s+(\d{1,2})$/);
  if (!match || !MONTHS[match[1]]) return null;
  const month = MONTHS[match[1]];
  const year = seasonYearForMonth(seasonName, month);
  const timeMatch = clean(timeText).match(/^(\d{1,2}):(\d{2})\s+(am|pm)$/i);
  let hour = Number(timeMatch?.[1] ?? 12);
  const minute = Number(timeMatch?.[2] ?? 0);
  const period = timeMatch?.[3]?.toLowerCase();
  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  const pad = (value) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(Number(match[2]))}T${pad(hour)}:${pad(minute)}:00`;
}

function teamHistoryLinks(html) {
  const $ = cheerio.load(html);
  const links = [];
  $('.stats-box').each((_, element) => {
    if (clean($(element).find('.header').first().text()).toLowerCase() !== 'choose team season') return;
    $(element).find('a[href^="/team/"]').each((__, anchor) => {
      const label = clean($(anchor).text());
      const href = $(anchor).attr('href');
      if (href && SEASON_PATTERN.test(label)) links.push({ href, label });
    });
  });
  return [...new Map(links.map((link) => [link.href, link])).values()];
}

function seasonNameFromHistoryLabel(label) {
  return titleSeason(clean(label).split(/\s+-\s+/)[0]);
}

function seasonSortValue(seasonName) {
  const years = clean(seasonName).match(/\d{4}/g)?.map(Number) ?? [0];
  const term = Object.keys(SEASON_TERM_ORDER).find((name) => clean(seasonName).startsWith(name));
  return Math.max(...years) * 10 + (SEASON_TERM_ORDER[term] ?? 0);
}

function currentSeasonNameFromHistory(history) {
  const names = [...new Set(history.map((entry) => seasonNameFromHistoryLabel(entry.label)).filter(Boolean))];
  return names.sort((a, b) => seasonSortValue(b) - seasonSortValue(a))[0] ?? '';
}

function resolveTeamIdentities(entries) {
  const scheduleCounts = new Map();
  entries.forEach(({ team }) => {
    const key = `${team.seasonSlug}|${slugify(team.scheduleLabel)}`;
    scheduleCounts.set(key, (scheduleCounts.get(key) ?? 0) + 1);
  });

  const candidates = entries.map((entry) => {
    const key = `${entry.team.seasonSlug}|${slugify(entry.team.scheduleLabel)}`;
    const disambiguated = (scheduleCounts.get(key) ?? 0) > 1;
    return {
      ...entry,
      disambiguated,
      candidateId: disambiguated
        ? `${entry.team.seasonSlug}-${slugify(entry.team.division)}`
        : entry.team.id,
    };
  });

  const candidateCounts = new Map();
  candidates.forEach(({ candidateId }) => {
    candidateCounts.set(candidateId, (candidateCounts.get(candidateId) ?? 0) + 1);
  });

  return candidates.map(({ candidateId, ...entry }) => ({
    ...entry,
    team: {
      ...entry.team,
      id: (candidateCounts.get(candidateId) ?? 0) > 1
        ? `${candidateId}-${entry.team.providerExternalId}`
        : candidateId,
    },
  }));
}

function teamMetadata(teamPath, html) {
  const $ = cheerio.load(html);
  const breadcrumb = $('.breadcrumb-container li');
  const seasonName = titleSeason($(breadcrumb[0]).text());
  const division = clean($(breadcrumb[1]).text());
  const scheduleLabel = clean(division.replace(/\s+TIER\b.*$/i, ''));
  const seasonSlug = `${SOURCE.seasonIdPrefix}${slugify(seasonName)}`;
  const providerExternalId = extractExternalId(teamPath, 'team');
  return {
    externalId: sourceExternalId(providerExternalId),
    providerExternalId,
    seasonName,
    seasonSlug,
    division,
    scheduleLabel,
    id: `${seasonSlug}-${slugify(scheduleLabel)}`,
    leagueKey: SOURCE.key,
    leagueName: SOURCE.sourceName,
    sourceUrl: absoluteUrl(teamPath),
  };
}

function officialTeamSummary(teamPath, html, teamId) {
  const $ = cheerio.load(html);
  let summary = null;
  $('.stats-box.standings table tr').each((_, row) => {
    if (summary) return;
    const cells = $(row).find('td');
    const teamLink = $(cells[0]).find('a').attr('href');
    if (teamLink !== teamPath || cells.length < 6) return;
    summary = {
      seasonTeamId: teamId,
      gamesPlayed: integer($(cells[1]).text()),
      wins: integer($(cells[2]).text()),
      losses: integer($(cells[3]).text()),
      ties: integer($(cells[4]).text()),
      points: integer($(cells[5]).text()),
      sourceUrl: absoluteUrl(teamPath),
    };
  });
  return summary;
}

function divisionStandings(teamPath, html, teamId) {
  const $ = cheerio.load(html);
  const rows = [];
  $('.stats-box.standings table').first().find('tr').slice(1).each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 6) return;
    const teamLink = $(cells[0]).find('a').attr('href') || '';
    const teamName = clean($(cells[0]).text());
    if (!teamName) return;
    rows.push({
      seasonTeamId: teamId,
      rank: rows.length + 1,
      teamName,
      teamExternalId: extractExternalId(teamLink, 'team') || null,
      gamesPlayed: integer($(cells[1]).text()),
      wins: integer($(cells[2]).text()),
      losses: integer($(cells[3]).text()),
      ties: integer($(cells[4]).text()),
      points: integer($(cells[5]).text()),
      isGoonSquad: teamLink === teamPath,
      sourceUrl: teamLink ? absoluteUrl(teamLink) : absoluteUrl(teamPath),
    });
  });
  return rows;
}

function parseSchedule(teamPath, teamId, seasonName, html, stage = 'regular') {
  const $ = cheerio.load(html);
  const games = [];
  $('table.statistic').each((_, table) => {
    const headers = $(table).find('tr').first().find('th').map((__, cell) => clean($(cell).text())).get();
    if (!headers.includes('Home team') || !headers.includes('Away team')) return;
    $(table).find('tr').slice(1).each((__, row) => {
      const dates = $(row).find('td.date').map((___, cell) => clean($(cell).text())).get();
      const teams = $(row).find('td.team');
      const scores = $(row).find('td.score').map((___, cell) => clean($(cell).text())).get();
      if (dates.length < 2 || teams.length < 2 || scores.length < 2) return;
      const homeHref = $(teams[0]).find('a').attr('href');
      const awayHref = $(teams[1]).find('a').attr('href');
      const homeName = clean($(teams[0]).text());
      const awayName = clean($(teams[1]).text());
      const isHome = homeHref === teamPath;
      const gameHref = $(row).find('td.anchor a[href^="/game/"]').attr('href') ?? '';
      const externalId = extractExternalId(gameHref, 'game');
      const homeScore = Number.parseInt(scores[0], 10);
      const awayScore = Number.parseInt(scores[1], 10);
      const isFinal = Number.isFinite(homeScore) && Number.isFinite(awayScore);
      const leagueStatus = clean($(row).find('td.status').text());
      games.push({
        id: externalId ? sourceEntityId('game', externalId) : `${teamId}-${slugify(`${dates[0]}-${homeName}-${awayName}`)}`,
        externalId: sourceExternalId(externalId) || null,
        seasonTeamId: teamId,
        stage,
        scheduledAt: parseGameDate(dates[0], dates[1], seasonName),
        opponent: isHome ? awayName : homeName,
        venue: isHome ? 'home' : 'away',
        location: clean($(row).find('td.location').text()),
        status: isFinal ? 'final' : 'scheduled',
        goalsFor: isFinal ? (isHome ? homeScore : awayScore) : null,
        goalsAgainst: isFinal ? (isHome ? awayScore : homeScore) : null,
        overtime: /\bOT\b/i.test(leagueStatus),
        notes: leagueStatus ? `League status: ${leagueStatus}` : '',
        sourceUrl: gameHref ? absoluteUrl(gameHref) : absoluteUrl(`/schedule/team/${teamPath.split('/')[2]}`),
        source: 'league',
        persisted: false,
        verified: true,
      });
    });
  });
  return games;
}

function tableHeaders($, table) {
  return $(table).find('tr').first().find('th').map((_, cell) => clean($(cell).text()).toUpperCase()).get();
}

function playerIdentity($, row) {
  const anchor = $(row).find('td.player a').first();
  const href = anchor.attr('href') ?? '';
  const externalId = extractExternalId(href, 'player');
  return {
    id: externalId ? sourceEntityId('player', externalId) : sourceEntityId('player', slugify(anchor.text())),
    externalId: sourceExternalId(externalId) || null,
    displayName: clean(anchor.clone().find('.not-on-roster').remove().end().text()),
    active: $(anchor).find('.not-on-roster').length === 0,
    sourceUrl: href ? absoluteUrl(href) : null,
  };
}

function rowValues($, row, headers) {
  const values = $(row).find('td.item').map((_, cell) => clean($(cell).text())).get();
  return Object.fromEntries(headers.slice(1).map((header, index) => [header, values[index]]));
}

function parsePlayerLeaders(teamId, html, stage = 'regular') {
  const $ = cheerio.load(html);
  const players = [];
  const lines = [];
  $('table.statistic').each((_, table) => {
    const headers = tableHeaders($, table);
    if (headers[0] !== 'PLAYER' || !headers.includes('PTS') || !headers.includes('PIM')) return;
    $(table).find('tr').slice(1).each((__, row) => {
      const player = playerIdentity($, row);
      if (!player.displayName) return;
      const values = rowValues($, row, headers);
      players.push({ ...player, primaryPosition: null, persisted: false });
      lines.push({
        id: `${teamId}-${stage}-${player.id}-field`,
        seasonTeamId: teamId,
        stage,
        playerId: player.id,
        gamesPlayed: integer(values.GP),
        goals: integer(values.G),
        assists: integer(values.A),
        points: integer(values.PTS),
        penaltyMinutes: integer(values.PIM),
        powerPlayGoals: integer(values.PPG),
        shortHandedGoals: integer(values.SHG),
        emptyNetGoals: integer(values.ENG),
        source: 'league',
      });
    });
  });
  return { players, lines };
}

function parseGoalieLeaders(teamId, html, stage = 'regular') {
  const $ = cheerio.load(html);
  const players = [];
  const lines = [];
  $('table.statistic').each((_, table) => {
    const headers = tableHeaders($, table);
    if (headers[0] !== 'PLAYER' || !headers.includes('SV%') || !headers.includes('GAA')) return;
    $(table).find('tr').slice(1).each((__, row) => {
      const player = playerIdentity($, row);
      if (!player.displayName) return;
      const values = rowValues($, row, headers);
      players.push({ ...player, primaryPosition: 'G', persisted: false });
      lines.push({
        id: `${teamId}-${stage}-${player.id}-goalie`,
        seasonTeamId: teamId,
        stage,
        playerId: player.id,
        gamesPlayed: integer(values.GP),
        wins: integer(values.W),
        losses: integer(values.L),
        ties: integer(values.T),
        shutouts: integer(values.SO),
        shotsAgainst: integer(values.SA),
        goalsAgainst: integer(values.GA),
        minutesPlayed: decimal(values.MIN),
        goalsAgainstAverage: decimal(values.GAA),
        savePercentage: decimal(values['SV%']),
        goals: integer(values.G),
        assists: integer(values.A),
        penaltyMinutes: integer(values.PIM),
        source: 'league',
      });
    });
  });
  return { players, lines };
}

function parseRoster(teamId, html) {
  const $ = cheerio.load(html);
  const players = [];
  const memberships = [];
  $('.table-responsive.roster table tr').slice(1).each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2 || $(cells[0]).attr('colspan')) return;
    const anchor = $(cells[0]).find('a').first();
    const href = anchor.attr('href') ?? '';
    const externalId = extractExternalId(href, 'player');
    const displayName = clean(anchor.text());
    if (!displayName) return;
    const playerId = externalId ? sourceEntityId('player', externalId) : sourceEntityId('player', slugify(displayName));
    const active = clean($(cells[1]).text()).toUpperCase() === 'YES';
    players.push({
      id: playerId,
      externalId: sourceExternalId(externalId) || null,
      displayName,
      primaryPosition: null,
      active,
      sourceUrl: href ? absoluteUrl(href) : null,
      persisted: false,
    });
    memberships.push({
      id: `${teamId}-${playerId}`,
      seasonTeamId: teamId,
      playerId,
      jerseyNumber: null,
      position: null,
      active,
      notes: clean($(cells[2]).text()),
      persisted: false,
    });
  });
  return { players, memberships };
}

function clockSeconds(value) {
  const match = clean(value).match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function gamePlayer($, anchor, teamExternalId) {
  const href = $(anchor).attr('href') ?? '';
  const externalId = extractExternalId(href, 'player');
  const isUs = href.includes(`/player/${teamExternalId}-goonsquad/`);
  return {
    isUs,
    player: isUs && externalId ? {
      id: sourceEntityId('player', externalId),
      externalId: sourceExternalId(externalId),
      displayName: clean($(anchor).attr('title') || $(anchor).text()),
      primaryPosition: null,
      active: false,
      sourceUrl: absoluteUrl(href),
      persisted: false,
    } : null,
    displayName: clean($(anchor).attr('title') || $(anchor).text()),
  };
}

function parseGameDetails(game, team, html) {
  const $ = cheerio.load(html);
  const players = [];
  const playerGameStats = [];
  const goalieGameStats = [];
  const allGoalieLines = [];
  const gameEvents = [];

  $('.stats-box.player-summary table').each((_, table) => {
    const headerRow = $(table).find('tr').filter((__, row) => $(row).find('th').length > 0).first();
    const headers = headerRow.find('th').map((__, cell) => clean($(cell).text()).toUpperCase()).get();
    const isGoalieTable = headers.includes('SA') && headers.includes('SV%');
    $(table).find('tr').each((__, row) => {
      const anchor = $(row).find('td.team a[href^="/player/"]').first();
      if (!anchor.length) return;
      const identity = gamePlayer($, anchor, team.providerExternalId);
      const values = $(row).find('td.item').map((___, cell) => clean($(cell).text())).get();
      const byHeader = Object.fromEntries(headers.slice(1).map((header, index) => [header, values[index]]));
      if (isGoalieTable) {
        const goalieLine = {
          player: identity.player,
          isUs: identity.isUs,
          shotsAgainst: integer(byHeader.SA),
          goalsAgainst: integer(byHeader.GA),
          minutesPlayed: decimal(byHeader.MIN),
          savePercentage: decimal(byHeader['SV%']),
          assists: integer(byHeader.A),
          penaltyMinutes: integer(byHeader.PIM),
        };
        allGoalieLines.push(goalieLine);
        if (!identity.isUs || !identity.player) return;
        players.push({ ...identity.player, primaryPosition: 'G' });
        goalieGameStats.push({
          id: `${game.id}-${identity.player.id}-goalie`,
          gameId: game.id,
          playerId: identity.player.id,
          gamesPlayed: 1,
          wins: game.goalsFor > game.goalsAgainst ? 1 : 0,
          losses: game.goalsFor < game.goalsAgainst ? 1 : 0,
          ties: game.goalsFor === game.goalsAgainst ? 1 : 0,
          goalsAgainst: goalieLine.goalsAgainst,
          shotsAgainst: goalieLine.shotsAgainst,
          saves: Math.max(0, goalieLine.shotsAgainst - goalieLine.goalsAgainst),
          shutouts: goalieLine.goalsAgainst === 0 ? 1 : 0,
          minutesPlayed: goalieLine.minutesPlayed,
          source: 'league',
        });
        return;
      }
      if (!identity.isUs || !identity.player || !headers.includes('PTS')) return;
      players.push(identity.player);
      playerGameStats.push({
        id: `${game.id}-${identity.player.id}-field`,
        gameId: game.id,
        playerId: identity.player.id,
        gamesPlayed: 1,
        goals: integer(byHeader.G),
        assists: integer(byHeader.A),
        shots: null,
        penaltyMinutes: integer(byHeader.PIM),
        plusMinus: null,
        blocks: null,
        takeaways: null,
        turnovers: null,
        powerPlayGoals: integer(byHeader.PPG),
        shortHandedGoals: integer(byHeader.SHG),
        emptyNetGoals: integer(byHeader.ENG),
        source: 'league',
      });
    });
  });

  let period = 1;
  $('.stats-box.scoring-summary table tr').each((index, row) => {
    const periodText = clean($(row).find('td.period').text());
    if (periodText) {
      period = integer(periodText) || period;
      return;
    }
    const time = clean($(row).find('td.time').text());
    const scorerAnchor = $(row).find('td.player a[href^="/player/"]').first();
    if (!time || !scorerAnchor.length) return;
    const teamHref = $(row).find('td.team a').attr('href') ?? '';
    const scorer = gamePlayer($, scorerAnchor, team.providerExternalId);
    if (scorer.player) players.push(scorer.player);
    const assistPlayers = $(row).find('td.assisted a[href^="/player/"]').map((__, anchor) => {
      const identity = gamePlayer($, anchor, team.providerExternalId);
      if (identity.player) players.push(identity.player);
      return identity;
    }).get();
    const score = $(row).find('td.score').map((__, cell) => integer($(cell).text())).get();
    gameEvents.push({
      id: `${game.id}-goal-${period}-${clockSeconds(time) ?? index}-${index}`,
      gameId: game.id,
      period,
      clockSeconds: clockSeconds(time),
      eventType: 'goal',
      teamSide: teamHref.includes(`/team/${team.providerExternalId}-goonsquad`) ? 'us' : 'opponent',
      primaryPlayerId: scorer.player?.id ?? null,
      secondaryPlayerId: assistPlayers.find((identity) => identity.player)?.player?.id ?? null,
      detail: {
        scorer: scorer.displayName,
        assists: assistPlayers.map((identity) => identity.displayName),
        strength: clean($(row).find('td.type').text()),
        score,
      },
      source: 'league',
    });
  });

  period = 1;
  $('.stats-box.penalty-summary table tr').each((index, row) => {
    const periodText = clean($(row).find('td.period').text());
    if (periodText) {
      period = integer(periodText) || period;
      return;
    }
    const time = clean($(row).find('td.time').text());
    const playerAnchor = $(row).find('td.player a[href^="/player/"]').first();
    if (!time || !playerAnchor.length) return;
    const teamHref = $(row).find('td.team a').attr('href') ?? '';
    const penalized = gamePlayer($, playerAnchor, team.providerExternalId);
    if (penalized.player) players.push(penalized.player);
    gameEvents.push({
      id: `${game.id}-penalty-${period}-${clockSeconds(time) ?? index}-${index}`,
      gameId: game.id,
      period,
      clockSeconds: clockSeconds(time),
      eventType: 'penalty',
      teamSide: teamHref.includes(`/team/${team.providerExternalId}-goonsquad`) ? 'us' : 'opponent',
      primaryPlayerId: penalized.player?.id ?? null,
      secondaryPlayerId: null,
      detail: {
        player: penalized.displayName,
        minutes: integer($(row).find('td.minutes').text()),
        penalty: clean($(row).find('td.type').text()),
      },
      source: 'league',
    });
  });

  const shotsAgainst = allGoalieLines.filter((line) => line.isUs).reduce((total, line) => total + line.shotsAgainst, 0);
  const shotsFor = allGoalieLines.filter((line) => !line.isUs).reduce((total, line) => total + line.shotsAgainst, 0);
  return {
    players,
    playerGameStats,
    goalieGameStats,
    gameEvents,
    teamGameStat: allGoalieLines.length ? {
      gameId: game.id,
      shotsFor,
      shotsAgainst,
      powerPlayGoals: null,
      powerPlayOpportunities: null,
      penaltyKillGoalsAgainst: null,
      timesShorthanded: null,
      faceoffWins: null,
      faceoffAttempts: null,
      blocks: null,
      takeaways: null,
      turnovers: null,
      source: 'league',
    } : null,
  };
}

async function mapWithConcurrency(items, limit, operation) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await operation(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function mergePlayers(target, incoming) {
  incoming.forEach((player) => {
    const current = target.get(player.id);
    target.set(player.id, {
      ...current,
      ...player,
      primaryPosition: current?.primaryPosition === 'G' || player.primaryPosition === 'G' ? 'G' : null,
      active: Boolean(current?.active || player.active),
    });
  });
}

function recordFromGames(games) {
  return games.filter((game) => game.status === 'final').reduce((record, game) => {
    record.gamesPlayed += 1;
    if (game.goalsFor > game.goalsAgainst) record.wins += 1;
    else if (game.goalsFor < game.goalsAgainst) record.losses += 1;
    else record.ties += 1;
    return record;
  }, { gamesPlayed: 0, wins: 0, losses: 0, ties: 0 });
}

function auditSnapshot(dataset) {
  const warnings = [];
  const teamIds = new Set(dataset.teams.map((team) => team.id));
  const playerIds = new Set(dataset.players.map((player) => player.id));
  const duplicateTeamIds = dataset.teams.map((team) => team.id).filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateTeamIds.length) warnings.push(`Duplicate team IDs: ${[...new Set(duplicateTeamIds)].join(', ')}`);
  const duplicateGameIds = dataset.games.map((game) => game.id).filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateGameIds.length) warnings.push(`Duplicate game IDs: ${[...new Set(duplicateGameIds)].join(', ')}`);
  dataset.teams.forEach((team) => {
    const official = dataset.teamSeasonSummaries.find((summary) => summary.seasonTeamId === team.id);
    const calculated = recordFromGames(dataset.games.filter((game) => game.seasonTeamId === team.id && game.stage === 'regular'));
    if (!official) warnings.push(`${team.id} has no standings summary.`);
    else if (['gamesPlayed', 'wins', 'losses', 'ties'].some((key) => official[key] !== calculated[key])) {
      warnings.push(`${team.id} schedule record ${calculated.gamesPlayed}-${calculated.wins}-${calculated.losses}-${calculated.ties} does not match standings ${official.gamesPlayed}-${official.wins}-${official.losses}-${official.ties}.`);
    }
  });
  dataset.games.forEach((game) => {
    if (!teamIds.has(game.seasonTeamId)) warnings.push(`Game ${game.id} references a missing team.`);
  });
  [...dataset.playerSeasonStats, ...dataset.goalieSeasonStats].forEach((line) => {
    if (!teamIds.has(line.seasonTeamId)) warnings.push(`Stat line ${line.id} references a missing team.`);
    if (!playerIds.has(line.playerId)) warnings.push(`Stat line ${line.id} references a missing player.`);
  });
  return warnings;
}

async function readExistingSnapshot() {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function sameFinalGame(previous, current) {
  return previous?.status === 'final'
    && current.status === 'final'
    && previous.goalsFor === current.goalsFor
    && previous.goalsAgainst === current.goalsAgainst
    && Boolean(previous.overtime) === Boolean(current.overtime);
}

function mergeCurrentSeasonSnapshot(existing, current) {
  if (!existing) return current;
  const currentSeasonIds = new Set(current.seasons.map((season) => season.id));
  const previousTeamIds = new Set(
    existing.teams
      .filter((team) => currentSeasonIds.has(team.seasonId))
      .map((team) => team.id),
  );
  const currentTeamIds = new Set(current.teams.map((team) => team.id));
  const replacedTeamIds = new Set([...previousTeamIds, ...currentTeamIds]);
  const replacedGameIds = new Set(
    existing.games
      .filter((game) => replacedTeamIds.has(game.seasonTeamId))
      .map((game) => game.id),
  );
  current.games.forEach((game) => replacedGameIds.add(game.id));
  const replaceTeamRows = (rows, additions) => [
    ...additions,
    ...rows.filter((row) => !replacedTeamIds.has(row.seasonTeamId)),
  ];
  const replaceGameRows = (rows = [], additions = []) => [
    ...additions,
    ...rows.filter((row) => !replacedGameIds.has(row.gameId ?? row.game_id)),
  ];
  const players = new Map(existing.players.map((player) => [player.id, player]));
  current.players.forEach((player) => players.set(player.id, player));
  const merged = {
    ...existing,
    source: current.source,
    sourceName: current.sourceName,
    sourceUrl: current.sourceUrl,
    capturedAt: current.capturedAt,
    seasons: [
      ...current.seasons,
      ...existing.seasons
        .filter((season) => !currentSeasonIds.has(season.id))
        .map((season) => season.current ? { ...season, current: false, status: 'complete' } : season),
    ],
    teams: [
      ...current.teams,
      ...existing.teams.filter((team) => !currentSeasonIds.has(team.seasonId)),
    ],
    players: [...players.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    memberships: replaceTeamRows(existing.memberships, current.memberships),
    games: replaceTeamRows(existing.games, current.games),
    teamGameStats: replaceGameRows(existing.teamGameStats, current.teamGameStats),
    playerGameStats: replaceGameRows(existing.playerGameStats, current.playerGameStats),
    goalieGameStats: replaceGameRows(existing.goalieGameStats, current.goalieGameStats),
    gameEvents: replaceGameRows(existing.gameEvents, current.gameEvents),
    teamSeasonSummaries: replaceTeamRows(existing.teamSeasonSummaries, current.teamSeasonSummaries),
    standings: replaceTeamRows(existing.standings || [], current.standings || []),
    playerSeasonStats: replaceTeamRows(existing.playerSeasonStats, current.playerSeasonStats),
    goalieSeasonStats: replaceTeamRows(existing.goalieSeasonStats, current.goalieSeasonStats),
  };
  const finalGameIds = new Set(
    merged.games
      .filter((game) => game.status === 'final' && game.sourceUrl)
      .map((game) => game.id),
  );
  merged.detailImport = {
    requestedGames: finalGameIds.size,
    importedGames: finalGameIds.size - (current.detailImport?.errors?.length ?? 0),
    errors: current.detailImport?.errors ?? [],
  };
  return merged;
}

function comparableSnapshot(snapshot) {
  if (!snapshot) return '';
  const copy = { ...snapshot };
  delete copy.capturedAt;
  return JSON.stringify(copy);
}

async function buildSnapshot({ scope = 'all', existingSnapshot = null } = {}) {
  const startHtml = await fetchHtml(START_TEAM_PATH);
  const fullHistory = teamHistoryLinks(startHtml);
  if (!fullHistory.length) throw new Error('No Goonsquad team history links were found. The league page structure may have changed.');
  const currentSeasonName = currentSeasonNameFromHistory(fullHistory);
  const history = scope === 'current'
    ? fullHistory.filter((entry) => seasonNameFromHistoryLabel(entry.label) === currentSeasonName)
    : fullHistory;
  if (!history.length) throw new Error(`No ${currentSeasonName} Goonsquad schedules were found.`);

  const teamEntries = resolveTeamIdentities(await mapWithConcurrency(history, 6, async (entry) => {
    const teamHtml = entry.href === START_TEAM_PATH ? startHtml : await fetchHtml(entry.href);
    return { entry, teamHtml, team: teamMetadata(entry.href, teamHtml) };
  }));

  const seasons = new Map();
  const teams = [];
  const players = new Map();
  const memberships = [];
  const games = [];
  const teamSeasonSummaries = [];
  const playerSeasonStats = [];
  const goalieSeasonStats = [];
  const teamGameStats = [];
  const playerGameStats = [];
  const goalieGameStats = [];
  const gameEvents = [];
  const standings = [];

  for (const { entry, teamHtml, team, disambiguated } of teamEntries) {
    const [regularScheduleHtml, playoffScheduleHtml, regularPlayersHtml, playoffPlayersHtml, regularGoaliesHtml, playoffGoaliesHtml, rosterHtml] = await Promise.all([
      fetchHtml(`/schedule/team/${team.providerExternalId}-goonsquad?id_stage=1&id_filter=1`),
      fetchHtml(`/schedule/team/${team.providerExternalId}-goonsquad?id_stage=2&id_filter=1`),
      fetchHtml(`/leaders/players/team/${team.providerExternalId}-goonsquad?id_stage=1`),
      fetchHtml(`/leaders/players/team/${team.providerExternalId}-goonsquad?id_stage=2`),
      fetchHtml(`/leaders/goalies/team/${team.providerExternalId}-goonsquad?id_stage=1`),
      fetchHtml(`/leaders/goalies/team/${team.providerExternalId}-goonsquad?id_stage=2`),
      fetchHtml(`/roster/${team.providerExternalId}-goonsquad`),
    ]);
    const regularPlayerLeaders = parsePlayerLeaders(team.id, regularPlayersHtml, 'regular');
    const playoffPlayerLeaders = parsePlayerLeaders(team.id, playoffPlayersHtml, 'playoffs');
    const regularGoalieLeaders = parseGoalieLeaders(team.id, regularGoaliesHtml, 'regular');
    const playoffGoalieLeaders = parseGoalieLeaders(team.id, playoffGoaliesHtml, 'playoffs');
    const roster = parseRoster(team.id, rosterHtml);
    mergePlayers(players, regularPlayerLeaders.players);
    mergePlayers(players, playoffPlayerLeaders.players);
    mergePlayers(players, regularGoalieLeaders.players);
    mergePlayers(players, playoffGoalieLeaders.players);
    mergePlayers(players, roster.players);
    memberships.push(...roster.memberships);
    games.push(
      ...parseSchedule(entry.href, team.id, team.seasonName, regularScheduleHtml, 'regular'),
      ...parseSchedule(entry.href, team.id, team.seasonName, playoffScheduleHtml, 'playoffs'),
    );
    playerSeasonStats.push(...regularPlayerLeaders.lines, ...playoffPlayerLeaders.lines);
    goalieSeasonStats.push(...regularGoalieLeaders.lines, ...playoffGoalieLeaders.lines);
    const summary = officialTeamSummary(entry.href, teamHtml, team.id);
    if (summary) teamSeasonSummaries.push(summary);
    standings.push(...divisionStandings(entry.href, teamHtml, team.id));
    seasons.set(team.seasonSlug, {
      id: team.seasonSlug,
      slug: team.seasonSlug,
      name: team.seasonName,
      startDate: null,
      endDate: null,
      status: !SOURCE.historical && team.seasonName === currentSeasonName ? 'active' : 'complete',
      current: !SOURCE.historical && team.seasonName === currentSeasonName,
      leagueKey: team.leagueKey,
      leagueName: team.leagueName,
      sourceUrl: team.sourceUrl,
    });
    teams.push({
      id: team.id,
      externalId: team.externalId,
      providerExternalId: team.providerExternalId,
      seasonId: team.seasonSlug,
      name: scheduleTeamName(team.scheduleLabel, team.division, disambiguated),
      scheduleLabel: team.scheduleLabel,
      division: team.division,
      leagueKey: team.leagueKey,
      leagueName: team.leagueName,
      sourceUrl: team.sourceUrl,
    });
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const finalGames = games.filter((game) => game.status === 'final' && game.sourceUrl);
  const existingGames = new Map((existingSnapshot?.games || []).map((game) => [game.id, game]));
  const reusableGameIds = new Set(
    finalGames
      .filter((game) => sameFinalGame(existingGames.get(game.id), game))
      .map((game) => game.id),
  );
  const reuseRows = (rows = []) => rows.filter((row) => reusableGameIds.has(row.gameId ?? row.game_id));
  teamGameStats.push(...reuseRows(existingSnapshot?.teamGameStats));
  playerGameStats.push(...reuseRows(existingSnapshot?.playerGameStats));
  goalieGameStats.push(...reuseRows(existingSnapshot?.goalieGameStats));
  gameEvents.push(...reuseRows(existingSnapshot?.gameEvents));
  const gamesNeedingDetails = finalGames.filter((game) => !reusableGameIds.has(game.id));
  const detailErrors = [];
  const details = await mapWithConcurrency(gamesNeedingDetails, 6, async (game) => {
    try {
      return parseGameDetails(game, teamById.get(game.seasonTeamId), await fetchHtml(game.sourceUrl));
    } catch (error) {
      detailErrors.push(`${game.id}: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  });
  details.filter(Boolean).forEach((detail) => {
    mergePlayers(players, detail.players);
    if (detail.teamGameStat) teamGameStats.push(detail.teamGameStat);
    playerGameStats.push(...detail.playerGameStats);
    goalieGameStats.push(...detail.goalieGameStats);
    gameEvents.push(...detail.gameEvents);
  });

  const dataset = {
    source: 'league-snapshot',
    sourceKey: SOURCE.key,
    sourceName: SOURCE.sourceName,
    sourceUrl: absoluteUrl(START_TEAM_PATH),
    capturedAt: new Date().toISOString(),
    seasons: [...seasons.values()],
    teams,
    players: [...players.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    memberships,
    games,
    teamGameStats,
    playerGameStats,
    goalieGameStats,
    gameEvents,
    teamSeasonSummaries,
    standings,
    playerSeasonStats,
    goalieSeasonStats,
    detailImport: {
      requestedGames: finalGames.length,
      importedGames: reusableGameIds.size + details.filter(Boolean).length,
      errors: detailErrors,
    },
  };
  const warnings = auditSnapshot(dataset);
  if (warnings.length) throw new Error(`Official statistics audit failed:\n- ${warnings.join('\n- ')}`);
  return dataset;
}

async function main() {
  const scope = process.env.STATS_SYNC_SCOPE === 'current' ? 'current' : 'all';
  const existingSnapshot = await readExistingSnapshot();
  const captured = await buildSnapshot({ scope, existingSnapshot });
  const snapshot = scope === 'current'
    ? mergeCurrentSeasonSnapshot(existingSnapshot, captured)
    : captured;
  const warnings = auditSnapshot(snapshot);
  if (warnings.length) throw new Error(`Merged statistics audit failed:\n- ${warnings.join('\n- ')}`);
  if (comparableSnapshot(existingSnapshot) === comparableSnapshot(snapshot)) {
    process.stdout.write(`Official ${scope === 'current' ? 'active-season' : 'archive'} statistics are unchanged.\n`);
    process.stdout.write(`Verified source: ${snapshot.sourceUrl}\n`);
    return;
  }
  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `Captured ${snapshot.seasons.length} seasons, ${snapshot.teams.length} teams, ${snapshot.games.length} games, ${snapshot.players.length} players, ${snapshot.playerSeasonStats.length} field-player lines, and ${snapshot.goalieSeasonStats.length} goaltender lines.\n`,
  );
  process.stdout.write(`Verified source: ${snapshot.sourceUrl}\n`);
  process.stdout.write(`Wrote ${OUTPUT_PATH}\n`);
}

export {
  auditSnapshot,
  buildSnapshot,
  currentSeasonNameFromHistory,
  mergeCurrentSeasonSnapshot,
  parseGameDate,
  parseGameDetails,
  divisionStandings,
  parseGoalieLeaders,
  parsePlayerLeaders,
  parseRoster,
  parseSchedule,
  resolveTeamIdentities,
  teamHistoryLinks,
  teamMetadata,
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  });
}

-- Add official roster publication state and roster-fingerprint research to the
-- private 2026 Mississauga tournament intelligence workspace.

update public.tournament_opponent_intelligence
set
  payload = payload || $json$
  {
    "summary": "Cambridge has an official tournament team page, but its Roster tab currently contains no published players. The regional Cambridge men's league remains the best matching pool once those names appear.",
    "identity": {
      "status": "roster-pending",
      "confidence": "high",
      "label": "Official roster not published yet",
      "note": "The team entry is confirmed. Player identity remains open because the official tournament roster is blank as of Aug 4, 2026."
    },
    "rosterStatus": {
      "status": "not-published",
      "publishedPlayers": 0,
      "lastChecked": "Aug 4, 2026",
      "officialTeamUrl": "https://gamesheetstats.com/seasons/14932/teams/531554",
      "note": "GameSheet publishes the Cambridge team page and its games, but no player names are present on the Roster tab yet."
    },
    "regionalSearch": {
      "status": "awaiting-fingerprint",
      "league": "Cambridge Men's Ball Hockey League",
      "region": "Cambridge, Ontario",
      "sourceUrl": "https://www.cmbhl.ca/",
      "note": "This is the official regional qualification path for Cambridge men's teams. The current tournament roster must be published before names can be compared without guessing.",
      "candidates": ["Cambridge Men's REC field", "2025 Cambridge Hitmen", "2024 Cambridge Thunder"]
    },
    "facts": [
      { "label": "Pool", "value": "Pool B" },
      { "label": "Official roster", "value": "0 players published" },
      { "label": "Regional matching pool", "value": "CMBHL men's teams" }
    ],
    "players": [],
    "questions": [
      "Recheck the official Roster tab before the Aug 21 opener.",
      "When names appear, compare the full list against CMBHL records rather than matching one player at a time.",
      "Use jersey numbers as a second identifier when common names overlap."
    ],
    "sources": [
      {
        "label": "Official Cambridge tournament team page",
        "url": "https://gamesheetstats.com/seasons/14932/teams/531554",
        "scope": "Official games and roster publication status"
      },
      {
        "label": "Cambridge Men's Ball Hockey League",
        "url": "https://www.cmbhl.ca/",
        "scope": "Regional league and provincial qualification context"
      }
    ]
  }
  $json$::jsonb,
  updated_at = now()
where tournament_id = '2026-mississauga-provincials'
  and team_id = 'cambridge';

update public.tournament_opponent_intelligence
set
  payload = payload || $json$
  {
    "summary": "Sudbury Silly Gooses has an official tournament team page, but its Roster tab currently contains no published players. Greater Sudbury's public league database gives us a strong regional comparison set as soon as the event names appear.",
    "identity": {
      "status": "roster-pending",
      "confidence": "high",
      "label": "Official roster not published yet",
      "note": "The tournament entry is confirmed. No individual should be attached to it until the blank official roster is populated."
    },
    "rosterStatus": {
      "status": "not-published",
      "publishedPlayers": 0,
      "lastChecked": "Aug 4, 2026",
      "officialTeamUrl": "https://gamesheetstats.com/seasons/14932/teams/531555",
      "note": "GameSheet publishes the Sudbury team page and schedule, but no player names are present on the Roster tab yet."
    },
    "regionalSearch": {
      "status": "candidate-pool-only",
      "league": "Greater Sudbury Ball Hockey League",
      "region": "Greater Sudbury, Ontario",
      "sourceUrl": "https://www.gsbhl.com/stats.php",
      "note": "The current GSBHL publishes team rosters and player statistics. These teams are a searchable candidate pool, not an attribution to Silly Gooses until several tournament names overlap.",
      "candidates": ["Ball Hogs", "Zambronis", "Flying Elbows", "Tundra", "Knuckle Ducks", "Misfits", "Mighty Red Ducks", "Bandits", "Hog Suckers", "Bulls"]
    },
    "facts": [
      { "label": "Pool", "value": "Pool B" },
      { "label": "Official roster", "value": "0 players published" },
      { "label": "Regional database", "value": "10 current GSBHL teams" }
    ],
    "history": [],
    "players": [],
    "questions": [
      "Recheck the official Roster tab before the Aug 21 game.",
      "Compare the complete event list against GSBHL team rosters and statistics once names are available.",
      "Require several matching players plus jersey or position evidence before connecting a regional team."
    ],
    "sources": [
      {
        "label": "Official Sudbury tournament team page",
        "url": "https://gamesheetstats.com/seasons/14932/teams/531555",
        "scope": "Official games and roster publication status"
      },
      {
        "label": "Greater Sudbury Ball Hockey League teams",
        "url": "https://www.gsbhl.com/teams.php",
        "scope": "Current regional team and roster comparison pool"
      },
      {
        "label": "Greater Sudbury player statistics",
        "url": "https://www.gsbhl.com/stats.php",
        "scope": "Current regional player-name and production database"
      }
    ]
  }
  $json$::jsonb,
  updated_at = now()
where tournament_id = '2026-mississauga-provincials'
  and team_id = 'sudbury-silly-gooses';

update public.tournament_opponent_intelligence
set
  payload = payload || $json$
  {
    "headline": "Pool C · complete roster fingerprint",
    "summary": "All 17 players on Mitt Magicians' official tournament roster align with the active Hamilton Ball Hockey League E2 roster through exact names or clear name variants, with matching jersey numbers providing a second identifier.",
    "identity": {
      "status": "roster-confirmed",
      "confidence": "high",
      "label": "17 of 17 roster match",
      "note": "This is a multi-player roster fingerprint, not a single-name inference. Six spelling variants are backed by matching jersey numbers and the remaining 11 names match directly."
    },
    "rosterStatus": {
      "status": "published",
      "publishedPlayers": 17,
      "lastChecked": "Aug 4, 2026",
      "officialTeamUrl": "https://gamesheetstats.com/seasons/14932/teams/531558",
      "note": "The official GameSheet team page publishes a 17-player tournament roster."
    },
    "rosterMatch": {
      "status": "confirmed",
      "label": "Complete Hamilton roster overlap",
      "matchedTeam": "Mitt Magicians",
      "league": "Hamilton Ball Hockey League",
      "division": "E2",
      "season": "2026 Spring / Summer",
      "overlap": 17,
      "total": 17,
      "record": "12-0-0",
      "standing": "1st",
      "goalDifference": "+58",
      "goalsFor": 78,
      "goalsAgainst": 20,
      "streak": "W12",
      "sourceUrl": "https://www.ballhockeyhamilton.com/hamiltonballhockeyleague1/STATS",
      "note": "The tournament roster matches 17 active Hamilton entries. The Hamilton team was 12-0 with 78 goals for and 20 against when checked on Aug 4, 2026."
    },
    "facts": [
      { "label": "Pool", "value": "Pool C" },
      { "label": "Roster overlap", "value": "17 of 17" },
      { "label": "Hamilton record", "value": "12-0-0 · +58" }
    ],
    "history": [
      {
        "season": "2026 Hamilton Ball Hockey League · Spring / Summer",
        "team": "Mitt Magicians · E2",
        "record": "12-0-0 · 78 GF · 20 GA",
        "result": "1st · W12",
        "relationship": "17 of 17 tournament players matched",
        "note": "Every official tournament player appears on the active Hamilton roster under an exact name or a jersey-backed spelling variant."
      }
    ],
    "players": [
      { "eventName": "Robby Bandini", "leagueName": "Robby Lo Voi-Bandini", "number": "27", "position": "D", "team": "Mitt Magicians", "gp": 10, "goals": 0, "assists": 4, "points": 4, "pim": 2, "match": "normalized" },
      { "eventName": "Shawn Blaylock", "leagueName": "Shawn Blaylock", "number": "8", "position": "C", "team": "Mitt Magicians", "gp": 9, "goals": 1, "assists": 3, "points": 4, "pim": 4, "match": "exact" },
      { "eventName": "Lucas Ciccarelli", "leagueName": "Lucas Ciccarelli", "number": "87", "position": "F", "team": "Mitt Magicians", "gp": 7, "goals": 4, "assists": 2, "points": 6, "pim": 2, "match": "exact" },
      { "eventName": "Mark Felice", "leagueName": "Mark Filice", "number": "28", "position": "F", "team": "Mitt Magicians", "gp": 4, "goals": 0, "assists": 1, "points": 1, "pim": 0, "match": "normalized" },
      { "eventName": "Matthew Fticar", "leagueName": "Matthew Fticar", "number": "22", "position": "C", "team": "Mitt Magicians", "gp": 7, "goals": 0, "assists": 4, "points": 4, "pim": 2, "match": "exact" },
      { "eventName": "Massimo Greco", "leagueName": "Massimo Greco", "number": "9", "position": "D", "team": "Mitt Magicians", "gp": 10, "goals": 4, "assists": 3, "points": 7, "pim": 4, "match": "exact" },
      { "eventName": "Ethan Holk", "leagueName": "Ethan Holk", "number": "7", "position": "C", "team": "Mitt Magicians", "gp": 9, "goals": 9, "assists": 5, "points": 14, "pim": 0, "match": "exact" },
      { "eventName": "Tom Horan", "leagueName": "Tom Horan", "number": "17", "position": "F", "team": "Mitt Magicians", "gp": 7, "goals": 6, "assists": 3, "points": 9, "pim": 0, "match": "exact" },
      { "eventName": "Quinten Lisle", "leagueName": "Quinten Lisle", "number": "11", "position": "C", "team": "Mitt Magicians", "gp": 9, "goals": 4, "assists": 7, "points": 11, "pim": 6, "match": "exact" },
      { "eventName": "Agostino Lovoi", "leagueName": "Agostino Lovoi", "number": "4", "position": "D", "team": "Mitt Magicians", "gp": 10, "goals": 1, "assists": 6, "points": 7, "pim": 2, "match": "exact" },
      { "eventName": "Francesco Lovoi", "leagueName": "Francesco Lo voi", "number": "55", "position": "D", "team": "Mitt Magicians", "gp": 10, "goals": 1, "assists": 2, "points": 3, "pim": 0, "match": "normalized" },
      { "eventName": "Ethan Matone", "leagueName": "Ethan Matone", "number": "53", "position": "F", "team": "Mitt Magicians", "gp": 9, "goals": 4, "assists": 10, "points": 14, "pim": 0, "match": "exact" },
      { "eventName": "Matthew Matone", "leagueName": "Matt Matone", "number": "88", "position": "C", "team": "Mitt Magicians", "gp": 9, "goals": 9, "assists": 8, "points": 17, "pim": 2, "match": "normalized" },
      { "eventName": "Santino Pasqaule", "leagueName": "Santino Pasquale", "number": "0", "position": "D", "team": "Mitt Magicians", "gp": 10, "goals": 2, "assists": 8, "points": 10, "pim": 4, "match": "normalized" },
      { "eventName": "Anthony Scaduto", "leagueName": "Anthony Scaduto", "number": "63", "position": "F", "team": "Mitt Magicians", "gp": 4, "goals": 2, "assists": 1, "points": 3, "pim": 4, "match": "exact" },
      { "eventName": "Philip Tylemen", "leagueName": "Philip Tyleman", "number": "14", "position": "F", "team": "Mitt Magicians", "gp": 9, "goals": 3, "assists": 6, "points": 9, "pim": 2, "match": "normalized" },
      { "eventName": "Nick Zarac", "leagueName": "Nick Zarac", "number": "10", "position": "F", "team": "Mitt Magicians", "gp": 8, "goals": 4, "assists": 3, "points": 7, "pim": 8, "match": "exact" }
    ],
    "questions": [
      "Confirm whether Hamilton's current 12-game form carries into the provincial weekend.",
      "Track the Matone-Holks-Lisle scoring group if the same combinations appear in tournament games.",
      "Recheck the league table immediately before a possible elimination-round meeting."
    ],
    "sources": [
      {
        "label": "Official Mitt Magicians tournament roster",
        "url": "https://gamesheetstats.com/seasons/14932/teams/531558",
        "scope": "Official tournament names, jersey numbers, and positions"
      },
      {
        "label": "Hamilton Ball Hockey League player statistics",
        "url": "https://www.ballhockeyhamilton.com/hamiltonballhockeyleague1/STATS",
        "scope": "Active roster, player production, and E2 standings"
      },
      {
        "label": "Hamilton Ball Hockey League",
        "url": "https://www.ballhockeyhamilton.com/hamiltonballhockeyleague1/",
        "scope": "Regional league context"
      }
    ]
  }
  $json$::jsonb,
  updated_at = now()
where tournament_id = '2026-mississauga-provincials'
  and team_id = 'mitt-magicians';

update public.tournament_opponent_intelligence
set
  payload = payload || jsonb_build_object(
    'rosterStatus', jsonb_build_object(
      'status', 'not-published',
      'publishedPlayers', 0,
      'lastChecked', 'Aug 4, 2026',
      'officialTeamUrl', case team_id
        when 'balls-of-glory' then 'https://gamesheetstats.com/seasons/14932/teams/531550'
        when 'moosehead' then 'https://gamesheetstats.com/seasons/14932/teams/531551'
        when 'dirty-birds' then 'https://gamesheetstats.com/seasons/14932/teams/531552'
        when 'high-park-highlanders' then 'https://gamesheetstats.com/seasons/14932/teams/531556'
        when 'sarabha' then 'https://gamesheetstats.com/seasons/14932/teams/531557'
      end,
      'note', 'The official tournament team page is live, but no player names are currently published on its Roster tab.'
    )
  ),
  updated_at = now()
where tournament_id = '2026-mississauga-provincials'
  and team_id in ('balls-of-glory', 'moosehead', 'dirty-birds', 'high-park-highlanders', 'sarabha');

update public.tournament_opponent_intelligence
set
  payload = jsonb_set(
    payload,
    '{identity}',
    '{"status":"roster-pending","confidence":"high","label":"Official roster not published yet","note":"The team entry is confirmed, but the official tournament roster is blank as of Aug 4, 2026."}'::jsonb,
    true
  ),
  updated_at = now()
where tournament_id = '2026-mississauga-provincials'
  and team_id in ('balls-of-glory', 'high-park-highlanders');

select
  'Tournament roster intelligence updated' as status,
  count(*) filter (where payload ? 'rosterStatus') as teams_with_roster_status,
  count(*) filter (where payload ? 'rosterMatch') as confirmed_roster_matches
from public.tournament_opponent_intelligence
where tournament_id = '2026-mississauga-provincials';

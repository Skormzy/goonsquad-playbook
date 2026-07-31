# Tournament Archive

Tournament dossiers live in `src/stats/tournaments.json`. The UI automatically
adds matching videos from `src/feed/officialYoutubeActivity.json` when a title
uses this format:

```text
Goonsquad vs OPPONENT (Home View) - Game 1 | TOURNAMENT NAME
Goonsquad vs OPPONENT (Away View) - Game 1 | TOURNAMENT NAME
```

The tournament name, opponent, and game number must match the dossier. Camera
angles are attached to the correct game automatically.

## Adding A Tournament

Add one object to `src/stats/tournaments.json`:

```json
{
  "id": "2027-example-cup",
  "name": "2027 Example Cup",
  "shortName": "Example 2027",
  "series": "Example tournament series",
  "organizer": "Tournament organizer",
  "location": "City, Ontario",
  "startDate": "2027-05-21",
  "endDate": "2027-05-23",
  "status": "complete",
  "dataStatus": "verified",
  "division": "Men's C",
  "format": "Round robin + elimination",
  "teamName": "Goonsquad",
  "summary": "Short description of the tournament run.",
  "sourceUrl": "https://official-event-page.example",
  "standings": [],
  "games": [],
  "bracket": []
}
```

Use `dataStatus: "partial"` until every displayed score, rank, and bracket
result has a reliable source. Unknown values stay `null`; never infer them.

## Standings

```json
{
  "team": "Goonsquad",
  "isGoonSquad": true,
  "gamesPlayed": 3,
  "wins": 2,
  "losses": 1,
  "ties": 0,
  "goalsFor": 9,
  "goalsAgainst": 5,
  "points": 4
}
```

Ranks can be included as `rank`. If omitted, the app sorts by points, goal
difference, goals for, then team name.

## Games

```json
{
  "id": "2027-example-game-1",
  "gameNumber": 1,
  "stage": "round-robin",
  "stageLabel": "Round robin",
  "opponent": "Example Opponent",
  "status": "final",
  "scoreFor": 4,
  "scoreAgainst": 2,
  "date": "2027-05-21",
  "time": "19:00",
  "location": "Example Arena"
}
```

## Bracket

Each bracket entry is one match. Shared `roundId` values form a column.

```json
{
  "id": "2027-example-semifinal-1",
  "roundId": "semifinal",
  "roundName": "Semifinal",
  "roundOrder": 2,
  "order": 1,
  "label": "Semifinal 1",
  "status": "final",
  "homeTeam": { "name": "Goonsquad", "seed": 2 },
  "awayTeam": { "name": "Example Opponent", "seed": 3 },
  "homeScore": 3,
  "awayScore": 1,
  "winner": "home"
}
```

## Source-backed snapshots

Completed tournaments should be captured as source-backed snapshots instead
of scraped in the browser at runtime. Include a `source` object with the
provider, source IDs, capture date, and direct links whenever the organizer
exposes them. This keeps a completed tournament fast and stable while the admin
override layer can still correct or enrich any field later.

The 2026 Oshawa dossier is a complete official snapshot. OBHF and GameSheet
verify all five results, the official table, team totals, player and goalie
leaders, roster, venues, and period scoring. GameSheet labels games 43 and 49
only as tournament games, so their quarterfinal and semifinal labels are marked
as `inferred-from-official-sequence`; the underlying opponents and scores are
official. Six Goonsquad YouTube angles attach to the first three games through
the title-matching convention above.

Use `dataStatus: "verified"` only when all visible competitive data is supported
by the linked source. Use `verificationNote` to disclose any reconstructed
stage names or other limited inference.

The surviving official 2024 OBHF tournament package verifies the Mississauga
event, Men's REC division, Pool A opponents, all three fixtures, venues, and
semifinal-to-final format. It does not include the played results.

A photo, screenshot, spreadsheet, or message containing the 2024 event's
missing scores and final table is enough to complete that dossier.

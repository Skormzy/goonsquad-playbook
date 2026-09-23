# Player spelling review — September 23, 2026

These corrections group source IDs into one player in administration, rosters,
statistics, and profiles. Imported names and source rows remain intact, so old
profile links and name searches continue to work and future imports retain history.
Similarity alone is not a merge rule.

## Supported corrections

### Abraham Sadozi

- Canonical source: `ycbhl-player-25735`; alias: `ycbhl-player-25962` (Abraham Saodzi).
- [Established league profile](https://www.yorkcentralbhl.com/player/7022-goonsquad/25735-abraham-sadozi)
  uses Sadozi across multiple teams and seasons since 2019.
- [Misspelled profile](https://www.yorkcentralbhl.com/player/7117-goonsquad/25962-abraham-saodzi)
  contains one Goonsquad appearance, [July 20, 2025 against Viperz](https://www.yorkcentralbhl.com/game/52142-goonsquad-viperz).
- Same team, division, position, and transposed surname; the team owner also
  identified the duplicate. Neither ID shares a game with the other in the
  combined field-player and goalie logs.
- Combined Goonsquad archive: 19 goalie GP, 6 W, 11 L, 2 T, 410 SA, 72 GA,
  338 saves, 554 minutes, 0 SO. SV% = 338 / 410; 30-minute GAA = 72 × 30 / 554.
  Preserve the separate field-player appearance (1 GP, 0 G, 0 A).

### Mathew Wallenburg

- Canonical source: `ycbhl-player-25816`; alias: `ycbhl-player-26163` (Matthew Walenburg).
- [Established YCBHL profile](https://www.yorkcentralbhl.com/player/7064-goonsquad/25816-mathew-wallenburg)
  and [independent GTBHL profile](https://www.greatertorontoballhockeyleague.com/player/3188-bullets/85384-mathew-wallenburg)
  agree on the spelling. The GTBHL page is spelling evidence only; its other-team
  statistics are not imported into Goonsquad totals.
- The alias has one Goonsquad appearance, April 1, 2026, with no game overlap.
- Combined Goonsquad archive: 45 GP, 38 G, 44 A, 82 PTS, 68 PIM, 3 PPG, 0 SHG, 2 ENG.

## Reviewed names kept separate

- Tyler Flach / Tyler Flack / Tyler Glach: no overlapping Goonsquad games, but
  public hockey records contain both [Tyler Flach](https://www.eliteprospects.com/player/992048/tyler-flach)
  and [Tyler Flack](https://oswegolakers.com/roster.aspx?rp_id=19812). No reliable
  identity connection established for the three league IDs (25980, 8079, 26108).
- John / Johnathan Gianopoulos (26132, 26364) and Matt / Matteo Crossley (26362,
  26386): searches did not establish that each pair is one person.
- Lee / Lorry Brown, Al-Rahim / Amyn Gangani, Saif / Sajjad Jaffery, Ryan Grant /
  Ryan Hunt, and Ryan Hunt / Ryan Ram have shared-game appearances as separate
  players. Their identities remain separate.

Regression coverage includes the reviewed IDs after cloud UUID replacement,
preferred spelling when only an alias is present, combined totals and weighted
goalie rates, historical name search, assignment edits/clears, and distinct names.

-- Private, source-backed tournament opponent research for team admins only.

create table if not exists public.tournament_opponent_intelligence (
  tournament_id text not null,
  team_id text not null,
  team_name text not null,
  pool_name text not null default '',
  priority smallint not null default 99,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, team_id),
  constraint tournament_opponent_intelligence_tournament_id_check
    check (tournament_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(tournament_id) <= 120),
  constraint tournament_opponent_intelligence_team_id_check
    check (team_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(team_id) <= 120),
  constraint tournament_opponent_intelligence_payload_check
    check (jsonb_typeof(payload) = 'object')
);

create index if not exists tournament_opponent_intelligence_priority_idx
  on public.tournament_opponent_intelligence (tournament_id, priority, team_name);

drop trigger if exists touch_updated_at_before_update on public.tournament_opponent_intelligence;
create trigger touch_updated_at_before_update
  before update on public.tournament_opponent_intelligence
  for each row execute function public.touch_updated_at();

alter table public.tournament_opponent_intelligence enable row level security;

drop policy if exists "Admins read tournament opponent intelligence" on public.tournament_opponent_intelligence;
create policy "Admins read tournament opponent intelligence" on public.tournament_opponent_intelligence
  for select to authenticated
  using (public.is_team_admin());

drop policy if exists "Admins create tournament opponent intelligence" on public.tournament_opponent_intelligence;
create policy "Admins create tournament opponent intelligence" on public.tournament_opponent_intelligence
  for insert to authenticated
  with check (public.is_team_admin() and updated_by = auth.uid());

drop policy if exists "Admins update tournament opponent intelligence" on public.tournament_opponent_intelligence;
create policy "Admins update tournament opponent intelligence" on public.tournament_opponent_intelligence
  for update to authenticated
  using (public.is_team_admin())
  with check (public.is_team_admin() and updated_by = auth.uid());

drop policy if exists "Admins delete tournament opponent intelligence" on public.tournament_opponent_intelligence;
create policy "Admins delete tournament opponent intelligence" on public.tournament_opponent_intelligence
  for delete to authenticated
  using (public.is_team_admin());

revoke all on public.tournament_opponent_intelligence from anon;
grant select, insert, update, delete on public.tournament_opponent_intelligence to authenticated;

insert into public.tournament_opponent_intelligence (
  tournament_id,
  team_id,
  team_name,
  pool_name,
  priority,
  payload
)
values
  (
    '2026-mississauga-provincials',
    'cambridge',
    'Cambridge',
    'Pool B',
    1,
    $json$
    {
      "headline": "Opening opponent · Friday at 5:00 p.m.",
      "summary": "The tournament schedule lists the team only as Cambridge. Public records establish a strong Cambridge Men's REC program, but do not establish which Cambridge roster is entering this event.",
      "identity": {
        "status": "unresolved",
        "confidence": "low",
        "label": "Exact roster not identified",
        "note": "Do not treat Cambridge Hitmen or Cambridge Thunder history as this team's current roster until the event list or uniforms confirm the identity."
      },
      "meeting": {
        "gameNumber": 43,
        "date": "2026-08-21",
        "time": "17:00",
        "location": "Corbasson CC · East Pad",
        "site": "Goonsquad home"
      },
      "facts": [
        { "label": "Pool", "value": "Pool B" },
        { "label": "Second game", "value": "vs Sudbury · Sat 9:00 a.m." },
        { "label": "Local pathway", "value": "CMBHL C/D/E champions qualify for OBHF provincials" }
      ],
      "history": [
        {
          "season": "2025 OBHF Summer · Men's REC",
          "team": "Cambridge Hitmen",
          "record": "5-0 · 20 GF · 3 GA",
          "result": "Champion",
          "relationship": "Possible regional name match only",
          "note": "Round robin: 3-0 with 10-3 goals; semifinal 7-0; final 3-0 over Moosehead."
        },
        {
          "season": "2024 OBHF Summer · Men's REC",
          "team": "Cambridge Thunder",
          "record": "4-1 · 22 GF · 5 GA",
          "result": "Finalist",
          "relationship": "Historical Cambridge entry; not a roster match",
          "note": "Included only as evidence that Cambridge regularly sends competitive Men's REC teams."
        }
      ],
      "players": [],
      "questions": [
        "Confirm the full team name and jersey identity at registration.",
        "Capture jersey numbers during warm-up before attaching any historical roster.",
        "Identify whether this is the returning Hitmen group or a different Cambridge qualifier."
      ],
      "sources": [
        {
          "label": "Cambridge Men's Ball Hockey League",
          "url": "https://www.cmbhl.ca/",
          "scope": "League format, divisions, provincial qualification, and venue"
        },
        {
          "label": "2025 OBHF Men's REC result board",
          "url": "https://ggts.ca/wp-content/uploads/2025/08/2025-Result-Boards-2nd-Wknd-London.pdf",
          "scope": "Cambridge Hitmen and Moosehead results"
        },
        {
          "label": "2025 OBHF champions",
          "url": "https://ontarioballhockeyfederation.ca/2025/08/25/2025-obhf-mens-d-recreational-provincial-championships-winners/",
          "scope": "Men's REC final result"
        }
      ]
    }
    $json$::jsonb
  ),
  (
    '2026-mississauga-provincials',
    'sudbury-silly-gooses',
    'Sudbury Silly Gooses',
    'Pool B',
    2,
    $json$
    {
      "headline": "Second opponent · Friday at 8:00 p.m.",
      "summary": "The tournament schedule confirms Sudbury Silly Gooses in Pool B. No reliable public roster, league table, or prior result under this exact name was indexed during the August 4 research pass.",
      "identity": {
        "status": "unresolved",
        "confidence": "low",
        "label": "No public history under exact name",
        "note": "Sudbury has produced other provincial teams, but none can be connected to this entry without a roster or official team page."
      },
      "meeting": {
        "gameNumber": 46,
        "date": "2026-08-21",
        "time": "20:00",
        "location": "Corbasson CC · East Pad",
        "site": "Goonsquad away"
      },
      "facts": [
        { "label": "Pool", "value": "Pool B" },
        { "label": "First game", "value": "vs Cambridge · Sat 9:00 a.m." },
        { "label": "Turnaround", "value": "3 hours after the Cambridge opener" }
      ],
      "history": [],
      "players": [],
      "questions": [
        "Record jersey numbers and handedness during the Cambridge-Sudbury game Saturday morning if needed later in the event.",
        "Confirm whether the roster has a public Sudbury league page under a different team name.",
        "Do not infer personnel from Sudbury Zambronis or other Sudbury provincial entries."
      ],
      "sources": [
        {
          "label": "2026 team tournament schedule",
          "url": "",
          "scope": "Pool assignment, game number, time, site, and venue"
        },
        {
          "label": "OBHF event calendar",
          "url": "https://ontarioballhockeyfederation.ca/events-2/",
          "scope": "Event dates, city, and Men's REC division"
        }
      ]
    }
    $json$::jsonb
  ),
  (
    '2026-mississauga-provincials',
    'moosehead',
    'Moosehead',
    'Pool A',
    3,
    $json$
    {
      "headline": "Pool A · returning finalist name",
      "summary": "Moosehead is the clearest returning-name signal in the field. A Moosehead team reached the 2025 OBHF Men's REC final after a productive pool stage.",
      "identity": {
        "status": "historical-name-match",
        "confidence": "medium",
        "label": "Same team name; roster continuity unknown",
        "note": "Use the prior results as team-level context, not proof of current personnel."
      },
      "facts": [
        { "label": "Pool", "value": "Pool A" },
        { "label": "2025 run", "value": "3-2 · 19 GF · 11 GA" },
        { "label": "2025 finish", "value": "Men's REC finalist" }
      ],
      "history": [
        {
          "season": "2025 OBHF Summer · Men's REC",
          "team": "Moosehead",
          "record": "3-2 · 19 GF · 11 GA",
          "result": "Finalist",
          "relationship": "Exact name match; roster continuity unknown",
          "note": "Pool wins of 6-2 and 7-0, a 4-3 semifinal win, then a 0-3 final loss to Cambridge Hitmen."
        }
      ],
      "players": [],
      "questions": [
        "Check whether the 2025 core returned before using the prior scoring profile.",
        "Confirm current goaltender and top line from the event roster."
      ],
      "sources": [
        {
          "label": "2025 OBHF Men's REC result board",
          "url": "https://ggts.ca/wp-content/uploads/2025/08/2025-Result-Boards-2nd-Wknd-London.pdf",
          "scope": "Round robin and elimination results"
        },
        {
          "label": "2025 OBHF champions",
          "url": "https://ontarioballhockeyfederation.ca/2025/08/25/2025-obhf-mens-d-recreational-provincial-championships-winners/",
          "scope": "Final result"
        }
      ]
    }
    $json$::jsonb
  ),
  (
    '2026-mississauga-provincials',
    'dirty-birds',
    'Dirty Birds',
    'Pool A',
    4,
    $json$
    {
      "headline": "Pool A",
      "summary": "A Dirty Birds team name appears in a 2026 Oakville Men's Tuesday E competition. The available index does not establish that it is this provincial roster or provide a dependable record.",
      "identity": {
        "status": "possible-name-match",
        "confidence": "low",
        "label": "Possible current league match",
        "note": "Confirm organizer and roster before connecting the Oakville entry."
      },
      "facts": [
        { "label": "Pool", "value": "Pool A" },
        { "label": "Indexed context", "value": "2026 Oakville Men's Tuesday E name match" }
      ],
      "history": [],
      "players": [],
      "questions": ["Confirm whether the Oakville team is the provincial qualifier."],
      "sources": [
        {
          "label": "Players Ball Hockey League",
          "url": "https://leagues.teamlinkt.com/playersballhockeyleague/Home",
          "scope": "Possible 2026 team-name match"
        }
      ]
    }
    $json$::jsonb
  ),
  (
    '2026-mississauga-provincials',
    'sarabha',
    'Sarabha',
    'Pool C',
    5,
    $json$
    {
      "headline": "Pool C · GTA name history",
      "summary": "Sarabha appears in Greater Toronto ball-hockey records, including a 2025 Tier 5A game page. The tournament schedule does not establish roster continuity.",
      "identity": {
        "status": "historical-name-match",
        "confidence": "medium",
        "label": "Official GTA team-name match",
        "note": "The linked game page is useful for candidate names only; do not present them as the 2026 provincial roster."
      },
      "facts": [
        { "label": "Pool", "value": "Pool C" },
        { "label": "Indexed context", "value": "2025 GTBHL Brampton Tier 5A" }
      ],
      "history": [
        {
          "season": "2025 GTBHL · Brampton Tier 5A",
          "team": "Sarabha",
          "record": "Game records indexed",
          "result": "Roster continuity unknown",
          "relationship": "Exact name match"
        }
      ],
      "players": [],
      "questions": ["Compare the event roster with the linked 2025 game page before attaching player history."],
      "sources": [
        {
          "label": "GTBHL Sarabha game page",
          "url": "https://www.greatertorontoballhockeyleague.com/game/85980-sarabha-shanghai-sharks",
          "scope": "Historical team and player-name context"
        }
      ]
    }
    $json$::jsonb
  ),
  (
    '2026-mississauga-provincials',
    'balls-of-glory',
    'Balls of Glory',
    'Pool A',
    6,
    $json$
    {
      "headline": "Pool A",
      "summary": "No reliable Ontario ball-hockey record under this exact name was found in the public research pass.",
      "identity": { "status": "unresolved", "confidence": "low", "label": "Public history not found", "note": "Unrelated teams with this name were excluded." },
      "facts": [{ "label": "Pool", "value": "Pool A" }],
      "history": [],
      "players": [],
      "questions": ["Capture the official roster or league origin at event registration."],
      "sources": [{ "label": "2026 team tournament schedule", "url": "", "scope": "Pool and fixtures" }]
    }
    $json$::jsonb
  ),
  (
    '2026-mississauga-provincials',
    'high-park-highlanders',
    'High Park Highlanders',
    'Pool C',
    7,
    $json$
    {
      "headline": "Pool C",
      "summary": "No reliable official record or roster under this exact team name was indexed in the public research pass.",
      "identity": { "status": "unresolved", "confidence": "low", "label": "Public history not found", "note": "Keep the identity open until an organizer or roster source is available." },
      "facts": [{ "label": "Pool", "value": "Pool C" }],
      "history": [],
      "players": [],
      "questions": ["Confirm the qualifying league and roster at event registration."],
      "sources": [{ "label": "2026 team tournament schedule", "url": "", "scope": "Pool and fixtures" }]
    }
    $json$::jsonb
  ),
  (
    '2026-mississauga-provincials',
    'mitt-magicians',
    'Mitt Magicians',
    'Pool C',
    8,
    $json$
    {
      "headline": "Pool C",
      "summary": "No reliable official record or roster under this exact team name was indexed in the public research pass.",
      "identity": { "status": "unresolved", "confidence": "low", "label": "Public history not found", "note": "Keep the identity open until an organizer or roster source is available." },
      "facts": [{ "label": "Pool", "value": "Pool C" }],
      "history": [],
      "players": [],
      "questions": ["Confirm the qualifying league and roster at event registration."],
      "sources": [{ "label": "2026 team tournament schedule", "url": "", "scope": "Pool and fixtures" }]
    }
    $json$::jsonb
  )
on conflict (tournament_id, team_id) do update
set
  team_name = excluded.team_name,
  pool_name = excluded.pool_name,
  priority = excluded.priority,
  payload = excluded.payload,
  updated_at = now();

select
  'Tournament opponent intelligence ready' as status,
  count(*) filter (where tournament_id = '2026-mississauga-provincials') as mississauga_teams,
  has_table_privilege('anon', 'public.tournament_opponent_intelligence', 'select') as anon_can_read
from public.tournament_opponent_intelligence;

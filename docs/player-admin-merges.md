# Merging duplicate players

In **Player administration**, find the incorrect entry and select **Merge to…**.
Search for and select the correctly named player. The confirmation labels both
the player being merged and the player that remains, shows the records being
combined, and lets an administrator choose the number and position to retain.
Confirm that the entries represent the same person, then select **Merge into
[correct name]**. The incorrect entry disappears from the directory.

The chosen player keeps the combined statistics, seasons, game history, roster
notes, source links, and approved account links. A source avatar remains available
when the target has none. Source spellings remain searchable. Old profile links
continue opening the combined player. Goalkeeping rates are calculated from the
combined totals. Future league imports continue to use the preserved source IDs.

An explicit number/position clear is retained. Otherwise, populated target values
are suggested; source values fill missing fields. The confirmation permits either
existing value or an explicit clear.

Merges are blocked when records belong to different approved account owners,
appear separately in the same game, or have overlapping season totals that the
game logs cannot explain. Review those records before merging. A changed number,
claim, roster, game, or statistic invalidates an open preview; refresh the preview
and review again. Similar-name suggestions never merge players automatically.

## Data and access

The merge creates directed `players.merged_into_player_id` links and an explicit
`canonical_display_name` on the selected survivor. Every member of each existing
identity is included. No statistical, membership, or claim row is deleted or moved.
The public metadata RPC carries the mapping into both bundled and cloud statistics.

The server derives full identity membership and the actor from the authenticated
admin session. Only the service role can execute the merge RPC. A transaction
checks the preview fingerprint, overlapping statistics, and account ownership
before updating links. The private `player_merge_audit` stores the actor, timestamp,
before/after player records, and the reviewed decision. There is no self-service
undo; recovery must account for changes made since the merge and can use this audit
without restoring or recreating statistical records.

`supabase/tests/player_identity_merges.sql` exercises permissions, preservation,
field choices, visibility, stale previews, and overlap checks using fixtures inside
a rollback transaction. Application tests cover directed identities, cloud/source
IDs, existing profile links, combined statistics, and the confirmation controls.

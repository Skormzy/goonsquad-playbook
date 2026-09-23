// Keep explicit profile assignments separate from the imported roster history.
// Protected rows must use a separate upsert batch: database bulk upserts union
// the supplied column keys and can otherwise turn an omitted position into null.
export async function importLeaguePlayers(cloud, players, upsert) {
  const externalIds = [...new Set(players.map((player) => player.externalId))];
  const assignedExternalIds = new Set();
  for (let index = 0; index < externalIds.length; index += 100) {
    const { data, error } = await cloud
      .from('players')
      .select('external_id,primary_position_updated_at')
      .eq('source', 'league')
      .in('external_id', externalIds.slice(index, index + 100));
    if (error) throw new Error(`Player assignments could not be checked: ${error.message}`);
    for (const player of data || []) {
      if (player.primary_position_updated_at != null) assignedExternalIds.add(player.external_id);
    }
  }

  const importedPositions = [];
  const preservedPositions = [];
  for (const player of players) {
    const row = {
      display_name: player.displayName,
      active: player.active,
      source: 'league',
      external_id: player.externalId,
      source_url: player.sourceUrl,
    };
    if (assignedExternalIds.has(player.externalId)) {
      preservedPositions.push(row);
    } else {
      importedPositions.push({ ...row, primary_position: player.primaryPosition });
    }
  }

  if (importedPositions.length) await upsert('players', importedPositions, 'source,external_id');
  if (preservedPositions.length) await upsert('players', preservedPositions, 'source,external_id');
}

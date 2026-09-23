const normalized = (value) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const recordIds = (row) => new Set([row.id, row.identityId, ...(row.sourcePlayers || []).map((player) => player.id)].filter(Boolean));

function nameDistance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let index = 1; index <= left.length; index += 1) {
    const current = [index];
    for (let other = 1; other <= right.length; other += 1) {
      current[other] = Math.min(current[other - 1] + 1, previous[other] + 1, previous[other - 1] + (left[index - 1] === right[other - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[right.length];
}

export function playerMergeTargets(rows, source, query = '') {
  const sourceIds = recordIds(source);
  const sourceName = normalized(source.displayName);
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  return rows.filter((row) => ![...recordIds(row)].some((id) => sourceIds.has(id))).map((row) => {
    const name = normalized(row.displayName);
    const distance = nameDistance(sourceName, name);
    return { ...row, suggested: sourceName.length > 4 && distance <= Math.max(2, Math.floor(sourceName.length * 0.15)), nameDistance: distance };
  }).filter((row) => {
    const search = normalized([row.displayName, row.jerseyNumber, row.position, row.teams, row.seasons, row.externalId, row.memberNames, row.usernames, row.emails, row.searchExtra].join(' '));
    return terms.every((term) => search.includes(term));
  }).sort((left, right) => Number(right.suggested) - Number(left.suggested) || (left.suggested ? left.nameDistance - right.nameDistance : 0) || left.displayName.localeCompare(right.displayName));
}

export function mergeFieldOptions(source, target, field) {
  const values = [...new Set([target?.[field], source?.[field]].filter((value) => value !== null && value !== undefined && String(value).trim() !== '').map(String))];
  return ['', ...values];
}

export function mergePreviewCountItems(counts = {}) {
  return [
    ['playerRecords', 'Player records'],
    ['gameStats', 'Player game records'],
    ['goalieStats', 'Goalie game records'],
    ['seasonRecords', 'Season totals'],
    ['memberships', 'Roster entries'],
    ['accounts', 'Approved account links'],
  ].filter(([key]) => Number.isFinite(counts[key])).map(([key, label]) => ({ key, label, count: counts[key] }));
}

export function mergePreviewMessages(messages = []) {
  return messages.map((message) => typeof message === 'string' ? message : message?.message).filter(Boolean);
}

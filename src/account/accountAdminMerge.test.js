import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../playmaker/playmakerCloud', () => ({ playmakerCloudSession: vi.fn(async () => ({ access_token: 'test-admin-token' })) }));
import { mergeManagedPlayers, previewManagedPlayerMerge } from './accountAdmin';

afterEach(() => vi.unstubAllGlobals());

describe('admin merge client requests', () => {
  it('previews without mutating and commits with the same source-to-target direction', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    vi.stubGlobal('fetch', fetch);
    await previewManagedPlayerMerge('wrong', 'correct');
    await mergeManagedPlayers({ sourcePlayerId: 'wrong', targetPlayerId: 'correct', previewToken: 'server-token', jerseyNumber: null, position: 'G' });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ action: 'preview-player-merge', sourcePlayerId: 'wrong', targetPlayerId: 'correct' });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ action: 'merge-players', sourcePlayerId: 'wrong', targetPlayerId: 'correct', previewToken: 'server-token', jerseyNumber: null, position: 'G' });
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer test-admin-token');
  });

  it('surfaces a stale preview rejection without silently retrying a mutation', async () => {
    const fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Player information changed. Refresh the preview.' }) }));
    vi.stubGlobal('fetch', fetch);
    await expect(mergeManagedPlayers({ sourcePlayerId: 'wrong', targetPlayerId: 'correct', previewToken: 'old' })).rejects.toThrow('Refresh the preview');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const cloud = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../playmaker/playmakerCloud', () => ({ getPlaymakerCloudClient: () => cloud }));

import { updateLinkedPlayerDetails } from './accountCloud';

beforeEach(() => {
  cloud.rpc.mockReset();
  cloud.rpc.mockResolvedValue({ error: null });
});

describe('linked player detail edits', () => {
  it('marks only position dirty when a member changes their position', async () => {
    await updateLinkedPlayerDetails('player', {
      jerseyNumber: '', position: 'd', updateJerseyNumber: false, updatePrimaryPosition: true,
    });
    expect(cloud.rpc).toHaveBeenCalledWith('update_linked_player_details', {
      p_player_id: 'player', p_jersey_number: null, p_primary_position: 'D',
      p_update_jersey_number: false, p_update_primary_position: true,
    });
  });

  it('does not reject or overwrite an unchanged historical position when changing the number', async () => {
    await updateLinkedPlayerDetails('player', {
      jerseyNumber: '88', position: 'LD', updateJerseyNumber: true, updatePrimaryPosition: false,
    });
    expect(cloud.rpc).toHaveBeenCalledWith('update_linked_player_details', expect.objectContaining({
      p_jersey_number: '88', p_update_jersey_number: true, p_update_primary_position: false,
    }));
  });

  it('sends an explicit position clear while leaving the displayed roster number untouched', async () => {
    await updateLinkedPlayerDetails('player', {
      jerseyNumber: '19', position: '', updateJerseyNumber: false, updatePrimaryPosition: true,
    });
    expect(cloud.rpc).toHaveBeenCalledWith('update_linked_player_details', expect.objectContaining({
      p_primary_position: null, p_update_jersey_number: false, p_update_primary_position: true,
    }));
  });

  it('keeps existing callers updating both fields and preserves player number zero', async () => {
    await updateLinkedPlayerDetails('player', { jerseyNumber: 0, position: 'C' });
    expect(cloud.rpc).toHaveBeenCalledWith('update_linked_player_details', expect.objectContaining({
      p_jersey_number: '0', p_primary_position: 'C',
      p_update_jersey_number: true, p_update_primary_position: true,
    }));
  });

  it('still validates an edited position before sending a mutation', async () => {
    await expect(updateLinkedPlayerDetails('player', {
      jerseyNumber: '19', position: 'LD', updatePrimaryPosition: true,
    })).rejects.toThrow('Choose Goalie, Defence, Center, or Winger.');
    expect(cloud.rpc).not.toHaveBeenCalled();
  });
});

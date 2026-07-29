import { describe, expect, it } from 'vitest';
import { createWorkspaceUrl, readWorkspaceUrl } from './workspaceUrlState';

describe('workspace URL state', () => {
  it('restores canonical content, mode, play, time, speed, and role', () => {
    expect(readWorkspaceUrl('http://localhost/?content=plays&mode=3d&playId=brk&phase=1&time=4.6&speed=0.25&role=RW&playing=false&camera=player')).toEqual({
      activeView: 'replay3d',
      content: 'plays',
      mode: '3d',
      playId: 'brk',
      tacticId: null,
      faceoffOutcome: 'won',
      strategyVariant: 'correct',
      phase: 1,
      time: 4.6,
      speed: 0.25,
      role: 'RW',
      playing: false,
      camera: 'player',
    });
  });

  it('keeps legacy replay links working', () => {
    const state = readWorkspaceUrl('http://localhost/?view=replay3d&play=false&time=4.6&camera=player');
    expect(state.activeView).toBe('replay3d');
    expect(state.playing).toBe(false);
    expect(state.time).toBe(4.6);
    expect(state.camera).toBe('player');
  });

  it('round-trips a lost faceoff without leaking it into other content', () => {
    const state = readWorkspaceUrl('http://localhost/?content=plays&mode=3d&playId=dzfl&faceoff=lost');
    expect(state.faceoffOutcome).toBe('lost');

    const faceoffUrl = new URL(createWorkspaceUrl('http://localhost/', {
      ...state,
      phase: 2,
      time: 2.1,
      role: 'C',
      speed: 1,
      playing: false,
      camera: 'broadcast',
    }), 'http://localhost');
    expect(faceoffUrl.searchParams.get('faceoff')).toBe('lost');

    const strategyUrl = new URL(createWorkspaceUrl(faceoffUrl.href, {
      ...state,
      activeView: 'tactics',
      tacticId: 'gap-control',
      strategyVariant: 'correct',
    }), 'http://localhost');
    expect(strategyUrl.searchParams.get('faceoff')).toBeNull();
  });

  it('serializes a complete shareable workspace session', () => {
    const relative = createWorkspaceUrl('http://localhost/?view=replay3d&play=false', {
      activeView: 'replay3d',
      playId: 'brk',
      phase: 1,
      time: 4.603,
      speed: 0.5,
      role: 'RW',
      playing: false,
      camera: 'player',
    });
    const url = new URL(relative, 'http://localhost');

    expect(url.searchParams.get('view')).toBeNull();
    expect(url.searchParams.get('play')).toBeNull();
    expect(url.searchParams.get('content')).toBe('plays');
    expect(url.searchParams.get('mode')).toBe('3d');
    expect(url.searchParams.get('playId')).toBe('brk');
    expect(url.searchParams.get('phase')).toBe('1');
    expect(url.searchParams.get('time')).toBe('4.6');
    expect(url.searchParams.get('speed')).toBe('0.5');
    expect(url.searchParams.get('role')).toBe('RW');
    expect(url.searchParams.get('playing')).toBe('false');
  });

  it('normalizes retired fast replay links to normal speed', () => {
    expect(readWorkspaceUrl('http://localhost/?content=plays&mode=3d&speed=1.5').speed).toBe(1);
    expect(readWorkspaceUrl('http://localhost/?content=plays&mode=3d&speed=2').speed).toBe(1);
  });

  it('restores and serializes a 3D strategy session', () => {
    const state = readWorkspaceUrl('http://localhost/?content=strategy&mode=3d&tacticId=gap-control&scenario=mistake');
    expect(state).toMatchObject({
      activeView: 'strategy3d',
      content: 'strategy',
      mode: '3d',
      tacticId: 'gap-control',
      strategyVariant: 'mistake',
    });

    const relative = createWorkspaceUrl('http://localhost/', {
      ...state,
      phase: 2,
      time: 6.4,
      role: 'C',
      speed: 1,
      playing: false,
      camera: 'overhead',
    });
    const url = new URL(relative, 'http://localhost');
    expect(url.searchParams.get('content')).toBe('strategy');
    expect(url.searchParams.get('mode')).toBe('3d');
    expect(url.searchParams.get('tacticId')).toBe('gap-control');
    expect(url.searchParams.get('scenario')).toBe('mistake');
    expect(url.searchParams.get('playId')).toBeNull();
  });

  it('restores Playmaker as a standalone authoring surface', () => {
    const state = readWorkspaceUrl('http://localhost/?content=playmaker');
    expect(state).toMatchObject({
      activeView: 'playmaker',
      content: 'playmaker',
      mode: '2d',
    });

    const relative = createWorkspaceUrl('http://localhost/?draft=portable', {
      ...state,
      phase: 0,
      time: 0,
      role: 'C',
      speed: 1,
      playing: false,
    });
    const url = new URL(relative, 'http://localhost');
    expect(url.searchParams.get('content')).toBe('playmaker');
    expect(url.searchParams.get('mode')).toBe('2d');
    expect(url.searchParams.get('draft')).toBe('portable');
    expect(url.searchParams.get('playId')).toBeNull();
    expect(url.searchParams.get('tacticId')).toBeNull();
  });

  it('restores statistics as a clean standalone team surface', () => {
    const state = readWorkspaceUrl('http://localhost/?content=stats&season=summer-2026&team=summer-2026-sunday&stage=playoffs');
    expect(state).toMatchObject({ activeView: 'stats', content: 'stats', mode: '2d' });

    const relative = createWorkspaceUrl('http://localhost/?content=plays&phase=2&season=summer-2026&team=summer-2026-sunday&stage=playoffs', {
      ...state,
      activeView: 'stats',
      phase: 2,
      time: 8,
      role: 'C',
      speed: 1,
      playing: false,
      camera: 'broadcast',
    });
    const url = new URL(relative, 'http://localhost');
    expect(url.searchParams.get('content')).toBe('stats');
    expect(url.searchParams.get('season')).toBe('summer-2026');
    expect(url.searchParams.get('team')).toBe('summer-2026-sunday');
    expect(url.searchParams.get('stage')).toBe('playoffs');
    expect(url.searchParams.get('phase')).toBeNull();
    expect(url.searchParams.get('camera')).toBeNull();

    const playRelative = createWorkspaceUrl(`http://localhost${relative}`, {
      ...state,
      activeView: 'app',
      playId: 'brk',
      phase: 0,
      time: 0,
      role: 'C',
      speed: 1,
      playing: false,
      camera: 'broadcast',
    });
    const playUrl = new URL(playRelative, 'http://localhost');
    expect(playUrl.searchParams.get('season')).toBeNull();
    expect(playUrl.searchParams.get('team')).toBeNull();
    expect(playUrl.searchParams.get('stage')).toBeNull();
  });

  it('restores a clean standalone member profile surface', () => {
    const state = readWorkspaceUrl('https://goonsquad.app/?content=profile&phase=4&camera=bench');
    expect(state).toMatchObject({ activeView: 'profile', content: 'profile', mode: '2d' });

    const relative = createWorkspaceUrl('https://goonsquad.app/?content=stats&season=summer-2026&game=game-1', {
      ...state,
      activeView: 'profile',
      phase: 4,
      time: 8,
      role: 'C',
      speed: 1,
      playing: false,
      camera: 'bench',
    });
    const url = new URL(relative, 'https://goonsquad.app');
    expect(url.searchParams.get('content')).toBe('profile');
    expect(url.searchParams.get('season')).toBeNull();
    expect(url.searchParams.get('game')).toBeNull();
    expect(url.searchParams.get('phase')).toBeNull();
    expect(url.searchParams.get('camera')).toBeNull();
  });

  it('restores a clean standalone account surface and preserves its auth mode', () => {
    const state = readWorkspaceUrl('https://goonsquad.app/?content=account&auth=signup&phase=4&camera=bench');
    expect(state).toMatchObject({ activeView: 'account', content: 'account', mode: '2d' });

    const relative = createWorkspaceUrl('https://goonsquad.app/?content=account&auth=signup&season=summer-2026&phase=4', {
      ...state,
      activeView: 'account',
      phase: 4,
      time: 8,
      role: 'C',
      speed: 1,
      playing: false,
      camera: 'bench',
    });
    const url = new URL(relative, 'https://goonsquad.app');
    expect(url.searchParams.get('content')).toBe('account');
    expect(url.searchParams.get('auth')).toBe('signup');
    expect(url.searchParams.get('season')).toBeNull();
    expect(url.searchParams.get('phase')).toBeNull();
    expect(url.searchParams.get('camera')).toBeNull();
  });
});

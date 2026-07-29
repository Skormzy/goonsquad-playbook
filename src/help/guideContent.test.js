import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GUIDE_TOPIC_BY_VIEW,
  GUIDE_TOPIC_ORDER,
  GUIDE_TOPICS,
  guideTopicForView,
} from './guideContent';

describe('in-product guide content', () => {
  it('covers every primary workspace and shared control surface', () => {
    expect(GUIDE_TOPIC_ORDER).toEqual([
      'start',
      'plays',
      'strategy',
      'three-d',
      'create',
      'stats',
      'game',
      'matchup',
      'player-stats',
      'profile',
      'account',
      'controls',
      'terms',
    ]);
    expect(Object.keys(GUIDE_TOPICS)).toEqual(GUIDE_TOPIC_ORDER);
    expect(DEFAULT_GUIDE_TOPIC_BY_VIEW).toMatchObject({
      playbook: 'plays',
      replay3d: 'three-d',
      tactics: 'strategy',
      strategy3d: 'three-d',
      playmaker: 'create',
      stats: 'stats',
      profile: 'profile',
      account: 'account',
    });
  });

  it('keeps every topic complete, concise, and valid for ball hockey', () => {
    GUIDE_TOPIC_ORDER.forEach((topicId) => {
      const topic = GUIDE_TOPICS[topicId];
      expect(topic.label.length).toBeGreaterThan(1);
      expect(topic.title.length).toBeGreaterThan(10);
      expect(topic.intro.length).toBeGreaterThan(20);
      expect(topic.sections.length).toBeGreaterThanOrEqual(3);
      expect(topic.note.length).toBeGreaterThan(20);
    });
    expect(JSON.stringify(GUIDE_TOPICS).toLowerCase()).not.toContain(['ska', 'te'].join(''));
    expect(GUIDE_TOPICS.create.action).toBe('Start Create tutorial');
  });

  it('keeps product promises aligned with the authored replay and statistics sources', () => {
    const copy = JSON.stringify(GUIDE_TOPICS);
    expect(copy).not.toContain('same timeline');
    expect(copy).not.toContain('stay synchronized');
    expect(copy).not.toContain('every 3D camera');
    expect(copy).toContain('official league sync or authorized team entry');
    expect(copy).toContain('may expand an authored moment');
    expect(copy).not.toContain('court');
  });

  it('selects a guide for every primary and detailed route', () => {
    expect(guideTopicForView('playbook')).toBe('plays');
    expect(guideTopicForView('account')).toBe('account');
    expect(guideTopicForView('stats', '?content=stats&game=game-1')).toBe('game');
    expect(guideTopicForView('stats', '?content=stats&opponent=red-wolves')).toBe('matchup');
    expect(guideTopicForView('stats', '?content=stats&player=player-1')).toBe('player-stats');
    expect(guideTopicForView('unknown')).toBe('start');
  });
});

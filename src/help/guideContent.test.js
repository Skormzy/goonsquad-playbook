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
      'profile',
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
      account: 'profile',
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

  it('falls back to the quick start for an unknown view', () => {
    expect(guideTopicForView('playbook')).toBe('plays');
    expect(guideTopicForView('unknown')).toBe('start');
  });
});

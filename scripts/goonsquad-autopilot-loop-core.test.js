import { describe, expect, it } from 'vitest';
import {
  buildLoopSummary,
  buildCodexExecArgs,
  buildCodexSpawnOptions,
  createNextRunnerState,
  codexSpawnOptions,
  parseRunnerArgs,
  shouldSkipRepeatedPrompt,
} from './goonsquad-autopilot-loop-core.mjs';

describe('goonsquad autopilot loop core', () => {
  it('parses loop execution flags with a bounded iteration count', () => {
    expect(parseRunnerArgs(['--loop', '--execute', '--iterations=4', '--force'])).toEqual({
      execute: true,
      force: true,
      loop: true,
      maxIterations: 4,
    });
  });

  it('defaults to one non-executing slice when loop flags are omitted', () => {
    expect(parseRunnerArgs([])).toEqual({
      execute: false,
      force: false,
      loop: false,
      maxIterations: 1,
    });
  });

  it('skips repeated prompts unless force is enabled', () => {
    expect(shouldSkipRepeatedPrompt({
      force: false,
      previousHash: 'same',
      promptHash: 'same',
    })).toBe(true);
    expect(shouldSkipRepeatedPrompt({
      force: true,
      previousHash: 'same',
      promptHash: 'same',
    })).toBe(false);
  });

  it('records loop history without losing the selected requirement', () => {
    const next = createNextRunnerState({
      previousState: {
        history: [{ selectedRequirementId: 'old-slice', promptHash: 'abc' }],
      },
      promptHash: 'def',
      selectedRequirementId: 'field-player-closeup-art-and-hand-contact',
      executed: true,
      iteration: 2,
    });

    expect(next.lastPromptHash).toBe('def');
    expect(next.selectedRequirementId).toBe('field-player-closeup-art-and-hand-contact');
    expect(next.history).toHaveLength(2);
    expect(next.history.at(-1)).toMatchObject({
      iteration: 2,
      selectedRequirementId: 'field-player-closeup-art-and-hand-contact',
      promptHash: 'def',
      executed: true,
    });
  });

  it('summarizes completed loop work for CLI output', () => {
    const summary = buildLoopSummary([
      { iteration: 1, selectedRequirementId: 'player-closeup', executed: true },
      { iteration: 2, selectedRequirementId: 'motion-retargeting', executed: false },
    ]);

    expect(summary).toContain('1. player-closeup (executed)');
    expect(summary).toContain('2. motion-retargeting (prepared)');
  });

  it('launches delegated Codex slices with non-interactive write permissions', () => {
    expect(buildCodexExecArgs('build the next slice')).toEqual([
      'exec',
      '--dangerously-bypass-approvals-and-sandbox',
      '-c',
      'service_tier="fast"',
      '-',
    ]);
  });

  it('uses the Windows shell for npm shim compatibility', () => {
    expect(codexSpawnOptions('win32')).toMatchObject({ shell: true });
    expect(codexSpawnOptions('linux')).toMatchObject({ shell: false });
  });

  it('pipes the delegated prompt through stdin when Codex reads from dash', () => {
    expect(buildCodexSpawnOptions({
      cwd: 'C:/Projects/goonsquad-playbook',
      platform: 'win32',
      prompt: 'next high-impact 3D slice',
    })).toEqual({
      cwd: 'C:/Projects/goonsquad-playbook',
      input: 'next high-impact 3D slice',
      shell: true,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  });
});

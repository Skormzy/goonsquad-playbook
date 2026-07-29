export function parseRunnerArgs(argv = []) {
  const args = new Set(argv);
  const iterationFlag = argv.find((arg) => arg.startsWith('--iterations=') || arg.startsWith('--max-iterations='));
  const parsedIterations = iterationFlag
    ? Number.parseInt(iterationFlag.split('=').at(-1), 10)
    : null;

  return {
    execute: args.has('--execute'),
    force: args.has('--force'),
    loop: args.has('--loop'),
    maxIterations: Number.isFinite(parsedIterations) && parsedIterations > 0
      ? parsedIterations
      : (args.has('--loop') ? 3 : 1),
  };
}

export function shouldSkipRepeatedPrompt({ force = false, previousHash, promptHash }) {
  return !force && Boolean(previousHash) && previousHash === promptHash;
}

export function createNextRunnerState({
  previousState = {},
  promptHash,
  selectedRequirementId,
  executed,
  iteration,
}) {
  const entry = {
    updatedAt: new Date().toISOString(),
    iteration,
    selectedRequirementId: selectedRequirementId ?? null,
    promptHash,
    executed,
  };
  const history = [...(previousState.history ?? []), entry].slice(-50);

  return {
    updatedAt: entry.updatedAt,
    lastPromptHash: promptHash,
    selectedRequirementId: selectedRequirementId ?? null,
    executed,
    history,
  };
}

export function buildLoopSummary(entries = []) {
  if (entries.length === 0) return 'No Autopilot slices were prepared.';

  return entries
    .map((entry) => {
      const state = entry.executed ? 'executed' : 'prepared';
      return `${entry.iteration}. ${entry.selectedRequirementId ?? 'none'} (${state})`;
    })
    .join('\n');
}

export function buildCodexExecArgs() {
  return [
    'exec',
    '--dangerously-bypass-approvals-and-sandbox',
    '-c',
    'service_tier="fast"',
    '-',
  ];
}

export function codexSpawnOptions(platform = process.platform) {
  return {
    shell: platform === 'win32',
  };
}

export function buildCodexSpawnOptions({
  cwd,
  platform = process.platform,
  prompt,
}) {
  return {
    cwd,
    input: prompt,
    stdio: ['pipe', 'inherit', 'inherit'],
    ...codexSpawnOptions(platform),
  };
}

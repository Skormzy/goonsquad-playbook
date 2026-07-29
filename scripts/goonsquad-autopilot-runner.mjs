import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { compileAutopilot, writeAutopilotArtifacts } from './goonsquad-autopilot-compiler.mjs';
import {
  buildCodexExecArgs,
  buildCodexSpawnOptions,
  buildLoopSummary,
  createNextRunnerState,
  parseRunnerArgs,
  shouldSkipRepeatedPrompt,
} from './goonsquad-autopilot-loop-core.mjs';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

function resolveProjectPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

function readJsonIfExists(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function commandExists(command) {
  const lookup = process.platform === 'win32' ? 'where.exe' : 'command';
  const args = process.platform === 'win32' ? [command] : ['-v', command];
  const result = childProcess.spawnSync(lookup, args, { stdio: 'ignore' });
  return result.status === 0;
}

function runCodexExec(prompt) {
  if (!commandExists('codex')) {
    throw new Error('codex CLI was not found on PATH. Autopilot artifacts were prepared, but execution could not be delegated.');
  }

  const result = childProcess.spawnSync('codex', buildCodexExecArgs(), {
    ...buildCodexSpawnOptions({ cwd: root, prompt }),
  });

  if (result.status !== 0) {
    const detail = result.error ? ` (${result.error.message})` : '';
    throw new Error(`codex exec failed with status ${result.status}${detail}.`);
  }
}

function runAutopilotRunner(argv = process.argv.slice(2)) {
  const options = parseRunnerArgs(argv);
  const loopEntries = [];

  for (let iteration = 1; iteration <= options.maxIterations; iteration += 1) {
    const compilation = compileAutopilot();
    const policy = compilation.checklist.policy ?? {};
    const stopFile = resolveProjectPath(policy.stopFile ?? '.superpowers/goonsquad-autopilot/STOP');
    const runnerStatePath = resolveProjectPath(policy.runnerStatePath ?? '.superpowers/goonsquad-autopilot/runner-state.json');

    if (fs.existsSync(stopFile)) {
      console.log(`Autopilot stopped by ${path.relative(root, stopFile)}.`);
      break;
    }

    const previousState = readJsonIfExists(runnerStatePath);

    if (shouldSkipRepeatedPrompt({
      force: options.force,
      previousHash: previousState.lastPromptHash,
      promptHash: compilation.promptHash,
    })) {
      writeAutopilotArtifacts(compilation);
      console.log(`Autopilot prepared the same next slice: ${compilation.requirement?.id ?? 'none'}.`);
      console.log('Use --force after reviewing the existing artifacts, or change checklist status/evidence.');
      break;
    }

    const artifacts = writeAutopilotArtifacts(compilation);
    const entry = {
      iteration,
      selectedRequirementId: compilation.requirement?.id ?? null,
      promptHash: compilation.promptHash,
      executed: options.execute,
    };

    writeJson(runnerStatePath, createNextRunnerState({
      previousState,
      promptHash: compilation.promptHash,
      selectedRequirementId: compilation.requirement?.id ?? null,
      executed: options.execute,
      iteration,
    }));

    loopEntries.push(entry);
    console.log(`Selected: ${entry.selectedRequirementId ?? 'none'}`);
    console.log(`Report: ${path.relative(root, artifacts.reportPath)}`);
    console.log(`Context pack: ${path.relative(root, artifacts.contextPackPath)}`);

    if (!compilation.requirement) break;

    if (options.execute) {
      runCodexExec(compilation.prompt);
    } else {
      console.log('Prepared one Autopilot slice. Pass --execute to delegate through codex exec when the CLI is available.');
      break;
    }

    if (!options.loop) break;
  }

  console.log('Autopilot loop summary:');
  console.log(buildLoopSummary(loopEntries));
}

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  runAutopilotRunner();
}

export { runAutopilotRunner };

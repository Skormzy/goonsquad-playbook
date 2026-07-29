import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

export const DEFAULT_CHECKLIST_PATH = path.join(root, 'docs', '3d-quality', 'autopilot-requirements.json');

function resolveProjectPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function loadChecklist(filePath = DEFAULT_CHECKLIST_PATH) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function selectNextRequirement(checklist) {
  const requirements = checklist.requirements ?? [];
  const candidates = requirements
    .filter((requirement) => !['done', 'blocked'].includes(requirement.status))
    .sort((a, b) => {
      const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDelta !== 0) return priorityDelta;
      return String(a.id).localeCompare(String(b.id));
    });

  return candidates[0] ?? null;
}

export function buildStatusSummary(checklist) {
  return (checklist.requirements ?? []).reduce((summary, requirement) => {
    const status = requirement.status ?? 'unknown';
    summary[status] = (summary[status] ?? 0) + 1;
    return summary;
  }, {});
}

function formatList(items = []) {
  if (items.length === 0) return '- None listed';
  return items.map((item) => `- ${item}`).join('\n');
}

function formatRequirementForPrompt(requirement) {
  return [
    `Selected requirement: ${requirement.id}`,
    `Title: ${requirement.title}`,
    `Category: ${requirement.category}`,
    `Status: ${requirement.status}`,
    `Priority: ${requirement.priority}`,
    `Why it matters: ${requirement.why}`,
    '',
    'Acceptance:',
    formatList(requirement.acceptance),
    '',
    'Required verification:',
    formatList(requirement.verification),
    '',
    'Likely files:',
    formatList(requirement.files),
  ].join('\n');
}

export function buildAutopilotPrompt(checklist, requirement) {
  if (!requirement) {
    return [
      'Goon Squad 3D Autopilot found no unfinished requirements.',
      'Run verification, review the latest screenshots, and only add new checklist items if real gaps remain.',
    ].join('\n');
  }

  return [
    'Autonomous Goon Squad 3D quality slice. Do not ask what to do next.',
    '',
    'Goal: build a state-of-the-art 3D ball hockey playbook by moving the replay toward broadcast-quality realism using research-backed scale, production-grade athlete assets, realistic movement, believable ball behavior, and clean responsive presentation. Do not copy third-party game assets or branding.',
    '',
    'Use docs/3d-quality/autopilot-requirements.json as the source of truth. Treat the selected requirement below as the next bounded work slice. If you discover a more severe blocker, update the checklist evidence and switch only if the blocker prevents this slice.',
    '',
    formatRequirementForPrompt(requirement),
    '',
    'Required loop:',
    '- Capture fresh desktop and mobile replay screenshots before judging the visual state when a browser is available.',
    '- Write a short scorecard covering player realism, body proportions, running animation, stick handling, ball behavior, rink scale and shape, boards/glass/net, lighting/shadows, broadcast camera, and UI clutter.',
    '- Implement the highest-impact real improvement for the selected requirement.',
    '- Avoid tiny cosmetic tweaks unless they unblock the selected requirement.',
    '- Do not mark a requirement done just because one pass improved it; leave it in_progress when the score remains below the target quality bar.',
    '- Keep coaching overlays off by default and keep captions below the playing surface.',
    '- Keep 12 players visible: 5v5 plus both goalies.',
    '- No audio work.',
    '- Update docs/3d-quality/autopilot-requirements.json with status and evidence.',
    '',
    'Verification gate:',
    '- Run the selected requirement verification commands where possible.',
    '- Run npm run check:terms.',
    '- Run npm run build before claiming the slice is healthy.',
    '- Capture fresh screenshots for visual requirements.',
    '',
    `Runtime cap: ${checklist.policy?.runtimeCapMinutes ?? 25} minutes for one slice.`,
    'Stop condition: stop after one verified slice, a real blocker with evidence, or the configured stop file.',
  ].join('\n');
}

export function buildReport({ checklist, requirement, promptHash }) {
  const summary = buildStatusSummary(checklist);
  const summaryLines = Object.entries(summary)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `- ${status}: ${count}`)
    .join('\n');

  if (!requirement) {
    return [
      '# Goon Squad 3D Autopilot Report',
      '',
      `Updated: ${new Date().toISOString()}`,
      '',
      'No unfinished requirements were found.',
      '',
      '## Checklist Status',
      summaryLines,
    ].join('\n');
  }

  return [
    '# Goon Squad 3D Autopilot Report',
    '',
    `Updated: ${new Date().toISOString()}`,
    `Prompt hash: ${promptHash}`,
    '',
    '## Next Slice',
    '',
    `- Requirement: ${requirement.id}`,
    `- Category: ${requirement.category}`,
    `- Priority: ${requirement.priority}`,
    `- Status: ${requirement.status}`,
    `- Reason: ${requirement.why}`,
    '',
    '## Acceptance',
    '',
    formatList(requirement.acceptance),
    '',
    '## Verification',
    '',
    formatList(requirement.verification),
    '',
    '## Checklist Status',
    '',
    summaryLines,
  ].join('\n');
}

export function buildContextPack({ checklist, requirement }) {
  const topOpen = (checklist.requirements ?? [])
    .filter((item) => item.status !== 'done')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 8)
    .map((item) => `- ${item.priority}: ${item.id} (${item.status})`)
    .join('\n');

  return [
    '# Goon Squad 3D Autopilot Context Pack',
    '',
    `Goal: ${checklist.goal}`,
    '',
    '## Current Selection',
    '',
    requirement ? formatRequirementForPrompt(requirement) : 'No unfinished requirement selected.',
    '',
    '## Highest-Priority Open Items',
    '',
    topOpen || '- None',
    '',
    '## Project Rules',
    '',
    '- Vite + React SPA.',
    '- Ball hockey wording only.',
    '- 12 players visible in every tactical replay.',
    '- Captions and teaching text below the playing surface.',
    '- Production player GLBs are the final path for athlete realism.',
  ].join('\n');
}

export function compileAutopilot(checklistPath = DEFAULT_CHECKLIST_PATH) {
  const checklist = loadChecklist(checklistPath);
  const requirement = selectNextRequirement(checklist);
  const prompt = buildAutopilotPrompt(checklist, requirement);
  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');

  return {
    checklist,
    requirement,
    prompt,
    promptHash,
    report: buildReport({ checklist, requirement, promptHash }),
    contextPack: buildContextPack({ checklist, requirement }),
  };
}

export function writeAutopilotArtifacts(compilation) {
  const policy = compilation.checklist.policy ?? {};
  const reportPath = resolveProjectPath(policy.reportPath ?? 'analysis/goonsquad-autopilot-report.md');
  const contextPackPath = resolveProjectPath(policy.contextPackPath ?? 'agent-context/goonsquad-autopilot-pack.md');
  const privatePayloadPath = resolveProjectPath(policy.privatePayloadPath ?? '.superpowers/goonsquad-autopilot/autopilot.json');

  ensureDirectory(reportPath);
  ensureDirectory(contextPackPath);
  ensureDirectory(privatePayloadPath);

  fs.writeFileSync(reportPath, `${compilation.report}\n`);
  fs.writeFileSync(contextPackPath, `${compilation.contextPack}\n`);
  fs.writeFileSync(privatePayloadPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    promptHash: compilation.promptHash,
    selectedRequirementId: compilation.requirement?.id ?? null,
    prompt: compilation.prompt,
  }, null, 2)}\n`);

  return {
    reportPath,
    contextPackPath,
    privatePayloadPath,
  };
}

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  const compilation = compileAutopilot();
  const artifacts = writeAutopilotArtifacts(compilation);

  console.log(`Selected: ${compilation.requirement?.id ?? 'none'}`);
  console.log(`Prompt hash: ${compilation.promptHash}`);
  console.log(`Report: ${path.relative(root, artifacts.reportPath)}`);
  console.log(`Context pack: ${path.relative(root, artifacts.contextPackPath)}`);
  console.log(`Private payload: ${path.relative(root, artifacts.privatePayloadPath)}`);
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const VALID_REQUIREMENT_STATUSES = new Set(['pending', 'in_progress', 'done', 'blocked']);

export function validateRequirementsDocument(document) {
  const errors = [];
  const requirements = document?.requirements ?? [];
  const ids = new Set();

  if (document?.version !== 1) errors.push('Requirements document must use version 1.');
  if (!document?.activeMilestone) errors.push('Requirements document needs an active milestone.');
  if (requirements.length === 0) errors.push('Requirements document needs at least one requirement.');

  requirements.forEach((requirement) => {
    if (!requirement.id) errors.push('Every requirement needs an ID.');
    if (ids.has(requirement.id)) errors.push(`Duplicate requirement ID: ${requirement.id}.`);
    ids.add(requirement.id);
    if (!requirement.milestone) errors.push(`${requirement.id} needs a milestone.`);
    if (!VALID_REQUIREMENT_STATUSES.has(requirement.status)) errors.push(`${requirement.id} has an invalid status.`);
    if (!Number.isFinite(requirement.priority)) errors.push(`${requirement.id} needs a numeric priority.`);
    if (!Array.isArray(requirement.acceptance) || requirement.acceptance.length === 0) errors.push(`${requirement.id} needs acceptance checks.`);
  });

  requirements.forEach((requirement) => {
    (requirement.dependencies ?? []).forEach((dependency) => {
      if (!ids.has(dependency)) errors.push(`${requirement.id} has an unknown dependency: ${dependency}.`);
    });
  });

  return errors;
}

function dependenciesDone(requirement, byId) {
  return (requirement.dependencies ?? []).every((id) => byId.get(id)?.status === 'done');
}

export function selectNextRequirement(document) {
  const requirements = document.requirements ?? [];
  const byId = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const candidates = requirements
    .filter((requirement) => requirement.milestone === document.activeMilestone)
    .filter((requirement) => requirement.status === 'in_progress'
      || (requirement.status === 'pending' && dependenciesDone(requirement, byId)))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'in_progress' ? -1 : 1;
      return b.priority - a.priority || a.id.localeCompare(b.id);
    });

  return candidates[0] ?? null;
}

export function summarizeRequirements(document) {
  const counts = Object.fromEntries([...VALID_REQUIREMENT_STATUSES].map((status) => [status, 0]));
  for (const requirement of document.requirements ?? []) counts[requirement.status] += 1;
  return {
    activeMilestone: document.activeMilestone,
    counts,
    nextRequirement: selectNextRequirement(document),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runCli() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const requirementsPath = path.join(root, 'docs', 'vnext', 'requirements.json');
  const statePath = path.join(root, 'docs', 'vnext', 'autopilot-state.json');
  const requirements = readJson(requirementsPath);
  const state = readJson(statePath);
  const errors = validateRequirementsDocument(requirements);

  if (errors.length > 0) {
    console.error(JSON.stringify({ valid: false, errors }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    valid: true,
    state,
    ...summarizeRequirements(requirements),
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli();

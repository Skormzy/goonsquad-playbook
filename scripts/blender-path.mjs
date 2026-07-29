import { access, readdir } from 'node:fs/promises';
import path from 'node:path';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function executableNames(platform = process.platform) {
  return platform === 'win32' ? ['blender.exe'] : ['blender'];
}

function envCandidates(env = process.env, platform = process.platform) {
  const explicit = [
    env.BLENDER_PATH,
    env.BLENDER_EXE,
  ];

  const pathEntries = (env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((entry) => executableNames(platform).map((name) => path.join(entry, name)));

  return [...explicit, ...pathEntries];
}

async function windowsInstallCandidates(env = process.env, readdirFn = readdir) {
  const bases = unique([
    env.ProgramFiles && path.join(env.ProgramFiles, 'Blender Foundation'),
    env['ProgramFiles(x86)'] && path.join(env['ProgramFiles(x86)'], 'Blender Foundation'),
    'C:\\Program Files\\Blender Foundation',
    'C:\\Program Files (x86)\\Blender Foundation',
  ]);

  const found = [];
  for (const base of bases) {
    try {
      const entries = await readdirFn(base, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.toLowerCase().startsWith('blender')) {
          found.push(path.join(base, entry.name, 'blender.exe'));
        }
      }
    } catch {
      // Not installed in this base path.
    }
  }

  return found.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

export async function getBlenderCandidates({
  env = process.env,
  platform = process.platform,
  readdirFn = readdir,
} = {}) {
  const candidates = [...envCandidates(env, platform)];
  if (platform === 'win32') {
    candidates.push(...await windowsInstallCandidates(env, readdirFn));
  } else if (platform === 'darwin') {
    candidates.push('/Applications/Blender.app/Contents/MacOS/Blender');
  }
  return unique(candidates);
}

export async function findBlenderExecutable({
  env = process.env,
  platform = process.platform,
  accessFn = access,
  readdirFn = readdir,
} = {}) {
  const candidates = await getBlenderCandidates({ env, platform, readdirFn });
  for (const candidate of candidates) {
    try {
      await accessFn(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

export function blenderNotFoundMessage(candidates) {
  return [
    'Blender executable was not found.',
    '',
    'Set BLENDER_PATH to the full Blender executable path, or install Blender in a standard location.',
    '',
    'Checked:',
    ...candidates.map((candidate) => `  - ${candidate}`),
  ].join('\n');
}

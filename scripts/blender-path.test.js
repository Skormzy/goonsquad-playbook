import { describe, expect, it } from 'vitest';
import { findBlenderExecutable, getBlenderCandidates } from './blender-path.mjs';

describe('Blender executable discovery', () => {
  it('prefers explicit Blender environment paths', async () => {
    const candidates = await getBlenderCandidates({
      env: {
        BLENDER_PATH: 'C:\\Tools\\Blender\\blender.exe',
        PATH: '',
      },
      platform: 'win32',
      readdirFn: async () => [],
    });

    expect(candidates[0]).toBe('C:\\Tools\\Blender\\blender.exe');
  });

  it('searches Windows Blender Foundation installs', async () => {
    const candidates = await getBlenderCandidates({
      env: {
        ProgramFiles: 'C:\\Program Files',
        PATH: '',
      },
      platform: 'win32',
      readdirFn: async () => [
        { name: 'Blender 4.3', isDirectory: () => true },
        { name: 'Blender 5.1', isDirectory: () => true },
        { name: 'Readme.txt', isDirectory: () => false },
      ],
    });

    expect(candidates).toContain('C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe');
    expect(candidates).toContain('C:\\Program Files\\Blender Foundation\\Blender 4.3\\blender.exe');
  });

  it('returns the first accessible executable candidate', async () => {
    const found = await findBlenderExecutable({
      env: {
        BLENDER_PATH: 'C:\\Missing\\blender.exe',
        PATH: 'C:\\Tools',
      },
      platform: 'win32',
      readdirFn: async () => [],
      accessFn: async (candidate) => {
        if (candidate !== 'C:\\Tools\\blender.exe') {
          throw new Error('missing');
        }
      },
    });

    expect(found).toBe('C:\\Tools\\blender.exe');
  });
});

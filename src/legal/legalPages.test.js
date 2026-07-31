import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const projectFile = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('public legal pages', () => {
  it.each([
    ['public/privacy.html', 'Privacy Policy'],
    ['public/terms.html', 'Terms of Service'],
  ])('%s is a complete public page', (path, title) => {
    const page = projectFile(path);
    expect(page).toContain(`<h1>${title}</h1>`);
    expect(page).toContain('Effective July 31, 2026');
    expect(page).toContain('Goon Squad team app');
    expect(page).toContain('Return to app');
  });

  it('publishes stable clean URLs for platform reviews', () => {
    const vercel = JSON.parse(projectFile('vercel.json'));
    expect(vercel.rewrites).toEqual(expect.arrayContaining([
      { source: '/privacy', destination: '/privacy.html' },
      { source: '/terms', destination: '/terms.html' },
    ]));
  });
});

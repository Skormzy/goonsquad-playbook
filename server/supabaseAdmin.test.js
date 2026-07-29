import { afterEach, describe, expect, it } from 'vitest';
import {
  createServerClients,
  parseJsonBody,
  publicAppUrl,
} from './supabaseAdmin';

const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const originalPublicUrl = process.env.PUBLIC_APP_URL;

afterEach(() => {
  if (originalServiceKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  if (originalPublicUrl == null) delete process.env.PUBLIC_APP_URL;
  else process.env.PUBLIC_APP_URL = originalPublicUrl;
});

describe('server account helpers', () => {
  it('refuses to create an admin client without a server-only service key', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => createServerClients()).toThrow('Server account management is not configured.');
  });

  it('uses the active deployment host for password recovery by default', () => {
    delete process.env.PUBLIC_APP_URL;
    expect(publicAppUrl({
      headers: {
        host: 'goonsquad-playbook.vercel.app',
        'x-forwarded-proto': 'https',
      },
    })).toBe('https://goonsquad-playbook.vercel.app');
  });

  it('accepts parsed or serialized request bodies', () => {
    expect(parseJsonBody({ body: { action: 'list' } })).toEqual({ action: 'list' });
    expect(parseJsonBody({ body: '{"action":"list"}' })).toEqual({ action: 'list' });
  });
});

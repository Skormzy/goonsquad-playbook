import { normalizeUsername, usernameValidationMessage } from '../../src/account/username.js';
import {
  createServerClients,
  parseJsonBody,
  sendApiError,
  setPrivateResponseHeaders,
} from '../../server/supabaseAdmin.js';

const LOGIN_ERROR = 'Email, username, or password is incorrect.';

export default async function handler(request, response) {
  setPrivateResponseHeaders(response);
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const { identifier, password } = parseJsonBody(request);
    const username = normalizeUsername(identifier);
    if (usernameValidationMessage(username) || typeof password !== 'string' || password.length < 8) {
      response.status(400).json({ error: LOGIN_ERROR });
      return;
    }

    const { admin, publicClient } = createServerClients();
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();
    if (!profile?.id) {
      response.status(400).json({ error: LOGIN_ERROR });
      return;
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError || !userData?.user?.email) {
      response.status(400).json({ error: LOGIN_ERROR });
      return;
    }

    const { data, error } = await publicClient.auth.signInWithPassword({
      email: userData.user.email,
      password,
    });
    if (error || !data?.session) {
      response.status(400).json({ error: LOGIN_ERROR });
      return;
    }

    response.status(200).json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  } catch (error) {
    sendApiError(response, error, 'Username sign-in is temporarily unavailable.');
  }
}

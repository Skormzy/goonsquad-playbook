import {
  bearerToken,
  configuredAccountOwnerEmail,
  createServerClients,
  sendApiError,
  setPrivateResponseHeaders,
} from '../../server/supabaseAdmin.js';

export default async function handler(request, response) {
  setPrivateResponseHeaders(response);
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const token = bearerToken(request);
    if (!token) {
      const error = new Error('Sign in to continue.');
      error.statusCode = 401;
      throw error;
    }

    const ownerEmail = configuredAccountOwnerEmail();
    if (!ownerEmail) {
      response.status(200).json({ promoted: false });
      return;
    }

    const { admin } = createServerClients();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      const error = new Error('Your session has expired. Sign in again.');
      error.statusCode = 401;
      throw error;
    }

    if (String(user.email || '').trim().toLowerCase() !== ownerEmail) {
      response.status(200).json({ promoted: false });
      return;
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) throw profileError || new Error('Account profile is unavailable.');

    if (profile.role !== 'admin') {
      const { error: updateError } = await admin
        .from('profiles')
        .update({ role: 'admin', updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (updateError) throw updateError;
    }

    response.status(200).json({ promoted: profile.role !== 'admin' });
  } catch (error) {
    sendApiError(response, error, 'Owner access could not be configured.');
  }
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createPlaymakerAccount,
  playmakerCloudConfigured,
  playmakerCloudSession,
  sendPlaymakerPasswordReset,
  signInPlaymakerAccount,
  signInPlaymakerWithGoogle,
  signOutPlaymakerAccount,
  updatePlaymakerPassword,
  watchPlaymakerCloudSession,
} from '../playmaker/playmakerCloud';
import {
  checkAccountUsernameAvailability,
  loadAccountProfile,
  loadMemberPlayerClaims,
  releaseMemberPlayerClaim,
  requestMemberPlayerClaim,
  updateAccountProfile,
} from './accountCloud';

const fallbackAccount = Object.freeze({
  configured: false,
  session: null,
  user: null,
  profile: null,
  playerClaims: [],
  displayName: 'Guest',
  username: '',
  busy: false,
  status: '',
  statusTone: '',
  passwordRecovery: false,
  dialogOpen: false,
  openAccount: () => {},
  closeAccount: () => {},
  clearStatus: () => {},
  checkUsername: async () => ({ available: false }),
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  resetPassword: async () => {},
  updatePassword: async () => {},
  signOut: async () => {},
  saveProfile: async () => {},
  claimPlayer: async () => {},
  releasePlayer: async () => {},
  refreshProfile: async () => {},
});

const AccountContext = createContext(fallbackAccount);

export function accountMessageForError(error) {
  const message = String(error instanceof Error ? error.message : error || '').trim();
  const normalized = message.toLowerCase();

  if (/username.*taken|duplicate key.*username/iu.test(message)) {
    return 'That username is already taken.';
  }
  if (/invalid login|invalid credentials|email or password/iu.test(message)) {
    return 'Email or password is incorrect.';
  }
  if (/email.*not confirmed|confirm.*email/iu.test(message)) {
    return 'Confirm your email before signing in.';
  }
  if (/already registered|user already exists|email.*already/iu.test(message)) {
    return 'An account already exists for that email. Try signing in.';
  }
  if (/rate limit|too many requests|over.*email.*rate/iu.test(message)) {
    return 'Too many attempts. Wait a moment, then try again.';
  }
  if (/failed to fetch|network|fetch failed|connection/iu.test(message)) {
    return 'Could not reach the account service. Check your connection and try again.';
  }
  if (/oauth|google/iu.test(message)) {
    return 'Google sign-in could not be completed. Please try again.';
  }
  if (/not configured|not connected/iu.test(message)) {
    return 'Accounts are temporarily unavailable. Your local plays remain safe.';
  }
  if (
    normalized === 'display name is required.'
    || normalized === 'sign in before updating your profile.'
    || normalized === 'sign in before syncing this play.'
    || /^username must /u.test(normalized)
    || /^username can /u.test(normalized)
  ) {
    return message;
  }
  return 'We could not complete that account request. Please try again.';
}

export function AccountProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [playerClaims, setPlayerClaims] = useState([]);
  const [busy, setBusy] = useState(playmakerCloudConfigured);
  const [status, setStatus] = useState('');
  const [statusTone, setStatusTone] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const refreshProfileForUser = useCallback(async (userId) => {
    if (!playmakerCloudConfigured || !userId) {
      setProfile(null);
      setPlayerClaims([]);
      return null;
    }
    let nextProfile = null;
    try {
      nextProfile = await loadAccountProfile(userId);
      setProfile(nextProfile);
    } catch {
      // Authentication remains usable while a deployment is waiting for its profile migration.
      setProfile(null);
    }

    try {
      setPlayerClaims(await loadMemberPlayerClaims(userId));
    } catch {
      // A profile should still load when the newer member-claim migration has not landed yet.
      setPlayerClaims([]);
    }
    return nextProfile;
  }, []);

  const refreshProfile = useCallback(
    () => refreshProfileForUser(session?.user?.id),
    [refreshProfileForUser, session?.user?.id],
  );

  useEffect(() => {
    if (!playmakerCloudConfigured) {
      setBusy(false);
      return undefined;
    }
    let active = true;
    playmakerCloudSession()
      .then((nextSession) => {
        if (!active) return;
        setSession(nextSession);
        return refreshProfileForUser(nextSession?.user?.id);
      })
      .catch((error) => {
        if (!active) return;
        setStatus(accountMessageForError(error));
        setStatusTone('error');
      })
      .finally(() => { if (active) setBusy(false); });
    const stop = watchPlaymakerCloudSession((nextSession, event) => {
      setSession(nextSession);
      setStatus('');
      setStatusTone('');
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        try {
          setDialogOpen(new URL(window.location.href).searchParams.get('content') !== 'account');
        } catch {
          setDialogOpen(true);
        }
      }
      refreshProfileForUser(nextSession?.user?.id);
    });
    return () => {
      active = false;
      stop();
    };
  }, [refreshProfileForUser]);

  const run = useCallback(async (operation, successMessage = '') => {
    setBusy(true);
    setStatus('');
    setStatusTone('');
    try {
      const result = await operation();
      if (successMessage) {
        setStatus(successMessage);
        setStatusTone('success');
      }
      return result;
    } catch (error) {
      setStatus(accountMessageForError(error));
      setStatusTone('error');
      throw error;
    } finally {
      setBusy(false);
    }
  }, []);

  const signIn = useCallback((email, password) => run(
    () => signInPlaymakerAccount(email, password),
    'Signed in.',
  ), [run]);

  const signUp = useCallback((email, password, displayName, username) => run(async () => {
    const availability = await checkAccountUsernameAvailability(username);
    if (availability.validationError) throw new Error(availability.validationError);
    if (!availability.available) throw new Error('That username is already taken.');
    return createPlaymakerAccount(email, password, displayName, availability.username);
  },
    'Account created. Check your email if confirmation is enabled.',
  ), [run]);

  const signInWithGoogle = useCallback(() => run(
    signInPlaymakerWithGoogle,
    'Opening Google sign in.',
  ), [run]);

  const resetPassword = useCallback((email) => run(
    () => sendPlaymakerPasswordReset(email),
    'Password reset link sent. Check your email.',
  ), [run]);

  const updatePassword = useCallback((password) => run(async () => {
    await updatePlaymakerPassword(password);
    setPasswordRecovery(false);
  }, 'Password updated.'), [run]);

  const signOut = useCallback(() => run(async () => {
    await signOutPlaymakerAccount();
    setSession(null);
    setProfile(null);
    setPlayerClaims([]);
    setPasswordRecovery(false);
  }, 'Signed out.'), [run]);

  const saveProfile = useCallback((updates) => run(async () => {
    const nextProfile = await updateAccountProfile(session?.user?.id, updates);
    setProfile(nextProfile);
    return nextProfile;
  }, 'Profile updated.'), [run, session?.user?.id]);

  const claimPlayer = useCallback((player) => run(async () => {
    await requestMemberPlayerClaim(player);
    const nextClaims = await loadMemberPlayerClaims(session?.user?.id);
    setPlayerClaims(nextClaims);
    return nextClaims;
  }, 'Squad stats linked.'), [run, session?.user?.id]);

  const releasePlayer = useCallback((playerId) => run(async () => {
    await releaseMemberPlayerClaim(playerId);
    const nextClaims = await loadMemberPlayerClaims(session?.user?.id);
    setPlayerClaims(nextClaims);
    return nextClaims;
  }, 'Player link removed.'), [run, session?.user?.id]);

  const displayName = profile?.display_name
    || session?.user?.user_metadata?.full_name
    || session?.user?.email?.split('@')[0]
    || 'Guest';
  const username = profile?.username
    || session?.user?.user_metadata?.username
    || '';

  const checkUsername = useCallback(
    (value) => checkAccountUsernameAvailability(value),
    [],
  );

  const value = useMemo(() => ({
    configured: playmakerCloudConfigured,
    session,
    user: session?.user ?? null,
    profile,
    playerClaims,
    displayName,
    username,
    busy,
    status,
    statusTone,
    passwordRecovery,
    dialogOpen,
    openAccount: () => setDialogOpen(true),
    closeAccount: () => setDialogOpen(false),
    clearStatus: () => {
      setStatus('');
      setStatusTone('');
    },
    checkUsername,
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
    updatePassword,
    signOut,
    saveProfile,
    claimPlayer,
    releasePlayer,
    refreshProfile,
  }), [busy, checkUsername, claimPlayer, dialogOpen, displayName, passwordRecovery, playerClaims, profile, refreshProfile, releasePlayer, resetPassword, session, signIn, signInWithGoogle, signOut, signUp, saveProfile, status, statusTone, updatePassword, username]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  return useContext(AccountContext);
}

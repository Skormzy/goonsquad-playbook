import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { useAccount } from './AccountContext';
import { useApp } from '../context/AppContext';
import { teamAccessPromptCopy } from './teamAccess';
import './teamAccess.css';

function destinationLabel(view) {
  if (view === 'playbook' || view === 'replay3d') return 'Plays';
  if (view === 'tactics' || view === 'strategy3d') return 'Strategy';
  if (view === 'playmaker') return 'Create';
  return 'This team workspace';
}

function AccessIcon({ state }) {
  if (state === 'pending') return <Clock3 aria-hidden="true" />;
  if (state === 'granted') return <BadgeCheck aria-hidden="true" />;
  return <LockKeyhole aria-hidden="true" />;
}

function AccessAction({ account, close, compact = false, setActiveView }) {
  if (account.teamAccessState === 'loading' || account.teamAccessState === 'unavailable') {
    return null;
  }

  if (account.teamAccessState === 'signed-out') {
    return (
      <button
        type="button"
        className="team-access-primary"
        onClick={() => {
          close();
          account.openAccount();
        }}
      >
        <LogIn aria-hidden="true" />
        <span>Create account or sign in</span>
        {!compact && <ArrowRight aria-hidden="true" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="team-access-primary"
      onClick={() => {
        close();
        setActiveView('profile');
      }}
    >
      <UserRoundCheck aria-hidden="true" />
      <span>{account.teamAccessState === 'pending' ? 'View request' : 'Request player access'}</span>
      {!compact && <ArrowRight aria-hidden="true" />}
    </button>
  );
}

export function TeamAccessPrompt() {
  const account = useAccount();
  const {
    closeTeamAccessPrompt,
    setActiveView,
    teamAccessPrompt,
  } = useApp();
  const dialogRef = useRef(null);
  const destination = destinationLabel(teamAccessPrompt.requestedView);
  const copy = teamAccessPromptCopy(account.teamAccessState, destination);

  useEffect(() => {
    if (!teamAccessPrompt.open) return undefined;
    const priorFocus = document.activeElement;
    dialogRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeTeamAccessPrompt();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      priorFocus?.focus?.({ preventScroll: true });
    };
  }, [closeTeamAccessPrompt, teamAccessPrompt.open]);

  if (!teamAccessPrompt.open) return null;

  return (
    <div
      className="team-access-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeTeamAccessPrompt();
      }}
    >
      <section
        ref={dialogRef}
        className="team-access-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-access-title"
        tabIndex={-1}
        data-state={account.teamAccessState}
      >
        <button
          type="button"
          className="team-access-close"
          onClick={closeTeamAccessPrompt}
          aria-label="Close access message"
          title="Close"
        >
          <X aria-hidden="true" />
        </button>
        <span className="team-access-icon"><AccessIcon state={account.teamAccessState} /></span>
        <div className="team-access-copy">
          <span>{copy.eyebrow}</span>
          <h2 id="team-access-title">{copy.title}</h2>
          <p>{copy.detail}</p>
        </div>
        <div className="team-access-actions">
          <AccessAction
            account={account}
            close={closeTeamAccessPrompt}
            setActiveView={setActiveView}
          />
          <button
            type="button"
            className="team-access-secondary"
            onClick={() => {
              closeTeamAccessPrompt();
              setActiveView('stats');
            }}
          >
            Back to Home
          </button>
        </div>
        <footer>
          <ShieldCheck aria-hidden="true" />
          <span>Home, schedules, results, standings, and public player statistics stay open.</span>
        </footer>
      </section>
    </div>
  );
}

export function PrivateWorkspaceGate({ requestedView }) {
  const account = useAccount();
  const { closeTeamAccessPrompt, setActiveView } = useApp();
  const destination = destinationLabel(requestedView);
  const copy = teamAccessPromptCopy(account.teamAccessState, destination);

  return (
    <main className="team-access-workspace" aria-labelledby="team-access-workspace-title">
      <span className="team-access-workspace-icon"><AccessIcon state={account.teamAccessState} /></span>
      <span>{copy.eyebrow}</span>
      <h1 id="team-access-workspace-title">{copy.title}</h1>
      <p>{copy.detail}</p>
      <AccessAction
        account={account}
        close={closeTeamAccessPrompt}
        compact
        setActiveView={setActiveView}
      />
    </main>
  );
}

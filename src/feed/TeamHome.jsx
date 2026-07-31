import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AtSign,
  BarChart3,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Film,
  Heart,
  ImagePlus,
  Link2,
  LockKeyhole,
  MessageCircle,
  MoreHorizontal,
  Pin,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  Trophy,
  UsersRound,
  X,
} from 'lucide-react';
import { useAccount } from '../account/AccountContext';
import { teamAccessPromptCopy } from '../account/teamAccess';
import { useApp } from '../context/AppContext';
import { loadStatisticsDataset } from '../stats/statsCloud';
import {
  ALL_SEASON_TEAMS_ID,
  formatGameDate,
  formatScheduleName,
  statsSnapshot,
} from '../stats/statsModel';
import {
  nextUpcomingGame,
  STATS_REFRESH_INTERVAL_MS,
} from '../stats/scheduleFreshness';
import {
  createTeamFeedComment,
  createTeamFeedPost,
  deleteTeamFeedComment,
  deleteTeamFeedPost,
  loadTeamFeed,
  markTeamFeedMentionsRead,
  setTeamFeedPostPinned,
  subscribeTeamFeed,
  toggleTeamFeedLike,
} from './feedCloud';
import {
  canPublishFeedPost,
  FEED_COMMENT_MAX_LENGTH,
  FEED_POST_MAX_LENGTH,
  feedTextParts,
  formatFeedTime,
  initialsForMember,
  linkDomain,
  validateFeedMedia,
} from './feedModel';
import './feed.css';

const FEED_FILTERS = Object.freeze([
  { id: 'latest', label: 'Latest' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'mentions', label: 'Mentions' },
]);

const FEED_MEDIA_REFRESH_INTERVAL_MS = 45 * 60 * 1000;

const QA_MEMBERS = Object.freeze([
  {
    id: 'qa-user',
    username: 'seymour',
    displayName: 'Seymour Korman',
    role: 'admin',
    playerId: '',
  },
  {
    id: 'qa-coach',
    username: 'coach',
    displayName: 'Coach',
    role: 'admin',
    playerId: '',
  },
  {
    id: 'qa-winger',
    username: 'winger',
    displayName: 'Ryan Hunt',
    role: 'member',
    playerId: '',
  },
]);

const QA_POSTS = Object.freeze([
  {
    id: 'qa-post-1',
    authorId: 'qa-coach',
    author: QA_MEMBERS[1],
    body: 'Monday: arrive by 6:30. We are opening with the 1-2-2. @winger, call the ball side early.',
    linkUrl: '',
    mediaPath: '',
    mediaKind: '',
    mediaUrl: '',
    pinnedAt: '2026-07-30T14:00:00Z',
    createdAt: '2026-07-30T14:00:00Z',
    likedBy: ['qa-user', 'qa-winger'],
    comments: [{
      id: 'qa-comment-1',
      postId: 'qa-post-1',
      body: 'Got it. Inside-out pressure and protect the middle.',
      authorId: 'qa-winger',
      author: QA_MEMBERS[2],
      createdAt: '2026-07-30T14:10:00Z',
    }],
    mentions: [{
      id: 'qa-mention-1',
      commentId: null,
      mentionedUserId: 'qa-winger',
      createdBy: 'qa-coach',
      readAt: null,
    }],
  },
  {
    id: 'qa-post-2',
    authorId: 'qa-user',
    author: QA_MEMBERS[0],
    body: 'Updated the D-zone faceoff lesson. The won and lost draw branches now use the same first read.',
    linkUrl: 'https://goonsquad.app/?content=plays',
    mediaPath: '',
    mediaKind: '',
    mediaUrl: '',
    pinnedAt: null,
    createdAt: '2026-07-30T12:00:00Z',
    likedBy: ['qa-coach'],
    comments: [],
    mentions: [],
  },
]);

function Avatar({ member, size = 'md' }) {
  return (
    <span className={`feed-avatar is-${size}`} aria-hidden="true">
      {member?.avatarUrl
        ? <img src={member.avatarUrl} alt="" />
        : initialsForMember(member)}
    </span>
  );
}

function RichFeedText({ children, members, onOpenMember }) {
  return (
    <p className="feed-rich-text">
      {feedTextParts(children, members).map((part, index) => (
        part.type === 'mention'
          ? part.member?.playerId
            ? (
              <button
                type="button"
                className="feed-mention"
                key={`${part.value}-${index}`}
                onClick={() => onOpenMember(part.member)}
              >
                {part.value}
              </button>
            )
            : <strong className="feed-mention is-static" key={`${part.value}-${index}`}>{part.value}</strong>
          : <span key={`text-${index}`}>{part.value}</span>
      ))}
    </p>
  );
}

function MentionInput({
  ariaLabel,
  maxLength,
  members,
  onChange,
  onSubmit,
  placeholder,
  rows = 1,
  value,
}) {
  const [activeQuery, setActiveQuery] = useState(null);
  const suggestions = useMemo(() => {
    if (activeQuery === null) return [];
    return members
      .filter((member) => {
        const haystack = `${member.username} ${member.displayName}`.toLowerCase();
        return haystack.includes(activeQuery.toLowerCase());
      })
      .slice(0, 5);
  }, [activeQuery, members]);

  const updateValue = (nextValue) => {
    onChange(nextValue);
    const match = nextValue.match(/(?:^|\s)@([a-z0-9_]*)$/iu);
    setActiveQuery(match ? match[1] : null);
  };

  const selectMember = (member) => {
    const next = value.replace(/(^|\s)@[a-z0-9_]*$/iu, `$1@${member.username} `);
    onChange(next);
    setActiveQuery(null);
  };

  return (
    <div className="feed-mention-input">
      <textarea
        aria-label={ariaLabel}
        maxLength={maxLength}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => updateValue(event.target.value)}
        onKeyDown={(event) => {
          if (rows === 1 && event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmit?.();
          }
        }}
      />
      {activeQuery !== null && suggestions.length > 0 && (
        <div className="feed-mention-menu" role="listbox" aria-label="Tag a teammate">
          {suggestions.map((member) => (
            <button
              type="button"
              key={member.id}
              role="option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectMember(member)}
            >
              <Avatar member={member} size="sm" />
              <span><strong>{member.displayName}</strong><small>@{member.username}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PostComposer({
  currentMember,
  members,
  onClose,
  onPublish,
  publishing,
}) {
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [error, setError] = useState('');
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : '', [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const chooseFile = (nextFile) => {
    const validation = validateFeedMedia(nextFile);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    setError('');
    setFile(nextFile);
  };

  const publish = async () => {
    if (!canPublishFeedPost({ body, file, linkUrl })) {
      setError('Add a message, link, photo, or video first.');
      return;
    }
    setError('');
    await onPublish({ body, file, linkUrl });
  };

  return (
    <div className="feed-composer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="feed-composer-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feed-composer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <button type="button" onClick={onClose} aria-label="Close post composer"><X /></button>
          <div><span>SQUAD LIVE</span><h2 id="feed-composer-title">Post to the team</h2></div>
          <button
            type="button"
            className="feed-publish-button"
            disabled={publishing || !canPublishFeedPost({ body, file, linkUrl })}
            onClick={publish}
          >
            {publishing ? 'Posting…' : 'Post'}
          </button>
        </header>
        <div className="feed-composer-author">
          <Avatar member={currentMember} />
          <span><strong>{currentMember?.displayName}</strong><small>Approved members</small></span>
        </div>
        <MentionInput
          ariaLabel="Post message"
          maxLength={FEED_POST_MAX_LENGTH}
          members={members.filter((member) => member.id !== currentMember?.id)}
          value={body}
          onChange={setBody}
          rows={5}
          placeholder="What does the squad need to know?"
        />
        {previewUrl && (
          <div className="feed-composer-preview">
            {file.type.startsWith('video/')
              ? <video src={previewUrl} controls />
              : <img src={previewUrl} alt="Selected upload preview" />}
            <button type="button" onClick={() => setFile(null)} aria-label="Remove attachment"><X /></button>
          </div>
        )}
        {linkOpen && (
          <label className="feed-link-field">
            <Link2 aria-hidden="true" />
            <input
              type="url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="Paste a link"
            />
          </label>
        )}
        {error && <p className="feed-form-error" role="alert"><CircleAlert /> {error}</p>}
        <footer>
          <span>Add to your post</span>
          <label title="Add photo">
            <ImagePlus aria-hidden="true" />
            <span className="sr-only">Add photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => chooseFile(event.target.files?.[0] || null)}
            />
          </label>
          <label title="Add video">
            <Film aria-hidden="true" />
            <span className="sr-only">Add video</span>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(event) => chooseFile(event.target.files?.[0] || null)}
            />
          </label>
          <button type="button" className={linkOpen ? 'is-active' : ''} onClick={() => setLinkOpen((open) => !open)} title="Add link">
            <Link2 aria-hidden="true" />
            <span className="sr-only">Add link</span>
          </button>
          <button type="button" title="Tag teammate" onClick={() => setBody((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}@`)}>
            <AtSign aria-hidden="true" />
            <span className="sr-only">Tag teammate</span>
          </button>
          <small>{body.length}/3000</small>
        </footer>
      </section>
    </div>
  );
}

function PostCard({
  currentUserId,
  isAdmin,
  members,
  onComment,
  onDeleteComment,
  onDeletePost,
  onLike,
  onOpenMember,
  onPin,
  onShare,
  pendingAction,
  post,
}) {
  const [comment, setComment] = useState('');
  const [commentsOpen, setCommentsOpen] = useState(post.comments.length > 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const liked = post.likedBy.includes(currentUserId);
  const canManage = isAdmin || post.authorId === currentUserId;

  const submitComment = async () => {
    if (!comment.trim()) return;
    const next = comment;
    setComment('');
    try {
      const completed = await onComment(post.id, next);
      if (!completed) {
        setComment(next);
        return;
      }
      setCommentsOpen(true);
    } catch {
      setComment(next);
    }
  };

  return (
    <article className={`feed-post ${post.pinnedAt ? 'is-pinned' : ''}`} id={`feed-post-${post.id}`}>
      {post.pinnedAt && <div className="feed-post-pinned"><Pin /> PINNED FOR THE SQUAD</div>}
      <header className="feed-post-header">
        <Avatar member={post.author} />
        <div>
          <strong>{post.author?.displayName || 'Goon Squad member'}</strong>
          <span>@{post.author?.username || 'member'} · {formatFeedTime(post.createdAt)}</span>
        </div>
        {canManage && (
          <div className="feed-post-menu">
            <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Post options" aria-expanded={menuOpen}>
              <MoreHorizontal />
            </button>
            {menuOpen && (
              <div>
                {isAdmin && (
                  <button type="button" onClick={() => { onPin(post); setMenuOpen(false); }}>
                    <Pin /> {post.pinnedAt ? 'Unpin post' : 'Pin for team'}
                  </button>
                )}
                <button type="button" className="is-danger" onClick={() => { onDeletePost(post); setMenuOpen(false); }}>
                  <Trash2 /> Delete post
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      {post.body && (
        <RichFeedText members={members} onOpenMember={onOpenMember}>
          {post.body}
        </RichFeedText>
      )}
      {post.mediaUrl && (
        <div className={`feed-post-media is-${post.mediaKind}`}>
          {post.mediaKind === 'video'
            ? <video src={post.mediaUrl} controls playsInline preload="metadata" />
            : <img src={post.mediaUrl} alt="Shared by a team member" loading="lazy" />}
        </div>
      )}
      {post.linkUrl && (
        <a className="feed-link-card" href={post.linkUrl} target="_blank" rel="noreferrer">
          <span><Link2 /></span>
          <div><small>SHARED LINK · {linkDomain(post.linkUrl)}</small><strong>{post.linkUrl}</strong></div>
          <ExternalLink />
        </a>
      )}
      {(post.likedBy.length > 0 || post.comments.length > 0) && (
        <div className="feed-post-counts">
          <span>{post.likedBy.length ? `${post.likedBy.length} ${post.likedBy.length === 1 ? 'like' : 'likes'}` : ''}</span>
          <button type="button" onClick={() => setCommentsOpen((open) => !open)}>
            {post.comments.length ? `${post.comments.length} ${post.comments.length === 1 ? 'comment' : 'comments'}` : ''}
          </button>
        </div>
      )}
      <div className="feed-post-actions">
        <button type="button" className={liked ? 'is-active' : ''} disabled={pendingAction} onClick={() => onLike(post)}>
          <Heart fill={liked ? 'currentColor' : 'none'} /> Like
        </button>
        <button type="button" onClick={() => setCommentsOpen(true)}>
          <MessageCircle /> Comment
        </button>
        <button type="button" onClick={() => onShare(post)}>
          <Share2 /> Share
        </button>
      </div>
      {commentsOpen && (
        <div className="feed-comments">
          {post.comments.map((item) => (
            <div className="feed-comment" key={item.id}>
              <Avatar member={item.author} size="sm" />
              <div>
                <strong>{item.author?.displayName || 'Team member'}</strong>
                <RichFeedText members={members} onOpenMember={onOpenMember}>{item.body}</RichFeedText>
                <small>{formatFeedTime(item.createdAt)}</small>
              </div>
              {(isAdmin || item.authorId === currentUserId) && (
                <button type="button" onClick={() => onDeleteComment(item.id)} aria-label="Delete comment">
                  <Trash2 />
                </button>
              )}
            </div>
          ))}
          <div className="feed-comment-composer">
            <Avatar member={members.find((member) => member.id === currentUserId)} size="sm" />
            <MentionInput
              ariaLabel={`Comment on ${post.author?.displayName || 'post'}`}
              maxLength={FEED_COMMENT_MAX_LENGTH}
              members={members.filter((member) => member.id !== currentUserId)}
              value={comment}
              onChange={setComment}
              onSubmit={submitComment}
              placeholder="Write a comment…"
            />
            <button type="button" disabled={!comment.trim() || pendingAction} onClick={submitComment} aria-label="Post comment">
              <Send />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function TeamPulse({ dataset, onOpenGame, onOpenStats, snapshot }) {
  if (!dataset || !snapshot) {
    return <div className="team-pulse-loading"><RefreshCw /> Loading game pulse…</div>;
  }
  const finals = snapshot.games.filter((game) => game.status === 'final');
  const latest = finals[0] || null;
  const next = nextUpcomingGame(snapshot.games);
  const record = `${snapshot.summary.wins}–${snapshot.summary.losses}–${snapshot.summary.ties}`;
  const schedule = (game) => dataset.teams.find((team) => team.id === game?.seasonTeamId);

  return (
    <aside className="team-pulse" aria-label="Team performance pulse">
      <header>
        <div><span>GAME PULSE</span><h2>{snapshot.season?.name || 'Goon Squad'}</h2></div>
        <button type="button" onClick={onOpenStats}>Full stats <ChevronRight /></button>
      </header>
      <div className="team-pulse-record">
        <span><Trophy /> SEASON RECORD</span>
        <strong>{record}</strong>
        <small>{snapshot.summary.gamesPlayed} games · {snapshot.summary.goalsFor} GF · {snapshot.summary.goalsAgainst} GA</small>
      </div>
      <div className="team-pulse-games">
        <button type="button" className="team-pulse-game is-next" onClick={() => next && onOpenGame(next)} disabled={!next}>
          <CalendarClock />
          <span>
            <small>NEXT UP</small>
            <strong>{next ? `vs ${next.opponent}` : 'Schedule clear'}</strong>
            <em>{next ? `${formatGameDate(next.scheduledAt)} · ${formatScheduleName(schedule(next))}` : 'No future game posted'}</em>
          </span>
          {next && <ChevronRight />}
        </button>
        <button type="button" className="team-pulse-game" onClick={() => latest && onOpenGame(latest)} disabled={!latest}>
          <Clock3 />
          <span>
            <small>LATEST RESULT</small>
            <strong>{latest ? `${latest.goalsFor}–${latest.goalsAgainst} vs ${latest.opponent}` : 'No result yet'}</strong>
            <em>{latest ? `${formatGameDate(latest.scheduledAt)} · ${formatScheduleName(schedule(latest))}` : 'Results will appear here'}</em>
          </span>
          {latest && <ChevronRight />}
        </button>
      </div>
      <div className="team-pulse-leagues">
        {snapshot.seasonSchedules.map(({ team, summary }) => (
          <div key={team.id}>
            <span>{formatScheduleName(team)}</span>
            <strong>{summary.wins}–{summary.losses}–{summary.ties}</strong>
          </div>
        ))}
      </div>
      <button type="button" className="team-pulse-stats-button" onClick={onOpenStats}>
        <BarChart3 /> Standings, games and player stats
      </button>
    </aside>
  );
}

function LockedFeed({ account, onOpenAccount }) {
  const copy = teamAccessPromptCopy(account.teamAccessState, 'Squad Live');
  const pending = account.teamAccessState === 'pending';
  return (
    <section className="feed-locked">
      <div className="feed-locked-mark"><LockKeyhole /></div>
      <span>PRIVATE TEAM SPACE</span>
      <h2>{pending ? 'Request sent.' : 'The locker room lives here.'}</h2>
      <p>
        {pending
          ? 'An admin will unlock the team feed, plays, strategies, and Create after approving your player profile.'
          : 'Create an account and request your player profile to see team posts, photos, videos, comments, and tags.'}
      </p>
      <div className="feed-privacy-points">
        <span><ShieldCheck /> Approved members only</span>
        <span><UsersRound /> Team conversation stays private</span>
      </div>
      <button type="button" onClick={onOpenAccount}>
        {pending ? 'View request' : account.user ? 'Request team access' : 'Create account or sign in'}
        <ChevronRight />
      </button>
      <small>{copy.detail}</small>
    </section>
  );
}

export default function TeamHome() {
  const account = useAccount();
  const { setActiveView } = useApp();
  const [dataset, setDataset] = useState(null);
  const [feed, setFeed] = useState({ posts: [], members: [], unreadMentionCount: 0 });
  const [feedLoading, setFeedLoading] = useState(account.hasTeamAccess);
  const [feedError, setFeedError] = useState('');
  const [filter, setFilter] = useState('latest');
  const [composerOpen, setComposerOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [status, setStatus] = useState('');
  const refreshTimerRef = useRef(null);
  const qaFeed = import.meta.env.DEV
    && typeof window !== 'undefined'
    && new URL(window.location.href).searchParams.get('qaFeed') === '1';
  const currentUserId = account.user?.id || (qaFeed ? 'qa-user' : '');
  const isAdmin = account.profile?.role === 'admin' || qaFeed;

  const loadStats = useCallback(async () => {
    try {
      setDataset(await loadStatisticsDataset());
    } catch {
      setDataset(null);
    }
  }, []);

  const refreshFeed = useCallback(async () => {
    if (!account.hasTeamAccess) return;
    if (qaFeed) {
      setFeed({
        posts: QA_POSTS.map((post) => ({ ...post })),
        members: [...QA_MEMBERS],
        unreadMentionCount: 0,
      });
      setFeedLoading(false);
      return;
    }
    setFeedLoading(true);
    try {
      setFeed(await loadTeamFeed({ userId: currentUserId }));
      setFeedError('');
    } catch (error) {
      setFeedError(
        /team_feed_|relation .* does not exist|schema cache/iu.test(error?.message || '')
          ? 'Squad Live is finishing setup. Refresh in a moment.'
          : error?.message || 'The team feed could not load.',
      );
    } finally {
      setFeedLoading(false);
    }
  }, [account.hasTeamAccess, currentUserId, qaFeed]);

  useEffect(() => {
    loadStats();
    const intervalId = window.setInterval(loadStats, STATS_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadStats]);

  useEffect(() => {
    if (!account.hasTeamAccess) {
      setFeed({ posts: [], members: [], unreadMentionCount: 0 });
      setFeedLoading(false);
      return undefined;
    }
    refreshFeed();
    if (qaFeed) return undefined;
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeTeamFeed(() => {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = window.setTimeout(refreshFeed, 250);
      });
    } catch (error) {
      setFeedError(error?.message || 'Live updates could not connect.');
    }
    const mediaRefreshIntervalId = window.setInterval(
      refreshFeed,
      FEED_MEDIA_REFRESH_INTERVAL_MS,
    );
    return () => {
      window.clearTimeout(refreshTimerRef.current);
      window.clearInterval(mediaRefreshIntervalId);
      unsubscribe();
    };
  }, [account.hasTeamAccess, qaFeed, refreshFeed]);

  useEffect(() => {
    if (!feed.posts.length || typeof window === 'undefined') return;
    const postId = new URL(window.location.href).searchParams.get('post');
    if (!postId) return;
    requestAnimationFrame(() => {
      document.getElementById(`feed-post-${postId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }, [feed.posts]);

  const snapshot = useMemo(() => {
    if (!dataset) return null;
    const season = dataset.seasons.find((item) => item.current) || dataset.seasons[0];
    return season
      ? statsSnapshot(dataset, season.id, ALL_SEASON_TEAMS_ID, 'regular')
      : null;
  }, [dataset]);

  const currentMember = feed.members.find((member) => member.id === currentUserId) || {
    id: currentUserId,
    username: account.username || 'member',
    displayName: account.displayName,
    avatarUrl: account.profile?.avatar_url || '',
    role: account.profile?.role || 'member',
  };
  const visiblePosts = useMemo(() => {
    if (filter === 'pinned') return feed.posts.filter((post) => post.pinnedAt);
    if (filter === 'mentions') {
      return feed.posts.filter((post) => post.mentions.some(
        (mention) => mention.mentionedUserId === currentUserId,
      ));
    }
    return feed.posts;
  }, [currentUserId, feed.posts, filter]);

  const navigate = useCallback((activeView, params = {}) => {
    const url = new URL(window.location.href);
    url.searchParams.set('content', activeView === 'stats' ? 'stats' : activeView);
    url.searchParams.set('mode', '2d');
    url.searchParams.delete('post');
    ['game', 'player', 'opponent', 'fixture'].forEach((key) => url.searchParams.delete(key));
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    window.history.pushState({ goonsquadDestination: activeView }, '', `${url.pathname}${url.search}${url.hash}`);
    setActiveView(activeView);
  }, [setActiveView]);

  const publish = async (payload) => {
    setPublishing(true);
    try {
      if (!qaFeed) {
        await createTeamFeedPost({
          ...payload,
          members: feed.members,
          userId: currentUserId,
        });
        await refreshFeed();
      }
      setComposerOpen(false);
      setStatus('Posted to the squad.');
    } catch (error) {
      setStatus(error?.message || 'The post could not be published.');
      throw error;
    } finally {
      setPublishing(false);
    }
  };

  const runPostAction = async (key, operation) => {
    setPendingAction(key);
    setStatus('');
    try {
      await operation();
      if (!qaFeed) await refreshFeed();
      return true;
    } catch (error) {
      setStatus(error?.message || 'That action did not complete.');
      return false;
    } finally {
      setPendingAction('');
    }
  };

  const openMember = (member) => {
    if (member?.playerId) navigate('stats', { player: member.playerId });
  };

  const sharePost = async (post) => {
    const url = new URL(window.location.href);
    url.searchParams.set('content', 'home');
    url.searchParams.delete('mode');
    url.searchParams.set('post', post.id);
    const shareUrl = url.toString();
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${post.author?.displayName || 'Goon Squad'} on Squad Live`,
          text: post.body.slice(0, 140),
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setStatus('Post link copied.');
      }
    } catch {
      // A dismissed native share sheet is not an error state.
    }
  };

  const chooseFilter = async (nextFilter) => {
    setFilter(nextFilter);
    if (nextFilter === 'mentions' && feed.unreadMentionCount && !qaFeed) {
      await markTeamFeedMentionsRead(currentUserId);
      setFeed((current) => ({ ...current, unreadMentionCount: 0 }));
    }
  };

  return (
    <main className="team-home" aria-label="Goon Squad home">
      <div className="team-home-inner">
        <header className="team-home-hero">
          <div>
            <span><Radio /> SQUAD LIVE</span>
            <h1>{account.hasTeamAccess ? `What's happening, ${account.displayName.split(' ')[0]}?` : 'Goon with the squad.'}</h1>
            <p>
              {account.hasTeamAccess
                ? 'Team updates, game pulse, and the conversation in one place.'
                : 'Public game information up front. The locker room stays with the team.'}
            </p>
          </div>
          <button type="button" onClick={() => navigate('stats')}>
            <BarChart3 /> Open team stats
          </button>
        </header>

        <div className="team-home-layout">
          <section className="team-feed-column" aria-label="Squad Live feed">
            {account.hasTeamAccess ? (
              <>
                <button type="button" className="feed-compose-launcher" onClick={() => setComposerOpen(true)}>
                  <Avatar member={currentMember} />
                  <span>Share with the squad…</span>
                  <Plus />
                </button>
                <div className="feed-filter-bar" role="tablist" aria-label="Feed filters">
                  {FEED_FILTERS.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      role="tab"
                      aria-selected={filter === item.id}
                      className={filter === item.id ? 'is-active' : ''}
                      onClick={() => chooseFilter(item.id)}
                    >
                      {item.label}
                      {item.id === 'mentions' && feed.unreadMentionCount > 0 && (
                        <span>{feed.unreadMentionCount}</span>
                      )}
                    </button>
                  ))}
                  <button type="button" className="feed-refresh" onClick={refreshFeed} aria-label="Refresh feed">
                    <RefreshCw />
                  </button>
                </div>
                {status && <p className="feed-status" role="status">{status}</p>}
                {feedLoading && <div className="feed-state"><RefreshCw className="is-spinning" /><strong>Loading the locker room…</strong></div>}
                {!feedLoading && feedError && (
                  <div className="feed-state is-error">
                    <CircleAlert />
                    <strong>{feedError}</strong>
                    <button type="button" onClick={refreshFeed}>Try again</button>
                  </div>
                )}
                {!feedLoading && !feedError && visiblePosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    members={feed.members}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    pendingAction={pendingAction === post.id}
                    onOpenMember={openMember}
                    onShare={sharePost}
                    onLike={() => runPostAction(post.id, () => (
                      qaFeed
                        ? Promise.resolve(setFeed((current) => ({
                          ...current,
                          posts: current.posts.map((item) => item.id === post.id
                            ? {
                              ...item,
                              likedBy: item.likedBy.includes(currentUserId)
                                ? item.likedBy.filter((id) => id !== currentUserId)
                                : [...item.likedBy, currentUserId],
                            }
                            : item),
                        })))
                        : toggleTeamFeedLike({
                          liked: post.likedBy.includes(currentUserId),
                          postId: post.id,
                          userId: currentUserId,
                        })
                    ))}
                    onComment={(postId, body) => runPostAction(post.id, () => (
                      qaFeed
                        ? Promise.resolve()
                        : createTeamFeedComment({
                          postId,
                          body,
                          members: feed.members,
                          userId: currentUserId,
                        })
                    ))}
                    onDeleteComment={(commentId) => runPostAction(post.id, () => (
                      qaFeed ? Promise.resolve() : deleteTeamFeedComment(commentId)
                    ))}
                    onDeletePost={(item) => runPostAction(post.id, () => (
                      qaFeed
                        ? Promise.resolve(setFeed((current) => ({
                          ...current,
                          posts: current.posts.filter((candidate) => candidate.id !== item.id),
                        })))
                        : deleteTeamFeedPost({ postId: item.id, mediaPath: item.mediaPath })
                    ))}
                    onPin={(item) => runPostAction(post.id, () => (
                      qaFeed
                        ? Promise.resolve()
                        : setTeamFeedPostPinned({
                          pinned: Boolean(item.pinnedAt),
                          postId: item.id,
                          userId: currentUserId,
                        })
                    ))}
                  />
                ))}
                {!feedLoading && !feedError && visiblePosts.length === 0 && (
                  <div className="feed-state is-empty">
                    <MessageCircle />
                    <strong>{filter === 'latest' ? 'Start the conversation.' : `No ${filter} posts yet.`}</strong>
                    <p>Useful updates beat noise. Post what helps the squad.</p>
                    {filter === 'latest' && <button type="button" onClick={() => setComposerOpen(true)}>Create first post</button>}
                  </div>
                )}
              </>
            ) : (
              <LockedFeed
                account={account}
                onOpenAccount={() => account.user ? navigate('profile') : account.openAccount()}
              />
            )}
          </section>
          <TeamPulse
            dataset={dataset}
            snapshot={snapshot}
            onOpenStats={() => navigate('stats')}
            onOpenGame={(game) => navigate('stats', { game: game.id })}
          />
        </div>
      </div>
      {composerOpen && (
        <PostComposer
          currentMember={currentMember}
          members={feed.members}
          publishing={publishing}
          onClose={() => !publishing && setComposerOpen(false)}
          onPublish={publish}
        />
      )}
    </main>
  );
}

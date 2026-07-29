import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { DIFFICULTY_COLORS } from '../data/plays';
import { CORE_PLAYS, itemsForCurriculumLane } from '../data/coreCatalog';
import { CAT_COLORS } from '../context/ThemeContext';
import CurriculumLaneSwitch from './CurriculumLaneSwitch';

const MotionDiv = motion.div;

export default function Sidebar({ embedded = false }) {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const {
    currentPlay, setCurrentPlay, setCurrentPhase, setIsPlaying,
    setSidebarOpen, setPreviousPositions, cancelPlaybackRestart,
    favorites, toggleFavorite,
  } = useApp();

  const [laneOverride, setLaneOverride] = useState(null);
  const [showFavs, setShowFavs] = useState(false);
  const [search, setSearch] = useState('');
  const lane = laneOverride?.playId === currentPlay?.id
    ? laneOverride.lane
    : currentPlay?.lane ?? 'defence';

  // Filtered play list
  let fp = itemsForCurriculumLane(CORE_PLAYS, lane);
  if (search.trim()) {
    const q = search.toLowerCase();
    fp = fp.filter(p =>
      p.n.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q) ||
      p.cat.toLowerCase().includes(q) ||
      p.situation.toLowerCase().includes(q)
    );
  }
  if (showFavs) fp = fp.filter(p => favorites.has(p.id));
  const visibleFavoriteCount = CORE_PLAYS.filter((play) => favorites.has(play.id)).length;

  const pick = p => {
    cancelPlaybackRestart();
    setPreviousPositions(null);
    setCurrentPlay(p);
    setLaneOverride(null);
    setCurrentPhase(0);
    setIsPlaying(false);
    if (!embedded) setSidebarOpen(false);
  };

  const FF = "'Trebuchet MS','Lucida Grande',sans-serif";

  return (
    <MotionDiv
      initial={embedded ? false : { x: -18, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={embedded ? undefined : { x: -18, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={embedded ? 'play-library-embedded' : 'play-library-overlay'}
      data-testid={embedded ? 'desktop-play-library' : 'overlay-play-library'}
      style={{
        position: embedded ? 'relative' : 'absolute',
        top: embedded ? undefined : 0,
        left: embedded ? undefined : 0,
        bottom: embedded ? undefined : 0,
        width: embedded ? '100%' : 272,
        height: embedded ? '100%' : undefined,
        background: t.sf, borderRight: `1px solid ${t.bd}`,
        zIndex: embedded ? 1 : 20, display: 'flex', flexDirection: 'column',
      }}
    >
      {embedded && (
        <div className="play-library-heading" style={{ color: t.td, borderBottomColor: t.bd }} data-core-play-count={CORE_PLAYS.length}>
          TEAM PLAYBOOK
          <span style={{ color: t.tm }}>{fp.length}</span>
        </div>
      )}
      <div className="play-library-lanes">
        <CurriculumLaneSwitch
          compact
          items={CORE_PLAYS}
          onChange={(nextLane) => setLaneOverride({
            playId: currentPlay?.id ?? null,
            lane: nextLane,
          })}
          value={lane}
        />
      </div>
      {/* ─── Search ─── */}
      <div style={{ padding: '6px 8px 0' }}>
        <div className="play-library-search" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: t.cb, border: `1px solid ${t.bd}`,
          borderRadius: 6, padding: '5px 8px',
        }}>
          <Search aria-hidden="true" style={{ width: 13, height: 13, color: t.td, flexShrink: 0 }} />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search plays…"
            aria-label="Search plays"
            style={{
              flex: 1, background: 'none', border: 'none',
              color: t.tx, fontSize: 11, fontFamily: FF,
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear play search"
              style={{
                background: 'none', border: 'none', color: t.td,
                cursor: 'pointer', padding: '0 2px', fontSize: 11, lineHeight: 1,
              }}
            ><X aria-hidden="true" style={{ width: 12, height: 12 }} /></button>
          )}
        </div>
      </div>

      {/* ─── All / Saved tabs ─── */}
      <div className="play-library-tabs" style={{ display: 'flex', gap: 4, padding: '6px 8px 4px' }}>
        {[
          { id: 'all',   label: `${lane.toUpperCase()} (${itemsForCurriculumLane(CORE_PLAYS, lane).length})`, active: !showFavs },
          { id: 'saved', label: `SAVED (${visibleFavoriteCount})`, active: showFavs },
        ].map(tab => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setShowFavs(tab.id === 'saved')}
            aria-pressed={tab.active}
            style={{
              flex: 1, padding: '3px 0', borderRadius: 4,
              border: `1px solid ${tab.active ? t.ac : t.bd}`,
              background: tab.active ? t.ab : 'transparent',
              color: tab.active ? t.ac : t.td,
              fontSize: 8.5, fontWeight: 700, fontFamily: 'monospace',
              cursor: 'pointer', letterSpacing: 0.5, transition: 'all .15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Play list ─── */}
      <div className="play-library-list" style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px' }} data-testid="core-play-list">
        {fp.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '28px 12px',
            color: t.td, fontSize: 11, lineHeight: 1.5, fontFamily: FF,
          }}>
            {search
              ? `No plays match "${search}"`
              : showFavs
                ? 'No saved plays yet.\nStar some with ★'
                : 'No plays found.'}
          </div>
        ) : (
          fp.map(p => {
            const isCurrent = currentPlay?.id === p.id;
            const isFav = favorites.has(p.id);
            const cc = CAT_COLORS[p.cat] || t.ac;

            return (
              <div key={p.id} style={{ position: 'relative', marginBottom: 2 }}>
                <button
                  type="button"
                  className="play-library-item"
                  onClick={() => pick(p)}
                  data-play-id={p.id}
                  aria-current={isCurrent ? 'true' : undefined}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 28px 7px 10px',
                    borderRadius: 5,
                    borderStyle: 'solid',
                    borderWidth: 1,
                    borderColor: isCurrent ? cc : t.bd,
                    background: isCurrent ? `${cc}12` : t.cb,
                    borderLeftWidth: 3,
                    borderLeftColor: cc,
                    cursor: 'pointer',
                    transition: 'all .12s', fontFamily: FF,
                  }}
                >
                  <div className="play-library-item-meta" style={{ color: p.isPrimarySystem ? t.ac : t.td }}>
                    {p.isPrimarySystem ? 'PRIMARY SYSTEM' : p.situation.toUpperCase()}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, marginBottom: 2,
                    color: t.tx, lineHeight: 1.3,
                  }}>
                    {p.n}
                  </div>
                  <div className="play-library-item-detail">
                    <span style={{
                      background: DIFFICULTY_COLORS[p.d],
                    }}>
                      <span className="sr-only">{p.d} difficulty</span>
                    </span>
                    <p style={{ color: t.td }}>{p.desc}</p>
                  </div>
                </button>
                <button
                  type="button"
                  className="play-library-favorite"
                  onClick={() => toggleFavorite(p.id)}
                  title={isFav ? 'Remove from saved' : 'Save play'}
                  aria-label={`${isFav ? 'Remove' : 'Save'} ${p.n}`}
                  aria-pressed={isFav}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 22, height: 22,
                    border: 'none', background: 'transparent',
                    color: isFav ? '#facc15' : t.td,
                    fontSize: 12, lineHeight: 1,
                    transition: 'color .15s',
                    cursor: 'pointer',
                  }}
                >
                  <span aria-hidden="true">{isFav ? '★' : '☆'}</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </MotionDiv>
  );
}

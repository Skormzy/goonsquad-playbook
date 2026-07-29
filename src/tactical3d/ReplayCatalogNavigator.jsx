import { useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LibraryBig,
  Search,
  X,
} from 'lucide-react';
import CurriculumLaneSwitch from '../components/CurriculumLaneSwitch';
import { itemsForCurriculumLane } from '../data/coreCatalog';
import { catalogSequence } from './replayCatalogNavigation';
import { useDialogFocus } from '../hooks/useDialogFocus';

function itemTitle(item) {
  return item.title ?? item.n ?? 'Untitled';
}

function itemCategory(item) {
  return item.category ?? item.cat ?? 'Team system';
}

function itemBeatCount(item, kind) {
  if (kind === 'strategy') {
    return Math.max(
      item.correctScene?.phases?.length ?? 0,
      item.mistakeScene?.phases?.length ?? 0,
    );
  }
  return item.phases?.length ?? 0;
}

function normalizedSearch(value) {
  return value.trim().toLocaleLowerCase();
}

export default function ReplayCatalogNavigator({
  compact = false,
  currentId,
  items,
  kind,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const currentItem = items.find((item) => item.id === currentId) ?? items[0] ?? null;
  const currentLane = currentItem?.lane ?? 'defence';
  const [browseContext, setBrowseContext] = useState(null);
  const [searchContext, setSearchContext] = useState(null);
  const browseLane = browseContext?.currentId === currentId
    ? browseContext.lane
    : currentLane;
  const search = searchContext?.currentId === currentId
    ? searchContext.value
    : '';
  const searchRef = useRef(null);
  const drawerRef = useDialogFocus({
    active: open,
    initialFocusRef: searchRef,
    onClose: () => setOpen(false),
  });
  const sequenceItems = useMemo(
    () => itemsForCurriculumLane(items, currentLane),
    [currentLane, items],
  );
  const browseItems = useMemo(
    () => itemsForCurriculumLane(items, browseLane),
    [browseLane, items],
  );
  const { currentIndex, previous, current, next } = catalogSequence(sequenceItems, currentId);
  const singular = kind === 'strategy' ? 'strategy' : 'play';
  const plural = kind === 'strategy' ? 'strategies' : 'plays';
  const drawerId = `vnext3d-${kind}-library`;
  const query = normalizedSearch(search);
  const visibleItems = useMemo(() => {
    if (!query) return browseItems;
    return browseItems.filter((item) => [
      itemTitle(item),
      itemCategory(item),
      item.desc,
      item.subtitle,
      item.situation,
    ].some((value) => value?.toLocaleLowerCase().includes(query)));
  }, [browseItems, query]);

  const select = (item) => {
    if (!item || item.id === currentId) {
      if (compact) setOpen(false);
      return;
    }
    onSelect(item);
    if (compact) setOpen(false);
  };

  return (
    <div
      className={`vnext3d-catalog-navigator ${open ? 'is-open' : ''}`}
      data-testid="vnext3d-catalog-navigator"
      data-kind={kind}
      data-current-index={currentIndex}
    >
      <nav
        className="vnext3d-sequence-dock"
        aria-label={`Browse 3D ${plural}`}
        data-current-lane={currentLane}
      >
        <button
          type="button"
          className="vnext3d-sequence-step"
          disabled={!previous}
          onClick={() => select(previous)}
          aria-label={previous ? `Previous ${singular}: ${itemTitle(previous)}` : `No previous ${singular}`}
          title={previous ? `Previous: ${itemTitle(previous)}` : undefined}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className="vnext3d-sequence-current"
          aria-expanded={open}
          aria-controls={drawerId}
          aria-label={`Browse all ${plural}. Current ${singular}: ${itemTitle(current)}`}
          onClick={() => setOpen((value) => !value)}
          data-testid="vnext3d-catalog-toggle"
        >
          <LibraryBig aria-hidden="true" />
          <span className="vnext3d-sequence-copy">
            <small>{currentLane.toUpperCase()} {String(currentIndex + 1).padStart(2, '0')} / {String(sequenceItems.length).padStart(2, '0')}</small>
            <strong>{itemTitle(current)}</strong>
          </span>
          <span className="vnext3d-sequence-browse" data-testid="vnext3d-browse-cue">
            <span>BROWSE {plural.toUpperCase()}</span>
            <ChevronDown aria-hidden="true" />
          </span>
        </button>
        <button
          type="button"
          className="vnext3d-sequence-step"
          disabled={!next}
          onClick={() => select(next)}
          aria-label={next ? `Next ${singular}: ${itemTitle(next)}` : `No next ${singular}`}
          title={next ? `Next: ${itemTitle(next)}` : undefined}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>

      <button
        type="button"
        className="vnext3d-catalog-backdrop"
        aria-label={`Close ${singular} library`}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <aside
        ref={drawerRef}
        id={drawerId}
        className="vnext3d-catalog-drawer"
        role={open ? 'dialog' : undefined}
        aria-modal={open ? 'true' : undefined}
        aria-label={`3D ${singular} library`}
        aria-hidden={!open}
        tabIndex={open ? -1 : undefined}
        data-testid="vnext3d-catalog-drawer"
      >
        <header className="vnext3d-catalog-heading">
          <div>
            <span>3D {kind === 'strategy' ? 'STRATEGY' : 'PLAYBOOK'}</span>
            <strong>{browseItems.length} {browseLane} essentials</strong>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={`Close ${singular} library`}
            title="Close library"
            tabIndex={open ? 0 : -1}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="vnext3d-catalog-lanes">
          <CurriculumLaneSwitch
            compact
            items={items}
            onChange={(lane) => {
              setBrowseContext({ currentId, lane });
              setSearchContext(null);
            }}
            value={browseLane}
          />
        </div>

        <label className="vnext3d-catalog-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search {plural}</span>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearchContext({
              currentId,
              value: event.target.value,
            })}
            placeholder={`Search ${plural}`}
            aria-label={`Search 3D ${plural}`}
            tabIndex={open ? 0 : -1}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearchContext(null)}
              aria-label={`Clear ${singular} search`}
              tabIndex={open ? 0 : -1}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </label>

        <div className="vnext3d-catalog-list" data-testid="vnext3d-catalog-list">
          {visibleItems.length ? visibleItems.map((item) => {
            const active = item.id === currentId;
            const catalogIndex = browseItems.findIndex((candidate) => candidate.id === item.id);
            return (
              <button
                type="button"
                key={item.id}
                className="vnext3d-catalog-item"
                data-item-id={item.id}
                aria-current={active ? 'true' : undefined}
                onClick={() => select(item)}
                tabIndex={open ? 0 : -1}
              >
                <span className="vnext3d-catalog-index">{String(catalogIndex + 1).padStart(2, '0')}</span>
                <span className="vnext3d-catalog-copy">
                  <strong>{itemTitle(item)}</strong>
                  <small>{item.situation ?? itemCategory(item)} · {itemBeatCount(item, kind)} beats</small>
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            );
          }) : (
            <div className="vnext3d-catalog-empty">No {plural} match “{search}”.</div>
          )}
        </div>
      </aside>
    </div>
  );
}

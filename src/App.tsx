import React, { useState, useEffect, useCallback } from 'react';
import { TabView, MediaItem, WatchlistEntry, WatchStatus } from './types';
import { MEDIA_ITEMS } from './data/mediaData';
import { CatalogueCategory } from './services/mediaApi';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { DiscoverView } from './components/DiscoverView';
import { WatchlistView } from './components/WatchlistView';
import { ProfileView } from './components/ProfileView';
import { DetailModal } from './components/DetailModal';
import { TrailerModal } from './components/TrailerModal';
import { SurpriseMeModal } from './components/SurpriseMeModal';
import { SearchOverlay } from './components/SearchOverlay';
import { Film } from 'lucide-react';

// Starter default watchlist so the user sees a rich, active state immediately
const INITIAL_WATCHLIST: WatchlistEntry[] = [
  {
    mediaId: 'dune-part-two',
    status: 'completed',
    addedAt: '2024-03-05',
    personalRating: 10,
    personalNotes: 'Unprecedented cinematic scale. Greig Fraser’s cinematography and Zimmer’s score are monumental.',
  },
  {
    mediaId: 'severance',
    status: 'watching',
    addedAt: '2024-03-10',
    personalRating: 9,
    personalNotes: 'Brilliant corporate existential thriller. Can’t stop analyzing the MDR floor.',
  },
  {
    mediaId: 'oppenheimer',
    status: 'completed',
    addedAt: '2024-01-15',
    personalRating: 9,
    personalNotes: 'Cillian Murphy gives a career-defining performance. The Trinity test sequence was breathtaking.',
  },
  {
    mediaId: 'arcane',
    status: 'completed',
    addedAt: '2024-02-20',
    personalRating: 10,
    personalNotes: 'Every frame is an oil painting. Emotional storytelling at the absolute highest level.',
  },
  {
    mediaId: 'blade-runner-2049',
    status: 'plan_to_watch',
    addedAt: '2024-03-12',
    personalRating: 0,
  },
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabView>('home');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [trailerMedia, setTrailerMedia] = useState<MediaItem | null>(null);
  const [isSurpriseOpen, setIsSurpriseOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [discoverInitialMood, setDiscoverInitialMood] = useState('all');
  const [discoverInitialCategory, setDiscoverInitialCategory] = useState<CatalogueCategory>('discover');

  // Dynamic registry of all loaded media items across pages so Watchlist, Profile & Roulette have full access
  const [knownMedia, setKnownMedia] = useState<MediaItem[]>(MEDIA_ITEMS);

  const handleRegisterMedia = useCallback((newItems: MediaItem[]) => {
    setKnownMedia((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const added = newItems.filter((item) => !existingIds.has(item.id));
      if (added.length === 0) return prev;
      return [...prev, ...added];
    });
  }, []);

  // Load watchlist from localStorage or fallback to default
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(() => {
    try {
      const saved = localStorage.getItem('reelmind_watchlist');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return INITIAL_WATCHLIST;
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('reelmind_watchlist', JSON.stringify(watchlist));
    } catch (e) {
      console.warn('Could not persist watchlist to localStorage', e);
    }
  }, [watchlist]);

  // Global keyboard shortcut for search (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isInWatchlist = (id: string) => watchlist.some((item) => item.mediaId === id);

  const handleToggleWatchlist = (mediaId: string, mediaObj?: MediaItem) => {
    const snapshot = mediaObj || knownMedia.find((m) => m.id === mediaId);
    setWatchlist((prev) => {
      const exists = prev.some((item) => item.mediaId === mediaId);
      if (exists) {
        return prev.filter((item) => item.mediaId !== mediaId);
      } else {
        const newEntry: WatchlistEntry = {
          mediaId,
          status: 'plan_to_watch',
          addedAt: new Date().toISOString().split('T')[0],
          personalRating: 0,
          mediaSnapshot: snapshot,
        };
        return [...prev, newEntry];
      }
    });
  };

  const handleUpdateWatchlistDetails = (
    mediaId: string,
    status: WatchStatus,
    rating?: number,
    notes?: string,
    mediaObj?: MediaItem
  ) => {
    const snapshot = mediaObj || knownMedia.find((m) => m.id === mediaId);
    setWatchlist((prev) => {
      const exists = prev.some((item) => item.mediaId === mediaId);
      if (exists) {
        return prev.map((item) => {
          if (item.mediaId === mediaId) {
            return {
              ...item,
              status,
              personalRating: rating !== undefined ? rating : item.personalRating,
              personalNotes: notes !== undefined ? notes : item.personalNotes,
              mediaSnapshot: snapshot || item.mediaSnapshot,
            };
          }
          return item;
        });
      } else {
        return [
          ...prev,
          {
            mediaId,
            status,
            addedAt: new Date().toISOString().split('T')[0],
            personalRating: rating || 0,
            personalNotes: notes || '',
            mediaSnapshot: snapshot,
          },
        ];
      }
    });
  };

  const handleRemoveFromWatchlist = (mediaId: string) => {
    setWatchlist((prev) => prev.filter((item) => item.mediaId !== mediaId));
  };

  const handleUpdateStatus = (mediaId: string, status: WatchStatus) => {
    setWatchlist((prev) =>
      prev.map((item) => (item.mediaId === mediaId ? { ...item, status } : item))
    );
  };

  const handleExploreMood = (moodId: string) => {
    setDiscoverInitialMood(moodId);
    setDiscoverInitialCategory('discover');
    setCurrentTab('discover');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExploreCategory = (category: CatalogueCategory) => {
    setDiscoverInitialCategory(category);
    setDiscoverInitialMood('all');
    setCurrentTab('discover');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedWatchlistEntry = selectedMedia
    ? watchlist.find((item) => item.mediaId === selectedMedia.id)
    : undefined;

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans']">
      {/* 3-Zone Navigation Top Bar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        watchlistCount={watchlist.length}
        onOpenSurprise={() => setIsSurpriseOpen(true)}
        onQuickSearchClick={() => setIsSearchOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {currentTab === 'home' && (
          <HomeView
            initialItems={MEDIA_ITEMS}
            isInWatchlist={isInWatchlist}
            onToggleWatchlist={handleToggleWatchlist}
            onSelectMedia={(media) => setSelectedMedia(media)}
            onPlayTrailer={(media) => setTrailerMedia(media)}
            onExploreMood={handleExploreMood}
            onExploreCategory={handleExploreCategory}
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onRegisterMedia={handleRegisterMedia}
          />
        )}

        {currentTab === 'discover' && (
          <DiscoverView
            isInWatchlist={isInWatchlist}
            onToggleWatchlist={handleToggleWatchlist}
            onSelectMedia={(media) => setSelectedMedia(media)}
            initialMood={discoverInitialMood}
            initialCategory={discoverInitialCategory}
            onRegisterMedia={handleRegisterMedia}
          />
        )}

        {currentTab === 'watchlist' && (
          <WatchlistView
            watchlist={watchlist}
            allMedia={knownMedia}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            onUpdateStatus={handleUpdateStatus}
            onSelectMedia={(media) => setSelectedMedia(media)}
            onNavigateHome={() => setCurrentTab('home')}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileView
            watchlist={watchlist}
            allMedia={knownMedia}
            onSelectMedia={(media) => setSelectedMedia(media)}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        )}
      </main>

      {/* Global Modals & Overlays */}
      <DetailModal
        media={selectedMedia}
        onClose={() => setSelectedMedia(null)}
        isInWatchlist={selectedMedia ? isInWatchlist(selectedMedia.id) : false}
        watchlistStatus={selectedWatchlistEntry?.status}
        personalRating={selectedWatchlistEntry?.personalRating}
        personalNotes={selectedWatchlistEntry?.personalNotes}
        onToggleWatchlist={handleToggleWatchlist}
        onUpdateWatchlistDetails={handleUpdateWatchlistDetails}
        onPlayTrailer={(media) => setTrailerMedia(media)}
        allMedia={knownMedia}
        onSelectSimilar={(media) => setSelectedMedia(media)}
      />

      <TrailerModal
        media={trailerMedia}
        onClose={() => setTrailerMedia(null)}
      />

      <SurpriseMeModal
        isOpen={isSurpriseOpen}
        onClose={() => setIsSurpriseOpen(false)}
        items={knownMedia}
        onSelectMedia={(media) => setSelectedMedia(media)}
      />

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        items={knownMedia}
        onSelectMedia={(media) => setSelectedMedia(media)}
        onRegisterMedia={handleRegisterMedia}
      />

      {/* Clean, Tasteful Footer adhering to anti-slop rules */}
      <footer className="border-t border-white/5 bg-[#07080c] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Film className="w-3 h-3 stroke-[2.5]" />
            </div>
            <span className="font-['Outfit'] font-semibold text-slate-300">ReelMind</span>
            <span>· Cinema & Television Discovery</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                setCurrentTab('discover');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-300 transition-colors"
            >
              Discover
            </button>
            <button
              onClick={() => {
                setCurrentTab('watchlist');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-300 transition-colors"
            >
              Watchlist
            </button>
            <button
              onClick={() => {
                setCurrentTab('profile');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-300 transition-colors"
            >
              Cinephile Profile
            </button>
            <button
              onClick={() => setIsSurpriseOpen(true)}
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              ReelRoulette
            </button>
          </div>

          <div className="text-slate-600 font-mono text-[11px]">
            © {new Date().getFullYear()} ReelMind. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

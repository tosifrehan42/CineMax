import React from 'react';
import { HomeHubMode, TabView, UserProfile } from '../types';
import {
  Film,
  Tv,
  Search,
  Bookmark,
  Compass,
  User,
  Dice5,
  LogIn,
  LogOut,
  HardDrive,
  ShieldCheck,
  Home,
} from 'lucide-react';

interface NavbarProps {
  currentTab: TabView;
  homeHubMode?: HomeHubMode;
  onTabChange: (tab: TabView, hubMode?: HomeHubMode) => void;
  watchlistCount: number;
  onOpenSurprise: () => void;
  onQuickSearchClick: () => void;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  userProfile?: UserProfile | null;
  userEmail?: string | null;
  onOpenAuthModal?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
}

const NavbarComponent: React.FC<NavbarProps> = ({
  currentTab,
  homeHubMode = 'all',
  onTabChange,
  watchlistCount,
  onOpenSurprise,
  onQuickSearchClick,
  isAuthenticated = false,
  isAdmin = false,
  userProfile,
  userEmail,
  onOpenAuthModal,
  onSignOut,
}) => {
  const [avatarLoadError, setAvatarLoadError] = React.useState(false);

  React.useEffect(() => {
    setAvatarLoadError(false);
  }, [userProfile?.avatarUrl]);

  const initials = (userProfile?.displayName || userEmail || 'CM')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const showAvatarImage = Boolean(userProfile?.avatarUrl && !avatarLoadError);

  const desktopNavItems: Array<{
    key: string;
    label: string;
    tab: TabView;
    hubMode?: HomeHubMode;
    isActive: boolean;
    icon?: React.ReactNode;
    badge?: number;
  }> = [
    {
      key: 'home-all',
      label: 'Home',
      tab: 'home',
      hubMode: 'all',
      isActive: currentTab === 'home' && homeHubMode === 'all',
    },
    {
      key: 'home-movies',
      label: 'Movies',
      tab: 'home',
      hubMode: 'movies',
      isActive: currentTab === 'home' && homeHubMode === 'movies',
    },
    {
      key: 'home-series',
      label: 'Series',
      tab: 'home',
      hubMode: 'series',
      isActive: currentTab === 'home' && homeHubMode === 'series',
    },
    {
      key: 'discover',
      label: 'Discover',
      tab: 'discover',
      isActive: currentTab === 'discover',
    },
    {
      key: 'watchlist',
      label: 'Watchlist',
      tab: 'watchlist',
      isActive: currentTab === 'watchlist',
      badge: watchlistCount > 0 ? watchlistCount : undefined,
    },
    {
      key: 'estimator',
      label: 'Quality & File Size',
      tab: 'estimator',
      isActive: currentTab === 'estimator',
      icon: <HardDrive className="w-3.5 h-3.5 text-amber-400" />,
    },
    ...(isAuthenticated && isAdmin
      ? [
          {
            key: 'admin',
            label: 'Admin',
            tab: 'admin' as TabView,
            isActive: currentTab === 'admin',
            icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />,
          },
        ]
      : []),
  ];

  const mobileBottomItems: Array<{
    id: TabView;
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
  }> = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home className="w-4 h-4" />,
      isActive: currentTab === 'home',
      onClick: () => onTabChange('home', homeHubMode),
    },
    {
      id: 'discover',
      label: 'Discover',
      icon: <Compass className="w-4 h-4" />,
      isActive: currentTab === 'discover',
      onClick: () => onTabChange('discover'),
    },
    {
      id: 'watchlist',
      label: 'Watchlist',
      icon: <Bookmark className="w-4 h-4" />,
      isActive: currentTab === 'watchlist',
      onClick: () => onTabChange('watchlist'),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="w-4 h-4" />,
      isActive: currentTab === 'profile',
      onClick: () => onTabChange('profile'),
    },
  ];

  return (
    <>
      {/* Sticky Top Header (Desktop Full Bar + Mobile Compact Top Bar) */}
      <header className="sticky top-0 z-50 w-full cm-glass-nav border-b border-white/[0.08] transition-colors">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-4 lg:gap-8">
          {/* Left Zone: Brand Logo + Desktop Navigation */}
          <div className="flex items-center gap-6 lg:gap-8 min-w-0">
            <button
              onClick={() => onTabChange('home', 'all')}
              className="flex items-center gap-2.5 text-left group focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Film className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl font-extrabold tracking-tight text-white whitespace-nowrap group-hover:text-amber-400 transition-colors">
                Cine<span className="text-amber-400">Max</span>
              </span>
            </button>

            {/* Desktop Primary Navigation */}
            <nav
              aria-label="Main Navigation"
              className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-medium"
            >
              {desktopNavItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onTabChange(item.tab, item.hubMode)}
                  className={`relative py-1 text-xs lg:text-sm font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 ${
                    item.isActive
                      ? 'text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 tabular-nums">
                      {item.badge}
                    </span>
                  )}
                  {item.isActive && (
                    <span className="absolute -bottom-[19px] left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" />
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Right Zone: Search, Surprise Me, Tools (Mobile), & Account Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Search Trigger */}
            <button
              onClick={onQuickSearchClick}
              aria-label="Open search"
              className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-slate-300 hover:text-white cm-glass-control rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
              title="Search movies, series, cast & directors (Ctrl+K)"
            >
              <Search className="w-4 h-4 text-amber-400" />
              <span className="hidden xl:inline text-xs text-slate-300">Search...</span>
              <kbd className="hidden xl:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-black/45 rounded border border-white/10">
                ⌘K
              </kbd>
            </button>

            {/* Mobile Quick Access to Quality & File Size Tool */}
            <button
              onClick={() => onTabChange('estimator')}
              aria-label="Quality & File Size Estimator"
              title="Quality & File Size Estimator"
              className={`md:hidden p-2 rounded-lg transition-colors ${
                currentTab === 'estimator'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-slate-300 hover:text-white cm-glass-control'
              }`}
            >
              <HardDrive className="w-4 h-4" />
            </button>

            {/* Surprise Me Button */}
            <button
              onClick={onOpenSurprise}
              title="Surprise Me — Instant Recommendation"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-sm shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Dice5 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Surprise Me</span>
            </button>

            {/* Mobile Verified Admin Access Icon (Only shown to verified admin) */}
            {isAuthenticated && isAdmin && (
              <button
                onClick={() => onTabChange('admin')}
                aria-label="Admin Dashboard"
                title="Admin Dashboard"
                className={`md:hidden p-2 rounded-lg border transition-colors ${
                  currentTab === 'admin'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'text-amber-400/90 bg-amber-500/10 border-amber-500/25'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            )}

            {/* Account / Profile Session Control */}
            {isAuthenticated ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onTabChange('profile')}
                  className={`flex items-center gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    currentTab === 'profile'
                      ? 'bg-amber-500/15 border border-amber-400/50 text-white'
                      : 'cm-glass-control text-white'
                  }`}
                  title={userProfile?.displayName || userEmail || 'Profile'}
                >
                  {showAvatarImage ? (
                    <img
                      src={userProfile!.avatarUrl!}
                      alt={userProfile?.displayName || 'Profile avatar'}
                      onError={() => setAvatarLoadError(true)}
                      className="w-5 h-5 rounded-full object-cover border border-amber-400/60 shrink-0"
                    />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                      {initials}
                    </span>
                  )}
                  <span className="hidden lg:inline max-w-[100px] truncate">
                    {userProfile?.displayName || userEmail?.split('@')[0] || 'Account'}
                  </span>
                </button>
                <button
                  onClick={onSignOut}
                  aria-label="Sign out"
                  title="Sign Out"
                  className="flex items-center justify-center min-h-[36px] min-w-[36px] p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onOpenAuthModal?.('signin')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-white cm-glass-control rounded-lg whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-400" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Sub-Hub Pill Bar when on Home Tab (All / Movies / Series) */}
        {currentTab === 'home' && (
          <div className="md:hidden px-4 py-2 border-t border-white/[0.06] cm-glass-subbar flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Titles', icon: null },
                  { id: 'movies', label: 'Movies', icon: <Film className="w-3 h-3" /> },
                  { id: 'series', label: 'Series', icon: <Tv className="w-3 h-3" /> },
                ] as const
              ).map((hub) => {
                const active = homeHubMode === hub.id;
                return (
                  <button
                    key={hub.id}
                    onClick={() => onTabChange('home', hub.id)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'cm-glass-control text-slate-300 hover:text-white'
                    }`}
                  >
                    {hub.icon}
                    <span>{hub.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onTabChange('estimator')}
              className="flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20"
            >
              <HardDrive className="w-3 h-3" />
              <span>Size Tool</span>
            </button>
          </div>
        )}
      </header>

      {/* Mobile Fixed Bottom Navigation Bar (Home, Discover, Watchlist, Profile) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 cm-glass-nav border-t border-white/10 cm-safe-bottom"
      >
        <div className="grid grid-cols-4 h-14">
          {mobileBottomItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors focus:outline-none ${
                item.isActive
                  ? 'text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              {item.isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-amber-400 rounded-full" />
              )}
              <div className="relative">
                {item.id === 'profile' && isAuthenticated && showAvatarImage ? (
                  <img
                    src={userProfile!.avatarUrl!}
                    alt="Profile"
                    onError={() => setAvatarLoadError(true)}
                    className="w-4 h-4 rounded-full object-cover border border-amber-400/60"
                  />
                ) : (
                  item.icon
                )}
                {item.id === 'watchlist' && watchlistCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-mono font-bold flex items-center justify-center tabular-nums">
                    {watchlistCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-none">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};

export const Navbar = React.memo(NavbarComponent);

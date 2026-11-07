import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { HomeHubMode, TabView, UserProfile } from '../types';
import { LiquidTabBubble, useLiquidTabBubble } from './LiquidTabBubble';
import { PWAInstallButton } from './OfflineStatusBanner';
import { popoverMenuVariants } from '../utils/motionSystem';
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
  MoreHorizontal,
  X,
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
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [userProfile?.avatarUrl]);

  // Close mobile overflow menu on outside tap or Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [mobileMenuOpen]);

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

  const activeDesktopKey = desktopNavItems.find((item) => item.isActive)?.key ?? null;
  const activeMobileBottomKey = mobileBottomItems.find((item) => item.isActive)?.id ?? null;

  const desktopBubble = useLiquidTabBubble(activeDesktopKey, [
    isAuthenticated,
    isAdmin,
    watchlistCount,
  ]);
  const mobileHubBubble = useLiquidTabBubble<HomeHubMode>(
    currentTab === 'home' ? homeHubMode : null,
    [currentTab]
  );
  const mobileBottomBubble = useLiquidTabBubble<TabView>(activeMobileBottomKey, [
    watchlistCount,
  ]);

  const isSecondaryToolActive = currentTab === 'estimator' || currentTab === 'admin';

  return (
    <>
      {/* Sticky Inset Top Header (Desktop Rounded Panel + Mobile Unified Rounded Shell) */}
      <header className="sticky top-0 z-50 w-full pt-[max(env(safe-area-inset-top,0px),0.5rem)] sm:pt-2.5 px-3 sm:px-6 lg:px-8 pointer-events-none">
        <div className="pointer-events-auto max-w-[1440px] mx-auto cm-glass-nav rounded-[20px] md:rounded-[22px] transition-colors overflow-visible">
          <div className="px-3 sm:px-5 lg:px-6 h-14 md:h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-8 min-w-0">
            {/* Left Zone: Brand Logo + Desktop Navigation */}
            <div className="flex items-center gap-2 sm:gap-5 lg:gap-7 min-w-0 shrink-0 h-full">
              <button
                onClick={() => onTabChange('home', 'all')}
                className="flex items-center gap-2 sm:gap-2.5 min-h-[44px] text-left group focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded-lg shrink-0 active:scale-[0.97] transition-transform"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 shrink-0">
                  <Film className="w-4 h-4 stroke-[2.5]" />
                </div>
                <span className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl font-extrabold tracking-tight text-white whitespace-nowrap group-hover:text-amber-400 transition-colors">
                  Cine<span className="text-amber-400">Max</span>
                </span>
              </button>

              {/* Desktop Primary Navigation with Shared Animated Liquid Glass Water Bubble */}
              <nav
                ref={desktopBubble.containerRef}
                aria-label="Main Navigation"
                className="relative hidden md:flex items-center h-full gap-1 lg:gap-1.5 text-sm font-medium"
              >
                <LiquidTabBubble
                  controller={desktopBubble}
                  variant="nav"
                  className="top-2.5 bottom-2.5 rounded-xl"
                  showBottomCaustic
                />
                {desktopNavItems.map((item) => (
                  <button
                    key={item.key}
                    ref={desktopBubble.registerTab(item.key)}
                    onClick={() => onTabChange(item.tab, item.hubMode)}
                    className={`relative z-10 h-11 px-2.5 lg:px-3.5 rounded-xl text-xs lg:text-sm font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 active:scale-[0.98] ${
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
                    {item.isActive && !desktopBubble.ready && (
                      <span className="absolute bottom-1 left-2 right-2 h-[2px] bg-gradient-to-r from-amber-400 to-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.45)]" />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Right Zone: Mobile (Search + Profile/Sign-In + More Tools) | Desktop (Full Controls) */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
              {/* Search Trigger (44x44px minimum on mobile) */}
              <button
                onClick={onQuickSearchClick}
                aria-label="Open search"
                className="flex items-center justify-center gap-2 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-[38px] md:px-3 md:py-1.5 text-slate-200 hover:text-white cm-glass-control rounded-xl shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                title="Search movies, series, cast & directors (Ctrl+K)"
              >
                <Search className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="hidden xl:inline text-xs text-slate-300">Search...</span>
                <kbd className="hidden xl:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-black/45 rounded border border-white/10">
                  ⌘K
                </kbd>
              </button>

              {/* Desktop-Only Surprise Me Button */}
              <button
                onClick={onOpenSurprise}
                aria-label="Surprise Me — Instant Recommendation"
                title="Surprise Me — Instant Recommendation"
                className="hidden md:flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.97] rounded-xl shadow-sm shadow-amber-500/20 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Dice5 className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                <span>Surprise Me</span>
              </button>

              {/* Desktop-Only In-App PWA Install Action */}
              <div className="hidden md:block">
                <PWAInstallButton compact />
              </div>

              {/* Account / Profile Session Control */}
              {isAuthenticated ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onTabChange('profile')}
                    aria-label={userProfile?.displayName || userEmail || 'Profile'}
                    className={`flex items-center justify-center gap-2 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-[38px] lg:px-2.5 rounded-xl text-xs font-medium transition-colors active:scale-[0.97] whitespace-nowrap shrink-0 ${
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
                        className="w-6 h-6 md:w-5 md:h-5 rounded-full object-cover border border-amber-400/60 shrink-0"
                      />
                    ) : (
                      <span className="w-6 h-6 md:w-5 md:h-5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        {initials}
                      </span>
                    )}
                    <span className="hidden lg:inline max-w-[100px] truncate">
                      {userProfile?.displayName || userEmail?.split('@')[0] || 'Account'}
                    </span>
                  </button>

                  {/* Desktop-Only Sign Out Button (moved to More Menu on mobile) */}
                  <button
                    onClick={onSignOut}
                    aria-label="Sign out"
                    title="Sign Out"
                    className="hidden md:flex items-center justify-center min-h-[38px] min-w-[38px] text-slate-400 hover:text-red-400 hover:bg-white/5 active:scale-95 rounded-xl transition-colors shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onOpenAuthModal?.('signin')}
                  className="flex items-center justify-center gap-1.5 px-3 min-h-[44px] md:min-h-[38px] text-xs font-semibold text-white cm-glass-control rounded-xl whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                >
                  <LogIn className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Sign In</span>
                </button>
              )}

              {/* Mobile More / Tools Overflow Menu Button (44x44px touch target) */}
              <div ref={mobileMenuRef} className="relative md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  aria-label="More tools and options"
                  aria-expanded={mobileMenuOpen}
                  className={`flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl transition-colors active:scale-95 ${
                    mobileMenuOpen || isSecondaryToolActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                      : 'cm-glass-control text-slate-200 hover:text-white'
                  }`}
                >
                  {mobileMenuOpen ? (
                    <X className="w-4 h-4 text-amber-400" />
                  ) : (
                    <MoreHorizontal className="w-5 h-5" />
                  )}
                </button>

                {/* Mobile Overflow Menu Popover Sheet */}
                <AnimatePresence>
                  {mobileMenuOpen && (
                    <motion.div
                      variants={popoverMenuVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute right-0 mt-2 w-64 rounded-2xl cm-glass-popover p-2 z-50 origin-top-right shadow-2xl space-y-1"
                    >
                      <div className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 border-b border-white/10">
                        Quick Tools &amp; Actions
                      </div>

                      {/* 1. Surprise Me */}
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onOpenSurprise();
                        }}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] transition-all"
                      >
                        <Dice5 className="w-4 h-4 stroke-[2.5] shrink-0" />
                        <div className="min-w-0">
                          <div className="font-bold leading-tight">Surprise Me</div>
                          <div className="text-[10px] text-slate-900/80 font-medium">
                            Instant curated recommendation
                          </div>
                        </div>
                      </button>

                      {/* 2. Quality & File Size Estimator */}
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onTabChange('estimator');
                        }}
                        className={`w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-xs font-semibold transition-colors ${
                          currentTab === 'estimator'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                            : 'text-slate-200 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="leading-tight">Quality &amp; File Size Tool</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            Bitrate &amp; storage calculator
                          </div>
                        </div>
                      </button>

                      {/* 3. PWA Install Button (Renders when installable or iOS) */}
                      <div className="px-1 pt-0.5">
                        <PWAInstallButton />
                      </div>

                      {/* 4. Verified Admin Dashboard (Only shown if verified admin) */}
                      {isAuthenticated && isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            onTabChange('admin');
                          }}
                          className={`w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-xs font-semibold transition-colors ${
                            currentTab === 'admin'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                              : 'text-amber-300 hover:bg-amber-500/15'
                          }`}
                        >
                          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Admin Dashboard</span>
                        </button>
                      )}

                      {/* 5. Sign Out (Only shown when signed in) */}
                      {isAuthenticated && onSignOut && (
                        <div className="pt-1 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              onSignOut();
                            }}
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-xs font-semibold text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 transition-colors"
                          >
                            <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Mobile Home Hub Switcher (3 Equal-Width Segmented Columns: All Titles | Movies | Series) */}
          {currentTab === 'home' && (
            <div className="md:hidden px-3 py-2 border-t border-white/[0.07] cm-glass-subbar rounded-b-[20px]">
              <div
                ref={mobileHubBubble.containerRef}
                role="tablist"
                aria-label="Content category filter"
                className="relative grid grid-cols-3 gap-1 p-1 rounded-xl cm-glass-segmented overflow-hidden"
              >
                <LiquidTabBubble
                  controller={mobileHubBubble}
                  variant="amber"
                  className="top-1 bottom-1 rounded-[9px]"
                />
                {(
                  [
                    { id: 'all', label: 'All Titles', icon: null },
                    {
                      id: 'movies',
                      label: 'Movies',
                      icon: <Film className="hidden min-[360px]:inline-block w-3.5 h-3.5 shrink-0" />,
                    },
                    {
                      id: 'series',
                      label: 'Series',
                      icon: <Tv className="hidden min-[360px]:inline-block w-3.5 h-3.5 shrink-0" />,
                    },
                  ] as const
                ).map((hub) => {
                  const active = homeHubMode === hub.id;
                  return (
                    <button
                      key={hub.id}
                      ref={mobileHubBubble.registerTab(hub.id)}
                      role="tab"
                      aria-selected={active}
                      onClick={() => onTabChange('home', hub.id)}
                      className={`relative z-10 w-full min-h-[38px] px-2 py-1.5 rounded-[9px] flex items-center justify-center gap-1.5 text-xs font-semibold leading-none transition-colors whitespace-nowrap select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 active:scale-[0.98] ${
                        active
                          ? mobileHubBubble.ready
                            ? 'text-slate-950 font-bold'
                            : 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {hub.icon}
                      <span>{hub.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Floating Inset Bottom Navigation Bar (Home, Discover, Watchlist, Profile) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed inset-x-3 sm:inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] z-50 cm-glass-nav rounded-[20px] overflow-hidden shadow-2xl"
      >
        <div
          ref={mobileBottomBubble.containerRef}
          className="relative grid grid-cols-4 h-[60px] px-1.5 py-1.5"
        >
          <LiquidTabBubble
            controller={mobileBottomBubble}
            variant="nav"
            className="top-1.5 bottom-1.5 rounded-[14px]"
            showBottomCaustic
          />
          {mobileBottomItems.map((item) => (
            <button
              key={item.id}
              ref={mobileBottomBubble.registerTab(item.id)}
              onClick={item.onClick}
              className={`relative z-10 min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-[14px] transition-colors focus:outline-none active:scale-[0.95] ${
                item.isActive
                  ? 'text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              {item.isActive && !mobileBottomBubble.ready && (
                <span className="absolute top-0 w-8 h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              )}
              <div className="relative flex items-center justify-center">
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
              <span className="text-[11px] leading-none tracking-tight">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};

export const Navbar = React.memo(NavbarComponent);

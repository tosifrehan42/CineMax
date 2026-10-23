import React from 'react';
import { TabView, UserProfile } from '../types';
import {
  Film,
  Search,
  Bookmark,
  Compass,
  User,
  Dice5,
  LogIn,
  LogOut,
} from 'lucide-react';

interface NavbarProps {
  currentTab: TabView;
  onTabChange: (tab: TabView) => void;
  watchlistCount: number;
  onOpenSurprise: () => void;
  onQuickSearchClick: () => void;
  isAuthenticated?: boolean;
  userProfile?: UserProfile | null;
  userEmail?: string | null;
  onOpenAuthModal?: (mode?: 'signin' | 'signup') => void;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  watchlistCount,
  onOpenSurprise,
  onQuickSearchClick,
  isAuthenticated = false,
  userProfile,
  userEmail,
  onOpenAuthModal,
  onSignOut,
}) => {
  const navItems: { id: TabView; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Film className="w-4 h-4" /> },
    { id: 'discover', label: 'Discover', icon: <Compass className="w-4 h-4" /> },
    { id: 'watchlist', label: 'Watchlist', icon: <Bookmark className="w-4 h-4" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  ];

  const initials = (userProfile?.displayName || userEmail || 'CM')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#090a0f]/90 backdrop-blur-md border-b border-white/5 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => onTabChange('home')}
          className="flex items-center gap-2.5 text-left group focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Film className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="font-['Outfit'] text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 group-hover:text-amber-400 transition-colors">
            Cine<span className="text-amber-400 font-extrabold">Max</span>
          </span>
        </button>

        {/* Zone 2: 4 single-line nav links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
                {item.id === 'watchlist' && watchlistCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 tabular-nums">
                    {watchlistCount}
                  </span>
                )}
                {isActive && (
                  <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Search, Surprise Me & Account Session Control */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onQuickSearchClick}
            aria-label="Open search"
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
            title="Search titles (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSurprise}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-sm shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Dice5 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">Surprise Me</span>
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onTabChange('profile')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
                title={userProfile?.displayName || userEmail || 'Profile'}
              >
                <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center">
                  {initials}
                </span>
                <span className="hidden lg:inline max-w-[110px] truncate">
                  {userProfile?.displayName || userEmail?.split('@')[0] || 'Account'}
                </span>
              </button>
              <button
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors focus:outline-none"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onOpenAuthModal?.('signin')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (within 15% screen height) */}
      <div className="md:hidden flex items-center justify-around py-2 border-t border-white/5 bg-[#090a0f]/95">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 text-xs font-medium transition-colors ${
                isActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.id === 'watchlist' && watchlistCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {watchlistCount}
                  </span>
                )}
              </div>
              <span className="text-[11px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};

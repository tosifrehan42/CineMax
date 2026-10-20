import React from 'react';
import { MediaItem, WatchlistEntry } from '../types';
import { MediaPoster } from './MediaPoster';
import {
  User,
  Star,
  Film,
  Tv,
  Clock,
  Award,
  Sparkles,
  Sliders,
  Heart,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

interface ProfileViewProps {
  watchlist: WatchlistEntry[];
  allMedia: MediaItem[];
  onSelectMedia: (media: MediaItem) => void;
  onNavigateTab: (tab: 'discover' | 'watchlist') => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  watchlist,
  allMedia,
  onSelectMedia,
  onNavigateTab,
}) => {
  // Compute user statistics
  const watchedEntries = watchlist.filter((e) => e.status === 'completed');
  const watchedMedia = watchedEntries
    .map((e) => allMedia.find((m) => m.id === e.mediaId) || e.mediaSnapshot)
    .filter((m): m is MediaItem => m !== undefined);

  // Genre breakdown from watched or saved items
  const genreCounts: Record<string, number> = {};
  const baseItems = watchedMedia.length > 0 ? watchedMedia : allMedia.slice(0, 6);
  baseItems.forEach((m) => {
    m.genres.forEach((g) => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
  });

  const sortedGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxGenreVal = sortedGenres.length > 0 ? sortedGenres[0][1] : 1;

  // Personal ratings
  const ratedEntries = watchlist
    .filter((e) => e.personalRating && e.personalRating > 0)
    .map((e) => ({
      entry: e,
      media: allMedia.find((m) => m.id === e.mediaId) || e.mediaSnapshot,
    }))
    .filter((item): item is { entry: WatchlistEntry; media: MediaItem } => item.media !== undefined);

  return (
    <div className="space-y-10 pb-16">
      {/* Profile Header Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900 via-slate-900/80 to-[#12141f] p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          {/* Avatar container */}
          <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-xl shadow-amber-500/20 shrink-0">
            <div className="w-full h-full rounded-2xl bg-[#090a0f] flex items-center justify-center overflow-hidden">
              <span className="font-['Outfit'] text-3xl font-extrabold text-amber-400">
                RM
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 bg-amber-400 rounded-full text-slate-950">
              <Award className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>

          {/* User Identity Details */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Rehan Toshif
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                Level 4 Cinephile
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Curator & Story Analyst · Member since October 2024
            </p>
            <p className="text-sm text-slate-300 mt-3 max-w-xl leading-relaxed">
              Drawn to non-linear narratives, existential science fiction, and high-contrast neo-noir cinematography.
            </p>

            {/* Quick Badges / Micro Stats */}
            <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-amber-400" />
                <strong className="text-white font-mono">{watchedMedia.length}</strong> Completed
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <strong className="text-white font-mono">148h</strong> Screen Time
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-400" />
                <strong className="text-white font-mono">{ratedEntries.length}</strong> Titles Reviewed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Grid: Taste DNA & Preferred Directors */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left: Genre & Taste DNA */}
        <div className="md:col-span-7 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-['Outfit'] text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Cinematic Taste DNA</span>
              </h2>
              <span className="text-xs text-slate-400">Calculated from viewing history</span>
            </div>

            <div className="space-y-3.5 pt-2">
              {sortedGenres.map(([genre, count]) => {
                const percentage = Math.round((count / maxGenreVal) * 100);
                return (
                  <div key={genre} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-medium">{genre}</span>
                      <span className="text-slate-400 font-mono">{count} titles ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preferred Directors */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/5 space-y-4">
            <h2 className="font-['Outfit'] text-base font-bold text-white flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-400" />
              <span>Auteur Affinity</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 pt-1">
              {[
                { name: 'Denis Villeneuve', works: 'Dune, Blade Runner 2049, Arrival', match: '98% match' },
                { name: 'Christopher Nolan', works: 'Oppenheimer, Interstellar, Inception', match: '96% match' },
                { name: 'David Fincher', works: 'Mindhunter, Seven, Fight Club', match: '92% match' },
                { name: 'Hayao Miyazaki', works: 'Spirited Away, Princess Mononoke', match: '89% match' },
              ].map((dir) => (
                <div
                  key={dir.name}
                  className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1"
                >
                  <div className="text-xs font-semibold text-white">{dir.name}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-1">{dir.works}</div>
                  <div className="text-[10px] font-mono text-amber-400/90 pt-0.5">{dir.match}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Personal Rating Notebook */}
        <div className="md:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-['Outfit'] text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span>My Viewing Journal</span>
              </h2>
              <button
                onClick={() => onNavigateTab('watchlist')}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-medium"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {ratedEntries.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <p className="text-xs">No ratings or reflections logged yet.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Open any title to assign personal stars and notes.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {ratedEntries.slice(0, 4).map(({ entry, media }) => (
                  <div
                    key={media.id}
                    onClick={() => onSelectMedia(media)}
                    className="p-3 rounded-xl bg-black/30 border border-white/5 hover:border-amber-400/30 transition-all cursor-pointer flex gap-3 items-center"
                  >
                    <div className="w-10 h-14 rounded overflow-hidden shrink-0 border border-white/10">
                      <MediaPoster media={media} aspect="poster" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs">
                        <h4 className="font-semibold text-white truncate">{media.title}</h4>
                        <span className="font-mono text-amber-400 shrink-0 ml-2">
                          {entry.personalRating} / 10 ★
                        </span>
                      </div>
                      {entry.personalNotes ? (
                        <p className="text-[11px] text-slate-300 italic line-clamp-1 mt-0.5">
                          "{entry.personalNotes}"
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {media.year} · {media.genres[0]}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Preferences Box */}
          <div className="p-5 rounded-2xl bg-black/40 border border-white/5 text-xs text-slate-400 space-y-2.5">
            <span className="font-semibold text-white uppercase tracking-wider text-[11px] block">
              Curation Engine Settings
            </span>
            <div className="flex items-center justify-between py-1">
              <span>Streaming Platform Grounding</span>
              <span className="text-white font-medium">US & Global</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Spoiler Shield</span>
              <span className="text-emerald-400 font-medium">Active (Enforced)</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Dark Theme Optical Balance</span>
              <span className="text-amber-300 font-medium">OLED Obsidian</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

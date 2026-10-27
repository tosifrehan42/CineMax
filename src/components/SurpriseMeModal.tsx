import React, { useState } from 'react';
import { MediaItem } from '../types';
import { MOODS } from '../data/mediaData';
import { MediaPoster } from './MediaPoster';
import { X, Dice5, Star, Sparkles, ArrowRight } from 'lucide-react';

interface SurpriseMeModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MediaItem[];
  onSelectMedia: (media: MediaItem) => void;
}

export const SurpriseMeModal: React.FC<SurpriseMeModalProps> = ({
  isOpen,
  onClose,
  items,
  onSelectMedia,
}) => {
  const [selectedMood, setSelectedMood] = useState('all');
  const [isRolling, setIsRolling] = useState(false);
  const [pickedItem, setPickedItem] = useState<MediaItem | null>(() => {
    return items[Math.floor(Math.random() * items.length)] || null;
  });

  if (!isOpen) return null;

  const handleRoll = () => {
    setIsRolling(true);
    let eligible = items;
    if (selectedMood !== 'all') {
      const filtered = items.filter((item) => item.moods.includes(selectedMood));
      if (filtered.length > 0) eligible = filtered;
    }

    // Animate rolling effect
    let counter = 0;
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * eligible.length);
      setPickedItem(eligible[randomIdx]);
      counter++;
      if (counter > 8) {
        clearInterval(interval);
        setIsRolling(false);
      }
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto cm-glass-backdrop flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl cm-glass-panel rounded-2xl overflow-hidden p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Dice5 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-['Outfit'] text-lg font-bold text-white">
                ReelRoulette
              </h3>
              <p className="text-xs text-slate-400">
                Let fate curate your next cinematic journey
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cm-glass-control"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mood filter pill selector (Interactive filter button group) */}
        <div className="mt-5">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-2">
            Target Vibe / Mood
          </span>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.slice(0, 6).map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMood(m.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  selectedMood === m.id
                    ? 'bg-amber-500 text-black font-semibold shadow-sm'
                    : 'cm-glass-control text-slate-300 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Revealed Title Display */}
        {pickedItem && (
          <div
            className={`mt-6 p-4 rounded-xl cm-glass-surface transition-all duration-200 flex gap-4 items-center ${
              isRolling ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
            }`}
          >
            <div className="w-24 shrink-0 rounded-lg overflow-hidden border border-white/10">
              <MediaPoster media={pickedItem} aspect="poster" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <span>{pickedItem.year}</span>
                <span aria-hidden="true">·</span>
                <span>{pickedItem.type === 'movie' ? 'Film' : `${pickedItem.seasons} Seasons`}</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-400 font-mono font-medium flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-amber-400" />
                  {pickedItem.rating.toFixed(1)}
                </span>
              </div>

              <h4 className="font-['Outfit'] text-lg font-bold text-white truncate">
                {pickedItem.title}
              </h4>
              <p className="text-xs text-slate-300 line-clamp-2 mt-1">
                {pickedItem.synopsis}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    onClose();
                    onSelectMedia(pickedItem);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black font-semibold text-xs hover:bg-slate-200 transition-colors"
                >
                  <span>Open Title Details</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Roll Button */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleRoll}
            disabled={isRolling}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            <Dice5 className={`w-4 h-4 stroke-[2.5] ${isRolling ? 'animate-spin' : ''}`} />
            <span>{isRolling ? 'Selecting...' : 'Spin Again'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

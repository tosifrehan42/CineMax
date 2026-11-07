import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Download,
  Share,
  PlusSquare,
  X,
  HardDriveDownload,
} from 'lucide-react';
import { usePWAStatus } from '../hooks/usePWAStatus';
import {
  fadeDownVariants,
  modalBackdropVariants,
  modalPanelVariants,
  reducedMotionVariants,
  SPRING_TACTILE,
  useCinematicMotion,
} from '../utils/motionSystem';

interface OfflineStatusBannerProps {
  userId?: string | null;
  watchlistCount: number;
  onManualSync?: () => void;
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({
  userId,
  watchlistCount,
  onManualSync,
}) => {
  const {
    isOnline,
    pendingSyncCount,
    isSyncing,
    justSyncedCount,
    cacheStats,
  } = usePWAStatus(userId, watchlistCount);
  const { prefersReducedMotion } = useCinematicMotion();
  const bannerVariants = prefersReducedMotion ? reducedMotionVariants : fadeDownVariants;

  const showBanner = !(isOnline && !isSyncing && pendingSyncCount === 0 && justSyncedCount === 0);

  return (
    <AnimatePresence initial={false}>
      {showBanner && (
        <motion.div
          key={!isOnline ? 'offline' : isSyncing || pendingSyncCount > 0 ? 'syncing' : 'synced'}
          variants={bannerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-2.5"
        >
          {!isOnline ? (
            <div
              role="status"
              aria-live="polite"
              className="cm-glass-card rounded-2xl px-4 py-2.5 border border-amber-500/30 bg-amber-500/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200 shadow-lg"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
                  <WifiOff className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0">
                  <span className="font-semibold text-amber-300">Offline Mode</span>
                  <span className="text-slate-300 ml-1.5">
                    · Your Watchlist ({cacheStats.watchlistTitlesCached} titles)
                    {cacheStats.viewedTitlesCached > 0
                      ? ` & ${cacheStats.viewedTitlesCached} viewed detail pages`
                      : ''}{' '}
                    are available from local cache.
                  </span>
                </div>
              </div>

              {pendingSyncCount > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] font-mono text-amber-300 shrink-0">
                  {pendingSyncCount} change{pendingSyncCount === 1 ? '' : 's'} queued for cloud sync
                </span>
              )}
            </div>
          ) : isSyncing || pendingSyncCount > 0 ? (
            <div
              role="status"
              aria-live="polite"
              className="cm-glass-card rounded-2xl px-4 py-2.5 border border-sky-500/30 bg-sky-500/[0.08] flex items-center justify-between gap-3 text-xs text-slate-200 shadow-lg"
            >
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
                <span>
                  <strong className="text-sky-300 font-semibold">Back online</strong> · Syncing{' '}
                  {pendingSyncCount} offline change{pendingSyncCount === 1 ? '' : 's'} to your cloud
                  account…
                </span>
              </div>
              {!isSyncing && onManualSync && (
                <button
                  type="button"
                  onClick={onManualSync}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-[11px] font-semibold text-sky-200 transition-colors cursor-pointer active:scale-[0.97]"
                >
                  Sync Now
                </button>
              )}
            </div>
          ) : justSyncedCount > 0 ? (
            <div
              role="status"
              aria-live="polite"
              className="cm-glass-card rounded-2xl px-4 py-2 border border-emerald-500/30 bg-emerald-500/[0.08] flex items-center gap-2.5 text-xs text-emerald-200 shadow-lg"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Synced {justSyncedCount} offline change{justSyncedCount === 1 ? '' : 's'} to cloud.
              </span>
            </div>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, installApp } = usePWAStatus();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { prefersReducedMotion } = useCinematicMotion();

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <motion.button
        type="button"
        onClick={installApp}
        aria-label="Install CineMax App"
        title="Install CineMax for offline access & home screen launch"
        whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
        transition={SPRING_TACTILE}
        className={
          compact
            ? 'flex items-center justify-center gap-1.5 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 min-[400px]:w-9 min-[400px]:h-9 sm:w-auto sm:min-h-[36px] sm:px-2.5 sm:py-1.5 text-xs font-medium text-amber-300 hover:text-white cm-glass-control rounded-xl shrink-0 transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400'
            : 'flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs font-semibold text-amber-300 transition-colors cursor-pointer'
        }
      >
        <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className={compact ? 'hidden xl:inline' : ''}>Install App</span>
      </motion.button>
    );
  }

  if (isIOS) {
    return (
      <>
        <motion.button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Install CineMax on iOS"
          title="Add CineMax to Home Screen"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
          transition={SPRING_TACTILE}
          className={
            compact
              ? 'flex items-center justify-center gap-1.5 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 min-[400px]:w-9 min-[400px]:h-9 sm:w-auto sm:min-h-[36px] sm:px-2.5 sm:py-1.5 text-xs font-medium text-amber-300 hover:text-white cm-glass-control rounded-xl shrink-0 transition-colors cursor-pointer'
              : 'flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs font-semibold text-amber-300 transition-colors cursor-pointer'
          }
        >
          <HardDriveDownload className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className={compact ? 'hidden xl:inline' : ''}>Install App</span>
        </motion.button>

        <AnimatePresence>
          {showIOSGuide && (
            <motion.div
              variants={prefersReducedMotion ? reducedMotionVariants : modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 pointer-events-auto"
            >
              <motion.div
                variants={prefersReducedMotion ? reducedMotionVariants : modalPanelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full max-w-sm rounded-2xl bg-[#121621] border border-white/15 p-6 shadow-2xl space-y-4 text-slate-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Install CineMax on iOS</h3>
                      <p className="text-xs text-slate-400">Offline Watchlist &amp; Full-Screen App</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs text-slate-300 bg-black/35 border border-white/[0.07] rounded-xl p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-amber-400 shrink-0">
                      <Share className="w-3.5 h-3.5" />
                    </span>
                    <span>
                      1. Tap the <strong className="text-white">Share</strong> button in your Safari
                      toolbar.
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-amber-400 shrink-0">
                      <PlusSquare className="w-3.5 h-3.5" />
                    </span>
                    <span>
                      2. Scroll down and select{' '}
                      <strong className="text-white">Add to Home Screen</strong>.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer active:scale-[0.98]"
                >
                  Got It
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return null;
};

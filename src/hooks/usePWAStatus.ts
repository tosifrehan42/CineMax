import { useEffect, useState, useCallback } from 'react';
import { registerSW } from 'virtual:pwa-register';
import {
  getPendingOfflineMutationsCount,
  SyncQueueStateEventDetail,
} from '../services/offlineSyncQueue';
import { getOfflineCacheStats } from '../services/offlineCacheService';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let swRegistered = false;

export function initServiceWorkerRegistration(): void {
  if (typeof window === 'undefined' || swRegistered) return;
  const protocol = window.location.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') return;

  swRegistered = true;
  try {
    registerSW({
      immediate: true,
      onOfflineReady() {
        window.dispatchEvent(new CustomEvent('cinemax:sw-offline-ready'));
      },
    });
  } catch {
    // Ignore registration error in restricted environments
  }
}

export function usePWAStatus(userId?: string | null, watchlistCount = 0) {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() =>
    getPendingOfflineMutationsCount(userId)
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [justSyncedCount, setJustSyncedCount] = useState<number>(0);
  const [cacheStats, setCacheStats] = useState(() =>
    getOfflineCacheStats(watchlistCount)
  );

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);

  useEffect(() => {
    initServiceWorkerRegistration();
  }, []);

  useEffect(() => {
    setPendingSyncCount(getPendingOfflineMutationsCount(userId));
  }, [userId]);

  useEffect(() => {
    setCacheStats(getOfflineCacheStats(watchlistCount));
  }, [watchlistCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleQueueUpdate = (e: Event) => {
      const detail = (e as CustomEvent<SyncQueueStateEventDetail>).detail;
      if (detail) {
        setPendingSyncCount(getPendingOfflineMutationsCount(userId));
        setIsSyncing(detail.isSyncing);
        if (detail.syncedCount && detail.syncedCount > 0) {
          setJustSyncedCount(detail.syncedCount);
        }
      } else {
        setPendingSyncCount(getPendingOfflineMutationsCount(userId));
      }
    };

    const handleCacheUpdate = () => {
      setCacheStats(getOfflineCacheStats(watchlistCount));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('cinemax:sync-queue-updated', handleQueueUpdate);
    window.addEventListener('cinemax:offline-cache-updated', handleCacheUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('cinemax:sync-queue-updated', handleQueueUpdate);
      window.removeEventListener('cinemax:offline-cache-updated', handleCacheUpdate);
    };
  }, [userId, watchlistCount]);

  useEffect(() => {
    if (justSyncedCount <= 0) return;
    const timer = window.setTimeout(() => {
      setJustSyncedCount(0);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [justSyncedCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cap = (window as any).Capacitor;
    const isCapacitorNative =
      Boolean(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());

    const isStandalone =
      isCapacitorNative ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !isCapacitorNative;
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  return {
    isOnline,
    pendingSyncCount,
    isSyncing,
    justSyncedCount,
    cacheStats,
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    installApp,
  };
}

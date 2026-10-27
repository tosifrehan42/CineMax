import React, { useState, useRef, useEffect, Suspense } from 'react';
import {
  MediaItem,
  UserProfile,
  WatchHistoryEntry,
  WatchlistEntry,
} from '../types';
import { MediaPoster } from './MediaPoster';
import {
  parseRuntimeMinutes,
  SUPABASE_SCHEMA_SQL,
  SUPABASE_AVATARS_BUCKET_SQL,
  validateAvatarFile,
  MAX_AVATAR_INPUT_BYTES,
} from '../services/supabaseClient';
import {
  Star,
  Film,
  Clock,
  Award,
  Sparkles,
  Heart,
  ChevronRight,
  BookOpen,
  Edit3,
  Calendar,
  Trash2,
  LogIn,
  LogOut,
  AlertCircle,
  RefreshCw,
  Loader2,
  Check,
  Copy,
  X,
  Flame,
  Camera,
  Upload,
  KeyRound,
} from 'lucide-react';

const AvatarCropModal = React.lazy(() =>
  import('./AvatarCropModal').then((m) => ({ default: m.AvatarCropModal }))
);
const ChangePasswordModal = React.lazy(() =>
  import('./ChangePasswordModal').then((m) => ({
    default: m.ChangePasswordModal,
  }))
);

interface ProfileViewProps {
  watchlist: WatchlistEntry[];
  watchHistory?: WatchHistoryEntry[];
  userProfile?: UserProfile | null;
  userEmail?: string | null;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  error?: string | null;
  schemaMissing?: boolean;
  onRetry?: () => void;
  onOpenAuthModal?: (mode?: 'signin' | 'signup') => void;
  onOpenChangePassword?: () => void;
  onSignOut?: () => void;
  onUpdateProfile?: (updates: {
    displayName: string;
    username?: string | null;
    bio?: string;
    favoriteGenres?: string[];
  }) => Promise<{ error: string | null }>;
  onUploadAvatar?: (
    fileBlob: Blob,
    mimeType: string
  ) => Promise<{ error: string | null; bucketSetupNeeded?: boolean }>;
  onRemoveAvatar?: () => Promise<{ error: string | null }>;
  onDeleteHistoryEntry?: (mediaId: string) => void;
  allMedia: MediaItem[];
  onSelectMedia: (media: MediaItem) => void;
  onNavigateTab: (tab: 'discover' | 'watchlist') => void;
}

const AVAILABLE_GENRES = [
  'Sci-Fi',
  'Drama',
  'Thriller',
  'Crime',
  'Mystery',
  'Action',
  'Fantasy',
  'Animation',
  'History',
  'Comedy',
  'Horror',
  'Romance',
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  watchlist,
  watchHistory = [],
  userProfile,
  userEmail,
  isAuthenticated = false,
  isLoading = false,
  error = null,
  schemaMissing = false,
  onRetry,
  onOpenAuthModal,
  onOpenChangePassword,
  onSignOut,
  onUpdateProfile,
  onUploadAvatar,
  onRemoveAvatar,
  onDeleteHistoryEntry,
  allMedia,
  onSelectMedia,
  onNavigateTab,
}) => {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLocalChangePasswordOpen, setIsLocalChangePasswordOpen] =
    useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFormError, setProfileFormError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedBucketSql, setCopiedBucketSql] = useState(false);

  // Avatar Upload, Crop & Removal State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [avatarActionError, setAvatarActionError] = useState<string | null>(null);
  const [avatarActionSuccess, setAvatarActionSuccess] = useState<string | null>(null);
  const [bucketSetupNeeded, setBucketSetupNeeded] = useState(false);
  const [avatarImageLoadFailed, setAvatarImageLoadFailed] = useState(false);

  useEffect(() => {
    setAvatarImageLoadFailed(false);
  }, [userProfile?.avatarUrl]);

  const hasValidAvatar = Boolean(
    isAuthenticated && userProfile?.avatarUrl && !avatarImageLoadFailed
  );

  const handleTriggerFileSelect = () => {
    setAvatarActionError(null);
    setAvatarActionSuccess(null);
    if (!isAuthenticated) {
      setAvatarActionError('Please sign in to upload or change your profile picture.');
      onOpenAuthModal?.('signin');
      return;
    }
    if (isUploadingAvatar || isRemovingAvatar) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarActionError(null);
    setAvatarActionSuccess(null);
    setBucketSetupNeeded(false);

    const validation = validateAvatarFile(file, MAX_AVATAR_INPUT_BYTES);
    if (!validation.valid) {
      setAvatarActionError(validation.error);
      e.target.value = '';
      return;
    }

    setSelectedAvatarFile(file);
    setIsCropModalOpen(true);
  };

  const handleConfirmCroppedUpload = async (
    croppedBlob: Blob,
    mimeType: string
  ) => {
    if (!onUploadAvatar || isUploadingAvatar) return;
    setIsUploadingAvatar(true);
    setAvatarActionError(null);
    setAvatarActionSuccess(null);
    setBucketSetupNeeded(false);

    try {
      const res = await onUploadAvatar(croppedBlob, mimeType);
      if (res.error) {
        setAvatarActionError(res.error);
        if (res.bucketSetupNeeded) {
          setBucketSetupNeeded(true);
        }
      } else {
        setIsCropModalOpen(false);
        setSelectedAvatarFile(null);
        setAvatarActionSuccess('Profile picture updated and saved to your account.');
        setTimeout(() => setAvatarActionSuccess(null), 4000);
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatarClick = async () => {
    if (!isAuthenticated) {
      onOpenAuthModal?.('signin');
      return;
    }
    if (!onRemoveAvatar || isRemovingAvatar || isUploadingAvatar) return;

    setIsRemovingAvatar(true);
    setAvatarActionError(null);
    setAvatarActionSuccess(null);

    try {
      const res = await onRemoveAvatar();
      if (res.error) {
        setAvatarActionError(res.error);
      } else {
        setAvatarActionSuccess('Profile picture removed. Reverted to default initials avatar.');
        setTimeout(() => setAvatarActionSuccess(null), 4000);
      }
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  const handleCopyBucketSql = () => {
    navigator.clipboard?.writeText(SUPABASE_AVATARS_BUCKET_SQL);
    setCopiedBucketSql(true);
    setTimeout(() => setCopiedBucketSql(false), 2500);
  };

  const openEditModal = () => {
    setEditDisplayName(
      userProfile?.displayName || userEmail?.split('@')[0] || 'Cinema Enthusiast'
    );
    setEditUsername(userProfile?.username || '');
    setEditBio(userProfile?.bio || '');
    setEditGenres(userProfile?.favoriteGenres || []);
    setProfileFormError(null);
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateProfile) return;
    setSavingProfile(true);
    setProfileFormError(null);
    const res = await onUpdateProfile({
      displayName: editDisplayName,
      username: editUsername || null,
      bio: editBio,
      favoriteGenres: editGenres,
    });
    setSavingProfile(false);
    if (res.error) {
      setProfileFormError(res.error);
    } else {
      setIsEditingProfile(false);
    }
  };

  const toggleEditGenre = (genre: string) => {
    setEditGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleCopySql = () => {
    navigator.clipboard?.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Merge watched history items with completed watchlist items for comprehensive real stats
  const historyWithMedia = watchHistory
    .map((h) => {
      const media = allMedia.find((m) => m.id === h.mediaId) || h.mediaSnapshot;
      return {
        mediaId: h.mediaId,
        watchedAt: h.watchedAt,
        personalRating: h.personalRating,
        reviewNotes: h.reviewNotes,
        runtimeMinutes: h.runtimeMinutes || parseRuntimeMinutes(media),
        media,
      };
    })
    .filter(
      (
        item
      ): item is {
        mediaId: string;
        watchedAt: string;
        personalRating: number | undefined;
        reviewNotes: string | undefined;
        runtimeMinutes: number;
        media: MediaItem;
      } => item.media !== undefined
    );

  // Also include completed watchlist items that might not be in watchHistory (e.g. local guest mode)
  const historyMediaIds = new Set(historyWithMedia.map((h) => h.mediaId));
  const completedWatchlistFallback = watchlist
    .filter((w) => w.status === 'completed' && !historyMediaIds.has(w.mediaId))
    .map((w) => {
      const media = allMedia.find((m) => m.id === w.mediaId) || w.mediaSnapshot;
      return {
        mediaId: w.mediaId,
        watchedAt: w.updatedAt || w.addedAt,
        personalRating: w.personalRating,
        reviewNotes: w.personalNotes,
        runtimeMinutes: parseRuntimeMinutes(media),
        media,
      };
    })
    .filter(
      (
        item
      ): item is {
        mediaId: string;
        watchedAt: string;
        personalRating: number | undefined;
        reviewNotes: string | undefined;
        runtimeMinutes: number;
        media: MediaItem;
      } => item.media !== undefined
    );

  const combinedJournal = [...historyWithMedia, ...completedWatchlistFallback].sort(
    (a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
  );

  // Real statistics calculation (Zero fake fallback numbers)
  const completedCount = combinedJournal.length;
  const totalMinutesWatched = combinedJournal.reduce(
    (sum, item) => sum + (item.runtimeMinutes || parseRuntimeMinutes(item.media)),
    0
  );
  const totalHoursWatched = (totalMinutesWatched / 60).toFixed(1).replace(/\.0$/, '');

  const favouritesCount = watchlist.filter((w) => w.isFavourite).length;

  // All rated entries across watchlist & history
  const ratingsMap = new Map<string, number>();
  watchlist.forEach((w) => {
    if (w.personalRating && w.personalRating > 0) {
      ratingsMap.set(w.mediaId, w.personalRating);
    }
  });
  combinedJournal.forEach((j) => {
    if (j.personalRating && j.personalRating > 0) {
      ratingsMap.set(j.mediaId, j.personalRating);
    }
  });
  const ratingValues = Array.from(ratingsMap.values());
  const avgPersonalRating =
    ratingValues.length > 0
      ? (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(1)
      : null;

  // Compute real active streak (distinct days logged in watch history)
  const distinctWatchDays = new Set(
    combinedJournal
      .map((j) => (j.watchedAt ? String(j.watchedAt).split('T')[0] : ''))
      .filter(Boolean)
  ).size;

  // Compute authentic Genre Taste DNA strictly from user's watched or saved titles (no fake fallback)
  const userMediaPool: MediaItem[] =
    combinedJournal.length > 0
      ? combinedJournal.map((j) => j.media)
      : watchlist
          .map((w) => allMedia.find((m) => m.id === w.mediaId) || w.mediaSnapshot)
          .filter((m): m is MediaItem => m !== undefined);

  const genreCounts: Record<string, number> = {};
  userMediaPool.forEach((m) => {
    m.genres.forEach((g) => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
  });

  const sortedGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const totalGenreMentions = userMediaPool.length || 1;

  // Compute real Director / Auteur Affinity from user's watched & saved titles
  const directorMap = new Map<string, { count: number; titles: string[] }>();
  userMediaPool.forEach((m) => {
    const dir = (m.director || '').trim();
    if (!dir || dir === 'Acclaimed Director' || dir.includes('Production')) return;
    const existing = directorMap.get(dir) || { count: 0, titles: [] };
    existing.count += 1;
    if (!existing.titles.includes(m.title)) {
      existing.titles.push(m.title);
    }
    directorMap.set(dir, existing);
  });
  const topDirectors = Array.from(directorMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4);

  const displayName = isAuthenticated
    ? userProfile?.displayName || userEmail?.split('@')[0] || 'Cinema Enthusiast'
    : 'Guest Cinephile (Local Session)';

  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const memberSince = userProfile?.createdAt
    ? new Date(userProfile.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  const cinephileTier =
    completedCount >= 20
      ? 'Auteur Archivist'
      : completedCount >= 5
      ? 'Curator Cinephile'
      : completedCount >= 1
      ? 'Active Viewer'
      : 'New Member';

  return (
    <div className="space-y-8 pb-16">
      {/* Signed-Out Callout Banner */}
      {!isAuthenticated && (
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-['Outfit'] text-base font-bold text-white flex items-center gap-2">
              <LogIn className="w-4 h-4 text-amber-400" />
              <span>Sign In for Persistent Profile & Viewing Journal</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Sign in with your Supabase account to customize your cinephile profile, record dated entries in your Viewing Journal, and sync statistics across devices.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onOpenAuthModal?.('signin')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap shadow-md shadow-amber-500/20"
            >
              Sign In
            </button>
            <button
              onClick={() => onOpenAuthModal?.('signup')}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs whitespace-nowrap"
            >
              Create Account
            </button>
          </div>
        </div>
      )}

      {/* Error State Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300">Profile & History Sync Issue</p>
              <p className="text-red-200/80 mt-0.5">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {schemaMissing && (
              <button
                onClick={handleCopySql}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium flex items-center gap-1.5 whitespace-nowrap"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>SQL Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy SQL Schema</span>
                  </>
                )}
              </button>
            )}
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden File Input for Avatar Upload (JPEG, PNG, WebP up to 10 MB) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Select profile picture (JPEG, PNG, or WebP up to 10 MB)"
      />

      {/* Avatar Status / Validation Feedback Banners */}
      {avatarActionError && !isCropModalOpen && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300">Profile Photo Error</p>
              <p className="text-red-200/90 mt-0.5">{avatarActionError}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {bucketSetupNeeded && (
              <button
                type="button"
                onClick={handleCopyBucketSql}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-amber-400"
              >
                {copiedBucketSql ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>SQL Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Avatars Storage SQL</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAvatarActionError(null)}
              className="p-1 text-red-300 hover:text-white"
              aria-label="Dismiss avatar error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {avatarActionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{avatarActionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setAvatarActionSuccess(null)}
            className="p-1 text-emerald-300 hover:text-white"
            aria-label="Dismiss success notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="py-20 text-center rounded-2xl border border-white/5 bg-slate-900/30 space-y-3">
          <Loader2 className="w-8 h-8 mx-auto text-amber-400 animate-spin" />
          <p className="text-sm font-medium text-slate-300">
            Loading your persistent profile and viewing history...
          </p>
        </div>
      ) : (
        <>
          {/* Profile Header Hero */}
          <div className="cm-glass-surface relative overflow-hidden rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar container + Quick Photo Controls */}
                <div className="flex flex-col items-center gap-2.5 shrink-0">
                  <div className="relative group w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-xl shadow-amber-500/20">
                    <div className="w-full h-full rounded-2xl bg-[#090a0f] flex items-center justify-center overflow-hidden relative">
                      {hasValidAvatar ? (
                        <img
                          src={userProfile!.avatarUrl!}
                          alt={displayName}
                          onError={() => setAvatarImageLoadFailed(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-['Outfit'] text-3xl sm:text-4xl font-extrabold text-amber-400 select-none">
                          {initials}
                        </span>
                      )}

                      {/* Hover Camera Trigger for Authenticated Users */}
                      {isAuthenticated && (
                        <button
                          type="button"
                          disabled={isUploadingAvatar || isRemovingAvatar}
                          onClick={handleTriggerFileSelect}
                          className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-amber-300 disabled:cursor-wait"
                          title={hasValidAvatar ? 'Change Photo' : 'Upload Photo'}
                        >
                          {isUploadingAvatar || isRemovingAvatar ? (
                            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                          ) : (
                            <>
                              <Camera className="w-5 h-5 text-amber-400" />
                              <span>{hasValidAvatar ? 'Change' : 'Upload'}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 p-1 bg-amber-400 rounded-full text-slate-950 shadow">
                      <Award className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  </div>

                  {/* Explicit Upload / Change / Remove Photo Buttons (Mobile & Desktop Friendly) */}
                  {isAuthenticated ? (
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <button
                        type="button"
                        disabled={isUploadingAvatar || isRemovingAvatar}
                        onClick={handleTriggerFileSelect}
                        className="cm-glass-control px-2.5 py-1 rounded-lg text-[11px] font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1 transition-colors disabled:opacity-40"
                      >
                        <Upload className="w-3 h-3" />
                        <span>{hasValidAvatar ? 'Change Photo' : 'Upload Photo'}</span>
                      </button>

                      {hasValidAvatar && (
                        <button
                          type="button"
                          disabled={isUploadingAvatar || isRemovingAvatar}
                          onClick={handleRemoveAvatarClick}
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-[11px] font-semibold text-red-300 flex items-center gap-1 transition-colors disabled:opacity-40"
                        >
                          {isRemovingAvatar ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          <span>Remove Photo</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenAuthModal?.('signin')}
                      className="text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                    >
                      <Camera className="w-3 h-3 text-amber-400" />
                      <span>Sign in to add photo</span>
                    </button>
                  )}
                </div>

                {/* User Identity Details */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-bold text-white tracking-tight">
                      {displayName}
                    </h1>
                    <span className="text-xs text-amber-300 font-medium">
                      · {cinephileTier}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    {userProfile?.username ? `@${userProfile.username} · ` : ''}
                    {userEmail ? `${userEmail} · ` : ''}
                    {memberSince ? `Member since ${memberSince}` : 'Local Browser Profile'}
                  </p>

                  <p className="text-sm text-slate-300 mt-2 max-w-xl leading-relaxed">
                    {userProfile?.bio
                      ? userProfile.bio
                      : isAuthenticated
                      ? 'No personal bio added yet. Click Edit Profile to share your favourite genres, directors, and cinema philosophy.'
                      : 'Browsing in guest mode. Sign in to customize your profile bio and sync your viewing journal across devices.'}
                  </p>

                  {userProfile?.favoriteGenres && userProfile.favoriteGenres.length > 0 && (
                    <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-amber-300/90">
                      <span className="text-slate-400">Preferred Genres:</span>
                      <span>{userProfile.favoriteGenres.join(' · ')}</span>
                    </div>
                  )}

                  {/* Quick Micro Stats */}
                  <div className="pt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-amber-400" />
                      <strong className="text-white font-mono tabular-nums">
                        {completedCount}
                      </strong>{' '}
                      Watched
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      <strong className="text-white font-mono tabular-nums">
                        {totalHoursWatched}h
                      </strong>{' '}
                      Screen Time
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-400" />
                      <strong className="text-white font-mono tabular-nums">
                        {favouritesCount}
                      </strong>{' '}
                      Favourites
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-yellow-400" />
                      <strong className="text-white font-mono tabular-nums">
                        {avgPersonalRating ? `${avgPersonalRating} ★` : '—'}
                      </strong>{' '}
                      Avg Rating ({ratingValues.length})
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <strong className="text-white font-mono tabular-nums">
                        {distinctWatchDays}d
                      </strong>{' '}
                      Logged Days
                    </span>
                  </div>
                </div>
              </div>

              {/* Profile Actions */}
              {isAuthenticated && (
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="cm-glass-control px-3.5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenChangePassword
                        ? onOpenChangePassword()
                        : setIsLocalChangePasswordOpen(true)
                    }
                    className="cm-glass-control px-3.5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>Change Password</span>
                  </button>
                  {onSignOut && (
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs font-semibold text-red-300 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Two-Column Grid: Taste DNA & Viewing Journal */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Left: Genre & Taste DNA + Auteur Affinity */}
            <div className="md:col-span-6 space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-['Outfit'] text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Cinematic Taste DNA</span>
                  </h2>
                  <span className="text-xs text-slate-400">
                    {combinedJournal.length > 0
                      ? 'Based on watched history'
                      : 'Based on saved watchlist'}
                  </span>
                </div>

                {sortedGenres.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      No genre data recorded yet.
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Mark titles as Completed or add movies and TV shows to your Watchlist to compute your authentic genre distribution.
                    </p>
                    <button
                      onClick={() => onNavigateTab('discover')}
                      className="mt-2 px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-amber-400 font-medium"
                    >
                      Explore Catalogue
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5 pt-2">
                    {sortedGenres.map(([genre, count]) => {
                      const percentage = Math.min(
                        100,
                        Math.round((count / totalGenreMentions) * 100)
                      );
                      return (
                        <div key={genre} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white font-medium">{genre}</span>
                            <span className="text-slate-400 font-mono tabular-nums">
                              {count} {count === 1 ? 'title' : 'titles'} ({percentage}%)
                            </span>
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
                )}
              </div>

              {/* Auteur / Director Affinity (Computed from user's real titles) */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-['Outfit'] text-base font-bold text-white flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-400" />
                    <span>Director & Creator Affinity</span>
                  </h2>
                  <span className="text-xs text-slate-400">From your library</span>
                </div>

                {topDirectors.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Add or complete films in your library to see your most-watched directors.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {topDirectors.map(([directorName, info]) => (
                      <div
                        key={directorName}
                        className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1"
                      >
                        <div className="text-xs font-semibold text-white">{directorName}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">
                          {info.titles.join(', ')}
                        </div>
                        <div className="text-[10px] font-mono text-amber-400/90 pt-0.5 tabular-nums">
                          {info.count} {info.count === 1 ? 'title' : 'titles'} in library
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Dated Viewing Journal (watch_history) */}
            <div className="md:col-span-6 space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-['Outfit'] text-base font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      <span>Viewing Journal & Watch History</span>
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Chronological log of completed titles, watch dates & personal ratings
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigateTab('watchlist')}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-medium whitespace-nowrap"
                  >
                    <span>Manage Library</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {combinedJournal.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <Calendar className="w-8 h-8 mx-auto text-slate-600 stroke-1" />
                    <p className="text-xs text-slate-300 font-medium">
                      Your Viewing Journal is empty
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                      Open any movie or TV series and set its status to Completed to record the watch date, personal rating, and review notes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1 max-h-[520px] overflow-y-auto pr-1">
                    {combinedJournal.map((item) => {
                      const formattedDate = item.watchedAt
                        ? String(item.watchedAt).split('T')[0]
                        : 'Logged';
                      return (
                        <div
                          key={`${item.mediaId}-${item.watchedAt}`}
                          className="p-3 rounded-xl bg-black/30 border border-white/5 hover:border-amber-400/30 transition-all flex gap-3 items-start group"
                        >
                          <div
                            onClick={() => onSelectMedia(item.media)}
                            className="w-12 h-16 rounded overflow-hidden shrink-0 border border-white/10 cursor-pointer"
                          >
                            <MediaPoster media={item.media} aspect="poster" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <h4
                                onClick={() => onSelectMedia(item.media)}
                                className="font-semibold text-white group-hover:text-amber-400 transition-colors truncate cursor-pointer"
                              >
                                {item.media.title}
                              </h4>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.personalRating && item.personalRating > 0 ? (
                                  <span className="font-mono text-amber-400 font-semibold tabular-nums">
                                    {item.personalRating}/10 ★
                                  </span>
                                ) : null}
                                {onDeleteHistoryEntry && (
                                  <button
                                    onClick={() => onDeleteHistoryEntry(item.mediaId)}
                                    title="Remove from watch history"
                                    className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono tabular-nums">
                              <span className="flex items-center gap-1 text-slate-300">
                                <Calendar className="w-3 h-3 text-amber-400/80" />
                                Watched {formattedDate}
                              </span>
                              <span>·</span>
                              <span>{item.media.year}</span>
                              <span>·</span>
                              <span>{Math.round(item.runtimeMinutes)}m</span>
                            </div>

                            {item.reviewNotes && (
                              <p className="text-[11px] text-slate-300 italic line-clamp-2 mt-1.5">
                                "{item.reviewNotes}"
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Account & Session Management Section */}
          {isAuthenticated && (
            <div className="cm-glass-surface rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-['Outfit'] text-base font-bold text-white">
                  Account &amp; Session Settings
                </h2>
                <p className="text-xs text-slate-400">
                  Signed in as <span className="text-slate-200 font-medium">{userEmail || displayName}</span> · Manage your profile, password, and active Supabase session.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={openEditModal}
                  className="cm-glass-control min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onOpenChangePassword
                      ? onOpenChangePassword()
                      : setIsLocalChangePasswordOpen(true)
                  }
                  className="cm-glass-control min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Change Password</span>
                </button>
                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-bold text-red-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Sign Out of CineMax</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="cm-glass-backdrop fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsEditingProfile(false)} />
          <div className="cm-glass-panel relative z-10 w-full max-w-lg rounded-2xl overflow-hidden my-auto">
            <div className="cm-glass-subbar px-6 py-4 flex items-center justify-between">
              <h3 className="font-['Outfit'] text-lg font-bold text-white">
                Edit Cinephile Profile
              </h3>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="cm-glass-control p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              {profileFormError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{profileFormError}</span>
                </div>
              )}

              {/* Profile Photo Section inside Edit Profile Modal */}
              <div className="cm-glass-surface p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shrink-0">
                    <div className="w-full h-full rounded-xl bg-[#090a0f] flex items-center justify-center overflow-hidden">
                      {hasValidAvatar ? (
                        <img
                          src={userProfile!.avatarUrl!}
                          alt={displayName}
                          onError={() => setAvatarImageLoadFailed(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-['Outfit'] text-lg font-extrabold text-amber-400">
                          {initials}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Profile Picture
                    </div>
                    <div className="text-[11px] text-slate-400">
                      JPEG, PNG, or WebP up to 10 MB · Public avatar URL
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isUploadingAvatar || isRemovingAvatar}
                    onClick={handleTriggerFileSelect}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{hasValidAvatar ? 'Change Photo' : 'Upload Photo'}</span>
                  </button>
                  {hasValidAvatar && (
                    <button
                      type="button"
                      disabled={isUploadingAvatar || isRemovingAvatar}
                      onClick={handleRemoveAvatarClick}
                      className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-xs font-semibold text-red-300 flex items-center gap-1 transition-colors disabled:opacity-40"
                      title="Remove Profile Photo"
                    >
                      {isRemovingAvatar ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="cm-glass-input w-full px-3.5 py-2 text-sm rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Username (optional, 3–30 alphanumeric/underscore)
                </label>
                <input
                  type="text"
                  maxLength={30}
                  placeholder="cinephile_alex"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="cm-glass-input w-full px-3.5 py-2 text-sm rounded-xl text-white placeholder:text-slate-600 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Personal Bio
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Share your favourite movements, directors, or cinema philosophy..."
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="cm-glass-input w-full px-3.5 py-2 text-sm rounded-xl text-white placeholder:text-slate-600 focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Preferred Genres
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_GENRES.map((genre) => {
                    const active = editGenres.includes(genre);
                    return (
                      <button
                        type="button"
                        key={genre}
                        onClick={() => toggleEditGenre(genre)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          active
                            ? 'bg-amber-500 text-slate-950 border border-amber-400 font-semibold'
                            : 'cm-glass-control text-slate-300 hover:text-white'
                        }`}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingProfile(false);
                    if (onOpenChangePassword) {
                      onOpenChangePassword();
                    } else {
                      setIsLocalChangePasswordOpen(true);
                    }
                  }}
                  className="cm-glass-control px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Change Password</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="cm-glass-control px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                  >
                    {savingProfile ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Profile</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lazy-Loaded Interactive Circular Crop & Change Password Modals */}
      <Suspense fallback={null}>
        {isCropModalOpen && (
          <AvatarCropModal
            file={selectedAvatarFile}
            isOpen={isCropModalOpen}
            isUploading={isUploadingAvatar}
            error={avatarActionError}
            bucketSetupNeeded={bucketSetupNeeded}
            onClose={() => {
              if (!isUploadingAvatar) {
                setIsCropModalOpen(false);
                setSelectedAvatarFile(null);
                setAvatarActionError(null);
              }
            }}
            onConfirmUpload={handleConfirmCroppedUpload}
          />
        )}

        {isLocalChangePasswordOpen && (
          <ChangePasswordModal
            isOpen={isLocalChangePasswordOpen}
            onClose={() => setIsLocalChangePasswordOpen(false)}
            userEmail={userEmail}
          />
        )}
      </Suspense>
    </div>
  );
};

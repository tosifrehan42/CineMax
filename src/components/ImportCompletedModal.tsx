import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MediaItem,
  WatchedEpisodeEntry,
  WatchHistoryEntry,
  WatchlistEntry,
} from '../types';
import { MediaPoster } from './MediaPoster';
import { LiquidTabBubble, useLiquidTabBubble } from './LiquidTabBubble';
import {
  executeCompletedImport,
  getTodayDateIso,
  ImportExecutionResult,
  parseImportFile,
  parseTextImportList,
  recalculateRowAccountState,
  resolveExtractedImportItems,
  ResolvedImportRow,
  searchMediaForImportOverride,
  validateImportFile,
} from '../services/completedImportService';
import {
  X,
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Search,
  Calendar,
  Film,
  Tv,
  Check,
  RefreshCw,
  LogIn,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

interface ImportCompletedModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  userId?: string | null;
  allMedia: MediaItem[];
  watchlist: WatchlistEntry[];
  watchHistory: WatchHistoryEntry[];
  onOpenAuthModal?: (mode?: 'signin' | 'signup') => void;
  onImportSuccess: (payload: {
    savedWatchlistEntries: WatchlistEntry[];
    savedHistoryEntries: WatchHistoryEntry[];
    savedEpisodeEntries: WatchedEpisodeEntry[];
    newlyDiscoveredMedia: MediaItem[];
    migrationNeeded?: boolean;
  }) => void;
  onNavigateTab?: (tab: 'watchlist' | 'profile') => void;
}

type InputTabMode = 'file' | 'paste';
type ReviewFilterTab = 'all' | 'matched' | 'ambiguous' | 'unmatched';
type WizardStep = 'input' | 'review' | 'results';

const SAMPLE_PASTE_TEXT = [
  '1. Oppenheimer (2023) - Movie',
  '2. Severance (2022) - TV Series',
  '3. Dune: Part Two (2024)',
  '4. Chernobyl (2019) [TV] - 2025-02-14',
  '5. Interstellar (2014) - 10/10',
].join('\n');

export const ImportCompletedModal: React.FC<ImportCompletedModalProps> = ({
  isOpen,
  onClose,
  isAuthenticated,
  userId,
  allMedia,
  watchlist,
  watchHistory,
  onOpenAuthModal,
  onImportSuccess,
  onNavigateTab,
}) => {
  const [step, setStep] = useState<WizardStep>('input');
  const [inputMode, setInputMode] = useState<InputTabMode>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [matchProgress, setMatchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const [defaultWatchedDate, setDefaultWatchedDate] = useState<string>(
    getTodayDateIso()
  );
  const [resolvedRows, setResolvedRows] = useState<ResolvedImportRow[]>([]);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilterTab>('all');

  // Per-row search & candidate override drawer state
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [overrideSearchQuery, setOverrideSearchQuery] = useState('');
  const [overrideTypeFilter, setOverrideTypeFilter] = useState<
    'all' | 'movie' | 'tv'
  >('all');
  const [overrideSearchResults, setOverrideSearchResults] = useState<
    MediaItem[]
  >([]);
  const [isSearchingOverride, setIsSearchingOverride] = useState(false);

  // Execution & Results state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [executionResult, setExecutionResult] =
    useState<ImportExecutionResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const inputModeBubble = useLiquidTabBubble<InputTabMode>(
    isOpen && step === 'input' ? inputMode : null,
    [isOpen, step, inputMode]
  );

  // Counts for Review step
  const counts = useMemo(() => {
    let matched = 0;
    let ambiguous = 0;
    let unmatched = 0;
    let alreadyCompleted = 0;
    let upgradeCount = 0;
    let selectedCount = 0;

    for (const r of resolvedRows) {
      if (r.matchStatus === 'matched') matched++;
      else if (r.matchStatus === 'ambiguous') ambiguous++;
      else unmatched++;

      if (r.existingState === 'already_completed') alreadyCompleted++;
      else if (r.existingState === 'upgrade_to_completed') upgradeCount++;

      if (r.selected && r.selectedMedia) selectedCount++;
    }

    return {
      total: resolvedRows.length,
      matched,
      ambiguous,
      unmatched,
      alreadyCompleted,
      upgradeCount,
      selectedCount,
    };
  }, [resolvedRows]);

  const reviewFilterBubble = useLiquidTabBubble<ReviewFilterTab>(
    isOpen && step === 'review' ? reviewFilter : null,
    [
      isOpen,
      step,
      reviewFilter,
      counts.total,
      counts.matched,
      counts.ambiguous,
      counts.unmatched,
    ]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExtracting && !isImporting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExtracting, isImporting, onClose]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  if (!isOpen) return null;

  const resetWizard = () => {
    setStep('input');
    setSelectedFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    setInputError(null);
    setIsExtracting(false);
    setMatchProgress(null);
    setResolvedRows([]);
    setReviewFilter('all');
    setExpandedRowId(null);
    setExecutionResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applySelectedFile(file);
  };

  const applySelectedFile = (file: File) => {
    setInputError(null);
    const validation = validateImportFile(file);
    if (!validation.valid) {
      setSelectedFile(null);
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(null);
      }
      setInputError(validation.error);
      return;
    }

    setSelectedFile(file);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (validation.kind === 'image') {
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      applySelectedFile(file);
    }
  };

  const handleExtractAndMatch = async () => {
    if (isExtracting) return;
    setInputError(null);

    if (!isAuthenticated || !userId) {
      setInputError(
        'Please sign in to your CineMax account to import completed movies and series.'
      );
      return;
    }

    setIsExtracting(true);
    setMatchProgress(null);

    try {
      let extractedResult: {
        items: Awaited<ReturnType<typeof parseImportFile>>['items'];
        error: string | null;
      };

      if (inputMode === 'file') {
        if (!selectedFile) {
          setInputError(
            'Please choose a file (PNG, JPG, WEBP, TXT, CSV, or JSON) first.'
          );
          setIsExtracting(false);
          return;
        }
        extractedResult = await parseImportFile(selectedFile);
      } else {
        extractedResult = parseTextImportList(pastedText);
      }

      if (extractedResult.error || extractedResult.items.length === 0) {
        setInputError(
          extractedResult.error ||
            'No titles could be extracted. Please check your file or pasted text.'
        );
        setIsExtracting(false);
        return;
      }

      setMatchProgress({ done: 0, total: extractedResult.items.length });

      const rows = await resolveExtractedImportItems({
        extractedItems: extractedResult.items,
        allMedia,
        watchlist,
        watchHistory,
        defaultWatchedDate,
        onProgress: (done, total) => setMatchProgress({ done, total }),
      });

      setResolvedRows(rows);
      setReviewFilter('all');
      setExpandedRowId(null);
      setStep('review');
    } catch (err: any) {
      setInputError(
        err?.message || 'An unexpected error occurred while parsing your list.'
      );
    } finally {
      setIsExtracting(false);
      setMatchProgress(null);
    }
  };

  const handleDefaultDateChange = (nextDate: string) => {
    setDefaultWatchedDate(nextDate);
    setResolvedRows((prev) =>
      prev.map((row) => {
        if (
          row.hasExplicitDateOverride ||
          row.extracted.watchedAtHint ||
          row.existingHistoryEntry?.watchedAt
        ) {
          return row;
        }
        return {
          ...row,
          watchedDateOverride: nextDate,
        };
      })
    );
  };

  const handleToggleRowSelected = (rowId: string) => {
    setResolvedRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId || !row.selectedMedia) return row;
        return { ...row, selected: !row.selected };
      })
    );
  };

  const handleRowDateChange = (rowId: string, nextDate: string) => {
    setResolvedRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        return {
          ...row,
          watchedDateOverride: nextDate,
          hasExplicitDateOverride: true,
        };
      })
    );
  };

  const handleSelectCandidateForRow = (rowId: string, media: MediaItem) => {
    setResolvedRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        return recalculateRowAccountState(
          row,
          media,
          watchlist,
          watchHistory,
          defaultWatchedDate
        );
      })
    );
    setExpandedRowId(null);
  };

  const handleOpenRowSearch = (row: ResolvedImportRow) => {
    if (expandedRowId === row.rowId) {
      setExpandedRowId(null);
      return;
    }
    setExpandedRowId(row.rowId);
    setOverrideSearchQuery(row.extracted.title);
    setOverrideTypeFilter(row.extracted.mediaTypeHint || 'all');
    setOverrideSearchResults(row.candidates);
  };

  const handleRunOverrideSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!overrideSearchQuery.trim() || isSearchingOverride) return;
    setIsSearchingOverride(true);
    try {
      const results = await searchMediaForImportOverride({
        query: overrideSearchQuery,
        typeFilter: overrideTypeFilter,
        allMedia,
      });
      setOverrideSearchResults(results);
    } finally {
      setIsSearchingOverride(false);
    }
  };

  const handleConfirmImport = async (onlyFailedRowIds?: Set<string>) => {
    if (!isAuthenticated || !userId || isImporting) return;

    setIsImporting(true);
    setImportProgress({ done: 0, total: counts.selectedCount });

    try {
      const result = await executeCompletedImport({
        userId,
        rows: resolvedRows,
        watchlist,
        watchHistory,
        defaultWatchedDate,
        onlyRowIds: onlyFailedRowIds,
        onProgress: (done, total) => setImportProgress({ done, total }),
      });

      if (
        result.savedWatchlistEntries.length > 0 ||
        result.savedHistoryEntries.length > 0 ||
        result.savedEpisodeEntries.length > 0
      ) {
        onImportSuccess({
          savedWatchlistEntries: result.savedWatchlistEntries,
          savedHistoryEntries: result.savedHistoryEntries,
          savedEpisodeEntries: result.savedEpisodeEntries,
          newlyDiscoveredMedia: result.newlyDiscoveredMedia,
          migrationNeeded: result.migrationNeeded,
        });
      }

      if (onlyFailedRowIds && executionResult) {
        // Merge retry results into previous executionResult
        setExecutionResult({
          importedNewCount:
            executionResult.importedNewCount + result.importedNewCount,
          updatedExistingCount:
            executionResult.updatedExistingCount + result.updatedExistingCount,
          skippedCount: executionResult.skippedCount,
          unmatchedCount: executionResult.unmatchedCount,
          failedItems: result.failedItems,
          savedWatchlistEntries: [
            ...executionResult.savedWatchlistEntries,
            ...result.savedWatchlistEntries,
          ],
          savedHistoryEntries: [
            ...executionResult.savedHistoryEntries,
            ...result.savedHistoryEntries,
          ],
          savedEpisodeEntries: [
            ...executionResult.savedEpisodeEntries,
            ...result.savedEpisodeEntries,
          ],
          newlyDiscoveredMedia: [
            ...executionResult.newlyDiscoveredMedia,
            ...result.newlyDiscoveredMedia,
          ],
          migrationNeeded:
            executionResult.migrationNeeded || result.migrationNeeded,
        });
      } else {
        setExecutionResult(result);
      }

      setStep('results');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const filteredReviewRows = useMemo(() => {
    return resolvedRows.filter((r) => {
      if (reviewFilter === 'matched') return r.matchStatus === 'matched';
      if (reviewFilter === 'ambiguous') return r.matchStatus === 'ambiguous';
      if (reviewFilter === 'unmatched') return r.matchStatus === 'unmatched';
      return true;
    });
  }, [resolvedRows, reviewFilter]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-6 pt-[max(env(safe-area-inset-top,12px),12px)] pb-[max(env(safe-area-inset-bottom,12px),12px)] sm:py-6 bg-black/80 backdrop-blur-md overflow-hidden box-border"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-completed-modal-title"
    >
      <div className="relative box-border w-full max-w-[calc(100vw-24px)] sm:max-w-4xl my-auto rounded-[20px] sm:rounded-[24px] cm-glass-nav border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-24px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] sm:max-h-[90vh]">
        {/* Modal Top Header */}
        <div className="px-4 sm:px-7 py-3.5 sm:py-4 border-b border-white/10 flex items-start sm:items-center justify-between gap-2.5 sm:gap-4 shrink-0 box-border">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 sm:mt-0">
              <Upload className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="import-completed-modal-title"
                className="font-['Outfit'] text-base sm:text-xl font-bold text-white tracking-tight leading-snug break-words sm:truncate"
              >
                Import Completed Movies &amp; TV Series
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed break-words sm:truncate mt-0.5">
                {step === 'input' &&
                  'Step 1 of 3 · Upload a screenshot, TXT, CSV, JSON, or paste your watched list'}
                {step === 'review' &&
                  'Step 2 of 3 · Review TMDB matches, verify ambiguous titles, and customize dates'}
                {step === 'results' &&
                  'Step 3 of 3 · Cloud sync summary for your Watchlist & Viewing Journal'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isExtracting || isImporting}
            aria-label="Close import modal"
            className="cm-glass-control w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body (Single vertical scroll container on mobile, zero horizontal overflow) */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 sm:p-7 space-y-5 sm:space-y-6 box-border">
          {/* Authentication Gate if Signed Out */}
          {!isAuthenticated ? (
            <div className="p-4 sm:p-6 rounded-2xl cm-glass-surface border border-amber-500/30 text-center space-y-4 box-border">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 mx-auto">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="font-['Outfit'] text-base sm:text-lg font-bold text-white">
                  Sign In Required for Account Import
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Importing completed movies and TV series saves directly to your cloud-synced Watchlist and Viewing Journal. Please sign in to continue.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuthModal?.('signin');
                  }}
                  className="px-5 py-2.5 min-h-[42px] rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20"
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>Sign In to My Account</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="cm-glass-control px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : step === 'input' ? (
            /* ================================================================
             * STEP 1: FILE UPLOAD OR TEXT PASTE
             * ================================================================ */
            <div className="space-y-4 sm:space-y-5 min-w-0">
              {/* Input Mode Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 min-w-0">
                <div
                  ref={inputModeBubble.containerRef}
                  className="relative cm-glass-segmented grid grid-cols-2 sm:inline-flex items-center p-1 rounded-xl w-full sm:w-auto max-w-full box-border"
                >
                  <LiquidTabBubble
                    controller={inputModeBubble}
                    variant="amber"
                    className="top-1 bottom-1 rounded-lg"
                  />
                  <button
                    type="button"
                    ref={inputModeBubble.registerTab('file')}
                    onClick={() => {
                      setInputMode('file');
                      setInputError(null);
                    }}
                    className={`relative z-10 min-w-0 px-2 sm:px-4 py-2 min-h-[38px] rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors text-center leading-tight ${
                      inputMode === 'file'
                        ? inputModeBubble.ready
                          ? 'text-slate-950 font-bold'
                          : 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Upload File or Screenshot</span>
                  </button>
                  <button
                    type="button"
                    ref={inputModeBubble.registerTab('paste')}
                    onClick={() => {
                      setInputMode('paste');
                      setInputError(null);
                    }}
                    className={`relative z-10 min-w-0 px-2 sm:px-4 py-2 min-h-[38px] rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors text-center leading-tight ${
                      inputMode === 'paste'
                        ? inputModeBubble.ready
                          ? 'text-slate-950 font-bold'
                          : 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Paste Text List</span>
                  </button>
                </div>

                <div className="text-[11px] sm:text-xs text-slate-400 break-words">
                  Supports PNG, JPG, WEBP, TXT, CSV &amp; JSON
                </div>
              </div>

              {inputMode === 'file' ? (
                <div className="space-y-4 min-w-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.txt,.csv,.json,image/png,image/jpeg,image/webp,text/plain,text/csv,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={handleDropFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 sm:p-8 rounded-2xl cm-glass-surface border border-dashed border-white/20 hover:border-amber-400/50 transition-colors cursor-pointer text-center space-y-3 min-w-0 box-border"
                  >
                    {selectedFile ? (
                      <div className="space-y-3 min-w-0">
                        {imagePreviewUrl ? (
                          <div className="max-h-44 sm:max-h-48 max-w-full mx-auto rounded-xl overflow-hidden border border-white/15 inline-block bg-black/40">
                            <img
                              src={imagePreviewUrl}
                              alt="Selected screenshot preview"
                              className="max-h-44 sm:max-h-48 max-w-full w-auto object-contain mx-auto"
                            />
                          </div>
                        ) : (
                          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 mx-auto">
                            <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                          </div>
                        )}
                        <div className="space-y-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-white break-all sm:break-words">
                            {selectedFile.name}
                          </p>
                          <p className="text-[11px] sm:text-xs text-slate-400 font-mono tabular-nums break-words">
                            {(selectedFile.size / 1024).toFixed(1)} KB · Tap to choose a different file
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-400 mx-auto">
                          <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-white break-words">
                            Tap to choose a file or drag and drop here
                          </p>
                          <p className="text-[11px] sm:text-xs text-slate-400 max-w-lg mx-auto leading-relaxed break-words">
                            Upload a screenshot of a numbered list (PNG, JPG, WEBP up to 8 MB) or a structured TXT, CSV, or JSON file (up to 2 MB).
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Format Guidelines */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs min-w-0">
                    <div className="p-3 sm:p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-1 min-w-0">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>List Screenshots</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed break-words">
                        PNG, JPG, or WEBP screenshots of phone notes, checklists, or numbered movie/series lists.
                      </p>
                    </div>
                    <div className="p-3 sm:p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-1 min-w-0">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span>TXT &amp; CSV Lists</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed break-words">
                        One title per line or CSV columns (<code className="text-slate-300 break-words">title, type, year, watched_at, rating</code>).
                      </p>
                    </div>
                    <div className="p-3 sm:p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-1 min-w-0">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>JSON Exports</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed break-words">
                        Arrays of title strings or objects with <code className="text-slate-300 break-words">title</code>, <code className="text-slate-300 break-words">type</code>, <code className="text-slate-300 break-words">year</code>, and optional <code className="text-slate-300 break-words">watchedAt</code>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 min-w-0">
                    <label
                      htmlFor="import-paste-textarea"
                      className="text-xs font-semibold text-slate-300 break-words min-w-0"
                    >
                      Paste Completed Movies &amp; TV Series (one title per line)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPastedText(SAMPLE_PASTE_TEXT);
                        setInputError(null);
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 font-medium shrink-0"
                    >
                      Insert Sample List
                    </button>
                  </div>
                  <textarea
                    id="import-paste-textarea"
                    rows={7}
                    value={pastedText}
                    onChange={(e) => {
                      setPastedText(e.target.value);
                      if (inputError) setInputError(null);
                    }}
                    placeholder={`1. Oppenheimer (2023) - Movie\n2. Severance (2022) - TV Series\n3. Dune: Part Two (2024)\n4. Dark (2017) [TV]`}
                    className="w-full max-w-full min-w-0 box-border rounded-2xl bg-black/40 border border-white/15 focus:border-amber-400/60 focus:outline-none p-3.5 sm:p-4 text-xs sm:text-sm text-white placeholder-slate-500 font-mono leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-400 leading-relaxed break-words">
                    Tip: You can include optional years like <code className="text-slate-300">(2023)</code>, type hints like <code className="text-slate-300">[Movie]</code> or <code className="text-slate-300">[TV]</code>, explicit episodes like <code className="text-slate-300">S01E01-E06</code>, or dates like <code className="text-slate-300">2025-03-15</code>.
                  </p>
                </div>
              )}

              {/* Error Alert */}
              {inputError && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2.5 min-w-0">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-semibold text-rose-300">
                      Could Not Process Input
                    </p>
                    <p className="leading-relaxed break-words">{inputError}</p>
                  </div>
                </div>
              )}

              {/* Extracting & Matching Progress Indicator */}
              {isExtracting && (
                <div className="p-3.5 sm:p-4 rounded-xl cm-glass-surface flex items-center justify-between gap-3 text-xs text-amber-200 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                    <span className="break-words">
                      {matchProgress
                        ? `Resolving TMDB matches (${matchProgress.done} of ${matchProgress.total})...`
                        : inputMode === 'file' &&
                          selectedFile &&
                          validateImportFile(selectedFile).kind === 'image'
                        ? 'Extracting titles from screenshot & matching with TMDB...'
                        : 'Parsing titles & matching with TMDB...'}
                    </span>
                  </div>
                  {matchProgress && (
                    <span className="font-mono font-bold text-amber-400 tabular-nums shrink-0">
                      {Math.round(
                        (matchProgress.done / Math.max(1, matchProgress.total)) *
                          100
                      )}
                      %
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : step === 'review' ? (
            /* ================================================================
             * STEP 2: INTERACTIVE PREVIEW, DISAMBIGUATION & DATE OVERRIDE
             * ================================================================ */
            <div className="space-y-4 sm:space-y-5 min-w-0">
              {/* Summary Bar + Default Watched Date Picker */}
              <div className="p-3.5 sm:p-4 rounded-2xl cm-glass-surface flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1.5 text-xs min-w-0">
                  <span className="text-slate-300">
                    Extracted:{' '}
                    <strong className="text-white font-mono tabular-nums">
                      {counts.total}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="text-emerald-300">
                    Matched:{' '}
                    <strong className="font-mono tabular-nums">
                      {counts.matched}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="text-amber-300">
                    Needs Review:{' '}
                    <strong className="font-mono tabular-nums">
                      {counts.ambiguous}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="text-rose-300">
                    Unmatched:{' '}
                    <strong className="font-mono tabular-nums">
                      {counts.unmatched}
                    </strong>
                  </span>
                  {counts.alreadyCompleted > 0 && (
                    <>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className="text-sky-300">
                        Already Completed:{' '}
                        <strong className="font-mono tabular-nums">
                          {counts.alreadyCompleted}
                        </strong>
                      </span>
                    </>
                  )}
                </div>

                {/* Global Default Watched Date */}
                <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 w-full lg:w-auto min-w-0">
                  <label
                    htmlFor="default-watched-date"
                    className="text-xs text-slate-300 flex items-center gap-1.5 min-w-0"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Default Watched Date:</span>
                  </label>
                  <input
                    id="default-watched-date"
                    type="date"
                    value={defaultWatchedDate}
                    max={getTodayDateIso()}
                    onChange={(e) =>
                      handleDefaultDateChange(
                        e.target.value || getTodayDateIso()
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-xs text-white font-mono tabular-nums focus:border-amber-400/60 focus:outline-none max-w-full"
                  />
                </div>
              </div>

              {/* Filter Tabs & Quick Selection Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 min-w-0">
                <div
                  ref={reviewFilterBubble.containerRef}
                  className="relative cm-glass-segmented flex items-center p-1 rounded-xl overflow-x-auto max-w-full min-w-0"
                >
                  <LiquidTabBubble
                    controller={reviewFilterBubble}
                    variant="glass"
                    className="top-1 bottom-1 rounded-lg"
                  />
                  {(
                    [
                      { id: 'all', label: `All (${counts.total})` },
                      { id: 'matched', label: `Matched (${counts.matched})` },
                      {
                        id: 'ambiguous',
                        label: `Needs Review (${counts.ambiguous})`,
                      },
                      {
                        id: 'unmatched',
                        label: `Unmatched (${counts.unmatched})`,
                      },
                    ] as Array<{ id: ReviewFilterTab; label: string }>
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      ref={reviewFilterBubble.registerTab(t.id)}
                      onClick={() => setReviewFilter(t.id)}
                      className={`relative z-10 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                        reviewFilter === t.id
                          ? 'text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setResolvedRows((prev) =>
                        prev.map((r) => ({
                          ...r,
                          selected: r.matchStatus === 'matched' && Boolean(r.selectedMedia),
                        }))
                      )
                    }
                    className="cm-glass-control px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white whitespace-nowrap"
                  >
                    Select Matched Only
                  </button>
                  {counts.ambiguous > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setResolvedRows((prev) =>
                          prev.map((r) => ({
                            ...r,
                            selected: Boolean(r.selectedMedia),
                          }))
                        )
                      }
                      className="cm-glass-control px-2.5 py-1.5 rounded-lg text-amber-300 hover:text-amber-200 whitespace-nowrap"
                    >
                      Include Ambiguous
                    </button>
                  )}
                </div>
              </div>

              {/* Info note about idempotent preservation */}
              <p className="text-[11px] text-slate-400 leading-relaxed break-words">
                Existing personal ratings, review notes, favourites, and prior watch dates are automatically preserved. Titles currently marked as <em>Watching</em> or <em>Want to Watch</em> will be upgraded to <strong>Completed</strong>.
              </p>

              {/* Review Rows List (Uses single modal scroll on mobile; bounded scroll on desktop) */}
              <div className="space-y-2.5 sm:max-h-[420px] sm:overflow-y-auto sm:pr-1 min-w-0">
                {filteredReviewRows.map((row) => {
                  const media = row.selectedMedia;
                  const isExpanded = expandedRowId === row.rowId;

                  return (
                    <div
                      key={row.rowId}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-colors min-w-0 box-border ${
                        row.selected && media
                          ? 'bg-slate-900/80 border-white/15'
                          : 'bg-black/30 border-white/5 opacity-80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                        {/* Left: Checkbox + Poster + Match Info */}
                        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={row.selected && Boolean(media)}
                            disabled={!media}
                            onChange={() => handleToggleRowSelected(row.rowId)}
                            aria-label={`Include ${
                              media?.title || row.extracted.title
                            } in import`}
                            className="mt-2 w-4 h-4 rounded accent-amber-500 cursor-pointer disabled:opacity-30 shrink-0"
                          />

                          {media ? (
                            <div className="w-11 h-15 sm:w-12 sm:h-16 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-slate-900">
                              <MediaPoster media={media} aspect="poster" />
                            </div>
                          ) : (
                            <div className="w-11 h-15 sm:w-12 sm:h-16 rounded-lg border border-dashed border-rose-500/40 bg-rose-500/5 flex items-center justify-center text-rose-400 shrink-0">
                              <AlertCircle className="w-5 h-5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-1">
                            {media ? (
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                                <span className="font-semibold text-xs sm:text-sm text-white break-words">
                                  {media.title}
                                </span>
                                <span className="text-xs text-slate-400 font-mono tabular-nums">
                                  ({media.year || '—'})
                                </span>
                                <span className="text-xs text-amber-300 flex items-center gap-1">
                                  {media.type === 'tv' ? (
                                    <>
                                      <Tv className="w-3 h-3 shrink-0" />
                                      <span>Series</span>
                                    </>
                                  ) : (
                                    <>
                                      <Film className="w-3 h-3 shrink-0" />
                                      <span>Movie</span>
                                    </>
                                  )}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                <span className="font-semibold text-xs sm:text-sm text-rose-300 break-words">
                                  {row.extracted.title}
                                </span>
                                <span className="text-xs text-rose-400">
                                  · Unmatched
                                </span>
                              </div>
                            )}

                            {/* Original Extracted Source Line */}
                            <div className="text-[11px] text-slate-400 break-words">
                              Source: <span className="text-slate-300">{row.extracted.rawLine}</span>
                              {row.extracted.seasonNumber ? (
                                <span className="text-amber-300 font-mono">
                                  {' '}
                                  · S{row.extracted.seasonNumber}
                                  {row.extracted.episodeNumbers &&
                                  row.extracted.episodeNumbers.length > 0
                                    ? ` (${row.extracted.episodeNumbers.length} ep)`
                                    : ''}
                                </span>
                              ) : null}
                            </div>

                            {/* Match Status & Existing Account Status Line */}
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] min-w-0">
                              {row.matchStatus === 'matched' && (
                                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                                  <span>Matched</span>
                                </span>
                              )}
                              {row.matchStatus === 'ambiguous' && (
                                <span className="text-amber-300 flex items-start sm:items-center gap-1 font-medium break-words">
                                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 sm:mt-0" />
                                  <span className="break-words">
                                    {row.matchReason || 'Ambiguous — Verify Match'}
                                  </span>
                                </span>
                              )}
                              {row.matchStatus === 'unmatched' && (
                                <span className="text-rose-400 flex items-start sm:items-center gap-1 font-medium break-words">
                                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5 sm:mt-0" />
                                  <span className="break-words">
                                    {row.matchReason ||
                                      'No automatic match found — search manually or skip'}
                                  </span>
                                </span>
                              )}

                              {row.existingState === 'already_completed' && (
                                <span className="text-sky-300 break-words">
                                  · Already Completed in Account (preserves rating &amp; date)
                                </span>
                              )}
                              {row.existingState === 'upgrade_to_completed' && (
                                <span className="text-amber-300 break-words">
                                  · In Watchlist (upgrades to Completed, keeps rating/notes)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Per-Row Date Override & Change Match Button */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t border-white/5 sm:border-0">
                          {media && (
                            <input
                              type="date"
                              value={row.watchedDateOverride}
                              max={getTodayDateIso()}
                              onChange={(e) =>
                                handleRowDateChange(row.rowId, e.target.value)
                              }
                              title="Watched date for Viewing Journal"
                              className="px-2 py-1 rounded-lg bg-black/50 border border-white/10 text-[11px] text-slate-200 font-mono tabular-nums focus:border-amber-400/50 focus:outline-none min-w-0 max-w-full"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenRowSearch(row)}
                            className="cm-glass-control px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1 whitespace-nowrap"
                          >
                            <Search className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>
                              {media ? 'Change Match' : 'Search Title'}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3 h-3 shrink-0" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Candidate & Manual TMDB Search Panel */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-white/10 space-y-3 min-w-0">
                          <form
                            onSubmit={handleRunOverrideSearch}
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0"
                          >
                            <div className="relative flex-1 min-w-0">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={overrideSearchQuery}
                                onChange={(e) =>
                                  setOverrideSearchQuery(e.target.value)
                                }
                                placeholder="Search TMDB title..."
                                className="w-full min-w-0 box-border pl-8 pr-3 py-1.5 rounded-lg bg-black/50 border border-white/15 text-xs text-white focus:border-amber-400/60 focus:outline-none"
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {(
                                [
                                  { id: 'all', label: 'All' },
                                  { id: 'movie', label: 'Movies' },
                                  { id: 'tv', label: 'Series' },
                                ] as const
                              ).map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setOverrideTypeFilter(opt.id)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    overrideTypeFilter === opt.id
                                      ? 'bg-amber-500 text-slate-950 font-bold'
                                      : 'bg-white/5 text-slate-300 hover:text-white'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}

                              <button
                                type="submit"
                                disabled={isSearchingOverride}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 flex items-center gap-1 whitespace-nowrap ml-auto sm:ml-0"
                              >
                                {isSearchingOverride ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Search className="w-3 h-3" />
                                )}
                                <span>Search</span>
                              </button>
                            </div>
                          </form>

                          {overrideSearchResults.length === 0 ? (
                            <p className="text-xs text-slate-400 py-2">
                              No matching titles found. Try adjusting the title or switching Movie / Series filter.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 min-w-0">
                              {overrideSearchResults.map((cand) => {
                                const isCurrent =
                                  media && media.id === cand.id;
                                return (
                                  <button
                                    key={cand.id}
                                    type="button"
                                    onClick={() =>
                                      handleSelectCandidateForRow(
                                        row.rowId,
                                        cand
                                      )
                                    }
                                    className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-colors min-w-0 ${
                                      isCurrent
                                        ? 'bg-amber-500/15 border-amber-400/50'
                                        : 'bg-black/40 border-white/10 hover:border-white/25'
                                    }`}
                                  >
                                    <div className="w-8 h-11 rounded overflow-hidden shrink-0 border border-white/10">
                                      <MediaPoster
                                        media={cand}
                                        aspect="poster"
                                      />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-semibold text-white truncate">
                                        {cand.title}
                                      </div>
                                      <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                                        {cand.year || '—'} ·{' '}
                                        {cand.type === 'tv'
                                          ? 'TV Series'
                                          : 'Movie'}{' '}
                                        · ★ {cand.rating?.toFixed(1) || '—'}
                                      </div>
                                    </div>
                                    {isCurrent && (
                                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Saving Progress Banner */}
              {isImporting && importProgress && (
                <div className="p-3.5 sm:p-4 rounded-xl cm-glass-surface flex items-center justify-between gap-3 text-xs text-amber-200 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                    <span className="break-words">
                      Saving completed titles to your Watchlist &amp; Viewing Journal ({importProgress.done} of {importProgress.total})...
                    </span>
                  </div>
                  <span className="font-mono font-bold text-amber-400 tabular-nums shrink-0">
                    {Math.round(
                      (importProgress.done /
                        Math.max(1, importProgress.total)) *
                        100
                    )}
                    %
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* ================================================================
             * STEP 3: IMPORT RESULTS & RETRY SUMMARY
             * ================================================================ */
            executionResult && (
              <div className="space-y-5 sm:space-y-6 min-w-0">
                <div className="p-4 sm:p-5 rounded-2xl cm-glass-surface border border-emerald-500/25 flex items-start gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-['Outfit'] text-base sm:text-lg font-bold text-white break-words">
                      {executionResult.failedItems.length === 0
                        ? 'Completed List Import Finished'
                        : 'Import Completed with Partial Warnings'}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
                      Your Watchlist and Viewing Journal have been updated in real time. Existing personal ratings, review notes, and favourites were preserved.
                    </p>
                  </div>
                </div>

                {/* Results Metric Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 min-w-0">
                  <div className="p-3.5 sm:p-4 rounded-xl bg-black/40 border border-white/10 space-y-1 min-w-0">
                    <div className="text-[11px] sm:text-xs text-slate-400">Newly Imported</div>
                    <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono tabular-nums">
                      {executionResult.importedNewCount}
                    </div>
                  </div>
                  <div className="p-3.5 sm:p-4 rounded-xl bg-black/40 border border-white/10 space-y-1 min-w-0">
                    <div className="text-[11px] sm:text-xs text-slate-400">
                      Already Present / Updated
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-sky-400 font-mono tabular-nums">
                      {executionResult.updatedExistingCount}
                    </div>
                  </div>
                  <div className="p-3.5 sm:p-4 rounded-xl bg-black/40 border border-white/10 space-y-1 min-w-0">
                    <div className="text-[11px] sm:text-xs text-slate-400">Skipped</div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-300 font-mono tabular-nums">
                      {executionResult.skippedCount}
                    </div>
                  </div>
                  <div className="p-3.5 sm:p-4 rounded-xl bg-black/40 border border-white/10 space-y-1 min-w-0">
                    <div className="text-[11px] sm:text-xs text-slate-400">Unmatched</div>
                    <div className="text-xl sm:text-2xl font-bold text-amber-400 font-mono tabular-nums">
                      {executionResult.unmatchedCount}
                    </div>
                  </div>
                  <div className="p-3.5 sm:p-4 rounded-xl bg-black/40 border border-white/10 space-y-1 col-span-2 sm:col-span-1 min-w-0">
                    <div className="text-[11px] sm:text-xs text-slate-400">Failed Writes</div>
                    <div
                      className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
                        executionResult.failedItems.length > 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {executionResult.failedItems.length}
                    </div>
                  </div>
                </div>

                {/* Failed Items List + Retry Action */}
                {executionResult.failedItems.length > 0 && (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold text-rose-300 min-w-0">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span className="break-words">
                          {executionResult.failedItems.length}{' '}
                          {executionResult.failedItems.length === 1
                            ? 'item failed'
                            : 'items failed'}{' '}
                          to save to Supabase
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={isImporting}
                        onClick={() =>
                          handleConfirmImport(
                            new Set(
                              executionResult.failedItems.map((f) => f.rowId)
                            )
                          )
                        }
                        className="px-3.5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 w-full sm:w-auto whitespace-nowrap"
                      >
                        {isImporting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        <span>Retry Failed Items</span>
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs text-rose-200/90 min-w-0">
                      {executionResult.failedItems.map((fail) => (
                        <div
                          key={fail.rowId}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 py-1.5 border-b border-rose-500/15 last:border-0 min-w-0"
                        >
                          <span className="font-medium text-white break-words">
                            {fail.title}
                          </span>
                          <span className="text-rose-300 break-words">
                            {fail.error}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Modal Footer */}
        {isAuthenticated && (
          <div className="px-4 sm:px-7 py-3.5 sm:py-4 pb-[max(env(safe-area-inset-bottom,0px),0.875rem)] sm:pb-4 border-t border-white/10 bg-black/50 shrink-0 box-border">
            {step === 'input' && (
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isExtracting}
                  className="cm-glass-control px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExtractAndMatch}
                  disabled={
                    isExtracting ||
                    (inputMode === 'file' ? !selectedFile : !pastedText.trim())
                  }
                  className="px-5 py-2.5 min-h-[42px] rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 disabled:opacity-40"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Matching Titles...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 shrink-0" />
                      <span>Extract &amp; Preview Matches</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {step === 'review' && (
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  disabled={isImporting}
                  className="cm-glass-control px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>Back to Input</span>
                </button>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <span className="text-xs text-slate-400 font-mono tabular-nums text-center sm:text-right">
                    {counts.selectedCount} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => handleConfirmImport()}
                    disabled={isImporting || counts.selectedCount === 0}
                    className="px-5 py-2.5 min-h-[42px] rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 disabled:opacity-40"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 shrink-0" />
                        <span>
                          Import {counts.selectedCount}{' '}
                          {counts.selectedCount === 1 ? 'Title' : 'Titles'} as Completed
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 'results' && (
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={resetWizard}
                  className="cm-glass-control px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-slate-200 hover:text-white flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Import Another List</span>
                </button>

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5">
                  {onNavigateTab && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateTab('watchlist');
                        }}
                        className="cm-glass-control px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center justify-center text-center"
                      >
                        View Watchlist
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateTab('profile');
                        }}
                        className="cm-glass-control px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center justify-center text-center"
                      >
                        View Journal
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="col-span-2 sm:col-span-1 px-5 py-2.5 min-h-[42px] rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

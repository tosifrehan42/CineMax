import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EpisodeInfo, MediaItem, SeasonSummary } from '../types';
import {
  fetchCatalogue,
  fetchTitleDetails,
  fetchTvSeasonEpisodes,
} from '../services/mediaApi';
import { MediaPoster } from './MediaPoster';
import {
  AUDIO_FORMAT_OPTIONS,
  AudioFormatOption,
  buildComparisonPresets,
  calculateFileSizeEstimate,
  EstimatorContentType,
  formatDecimalStorage,
  getAudioBitrateRangeMbps,
  getPresetVideoBitrateRange,
  parseStrictRuntimeMinutes,
  RESOLUTION_OPTIONS,
  ResolutionOption,
  SOURCE_RELEASE_OPTIONS,
  SourceReleaseType,
  VIDEO_CODEC_OPTIONS,
  VideoCodecOption,
} from '../utils/fileSizeCalculator';
import {
  HardDrive,
  Film,
  Tv,
  Layers,
  Search,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  Info,
  Sliders,
  Sparkles,
  Clock,
  Volume2,
  Cpu,
  Disc,
  Monitor,
  X,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';

interface QualityFileSizeEstimatorProps {
  allMedia: MediaItem[];
  initialMedia?: MediaItem | null;
  initialSeasonNumber?: number;
  onClearInitialMedia?: () => void;
  onSelectMediaDetail?: (media: MediaItem) => void;
  onRegisterMedia?: (items: MediaItem[]) => void;
}

export const QualityFileSizeEstimator: React.FC<QualityFileSizeEstimatorProps> = ({
  allMedia,
  initialMedia,
  initialSeasonNumber,
  onClearInitialMedia,
  onSelectMediaDetail,
  onRegisterMedia,
}) => {
  // 1. Content & Selected Title State
  const [contentType, setContentType] = useState<EstimatorContentType>('movie');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [runtimeSourceNote, setRuntimeSourceNote] = useState<string | null>(
    'Default 2h 00m benchmark runtime — select a title above or edit hours & minutes below.'
  );
  const [missingRuntimeWarning, setMissingRuntimeWarning] = useState<string | null>(null);

  // 2. Runtime Inputs (Movie / Single Episode)
  const [runtimeHours, setRuntimeHours] = useState<string>('2');
  const [runtimeMinutes, setRuntimeMinutes] = useState<string>('0');

  // 3. Full Season & TV Metadata Inputs
  const [seasonsList, setSeasonsList] = useState<SeasonSummary[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<EpisodeInfo[]>([]);
  const [selectedEpisodeNumber, setSelectedEpisodeNumber] = useState<number>(1);
  const [isLoadingTvMeta, setIsLoadingTvMeta] = useState<boolean>(false);

  const [seasonEpisodeCount, setSeasonEpisodeCount] = useState<string>('10');
  const [seasonAvgEpHours, setSeasonAvgEpHours] = useState<string>('0');
  const [seasonAvgEpMinutes, setSeasonAvgEpMinutes] = useState<string>('50');

  // 4. Quality, Source, Codec, Audio & Overhead State
  const [resolution, setResolution] = useState<ResolutionOption>('1080p');
  const [sourceType, setSourceType] = useState<SourceReleaseType>('streaming');
  const [videoCodec, setVideoCodec] = useState<VideoCodecOption>('h264');
  const [audioFormat, setAudioFormat] = useState<AudioFormatOption>('eac3_51');

  // Editable Bitrates & Overhead
  const [videoBitrateInput, setVideoBitrateInput] = useState<string>('7.2');
  const [isVideoBitrateManuallyEdited, setIsVideoBitrateManuallyEdited] =
    useState<boolean>(false);
  const [customAudioKbpsInput, setCustomAudioKbpsInput] = useState<string>('640');
  const [overheadPercentInput, setOverheadPercentInput] = useState<string>('1.5');

  // 5. Title Search Picker State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // 6. Clipboard Feedback State
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute current preset bitrate range whenever resolution, sourceType, or videoCodec changes
  const currentPresetVideoRange = useMemo(
    () => getPresetVideoBitrateRange(resolution, sourceType, videoCodec),
    [resolution, sourceType, videoCodec]
  );

  // Sync videoBitrateInput with preset typical whenever preset selectors change (unless custom mode)
  useEffect(() => {
    if (sourceType !== 'custom' && videoCodec !== 'custom') {
      setVideoBitrateInput(String(currentPresetVideoRange.typical));
      setIsVideoBitrateManuallyEdited(false);
    }
  }, [currentPresetVideoRange, sourceType, videoCodec]);

  // Sync audio bitrate input when audioFormat changes
  useEffect(() => {
    if (audioFormat === 'none') {
      setCustomAudioKbpsInput('0');
    } else if (audioFormat !== 'custom') {
      const meta = AUDIO_FORMAT_OPTIONS.find((a) => a.id === audioFormat);
      if (meta) {
        setCustomAudioKbpsInput(String(meta.defaultKbps));
      }
    }
  }, [audioFormat]);

  // Search catalogue when searchQuery changes
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(allMedia.slice(0, 8));
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);

    const timer = setTimeout(() => {
      fetchCatalogue({ query: trimmed, page: 1 }, controller.signal)
        .then((res) => {
          if (!controller.signal.aborted) {
            setSearchResults(res.items.slice(0, 10));
            if (res.items.length > 0) {
              onRegisterMedia?.(res.items);
            }
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            const qLower = trimmed.toLowerCase();
            setSearchResults(
              allMedia
                .filter((m) => m.title.toLowerCase().includes(qLower))
                .slice(0, 8)
            );
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        });
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, allMedia, onRegisterMedia]);

  // Handle prefill when launched from DetailModal (initialMedia)
  useEffect(() => {
    if (initialMedia) {
      handleSelectTitle(initialMedia, initialSeasonNumber);
      onClearInitialMedia?.();
    }
  }, [initialMedia, initialSeasonNumber]);

  // Apply a selected Movie or TV Show and prefill its authentic metadata
  const handleSelectTitle = async (
    media: MediaItem,
    preferredSeasonNumber?: number
  ) => {
    setSelectedMedia(media);
    setIsSearchDropdownOpen(false);
    setSearchQuery('');
    setMissingRuntimeWarning(null);

    if (media.type === 'movie') {
      setContentType('movie');
      setSeasonsList([]);
      setSeasonEpisodes([]);

      // Check immediate runtime or fetch enriched details
      let parsedMins = parseStrictRuntimeMinutes(media.runtime);
      let activeItem = media;

      if (parsedMins === null) {
        setIsLoadingTvMeta(true);
        try {
          const detailRes = await fetchTitleDetails(media);
          if (detailRes.item) {
            activeItem = detailRes.item;
            setSelectedMedia(detailRes.item);
            onRegisterMedia?.([detailRes.item]);
            parsedMins = parseStrictRuntimeMinutes(detailRes.item.runtime);
          }
        } catch {
          // Ignore network error and check parsedMins below
        } finally {
          setIsLoadingTvMeta(false);
        }
      }

      if (parsedMins !== null && parsedMins > 0) {
        const hrs = Math.floor(parsedMins / 60);
        const mins = parsedMins % 60;
        setRuntimeHours(String(hrs));
        setRuntimeMinutes(String(mins));
        setRuntimeSourceNote(
          `Prefilled from "${activeItem.title}" (${activeItem.year}) metadata: ${hrs}h ${mins}m (${parsedMins} min).`
        );
        setMissingRuntimeWarning(null);
      } else {
        // Never silently assume a runtime when metadata is unavailable
        setRuntimeHours('0');
        setRuntimeMinutes('0');
        setRuntimeSourceNote(null);
        setMissingRuntimeWarning(
          `Exact runtime metadata is unavailable for "${activeItem.title}". Please enter the hours and minutes manually below.`
        );
      }
    } else {
      // TV Show selected: default to Full TV Season unless user was already on tv_episode
      const nextContentType: EstimatorContentType =
        contentType === 'tv_episode' ? 'tv_episode' : 'tv_season';
      setContentType(nextContentType);
      setIsLoadingTvMeta(true);

      try {
        const detailRes = await fetchTitleDetails(media);
        const enriched = detailRes.item || media;
        setSelectedMedia(enriched);
        onRegisterMedia?.([enriched]);

        const availableSeasons: SeasonSummary[] =
          enriched.seasonsList && enriched.seasonsList.length > 0
            ? enriched.seasonsList
            : Array.from({ length: Math.max(1, enriched.seasons || 1) }, (_, idx) => ({
                seasonNumber: idx + 1,
                name: `Season ${idx + 1}`,
                episodeCount: 8,
              }));

        setSeasonsList(availableSeasons);
        const targetSeason =
          preferredSeasonNumber &&
          availableSeasons.some((s) => s.seasonNumber === preferredSeasonNumber)
            ? preferredSeasonNumber
            : availableSeasons[0]?.seasonNumber || 1;

        setSelectedSeason(targetSeason);
        await loadSeasonRuntimeData(
          enriched,
          targetSeason,
          availableSeasons,
          nextContentType
        );
      } catch {
        setMissingRuntimeWarning(
          `Could not load season runtime metadata for "${media.title}". Please enter the runtime manually.`
        );
      } finally {
        setIsLoadingTvMeta(false);
      }
    }
  };

  const loadSeasonRuntimeData = async (
    tvMedia: MediaItem,
    seasonNum: number,
    allSeasons: SeasonSummary[],
    activeScope: EstimatorContentType
  ) => {
    setIsLoadingTvMeta(true);
    setMissingRuntimeWarning(null);
    try {
      const epRes = await fetchTvSeasonEpisodes(tvMedia.id, seasonNum);
      const episodes = epRes.episodes || [];
      setSeasonEpisodes(episodes);
      setSelectedEpisodeNumber(episodes[0]?.episodeNumber || 1);

      const seasonSummary = allSeasons.find((s) => s.seasonNumber === seasonNum);
      const epCount = episodes.length || seasonSummary?.episodeCount || 0;

      // Calculate average runtime from episodes that have confirmed runtime > 0
      const validRuntimes = episodes
        .map((e) => e.runtime)
        .filter((r): r is number => typeof r === 'number' && r > 0);

      const fallbackSeriesRuntime = parseStrictRuntimeMinutes(tvMedia.runtime);

      if (epCount > 0) {
        setSeasonEpisodeCount(String(epCount));
      }

      if (validRuntimes.length > 0) {
        const avgMins = Math.round(
          validRuntimes.reduce((acc, r) => acc + r, 0) / validRuntimes.length
        );
        const firstEpMins = validRuntimes[0];

        setSeasonAvgEpHours(String(Math.floor(avgMins / 60)));
        setSeasonAvgEpMinutes(String(avgMins % 60));

        setRuntimeHours(String(Math.floor(firstEpMins / 60)));
        setRuntimeMinutes(String(firstEpMins % 60));

        setRuntimeSourceNote(
          `Prefilled from "${tvMedia.title}" — Season ${seasonNum} (${epCount} episodes, ~${avgMins} min/ep average).`
        );
        setMissingRuntimeWarning(null);
      } else if (fallbackSeriesRuntime !== null && fallbackSeriesRuntime > 0) {
        setSeasonAvgEpHours(String(Math.floor(fallbackSeriesRuntime / 60)));
        setSeasonAvgEpMinutes(String(fallbackSeriesRuntime % 60));
        setRuntimeHours(String(Math.floor(fallbackSeriesRuntime / 60)));
        setRuntimeMinutes(String(fallbackSeriesRuntime % 60));
        setRuntimeSourceNote(
          `Prefilled from "${tvMedia.title}" series runtime metadata (${fallbackSeriesRuntime} min/ep).`
        );
      } else {
        // Never silently assume runtime when metadata is unavailable
        if (activeScope === 'tv_season') {
          setSeasonAvgEpHours('0');
          setSeasonAvgEpMinutes('0');
        } else {
          setRuntimeHours('0');
          setRuntimeMinutes('0');
        }
        setRuntimeSourceNote(null);
        setMissingRuntimeWarning(
          `Episode runtime metadata is unavailable for "${tvMedia.title}" Season ${seasonNum}. Please enter episode duration manually.`
        );
      }
    } catch {
      setRuntimeSourceNote(null);
      setMissingRuntimeWarning(
        `Could not retrieve episode runtimes for "${tvMedia.title}" Season ${seasonNum}. Please enter runtime manually.`
      );
    } finally {
      setIsLoadingTvMeta(false);
    }
  };

  // Handle changing Season dropdown for a selected TV series
  const handleSeasonChange = async (newSeasonNum: number) => {
    setSelectedSeason(newSeasonNum);
    if (selectedMedia && selectedMedia.type === 'tv') {
      await loadSeasonRuntimeData(
        selectedMedia,
        newSeasonNum,
        seasonsList,
        contentType
      );
    }
  };

  // Handle changing Episode dropdown in Single TV Episode mode
  const handleEpisodeChange = (epNumber: number) => {
    setSelectedEpisodeNumber(epNumber);
    const ep = seasonEpisodes.find((e) => e.episodeNumber === epNumber);
    if (ep && typeof ep.runtime === 'number' && ep.runtime > 0) {
      const hrs = Math.floor(ep.runtime / 60);
      const mins = ep.runtime % 60;
      setRuntimeHours(String(hrs));
      setRuntimeMinutes(String(mins));
      setMissingRuntimeWarning(null);
      setRuntimeSourceNote(
        `Prefilled from "${selectedMedia?.title}" S${String(selectedSeason).padStart(
          2,
          '0'
        )}E${String(ep.episodeNumber).padStart(2, '0')} "${ep.name}" (${ep.runtime} min).`
      );
    } else {
      setRuntimeHours('0');
      setRuntimeMinutes('0');
      setRuntimeSourceNote(null);
      setMissingRuntimeWarning(
        `Runtime metadata is unavailable for Episode ${epNumber}. Please enter its runtime manually.`
      );
    }
  };

  // Parse numeric inputs for the calculation engine
  const singleRuntimeTotalMinutes = useMemo(() => {
    const hrs = Math.max(0, parseFloat(runtimeHours) || 0);
    const mins = Math.max(0, parseFloat(runtimeMinutes) || 0);
    return hrs * 60 + mins;
  }, [runtimeHours, runtimeMinutes]);

  const seasonAvgTotalMinutes = useMemo(() => {
    const hrs = Math.max(0, parseFloat(seasonAvgEpHours) || 0);
    const mins = Math.max(0, parseFloat(seasonAvgEpMinutes) || 0);
    return hrs * 60 + mins;
  }, [seasonAvgEpHours, seasonAvgEpMinutes]);

  const parsedEpisodeCount = useMemo(() => {
    const count = parseInt(seasonEpisodeCount, 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }, [seasonEpisodeCount]);

  const parsedVideoBitrateMbps = useMemo(() => {
    const val = parseFloat(videoBitrateInput);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }, [videoBitrateInput]);

  const parsedCustomAudioKbps = useMemo(() => {
    const val = parseFloat(customAudioKbpsInput);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }, [customAudioKbpsInput]);

  const parsedOverheadPercent = useMemo(() => {
    const val = parseFloat(overheadPercentInput);
    return Number.isFinite(val) && val >= 0 ? Math.min(25, val) : 0;
  }, [overheadPercentInput]);

  const audioBitrateRangeMbps = useMemo(
    () => getAudioBitrateRangeMbps(audioFormat, parsedCustomAudioKbps),
    [audioFormat, parsedCustomAudioKbps]
  );

  const effectiveAudioMbps = useMemo(() => {
    if (audioFormat === 'none') return 0;
    return parsedCustomAudioKbps / 1000;
  }, [audioFormat, parsedCustomAudioKbps]);

  const isCustomVideoMode =
    sourceType === 'custom' ||
    videoCodec === 'custom' ||
    isVideoBitrateManuallyEdited;

  // Run the core calculation engine
  const estimate = useMemo(
    () =>
      calculateFileSizeEstimate({
        contentType,
        singleRuntimeMinutes: singleRuntimeTotalMinutes,
        episodeCount: parsedEpisodeCount,
        avgEpisodeRuntimeMinutes: seasonAvgTotalMinutes,
        videoBitrateMbps: parsedVideoBitrateMbps,
        videoBitrateRangeMbps: currentPresetVideoRange,
        audioBitrateMbps: effectiveAudioMbps,
        audioBitrateRangeMbps,
        overheadPercent: parsedOverheadPercent,
        isCustomBitrate: isCustomVideoMode,
      }),
    [
      contentType,
      singleRuntimeTotalMinutes,
      parsedEpisodeCount,
      seasonAvgTotalMinutes,
      parsedVideoBitrateMbps,
      currentPresetVideoRange,
      effectiveAudioMbps,
      audioBitrateRangeMbps,
      parsedOverheadPercent,
      isCustomVideoMode,
    ]
  );

  // Build the 5 required comparison rows for the same runtime
  const comparisonRows = useMemo(
    () =>
      buildComparisonPresets(
        estimate.totalRuntimeSeconds,
        estimate.perUnitRuntimeSeconds,
        contentType === 'tv_season',
        parsedOverheadPercent
      ),
    [
      estimate.totalRuntimeSeconds,
      estimate.perUnitRuntimeSeconds,
      contentType,
      parsedOverheadPercent,
    ]
  );

  // Reset all fields to clean defaults
  const handleReset = () => {
    setSelectedMedia(null);
    setContentType('movie');
    setRuntimeHours('2');
    setRuntimeMinutes('0');
    setSeasonEpisodeCount('10');
    setSeasonAvgEpHours('0');
    setSeasonAvgEpMinutes('50');
    setSeasonsList([]);
    setSeasonEpisodes([]);
    setResolution('1080p');
    setSourceType('streaming');
    setVideoCodec('h264');
    setAudioFormat('eac3_51');
    setOverheadPercentInput('1.5');
    setIsVideoBitrateManuallyEdited(false);
    setMissingRuntimeWarning(null);
    setRuntimeSourceNote(
      'Default 2h 00m benchmark runtime — select a title above or edit hours & minutes below.'
    );
    setCopyStatus('idle');
  };

  // Apply a row from the Preset Comparison table
  const handleApplyComparisonPreset = (
    res: ResolutionOption,
    src: SourceReleaseType,
    codec: VideoCodecOption
  ) => {
    setResolution(res);
    setSourceType(src);
    setVideoCodec(codec);
    if (src === 'bluray_remux' && res === '2160p') {
      setAudioFormat('truehd_atmos');
    } else if (res === '720p') {
      setAudioFormat('ac3_eac3');
    } else {
      setAudioFormat('eac3_51');
    }
    setIsVideoBitrateManuallyEdited(false);
  };

  // Copy formatted estimate summary to clipboard
  const handleCopyResults = async () => {
    if (!estimate.isValid) return;

    const resMeta = RESOLUTION_OPTIONS.find((r) => r.id === resolution);
    const srcMeta = SOURCE_RELEASE_OPTIONS.find((s) => s.id === sourceType);
    const codecMeta = VIDEO_CODEC_OPTIONS.find((c) => c.id === videoCodec);
    const audioMeta = AUDIO_FORMAT_OPTIONS.find((a) => a.id === audioFormat);

    const contentLabel =
      contentType === 'movie'
        ? 'Movie'
        : contentType === 'tv_episode'
        ? 'Single TV Episode'
        : `Full TV Season (${estimate.episodeCount} Episodes)`;

    const titleLine = selectedMedia
      ? `Title: ${selectedMedia.title} (${selectedMedia.year})${
          selectedMedia.type === 'tv' ? ` — Season ${selectedSeason}` : ''
        }`
      : 'Title: Custom Runtime Estimate';

    const runtimeHoursFormatted = Math.floor(estimate.totalRuntimeMinutes / 60);
    const runtimeMinsFormatted = Math.round(estimate.totalRuntimeMinutes % 60);

    const lines = [
      '=== CineMax Quality & File Size Estimate ===',
      titleLine,
      `Scope: ${contentLabel}`,
      `Total Runtime: ${runtimeHoursFormatted}h ${runtimeMinsFormatted}m (${estimate.totalRuntimeSeconds.toLocaleString()} seconds)`,
      `Quality Profile: ${resMeta?.label || resolution} · ${srcMeta?.label || sourceType} · ${codecMeta?.label || videoCodec}`,
      `Audio Track: ${audioMeta?.label || audioFormat} (${
        audioFormat === 'none'
          ? '0 kbps'
          : `${Math.round(estimate.audioBitrateMbps * 1000)} kbps / ${estimate.audioBitrateMbps.toFixed(3)} Mbps`
      })`,
      `Bitrate Breakdown: Video ${estimate.videoBitrateMbps.toFixed(2)} Mbps + Audio ${estimate.audioBitrateMbps.toFixed(2)} Mbps + Overhead ${parsedOverheadPercent}% = ${estimate.totalBitrateMbps.toFixed(2)} Mbps Total`,
      `Estimated File Size (Typical): ${estimate.typicalSizeGb.toFixed(2)} GB (${Math.round(
        estimate.typicalSizeMb
      ).toLocaleString()} MB) [1 GB = 1,000 MB]`,
      `Estimated Range (Low – High): ${estimate.lowSizeGb.toFixed(2)} GB – ${estimate.highSizeGb.toFixed(2)} GB`,
      ...(contentType === 'tv_season'
        ? [
            `Per-Episode Estimate: ${estimate.perEpisodeTypicalGb.toFixed(2)} GB (${Math.round(
              estimate.perEpisodeTypicalMb
            ).toLocaleString()} MB) per episode`,
          ]
        : []),
      'Note: Bitrate-based estimate (Mbps × seconds ÷ 8,000). Actual release sizes vary with VBR scene complexity, film grain, HDR metadata, and audio tracks.',
    ];

    const summaryText = lines.join('\n');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(summaryText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = summaryText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2800);
    } catch {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  };

  // Quick-pick sample movies & TV shows from the loaded catalogue
  const quickPickItems = useMemo(() => {
    const movies = allMedia.filter((m) => m.type === 'movie').slice(0, 4);
    const shows = allMedia.filter((m) => m.type === 'tv').slice(0, 3);
    return [...movies, ...shows];
  }, [allMedia]);

  const formattedTotalStorage = formatDecimalStorage(estimate.typicalSizeGb);
  const formattedLowStorage = formatDecimalStorage(estimate.lowSizeGb);
  const formattedHighStorage = formatDecimalStorage(estimate.highSizeGb);
  const formattedPerEpStorage = formatDecimalStorage(estimate.perEpisodeTypicalGb);

  return (
    <div className="pt-24 sm:pt-28 pb-16 max-w-[1440px] mx-auto px-4 sm:px-8 space-y-8">
      {/* Studio Header & Disclaimer Banner */}
      <div className="relative rounded-2xl bg-gradient-to-br from-[#12141f] via-[#0d0e15] to-[#090a0f] border border-white/10 p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400">
              <HardDrive className="w-3.5 h-3.5" />
              <span>CineMax Technical Utility · Storage & Bandwidth Calculator</span>
            </div>
            <h1 className="font-['Outfit'] text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Quality &amp; File Size Estimator
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Calculate realistic storage requirements and bitrate footprints across{' '}
              <span className="text-white font-medium">480p to 4K UHD Blu-ray Remuxes</span>,
              modern codecs (<span className="font-mono text-amber-300">AVC, HEVC, AV1</span>),
              and surround audio formats using real runtime metadata.
            </p>
          </div>

          {/* Disclaimer Pill Box */}
          <div className="lg:max-w-sm shrink-0 rounded-xl bg-amber-500/[0.07] border border-amber-500/25 p-4 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
              <Info className="w-4 h-4 shrink-0" />
              <span>Bitrate-Based Estimation Notice</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Results are calculated estimates (
              <span className="font-mono text-slate-200">
                Mbps × seconds ÷ 8,000
              </span>
              , decimal <span className="font-mono text-slate-200">1 GB = 1,000 MB</span>
              ), not guarantees of an exact release file size.
            </p>
          </div>
        </div>
      </div>

      {/* Title Search & Catalogue Prefill Bar */}
      <div className="rounded-2xl bg-[#0d0e14] border border-white/10 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-['Outfit'] text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Prefill Runtime from CineMax / TMDB Catalogue (Optional)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Search any movie or TV series to automatically populate runtime, season count, and episode durations—or enter durations manually below.
            </p>
          </div>
          {selectedMedia && (
            <button
              type="button"
              onClick={() => {
                setSelectedMedia(null);
                setMissingRuntimeWarning(null);
                setRuntimeSourceNote('Manual runtime entry active.');
              }}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Unlink Title</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Search Input with Dropdown */}
          <div
            ref={searchContainerRef}
            className="relative lg:col-span-7"
          >
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                placeholder="Search movie or TV series to prefill runtime (e.g. Dune, Oppenheimer, Severance, Arcane)..."
                aria-label="Search title to prefill runtime"
                className="w-full pl-10 pr-10 py-2.5 bg-black/50 border border-white/15 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
              {isSearching && (
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin absolute right-3.5" />
              )}
              {!isSearching && searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-slate-400 hover:text-white"
                  aria-label="Clear search query"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Results */}
            {isSearchDropdownOpen && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-[#12141e] border border-white/15 rounded-xl shadow-2xl max-h-80 overflow-y-auto divide-y divide-white/5">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTitle(item)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/5 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-12 rounded overflow-hidden shrink-0 border border-white/10">
                        <MediaPoster media={item} aspect="poster" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                          <span className="uppercase text-[10px] text-amber-400">
                            {item.type === 'movie' ? 'Movie' : 'TV Series'}
                          </span>
                          <span>·</span>
                          <span>{item.year}</span>
                          {item.runtime && (
                            <>
                              <span>·</span>
                              <span className="text-slate-300">{item.runtime}</span>
                            </>
                          )}
                          {item.type === 'tv' && item.seasons && (
                            <>
                              <span>·</span>
                              <span className="text-slate-300">
                                {item.seasons} {item.seasons === 1 ? 'Season' : 'Seasons'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-amber-400 shrink-0">
                      Prefill →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick-Select Chips */}
          <div className="lg:col-span-5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mr-1">
              Quick Prefill:
            </span>
            {quickPickItems.map((item) => {
              const isSelected = selectedMedia?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTitle(item)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                      : 'bg-white/[0.04] hover:bg-white/10 text-slate-300 border-white/10'
                  }`}
                >
                  {item.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Linked Title Card Banner */}
        {selectedMedia && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-16 rounded-lg overflow-hidden shrink-0 border border-white/15">
                <MediaPoster media={selectedMedia} aspect="poster" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {selectedMedia.type === 'movie' ? 'Linked Movie' : 'Linked TV Series'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {selectedMedia.year} · ★ {selectedMedia.rating.toFixed(1)}
                  </span>
                </div>
                <h3 className="font-['Outfit'] text-base sm:text-lg font-bold text-white mt-0.5">
                  {selectedMedia.title}
                </h3>
                {runtimeSourceNote && (
                  <p className="text-xs text-emerald-400 font-mono mt-0.5">
                    {runtimeSourceNote}
                  </p>
                )}
              </div>
            </div>

            {onSelectMediaDetail && (
              <button
                type="button"
                onClick={() => onSelectMediaDetail(selectedMedia)}
                className="self-start sm:self-center inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                <span>Open Title Details</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Warning when metadata runtime is unavailable */}
        {missingRuntimeWarning && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 p-3.5 flex items-start gap-3 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300 block">
                Runtime Metadata Unavailable — Manual Input Required
              </span>
              <span className="text-amber-200/90">{missingRuntimeWarning}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main 12-Column Workbench: Left Parameters (7 Cols) + Right Live Readout (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: CONFIGURATION INPUTS */}
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 1: CONTENT TYPE & RUNTIME */}
          <div className="rounded-2xl bg-[#0d0e14] border border-white/10 p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-['Outfit'] text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>1. Content Scope &amp; Runtime</span>
              </h2>
              {isLoadingTvMeta && (
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading metadata...</span>
                </span>
              )}
            </div>

            {/* Content Scope 3-Way Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    id: 'movie',
                    label: 'Movie',
                    sub: 'Single feature film',
                    icon: Film,
                  },
                  {
                    id: 'tv_episode',
                    label: 'TV Episode',
                    sub: 'Single series episode',
                    icon: Tv,
                  },
                  {
                    id: 'tv_season',
                    label: 'Full TV Season',
                    sub: 'Multi-episode season pack',
                    icon: Layers,
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = contentType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setContentType(item.id);
                      if (
                        item.id === 'tv_episode' &&
                        selectedMedia?.type !== 'tv' &&
                        runtimeHours === '2' &&
                        runtimeMinutes === '0'
                      ) {
                        setRuntimeHours('0');
                        setRuntimeMinutes('50');
                        setRuntimeSourceNote(
                          'Switched to single TV episode — adjust hours & minutes below.'
                        );
                      } else if (
                        item.id === 'movie' &&
                        selectedMedia?.type !== 'movie' &&
                        runtimeHours === '0' &&
                        runtimeMinutes === '50'
                      ) {
                        setRuntimeHours('2');
                        setRuntimeMinutes('0');
                        setRuntimeSourceNote(
                          'Switched to feature film — adjust hours & minutes below.'
                        );
                      }
                    }}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-amber-500/15 border-amber-400 text-white shadow-sm'
                        : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/25 hover:bg-white/[0.03]'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        active
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{item.label}</div>
                      <div className="text-[11px] text-slate-400">{item.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Optional TV Season / Episode Picker when a TV Series is Linked */}
            {selectedMedia?.type === 'tv' && seasonsList.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Select Series Season
                  </label>
                  <select
                    value={selectedSeason}
                    onChange={(e) => handleSeasonChange(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                  >
                    {seasonsList.map((s) => (
                      <option key={s.seasonNumber} value={s.seasonNumber}>
                        Season {s.seasonNumber} ({s.episodeCount} Episodes)
                      </option>
                    ))}
                  </select>
                </div>

                {contentType === 'tv_episode' && seasonEpisodes.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Select Episode
                    </label>
                    <select
                      value={selectedEpisodeNumber}
                      onChange={(e) => handleEpisodeChange(Number(e.target.value))}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                    >
                      {seasonEpisodes.map((ep) => (
                        <option key={ep.episodeNumber} value={ep.episodeNumber}>
                          E{String(ep.episodeNumber).padStart(2, '0')} — {ep.name}{' '}
                          {ep.runtime ? `(${ep.runtime}m)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Runtime Input Fields based on Content Type */}
            {contentType !== 'tv_season' ? (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end pt-1">
                <div className="sm:col-span-4">
                  <label
                    htmlFor="estimator-hours"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                  >
                    Hours
                  </label>
                  <div className="relative">
                    <input
                      id="estimator-hours"
                      type="number"
                      min="0"
                      max="24"
                      step="1"
                      value={runtimeHours}
                      onChange={(e) => {
                        setRuntimeHours(e.target.value);
                        setMissingRuntimeWarning(null);
                      }}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-amber-400 tabular-nums"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                      hr
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label
                    htmlFor="estimator-minutes"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                  >
                    Minutes
                  </label>
                  <div className="relative">
                    <input
                      id="estimator-minutes"
                      type="number"
                      min="0"
                      max="999"
                      step="1"
                      value={runtimeMinutes}
                      onChange={(e) => {
                        setRuntimeMinutes(e.target.value);
                        setMissingRuntimeWarning(null);
                      }}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-amber-400 tabular-nums"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                      min
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-4 rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 flex flex-col justify-center">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400">
                    Total Runtime
                  </span>
                  <span className="text-sm font-mono font-bold text-amber-300 tabular-nums">
                    {singleRuntimeTotalMinutes} min ({(singleRuntimeTotalMinutes * 60).toLocaleString()}s)
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end pt-1">
                <div className="sm:col-span-4">
                  <label
                    htmlFor="season-ep-count"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                  >
                    Episode Count
                  </label>
                  <div className="relative">
                    <input
                      id="season-ep-count"
                      type="number"
                      min="1"
                      max="200"
                      step="1"
                      value={seasonEpisodeCount}
                      onChange={(e) => setSeasonEpisodeCount(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-amber-400 tabular-nums"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                      eps
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label
                    htmlFor="season-avg-hours"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                  >
                    Avg Ep Hours
                  </label>
                  <div className="relative">
                    <input
                      id="season-avg-hours"
                      type="number"
                      min="0"
                      max="10"
                      step="1"
                      value={seasonAvgEpHours}
                      onChange={(e) => {
                        setSeasonAvgEpHours(e.target.value);
                        setMissingRuntimeWarning(null);
                      }}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-amber-400 tabular-nums"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                      hr
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label
                    htmlFor="season-avg-minutes"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                  >
                    Avg Ep Minutes
                  </label>
                  <div className="relative">
                    <input
                      id="season-avg-minutes"
                      type="number"
                      min="0"
                      max="300"
                      step="1"
                      value={seasonAvgEpMinutes}
                      onChange={(e) => {
                        setSeasonAvgEpMinutes(e.target.value);
                        setMissingRuntimeWarning(null);
                      }}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-amber-400 tabular-nums"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                      min
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: RESOLUTION & SOURCE / RELEASE TYPE */}
          <div className="rounded-2xl bg-[#0d0e14] border border-white/10 p-5 sm:p-6 space-y-6">
            {/* Resolution */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-['Outfit'] text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-amber-400" />
                  <span>2. Resolution</span>
                </h2>
                <span className="text-xs font-mono text-slate-400">
                  {RESOLUTION_OPTIONS.find((r) => r.id === resolution)?.dimensions}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {RESOLUTION_OPTIONS.map((res) => {
                  const active = resolution === res.id;
                  return (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => setResolution(res.id)}
                      className={`py-2.5 px-3 rounded-xl border text-center transition-all ${
                        active
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/10'
                          : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <div className="text-xs sm:text-sm font-mono">{res.shortLabel}</div>
                      <div
                        className={`text-[10px] font-mono mt-0.5 ${
                          active ? 'text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        {res.dimensions}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Source / Release Type */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <h2 className="font-['Outfit'] text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Disc className="w-4 h-4 text-amber-400" />
                <span>3. Source / Release Type</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SOURCE_RELEASE_OPTIONS.map((src) => {
                  const active = sourceType === src.id;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => setSourceType(src.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{src.label}</span>
                        {src.id === 'bluray_remux' && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            Lossless Video
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-snug">
                        {src.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STEP 3: VIDEO CODEC & AUDIO FORMAT */}
          <div className="rounded-2xl bg-[#0d0e14] border border-white/10 p-5 sm:p-6 space-y-6">
            {/* Video Codec */}
            <div className="space-y-3">
              <h2 className="font-['Outfit'] text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span>4. Video Codec</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {VIDEO_CODEC_OPTIONS.map((codec) => {
                  const active = videoCodec === codec.id;
                  return (
                    <button
                      key={codec.id}
                      type="button"
                      onClick={() => setVideoCodec(codec.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="text-sm font-bold font-mono">{codec.label}</div>
                      <p className="text-xs text-slate-400 mt-1 leading-snug">
                        {codec.efficiencyNote}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Audio Format */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <h2 className="font-['Outfit'] text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-amber-400" />
                <span>5. Audio Format</span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AUDIO_FORMAT_OPTIONS.map((aud) => {
                  const active = audioFormat === aud.id;
                  return (
                    <button
                      key={aud.id}
                      type="button"
                      onClick={() => setAudioFormat(aud.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        active
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div>
                        <div className="text-xs sm:text-sm font-bold">{aud.label}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {aud.channels}
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-amber-300/90 mt-2">
                        {aud.id === 'none'
                          ? '0 kbps'
                          : aud.id === 'custom'
                          ? `${customAudioKbpsInput || 0} kbps`
                          : `~${aud.defaultKbps} kbps`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 4: EDITABLE BITRATE & CONTAINER OVERHEAD FINE-TUNING */}
            <div className="pt-4 border-t border-white/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>Fine-Tune Bitrates &amp; Container Overhead</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Presets populate realistic bitrates automatically, or override any value below for custom calculations.
                  </p>
                </div>
                {isCustomVideoMode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (sourceType === 'custom') setSourceType('streaming');
                      if (videoCodec === 'custom') setVideoCodec('h264');
                      setVideoBitrateInput(String(currentPresetVideoRange.typical));
                      setIsVideoBitrateManuallyEdited(false);
                    }}
                    className="text-xs font-mono text-amber-400 hover:text-amber-300 underline self-start sm:self-auto"
                  >
                    Restore preset bitrate ({currentPresetVideoRange.typical} Mbps)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Editable Video Bitrate (Mbps) */}
                <div>
                  <label
                    htmlFor="video-bitrate-mbps"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1"
                  >
                    Video Bitrate (Mbps)
                  </label>
                  <div className="relative">
                    <input
                      id="video-bitrate-mbps"
                      type="number"
                      min="0.1"
                      max="250"
                      step="0.1"
                      value={videoBitrateInput}
                      onChange={(e) => {
                        setVideoBitrateInput(e.target.value);
                        setIsVideoBitrateManuallyEdited(true);
                      }}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-400 tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                      Mbps
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    Preset range: {currentPresetVideoRange.low} –{' '}
                    {currentPresetVideoRange.high} Mbps
                  </div>
                </div>

                {/* Editable Audio Bitrate (kbps) */}
                <div>
                  <label
                    htmlFor="audio-bitrate-kbps"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1"
                  >
                    Audio Bitrate (kbps)
                  </label>
                  <div className="relative">
                    <input
                      id="audio-bitrate-kbps"
                      type="number"
                      min="0"
                      max="15000"
                      step="32"
                      disabled={audioFormat === 'none'}
                      value={customAudioKbpsInput}
                      onChange={(e) => {
                        setCustomAudioKbpsInput(e.target.value);
                        if (audioFormat !== 'custom' && audioFormat !== 'none') {
                          setAudioFormat('custom');
                        }
                      }}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-400 disabled:opacity-40 tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                      kbps
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    = {effectiveAudioMbps.toFixed(3)} Mbps
                  </div>
                </div>

                {/* Editable Container Overhead (%) */}
                <div>
                  <label
                    htmlFor="container-overhead-pct"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1"
                  >
                    Container Overhead (%)
                  </label>
                  <div className="relative">
                    <input
                      id="container-overhead-pct"
                      type="number"
                      min="0"
                      max="25"
                      step="0.1"
                      value={overheadPercentInput}
                      onChange={(e) => setOverheadPercentInput(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-400 tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                      %
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    MKV/MP4 muxing &amp; subtitles
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE ESTIMATION RESULTS & BREAKDOWN */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <div className="rounded-2xl bg-gradient-to-b from-[#131520] to-[#0d0e14] border border-amber-500/30 p-6 shadow-2xl space-y-6">
            {/* Top Bar: Status + Reset / Copy Actions */}
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/10">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 block">
                  Estimated Storage Output
                </span>
                <h2 className="font-['Outfit'] text-lg font-bold text-white">
                  {contentType === 'movie'
                    ? 'Feature Film Estimate'
                    : contentType === 'tv_episode'
                    ? 'Single Episode Estimate'
                    : `Full Season (${estimate.episodeCount} Episodes)`}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset all inputs to defaults"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  disabled={!estimate.isValid}
                  onClick={handleCopyResults}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-40 ${
                    copyStatus === 'copied'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : copyStatus === 'error'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400'
                  }`}
                >
                  {copyStatus === 'copied' ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Results</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {!estimate.isValid ? (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-5 text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
                <div className="text-sm font-semibold text-white">
                  Awaiting Valid Runtime or Bitrate
                </div>
                <p className="text-xs text-rose-200/80">
                  {estimate.validationMessage}
                </p>
              </div>
            ) : (
              <>
                {/* Primary Hero File Size Readout */}
                <div className="rounded-xl bg-black/50 border border-white/10 p-5 space-y-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                      {contentType === 'tv_season'
                        ? 'Estimated Total Season Size'
                        : 'Estimated Total File Size'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Decimal (1 GB = 1,000 MB)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-4xl sm:text-5xl font-extrabold text-amber-400 tracking-tight tabular-nums">
                      {formattedTotalStorage.primary}
                    </span>
                    <span className="font-mono text-sm sm:text-base text-slate-400 tabular-nums">
                      ({formattedTotalStorage.secondary})
                    </span>
                  </div>

                  {/* Low – Typical – High Range Pill */}
                  <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400">
                      {isCustomVideoMode
                        ? 'Estimated ±12% VBR variance:'
                        : 'Preset Bitrate Range (Low – High):'}
                    </span>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      {formattedLowStorage.primary} – {formattedHighStorage.primary}
                    </span>
                  </div>

                  {/* Per-Episode Callout when Full TV Season is active */}
                  {contentType === 'tv_season' && (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-amber-300 font-semibold block">
                          Per-Episode Size ({estimate.episodeCount} Episodes)
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          Range: {estimate.perEpisodeLowGb.toFixed(2)} GB –{' '}
                          {estimate.perEpisodeHighGb.toFixed(2)} GB / ep
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-base font-bold text-white tabular-nums block">
                          {formattedPerEpStorage.primary}
                        </span>
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {formattedPerEpStorage.secondary} / ep
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Visual Proportional Stream Bar */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider">
                      Stream Contribution Breakdown
                    </span>
                    <span className="font-mono text-slate-300 tabular-nums">
                      {estimate.totalBitrateMbps.toFixed(2)} Mbps Total
                    </span>
                  </div>

                  <div className="w-full h-3 rounded-full bg-black/60 overflow-hidden flex border border-white/10">
                    <div
                      style={{ width: `${Math.max(2, estimate.videoSharePercent)}%` }}
                      className="bg-amber-400 h-full transition-all duration-300"
                      title={`Video: ${estimate.videoSharePercent.toFixed(1)}%`}
                    />
                    {estimate.audioSharePercent > 0 && (
                      <div
                        style={{ width: `${Math.max(2, estimate.audioSharePercent)}%` }}
                        className="bg-sky-400 h-full transition-all duration-300"
                        title={`Audio: ${estimate.audioSharePercent.toFixed(1)}%`}
                      />
                    )}
                    {estimate.overheadSharePercent > 0 && (
                      <div
                        style={{ width: `${Math.max(1, estimate.overheadSharePercent)}%` }}
                        className="bg-emerald-400 h-full transition-all duration-300"
                        title={`Container Overhead: ${estimate.overheadSharePercent.toFixed(1)}%`}
                      />
                    )}
                  </div>

                  {/* Detailed Breakdown Rows */}
                  <div className="space-y-2 pt-1 text-xs">
                    {/* Video Row */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 shrink-0" />
                        <div>
                          <span className="text-white font-medium">Video Track</span>
                          <span className="text-slate-400 font-mono ml-2">
                            ({estimate.videoBitrateMbps.toFixed(2)} Mbps ·{' '}
                            {estimate.videoSharePercent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-white tabular-nums">
                        {formatDecimalStorage(estimate.videoSizeGb).primary}
                      </span>
                    </div>

                    {/* Audio Row */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 shrink-0" />
                        <div>
                          <span className="text-white font-medium">Audio Track</span>
                          <span className="text-slate-400 font-mono ml-2">
                            (
                            {audioFormat === 'none'
                              ? 'No audio'
                              : `${Math.round(estimate.audioBitrateMbps * 1000)} kbps · ${estimate.audioSharePercent.toFixed(1)}%`}
                            )
                          </span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-white tabular-nums">
                        {audioFormat === 'none'
                          ? '0 MB'
                          : formatDecimalStorage(estimate.audioSizeGb).primary}
                      </span>
                    </div>

                    {/* Container Overhead Row */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 shrink-0" />
                        <div>
                          <span className="text-white font-medium">
                            Container / Muxing
                          </span>
                          <span className="text-slate-400 font-mono ml-2">
                            ({parsedOverheadPercent}% ·{' '}
                            {estimate.overheadBitrateMbps.toFixed(2)} Mbps)
                          </span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-white tabular-nums">
                        {formatDecimalStorage(estimate.overheadSizeGb).primary}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Exact Calculation Formula Trace */}
                <div className="rounded-xl bg-black/40 border border-white/5 p-3.5 space-y-1.5 text-[11px] font-mono text-slate-400">
                  <div className="text-slate-300 font-semibold flex items-center justify-between">
                    <span>Calculation Formula Trace</span>
                    <span>
                      Runtime: {Math.floor(estimate.totalRuntimeMinutes / 60)}h{' '}
                      {Math.round(estimate.totalRuntimeMinutes % 60)}m (
                      {estimate.totalRuntimeSeconds.toLocaleString()}s)
                    </span>
                  </div>
                  <div className="text-amber-300/90 break-all">
                    {estimate.totalBitrateMbps.toFixed(2)} Mbps ×{' '}
                    {estimate.totalRuntimeSeconds.toLocaleString()} s ÷ 8,000 ={' '}
                    {estimate.typicalSizeGb.toFixed(3)} GB (
                    {Math.round(estimate.typicalSizeMb).toLocaleString()} MB)
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SIDE-BY-SIDE PRESET COMPARISON TABLE FOR THE SAME RUNTIME */}
      {estimate.isValid && comparisonRows.length > 0 && (
        <div className="rounded-2xl bg-[#0d0e14] border border-white/10 p-5 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-['Outfit'] text-lg sm:text-xl font-bold text-white">
                Side-by-Side Quality Preset Comparison
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Comparing standard release tiers for the exact same{' '}
                <span className="text-white font-mono font-semibold">
                  {Math.floor(estimate.totalRuntimeMinutes / 60)}h{' '}
                  {Math.round(estimate.totalRuntimeMinutes % 60)}m
                </span>{' '}
                runtime ({estimate.totalRuntimeSeconds.toLocaleString()} seconds). Click any row to load its profile.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Decimal units: 1 GB = 1,000 MB
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  <th className="py-3 pr-4">Preset Profile</th>
                  <th className="py-3 px-4">Video Bitrate</th>
                  <th className="py-3 px-4">Default Audio</th>
                  <th className="py-3 px-4">Typical Size</th>
                  {contentType === 'tv_season' && (
                    <th className="py-3 px-4">Per Episode</th>
                  )}
                  <th className="py-3 px-4">Estimated Range (Low – High)</th>
                  <th className="py-3 pl-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs sm:text-sm">
                {comparisonRows.map((row) => {
                  const isCurrentMatch =
                    resolution === row.resolution &&
                    sourceType === row.sourceType &&
                    videoCodec === row.codec &&
                    !isCustomVideoMode;

                  return (
                    <tr
                      key={row.id}
                      onClick={() =>
                        handleApplyComparisonPreset(
                          row.resolution,
                          row.sourceType,
                          row.codec
                        )
                      }
                      className={`cursor-pointer transition-colors ${
                        isCurrentMatch
                          ? 'bg-amber-500/10 hover:bg-amber-500/15'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-white font-mono">
                            {row.label}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                            {row.badge}
                          </span>
                          {isCurrentMatch && (
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold">
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300 tabular-nums">
                        {row.videoTypicalMbps.toFixed(1)} Mbps
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-xs">
                        {row.audioLabel}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-400 tabular-nums">
                        {formatDecimalStorage(row.typicalSizeGb).primary}
                        <span className="text-slate-500 font-normal text-xs ml-1.5">
                          ({formatDecimalStorage(row.typicalSizeGb).secondary})
                        </span>
                      </td>
                      {contentType === 'tv_season' && (
                        <td className="py-3.5 px-4 font-mono text-slate-200 tabular-nums">
                          {row.perEpisodeTypicalGb !== undefined
                            ? `${formatDecimalStorage(row.perEpisodeTypicalGb).primary} / ep`
                            : '—'}
                        </td>
                      )}
                      <td className="py-3.5 px-4 font-mono text-slate-300 tabular-nums">
                        {formatDecimalStorage(row.lowSizeGb).primary} –{' '}
                        {formatDecimalStorage(row.highSizeGb).primary}
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyComparisonPreset(
                              row.resolution,
                              row.sourceType,
                              row.codec
                            );
                          }}
                          className="text-xs font-semibold text-amber-400 hover:text-amber-300"
                        >
                          {isCurrentMatch ? 'Selected' : 'Apply →'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WHY ACTUAL FILE SIZES VARY — TECHNICAL REFERENCE */}
      <div className="rounded-2xl bg-[#0d0e14] border border-white/10 p-5 sm:p-6 space-y-3">
        <h3 className="font-['Outfit'] text-base font-bold text-white flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-400" />
          <span>Why Actual Release File Sizes Vary</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-1">
            <div className="text-slate-200 font-semibold">
              1. Variable Bitrate (VBR) &amp; Film Grain
            </div>
            <p>
              Modern encoders (x264, x265, SVT-AV1) use Constant Rate Factor (CRF) or 2-pass VBR. High-motion action sequences and natural 35mm film grain require significantly more bits than static dialogue or clean digital animation at the same resolution.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-1">
            <div className="text-slate-200 font-semibold">
              2. HDR10, Dolby Vision &amp; 10-Bit Depth
            </div>
            <p>
              10-bit HDR10 and Dolby Vision enhancement layers (FEL/MEL) carry wider color gamut and dynamic luminance metadata, typically increasing video stream bitrates by 15–25% compared to 8-bit SDR encodes.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-1">
            <div className="text-slate-200 font-semibold">
              3. Multi-Audio &amp; Lossless Object Tracks
            </div>
            <p>
              A single Dolby TrueHD 7.1 Atmos track (~4.5–6.0 Mbps) can add 3.5–5.0 GB to a 2-hour movie—often exceeding the entire video size of a 1080p HEVC Web-DL. Releases bundling multiple language dubs or PGS bitmap subtitles also increase container size.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

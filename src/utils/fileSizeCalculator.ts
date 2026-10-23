export type EstimatorContentType = 'movie' | 'tv_episode' | 'tv_season';

export type ResolutionOption = '480p' | '720p' | '1080p' | '1440p' | '2160p';

export type SourceReleaseType =
  | 'streaming'
  | 'bluray_encode'
  | 'bluray_remux'
  | 'compressed_webrip'
  | 'custom';

export type VideoCodecOption = 'h264' | 'hevc' | 'av1' | 'custom';

export type AudioFormatOption =
  | 'aac_stereo'
  | 'ac3_eac3'
  | 'eac3_51'
  | 'dts_hd'
  | 'truehd_atmos'
  | 'custom'
  | 'none';

export interface BitrateRangeMbps {
  low: number;
  typical: number;
  high: number;
}

export interface ResolutionMeta {
  id: ResolutionOption;
  label: string;
  shortLabel: string;
  dimensions: string;
}

export interface SourceReleaseMeta {
  id: SourceReleaseType;
  label: string;
  description: string;
}

export interface VideoCodecMeta {
  id: VideoCodecOption;
  label: string;
  efficiencyNote: string;
}

export interface AudioFormatMeta {
  id: AudioFormatOption;
  label: string;
  channels: string;
  defaultKbps: number;
  lowKbps: number;
  highKbps: number;
}

export const RESOLUTION_OPTIONS: ResolutionMeta[] = [
  { id: '480p', label: '480p SD', shortLabel: '480p', dimensions: '854 × 480' },
  { id: '720p', label: '720p HD', shortLabel: '720p HD', dimensions: '1280 × 720' },
  { id: '1080p', label: '1080p Full HD', shortLabel: '1080p FHD', dimensions: '1920 × 1080' },
  { id: '1440p', label: '1440p QHD', shortLabel: '1440p', dimensions: '2560 × 1440' },
  { id: '2160p', label: '2160p / 4K UHD', shortLabel: '2160p / 4K', dimensions: '3840 × 2160' },
];

export const SOURCE_RELEASE_OPTIONS: SourceReleaseMeta[] = [
  {
    id: 'streaming',
    label: 'Streaming / Web-DL',
    description: 'Untouched stream from premium VOD platforms (Netflix, Apple TV+, Prime, Max)',
  },
  {
    id: 'bluray_encode',
    label: 'Blu-ray encode',
    description: 'High-transparency x264/x265 encode mastered from a retail Blu-ray disc',
  },
  {
    id: 'bluray_remux',
    label: 'Blu-ray Remux',
    description: 'Lossless 1:1 disc video stream repackaged into MKV with zero re-compression',
  },
  {
    id: 'compressed_webrip',
    label: 'Compressed WEBRip',
    description: 'Space-saving re-encode optimized for smaller storage and mobile playback',
  },
  {
    id: 'custom',
    label: 'Custom bitrate',
    description: 'Specify your own exact target video bitrate in Mbps',
  },
];

export const VIDEO_CODEC_OPTIONS: VideoCodecMeta[] = [
  {
    id: 'h264',
    label: 'H.264 / AVC',
    efficiencyNote: 'Universal hardware compatibility; standard baseline bitrates',
  },
  {
    id: 'hevc',
    label: 'H.265 / HEVC',
    efficiencyNote: '~35–40% more efficient than H.264 at equivalent visual quality; standard for 4K/HDR',
  },
  {
    id: 'av1',
    label: 'AV1',
    efficiencyNote: 'Next-gen royalty-free codec; ~25–30% smaller than HEVC at similar perceptual fidelity',
  },
  {
    id: 'custom',
    label: 'Other / custom bitrate',
    efficiencyNote: 'Manual video bitrate target (VP9, ProRes, MPEG-2, or custom CRF encode)',
  },
];

export const AUDIO_FORMAT_OPTIONS: AudioFormatMeta[] = [
  {
    id: 'aac_stereo',
    label: 'AAC stereo',
    channels: '2.0 Stereo',
    defaultKbps: 192,
    lowKbps: 128,
    highKbps: 256,
  },
  {
    id: 'ac3_eac3',
    label: 'AC-3 / E-AC-3',
    channels: '5.1 Standard',
    defaultKbps: 384,
    lowKbps: 256,
    highKbps: 448,
  },
  {
    id: 'eac3_51',
    label: 'E-AC-3 5.1',
    channels: '5.1 Dolby Digital Plus',
    defaultKbps: 640,
    lowKbps: 448,
    highKbps: 768,
  },
  {
    id: 'dts_hd',
    label: 'DTS / DTS-HD',
    channels: '5.1 / 7.1 Master Audio',
    defaultKbps: 1536,
    lowKbps: 1509,
    highKbps: 3200,
  },
  {
    id: 'truehd_atmos',
    label: 'TrueHD / Atmos',
    channels: '7.1 Lossless / Object',
    defaultKbps: 4500,
    lowKbps: 3200,
    highKbps: 6500,
  },
  {
    id: 'custom',
    label: 'Custom audio bitrate',
    channels: 'User-defined',
    defaultKbps: 512,
    lowKbps: 512,
    highKbps: 512,
  },
  {
    id: 'none',
    label: 'No audio',
    channels: 'Video-only calculation',
    defaultKbps: 0,
    lowKbps: 0,
    highKbps: 0,
  },
];

/**
 * Base H.264 video bitrate ranges (in Mbps) for each Resolution × Source Release Type.
 * Codec multipliers are applied on top unless the source is Blu-ray Remux (which uses disc specification bitrates).
 */
const BASE_H264_VIDEO_BITRATES: Record<
  ResolutionOption,
  Record<Exclude<SourceReleaseType, 'custom'>, BitrateRangeMbps>
> = {
  '480p': {
    compressed_webrip: { low: 0.6, typical: 0.9, high: 1.3 },
    streaming: { low: 1.0, typical: 1.5, high: 2.2 },
    bluray_encode: { low: 1.5, typical: 2.2, high: 3.0 },
    bluray_remux: { low: 4.5, typical: 6.2, high: 8.5 }, // DVD / SD Remux equivalent
  },
  '720p': {
    compressed_webrip: { low: 1.3, typical: 1.9, high: 2.6 },
    streaming: { low: 2.5, typical: 3.6, high: 5.0 },
    bluray_encode: { low: 4.0, typical: 5.8, high: 8.0 },
    bluray_remux: { low: 12.0, typical: 16.0, high: 20.0 },
  },
  '1080p': {
    compressed_webrip: { low: 2.2, typical: 3.2, high: 4.5 },
    streaming: { low: 4.8, typical: 7.2, high: 10.5 },
    bluray_encode: { low: 8.5, typical: 12.5, high: 17.5 },
    bluray_remux: { low: 24.0, typical: 31.5, high: 38.0 }, // 1080p BD-50 AVC/VC-1 Remux
  },
  '1440p': {
    compressed_webrip: { low: 4.5, typical: 6.5, high: 9.0 },
    streaming: { low: 9.0, typical: 13.0, high: 18.0 },
    bluray_encode: { low: 14.0, typical: 19.5, high: 26.0 },
    bluray_remux: { low: 34.0, typical: 44.0, high: 54.0 },
  },
  '2160p': {
    compressed_webrip: { low: 9.5, typical: 13.5, high: 18.5 },
    streaming: { low: 16.0, typical: 23.5, high: 32.0 },
    bluray_encode: { low: 24.0, typical: 35.0, high: 48.0 },
    bluray_remux: { low: 52.0, typical: 66.0, high: 88.0 }, // 4K UHD Blu-ray Remux
  },
};

/**
 * Returns realistic low / typical / high video bitrates in Mbps for a given
 * resolution, release type, and video codec combination.
 */
export function getPresetVideoBitrateRange(
  resolution: ResolutionOption,
  sourceType: SourceReleaseType,
  codec: VideoCodecOption
): BitrateRangeMbps {
  const effectiveSource = sourceType === 'custom' ? 'streaming' : sourceType;
  const base = BASE_H264_VIDEO_BITRATES[resolution][effectiveSource];

  // Blu-ray Remux streams are untouched from retail discs (1080p is natively H.264/VC-1, 4K UHD is natively HEVC)
  if (effectiveSource === 'bluray_remux') {
    if (resolution === '2160p') {
      // 4K UHD Blu-ray discs are authored in HEVC at ~50-85 Mbps
      return {
        low: Number(base.low.toFixed(2)),
        typical: Number(base.typical.toFixed(2)),
        high: Number(base.high.toFixed(2)),
      };
    }
    // For 1080p/720p remuxes, slight variation if user explicitly selects HEVC/AV1 hybrid remux
    const remuxFactor = codec === 'hevc' ? 0.88 : codec === 'av1' ? 0.8 : 1.0;
    return {
      low: Number((base.low * remuxFactor).toFixed(2)),
      typical: Number((base.typical * remuxFactor).toFixed(2)),
      high: Number((base.high * remuxFactor).toFixed(2)),
    };
  }

  // For Streaming, Blu-ray Encode, and Compressed WEBRip, apply realistic codec compression ratios
  let codecMultiplier = 1.0;
  if (codec === 'hevc') {
    codecMultiplier = 0.64; // HEVC requires ~36% less bitrate than H.264 for comparable quality
  } else if (codec === 'av1') {
    codecMultiplier = 0.48; // AV1 requires ~52% less than H.264 (~25% less than HEVC)
  } else if (codec === 'custom') {
    codecMultiplier = 0.75;
  }

  return {
    low: Math.max(0.25, Number((base.low * codecMultiplier).toFixed(2))),
    typical: Math.max(0.4, Number((base.typical * codecMultiplier).toFixed(2))),
    high: Math.max(0.6, Number((base.high * codecMultiplier).toFixed(2))),
  };
}

/**
 * Returns audio bitrate range in Mbps (1 Mbps = 1,000 kbps decimal).
 */
export function getAudioBitrateRangeMbps(
  audioFormat: AudioFormatOption,
  customAudioKbps: number
): BitrateRangeMbps {
  if (audioFormat === 'none') {
    return { low: 0, typical: 0, high: 0 };
  }
  if (audioFormat === 'custom') {
    const safeKbps = Math.max(0, Number.isFinite(customAudioKbps) ? customAudioKbps : 0);
    const mbps = safeKbps / 1000;
    return { low: mbps, typical: mbps, high: mbps };
  }
  const meta =
    AUDIO_FORMAT_OPTIONS.find((a) => a.id === audioFormat) || AUDIO_FORMAT_OPTIONS[2];
  return {
    low: meta.lowKbps / 1000,
    typical: meta.defaultKbps / 1000,
    high: meta.highKbps / 1000,
  };
}

/**
 * Core formula required by specification:
 * File size in decimal GB ≈ total average bitrate in Mbps × runtime in seconds ÷ 8,000
 * Consistent decimal units: 1 GB = 1,000 MB.
 */
export function computeDecimalGbFromBitrateAndSeconds(
  totalBitrateMbps: number,
  runtimeSeconds: number
): number {
  if (
    !Number.isFinite(totalBitrateMbps) ||
    !Number.isFinite(runtimeSeconds) ||
    totalBitrateMbps <= 0 ||
    runtimeSeconds <= 0
  ) {
    return 0;
  }
  return (totalBitrateMbps * runtimeSeconds) / 8000;
}

export interface FileSizeCalculationInput {
  contentType: EstimatorContentType;
  /** Single movie or single episode duration in minutes */
  singleRuntimeMinutes: number;
  /** Number of episodes (used when contentType === 'tv_season') */
  episodeCount: number;
  /** Average episode runtime in minutes (used when contentType === 'tv_season') */
  avgEpisodeRuntimeMinutes: number;
  /** Video bitrate in Mbps (typical / user-edited value) */
  videoBitrateMbps: number;
  /** Video bitrate range (low/typical/high) from preset or custom */
  videoBitrateRangeMbps: BitrateRangeMbps;
  /** Audio bitrate in Mbps (typical / user-edited value) */
  audioBitrateMbps: number;
  /** Audio bitrate range in Mbps */
  audioBitrateRangeMbps: BitrateRangeMbps;
  /** Container / muxing overhead percentage (e.g., 1.5 for 1.5%) */
  overheadPercent: number;
  /** Whether the user is using a custom manual bitrate rather than a preset range */
  isCustomBitrate: boolean;
}

export interface FileSizeBreakdown {
  isValid: boolean;
  validationMessage?: string;
  /** Total runtime in minutes across the selected scope */
  totalRuntimeMinutes: number;
  /** Total runtime in seconds across the selected scope */
  totalRuntimeSeconds: number;
  /** Runtime of a single unit (movie or 1 episode) in seconds */
  perUnitRuntimeSeconds: number;
  episodeCount: number;
  /** Bitrate breakdown in Mbps */
  videoBitrateMbps: number;
  audioBitrateMbps: number;
  overheadBitrateMbps: number;
  totalBitrateMbps: number;
  totalLowBitrateMbps: number;
  totalHighBitrateMbps: number;
  /** Total size in decimal GB (1 GB = 1000 MB) */
  typicalSizeGb: number;
  lowSizeGb: number;
  highSizeGb: number;
  /** Total size in decimal MB */
  typicalSizeMb: number;
  lowSizeMb: number;
  highSizeMb: number;
  /** Component contributions in decimal GB */
  videoSizeGb: number;
  audioSizeGb: number;
  overheadSizeGb: number;
  /** Percentage shares of total file size */
  videoSharePercent: number;
  audioSharePercent: number;
  overheadSharePercent: number;
  /** Per-episode size in decimal GB & MB (relevant for TV Season mode) */
  perEpisodeTypicalGb: number;
  perEpisodeLowGb: number;
  perEpisodeHighGb: number;
  perEpisodeTypicalMb: number;
}

export function calculateFileSizeEstimate(
  input: FileSizeCalculationInput
): FileSizeBreakdown {
  const safeOverheadPct = Math.max(
    0,
    Math.min(25, Number.isFinite(input.overheadPercent) ? input.overheadPercent : 1.5)
  );
  const overheadMultiplier = safeOverheadPct / 100;

  const isSeason = input.contentType === 'tv_season';
  const epCount = isSeason ? Math.max(0, Math.floor(input.episodeCount || 0)) : 1;
  const unitMinutes = isSeason
    ? input.avgEpisodeRuntimeMinutes
    : input.singleRuntimeMinutes;

  if (!Number.isFinite(unitMinutes) || unitMinutes <= 0) {
    return createEmptyBreakdown(
      isSeason
        ? 'Enter a valid average episode runtime greater than 0 minutes.'
        : 'Enter a valid runtime greater than 0 minutes.'
    );
  }

  if (isSeason && epCount <= 0) {
    return createEmptyBreakdown(
      'Enter at least 1 episode to calculate a full TV season estimate.'
    );
  }

  const videoMbps = Math.max(
    0,
    Number.isFinite(input.videoBitrateMbps) ? input.videoBitrateMbps : 0
  );
  const audioMbps = Math.max(
    0,
    Number.isFinite(input.audioBitrateMbps) ? input.audioBitrateMbps : 0
  );

  if (videoMbps <= 0 && audioMbps <= 0) {
    return createEmptyBreakdown(
      'Video bitrate must be greater than 0 Mbps to compute a file size.'
    );
  }

  const perUnitRuntimeSeconds = Math.round(unitMinutes * 60);
  const totalRuntimeMinutes = unitMinutes * epCount;
  const totalRuntimeSeconds = perUnitRuntimeSeconds * epCount;

  const baseCombinedMbps = videoMbps + audioMbps;
  const overheadBitrateMbps = baseCombinedMbps * overheadMultiplier;
  const totalBitrateMbps = baseCombinedMbps + overheadBitrateMbps;

  // Low and High bitrates scale proportionally if user tweaked typical bitrate, or use preset bounds
  const lowVideoMbps = input.isCustomBitrate
    ? videoMbps * 0.88
    : Math.min(videoMbps, input.videoBitrateRangeMbps.low);
  const highVideoMbps = input.isCustomBitrate
    ? videoMbps * 1.12
    : Math.max(videoMbps, input.videoBitrateRangeMbps.high);

  const lowAudioMbps = Math.min(audioMbps, input.audioBitrateRangeMbps.low);
  const highAudioMbps = Math.max(audioMbps, input.audioBitrateRangeMbps.high);

  const totalLowBitrateMbps = (lowVideoMbps + lowAudioMbps) * (1 + overheadMultiplier);
  const totalHighBitrateMbps = (highVideoMbps + highAudioMbps) * (1 + overheadMultiplier);

  // Sizes in decimal GB (Mbps × seconds ÷ 8,000)
  const videoSizeGb = computeDecimalGbFromBitrateAndSeconds(
    videoMbps,
    totalRuntimeSeconds
  );
  const audioSizeGb = computeDecimalGbFromBitrateAndSeconds(
    audioMbps,
    totalRuntimeSeconds
  );
  const overheadSizeGb = computeDecimalGbFromBitrateAndSeconds(
    overheadBitrateMbps,
    totalRuntimeSeconds
  );

  const typicalSizeGb = computeDecimalGbFromBitrateAndSeconds(
    totalBitrateMbps,
    totalRuntimeSeconds
  );
  const lowSizeGb = computeDecimalGbFromBitrateAndSeconds(
    totalLowBitrateMbps,
    totalRuntimeSeconds
  );
  const highSizeGb = computeDecimalGbFromBitrateAndSeconds(
    totalHighBitrateMbps,
    totalRuntimeSeconds
  );

  const perEpisodeTypicalGb = computeDecimalGbFromBitrateAndSeconds(
    totalBitrateMbps,
    perUnitRuntimeSeconds
  );
  const perEpisodeLowGb = computeDecimalGbFromBitrateAndSeconds(
    totalLowBitrateMbps,
    perUnitRuntimeSeconds
  );
  const perEpisodeHighGb = computeDecimalGbFromBitrateAndSeconds(
    totalHighBitrateMbps,
    perUnitRuntimeSeconds
  );

  const videoSharePercent =
    totalBitrateMbps > 0 ? (videoMbps / totalBitrateMbps) * 100 : 0;
  const audioSharePercent =
    totalBitrateMbps > 0 ? (audioMbps / totalBitrateMbps) * 100 : 0;
  const overheadSharePercent =
    totalBitrateMbps > 0 ? (overheadBitrateMbps / totalBitrateMbps) * 100 : 0;

  return {
    isValid: true,
    totalRuntimeMinutes,
    totalRuntimeSeconds,
    perUnitRuntimeSeconds,
    episodeCount: epCount,
    videoBitrateMbps: videoMbps,
    audioBitrateMbps: audioMbps,
    overheadBitrateMbps,
    totalBitrateMbps,
    totalLowBitrateMbps,
    totalHighBitrateMbps,
    typicalSizeGb,
    lowSizeGb,
    highSizeGb,
    typicalSizeMb: typicalSizeGb * 1000,
    lowSizeMb: lowSizeGb * 1000,
    highSizeMb: highSizeGb * 1000,
    videoSizeGb,
    audioSizeGb,
    overheadSizeGb,
    videoSharePercent,
    audioSharePercent,
    overheadSharePercent,
    perEpisodeTypicalGb,
    perEpisodeLowGb,
    perEpisodeHighGb,
    perEpisodeTypicalMb: perEpisodeTypicalGb * 1000,
  };
}

function createEmptyBreakdown(validationMessage: string): FileSizeBreakdown {
  return {
    isValid: false,
    validationMessage,
    totalRuntimeMinutes: 0,
    totalRuntimeSeconds: 0,
    perUnitRuntimeSeconds: 0,
    episodeCount: 0,
    videoBitrateMbps: 0,
    audioBitrateMbps: 0,
    overheadBitrateMbps: 0,
    totalBitrateMbps: 0,
    totalLowBitrateMbps: 0,
    totalHighBitrateMbps: 0,
    typicalSizeGb: 0,
    lowSizeGb: 0,
    highSizeGb: 0,
    typicalSizeMb: 0,
    lowSizeMb: 0,
    highSizeMb: 0,
    videoSizeGb: 0,
    audioSizeGb: 0,
    overheadSizeGb: 0,
    videoSharePercent: 0,
    audioSharePercent: 0,
    overheadSharePercent: 0,
    perEpisodeTypicalGb: 0,
    perEpisodeLowGb: 0,
    perEpisodeHighGb: 0,
    perEpisodeTypicalMb: 0,
  };
}

export interface ComparisonPresetRow {
  id: string;
  label: string;
  badge: string;
  resolution: ResolutionOption;
  sourceType: SourceReleaseType;
  codec: VideoCodecOption;
  audioLabel: string;
  videoTypicalMbps: number;
  audioMbps: number;
  totalTypicalMbps: number;
  typicalSizeGb: number;
  lowSizeGb: number;
  highSizeGb: number;
  perEpisodeTypicalGb?: number;
}

/**
 * Generates the 5 required comparison rows for the same runtime:
 * - 720p H.264
 * - 1080p H.264
 * - 1080p HEVC
 * - 4K HEVC
 * - 4K Remux
 */
export function buildComparisonPresets(
  totalRuntimeSeconds: number,
  perUnitRuntimeSeconds: number,
  isSeason: boolean,
  overheadPercent: number
): ComparisonPresetRow[] {
  if (!Number.isFinite(totalRuntimeSeconds) || totalRuntimeSeconds <= 0) {
    return [];
  }
  const safeOverhead = Math.max(0, Math.min(25, overheadPercent || 1.5)) / 100;

  const specs: Array<{
    id: string;
    label: string;
    badge: string;
    resolution: ResolutionOption;
    sourceType: SourceReleaseType;
    codec: VideoCodecOption;
    audioFormat: AudioFormatOption;
    audioLabel: string;
  }> = [
    {
      id: '720p_h264',
      label: '720p H.264',
      badge: 'Streaming HD',
      resolution: '720p',
      sourceType: 'streaming',
      codec: 'h264',
      audioFormat: 'ac3_eac3',
      audioLabel: 'AC-3 384 kbps',
    },
    {
      id: '1080p_h264',
      label: '1080p H.264',
      badge: 'Standard Web-DL',
      resolution: '1080p',
      sourceType: 'streaming',
      codec: 'h264',
      audioFormat: 'eac3_51',
      audioLabel: 'E-AC-3 5.1 (640 kbps)',
    },
    {
      id: '1080p_hevc',
      label: '1080p HEVC',
      badge: 'Efficient x265',
      resolution: '1080p',
      sourceType: 'streaming',
      codec: 'hevc',
      audioFormat: 'eac3_51',
      audioLabel: 'E-AC-3 5.1 (640 kbps)',
    },
    {
      id: '4k_hevc',
      label: '4K HEVC',
      badge: 'UHD Web-DL / Encode',
      resolution: '2160p',
      sourceType: 'streaming',
      codec: 'hevc',
      audioFormat: 'eac3_51',
      audioLabel: 'E-AC-3 5.1 Atmos (768 kbps)',
    },
    {
      id: '4k_remux',
      label: '4K Remux',
      badge: 'UHD Blu-ray Disc 1:1',
      resolution: '2160p',
      sourceType: 'bluray_remux',
      codec: 'hevc',
      audioFormat: 'truehd_atmos',
      audioLabel: 'TrueHD Atmos (4.5 Mbps)',
    },
  ];

  return specs.map((spec) => {
    const vRange = getPresetVideoBitrateRange(
      spec.resolution,
      spec.sourceType,
      spec.codec
    );
    const aRange = getAudioBitrateRangeMbps(spec.audioFormat, 0);

    const totalTypicalMbps = (vRange.typical + aRange.typical) * (1 + safeOverhead);
    const totalLowMbps = (vRange.low + aRange.low) * (1 + safeOverhead);
    const totalHighMbps = (vRange.high + aRange.high) * (1 + safeOverhead);

    return {
      id: spec.id,
      label: spec.label,
      badge: spec.badge,
      resolution: spec.resolution,
      sourceType: spec.sourceType,
      codec: spec.codec,
      audioLabel: spec.audioLabel,
      videoTypicalMbps: vRange.typical,
      audioMbps: aRange.typical,
      totalTypicalMbps,
      typicalSizeGb: computeDecimalGbFromBitrateAndSeconds(
        totalTypicalMbps,
        totalRuntimeSeconds
      ),
      lowSizeGb: computeDecimalGbFromBitrateAndSeconds(
        totalLowMbps,
        totalRuntimeSeconds
      ),
      highSizeGb: computeDecimalGbFromBitrateAndSeconds(
        totalHighMbps,
        totalRuntimeSeconds
      ),
      perEpisodeTypicalGb: isSeason
        ? computeDecimalGbFromBitrateAndSeconds(totalTypicalMbps, perUnitRuntimeSeconds)
        : undefined,
    };
  });
}

/**
 * Strictly parses a runtime string (such as "2h 46m", "148m", "1h", "55 min") into total minutes.
 * Returns null if the string is missing, empty, or does not contain a valid positive duration.
 * Never silently assumes a default runtime.
 */
export function parseStrictRuntimeMinutes(runtimeStr?: string | null): number | null {
  if (!runtimeStr || typeof runtimeStr !== 'string') return null;
  const trimmed = runtimeStr.trim();
  if (!trimmed) return null;

  let totalMinutes = 0;
  let matched = false;

  const hoursMatch = trimmed.match(/(\d+)\s*h(?:ours?|r|rs)?/i);
  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60;
    matched = true;
  }

  const minsMatch = trimmed.match(/(\d+)\s*m(?:in(?:ute)?s?)?/i);
  if (minsMatch) {
    totalMinutes += parseInt(minsMatch[1], 10);
    matched = true;
  }

  if (!matched && /^\d+$/.test(trimmed)) {
    totalMinutes = parseInt(trimmed, 10);
    matched = true;
  }

  return matched && totalMinutes > 0 ? totalMinutes : null;
}

/**
 * Formats decimal GB cleanly, showing both GB and MB when appropriate.
 * Decimal convention: 1 GB = 1,000 MB.
 */
export function formatDecimalStorage(sizeGb: number): {
  primary: string;
  secondary: string;
} {
  if (!Number.isFinite(sizeGb) || sizeGb <= 0) {
    return { primary: '0.00 GB', secondary: '0 MB' };
  }
  const sizeMb = sizeGb * 1000;
  if (sizeGb < 1) {
    return {
      primary: `${Math.round(sizeMb).toLocaleString()} MB`,
      secondary: `${sizeGb.toFixed(2)} GB`,
    };
  }
  return {
    primary: `${sizeGb.toFixed(2)} GB`,
    secondary: `${Math.round(sizeMb).toLocaleString()} MB`,
  };
}

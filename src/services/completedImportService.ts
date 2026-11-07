import {
  MediaItem,
  MediaType,
  WatchedEpisodeEntry,
  WatchHistoryEntry,
  WatchlistEntry,
} from '../types';
import { MEDIA_ITEMS } from '../data/mediaData';
import { EXTRA_ANCHOR_ITEMS, INDIAN_TRENDING_ITEMS } from '../data/franchiseData';
import {
  dedupeMediaItems,
  extractCanonicalTmdbIdentity,
  getCanonicalMediaKey,
  normalizeMediaTitle,
} from '../utils/mediaIntegrity';
import {
  executeSmartSearch,
  fetchCatalogue,
} from './mediaApi';
import {
  detectCandidateAmbiguity,
  isProtectedNumericTitle,
  resolveDeterministicTitle,
  resolveDeterministicTitlesBatch,
  scoreDeterministicCandidate,
} from './titleMatcher';
import {
  extractTextFromImageWithOcr,
  OcrProgressUpdate,
} from './ocrImportService';
import {
  setSeasonEpisodesWatchedInDb,
  upsertWatchHistoryItem,
  upsertWatchlistItem,
} from './supabaseClient';

export interface ExtractedImportItem {
  id: string;
  rawLine: string;
  title: string;
  normalizedTitle?: string;
  alternateQueries?: string[];
  mediaTypeHint?: MediaType;
  yearHint?: number;
  inferredMediaTypeHint?: MediaType;
  inferredYearHint?: number;
  matchConfidence?: number;
  smartMatched?: boolean;
  isAmbiguousHint?: boolean;
  ambiguityReasonHint?: string;
  seasonNumber?: number;
  episodeNumbers?: number[];
  watchedAtHint?: string;
  personalRatingHint?: number;
  notesHint?: string;
}

export type ImportMatchStatus = 'matched' | 'ambiguous' | 'unmatched';

export type ExistingAccountState =
  | 'none'
  | 'already_completed'
  | 'upgrade_to_completed';

export interface ResolvedImportRow {
  rowId: string;
  extracted: ExtractedImportItem;
  matchStatus: ImportMatchStatus;
  matchReason?: string;
  smartMatched?: boolean;
  normalizedTitle?: string;
  selectedMedia: MediaItem | null;
  candidates: MediaItem[];
  existingState: ExistingAccountState;
  existingWatchlistEntry?: WatchlistEntry;
  existingHistoryEntry?: WatchHistoryEntry;
  selected: boolean;
  watchedDateOverride: string;
  hasExplicitDateOverride: boolean;
}

export interface ImportFailedItem {
  rowId: string;
  title: string;
  error: string;
}

export interface ImportExecutionResult {
  importedNewCount: number;
  updatedExistingCount: number;
  skippedCount: number;
  unmatchedCount: number;
  failedItems: ImportFailedItem[];
  savedWatchlistEntries: WatchlistEntry[];
  savedHistoryEntries: WatchHistoryEntry[];
  savedEpisodeEntries: WatchedEpisodeEntry[];
  newlyDiscoveredMedia: MediaItem[];
  migrationNeeded?: boolean;
}

const MAX_IMAGE_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const SUPPORTED_TEXT_EXTENSIONS = ['.txt', '.csv', '.json'];

export function getTodayDateIso(): string {
  return new Date().toISOString().split('T')[0];
}

export function validateImportFile(file: File): {
  valid: boolean;
  kind: 'image' | 'txt' | 'csv' | 'json' | null;
  error: string | null;
} {
  if (!file) {
    return { valid: false, kind: null, error: 'Please select a file to import.' };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      kind: null,
      error: `The selected file "${file.name}" is empty (0 bytes).`,
    };
  }

  const nameLower = (file.name || '').toLowerCase().trim();
  const mimeLower = (file.type || '').toLowerCase().trim();

  const isImage =
    SUPPORTED_IMAGE_EXTENSIONS.some((ext) => nameLower.endsWith(ext)) ||
    mimeLower === 'image/png' ||
    mimeLower === 'image/jpeg' ||
    mimeLower === 'image/jpg' ||
    mimeLower === 'image/webp';

  if (isImage) {
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      return {
        valid: false,
        kind: null,
        error: `Image file is too large (${(file.size / (1024 * 1024)).toFixed(
          1
        )} MB). Maximum allowed size for PNG/JPG/WEBP screenshots is 8 MB.`,
      };
    }
    return { valid: true, kind: 'image', error: null };
  }

  const isJson =
    nameLower.endsWith('.json') || mimeLower === 'application/json';
  const isCsv =
    nameLower.endsWith('.csv') ||
    mimeLower === 'text/csv' ||
    mimeLower === 'application/csv';
  const isTxt =
    nameLower.endsWith('.txt') ||
    mimeLower === 'text/plain' ||
    SUPPORTED_TEXT_EXTENSIONS.some((ext) => nameLower.endsWith(ext));

  if (isJson || isCsv || isTxt) {
    if (file.size > MAX_TEXT_FILE_BYTES) {
      return {
        valid: false,
        kind: null,
        error: `File is too large (${(file.size / (1024 * 1024)).toFixed(
          1
        )} MB). Maximum allowed size for TXT/CSV/JSON files is 2 MB.`,
      };
    }
    const kind = isJson ? 'json' : isCsv ? 'csv' : 'txt';
    return { valid: true, kind, error: null };
  }

  return {
    valid: false,
    kind: null,
    error:
      'Unsupported file format. Please choose a PNG, JPG/JPEG, WEBP screenshot, or a TXT, CSV, or JSON file.',
  };
}

function normalizeDateString(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoPrefix) {
    return isoPrefix[1];
  }
  const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    const y = slashMatch[1];
    const m = slashMatch[2].padStart(2, '0');
    const d = slashMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return undefined;
}

function parseMediaTypeToken(token?: string | null): MediaType | undefined {
  if (!token) return undefined;
  const norm = String(token).trim().toLowerCase();
  if (
    norm === 'movie' ||
    norm === 'movies' ||
    norm === 'film' ||
    norm === 'feature'
  ) {
    return 'movie';
  }
  if (
    norm === 'tv' ||
    norm === 'series' ||
    norm === 'tv series' ||
    norm === 'tv show' ||
    norm === 'show' ||
    norm === 'miniseries' ||
    norm === 'limited series' ||
    norm === 'anime series' ||
    norm === 'web series'
  ) {
    return 'tv';
  }
  return undefined;
}

function parseEpisodeRange(
  startEp: number,
  endEp?: number
): number[] | undefined {
  if (!Number.isInteger(startEp) || startEp < 1 || startEp > 2000) {
    return undefined;
  }
  if (endEp !== undefined && Number.isInteger(endEp) && endEp >= startEp) {
    const cappedEnd = Math.min(endEp, startEp + 100);
    const list: number[] = [];
    for (let ep = startEp; ep <= cappedEnd; ep++) {
      list.push(ep);
    }
    return list;
  }
  return [startEp];
}

export function parseSingleTextLine(
  line: string,
  index: number
): ExtractedImportItem | null {
  const rawLine = String(line || '').trim();
  if (!rawLine) return null;

  // Ignore comment or markdown header lines
  if (
    rawLine.startsWith('//') ||
    /^#{1,6}\s+/.test(rawLine) ||
    /^[-=_*]{3,}$/.test(rawLine)
  ) {
    return null;
  }

  let working = rawLine
    // Strip leading numbering / bullets / checkboxes: "1. ", "01) ", "- [x] ", "• "
    .replace(
      /^\s*(?:[-*•✓✔☑]+\s*)?(?:\[[xX✓✔\s]\]\s*)?(?:#?\d{1,4}\s*[.)\]:-]\s*)?/,
      ''
    )
    .trim();

  if (!working) return null;

  let mediaTypeHint: MediaType | undefined;
  let yearHint: number | undefined;
  let seasonNumber: number | undefined;
  let episodeNumbers: number[] | undefined;
  let watchedAtHint: string | undefined;
  let personalRatingHint: number | undefined;

  // 1. Extract explicit watched date (YYYY-MM-DD)
  const dateMatch = working.match(
    /(?:watched(?:\s+on)?\s*[:=-]?\s*)?\b((?:19|20)\d{2}-\d{2}-\d{2})\b/i
  );
  if (dateMatch) {
    watchedAtHint = dateMatch[1];
    working = working.replace(dateMatch[0], ' ').trim();
  }

  // 2. Extract explicit rating out of 10 e.g. "9/10", "Rating: 8/10", "★ 9"
  const ratingMatch = working.match(
    /(?:\b(?:rating|score)\s*[:=-]?\s*)?\b(10|[1-9](?:\.\d)?)\s*\/\s*10\b/i
  );
  if (ratingMatch) {
    const val = Math.round(parseFloat(ratingMatch[1]));
    if (val >= 1 && val <= 10) {
      personalRatingHint = val;
    }
    working = working.replace(ratingMatch[0], ' ').trim();
  }

  // 3. Extract explicit Season + Episode pattern: e.g. S01E01, S1E1-E8, Season 1 Episode 3
  const seCodeMatch = working.match(
    /\bS(\d{1,2})\s*E(\d{1,3})(?:\s*[-–to]+\s*E?(\d{1,3}))?\b/i
  );
  if (seCodeMatch) {
    seasonNumber = parseInt(seCodeMatch[1], 10);
    const startEp = parseInt(seCodeMatch[2], 10);
    const endEp = seCodeMatch[3] ? parseInt(seCodeMatch[3], 10) : undefined;
    episodeNumbers = parseEpisodeRange(startEp, endEp);
    mediaTypeHint = 'tv';
    working = working.replace(seCodeMatch[0], ' ').trim();
  } else {
    const seasonEpWordsMatch = working.match(
      /\bSeason\s*(\d{1,2})(?:\s*[,:-]?\s*(?:Episode|Ep\.?|Episodes|Eps\.?)\s*(\d{1,3})(?:\s*[-–to]+\s*(\d{1,3}))?)?\b/i
    );
    if (seasonEpWordsMatch) {
      seasonNumber = parseInt(seasonEpWordsMatch[1], 10);
      if (seasonEpWordsMatch[2]) {
        const startEp = parseInt(seasonEpWordsMatch[2], 10);
        const endEp = seasonEpWordsMatch[3]
          ? parseInt(seasonEpWordsMatch[3], 10)
          : undefined;
        episodeNumbers = parseEpisodeRange(startEp, endEp);
      }
      mediaTypeHint = 'tv';
      working = working.replace(seasonEpWordsMatch[0], ' ').trim();
    }
  }

  // 4. Extract explicit media type tag in brackets/parens or trailing delimiter: (Movie), [TV Series], - Series
  const bracketTypeMatch = working.match(
    /[\[(]\s*(movie|film|tv\s*series|tv\s*show|web\s*series|mini\s*series|limited\s*series|series|tv|show)\s*[\])]/i
  );
  if (bracketTypeMatch) {
    const parsedType = parseMediaTypeToken(bracketTypeMatch[1]);
    if (parsedType) mediaTypeHint = parsedType;
    working = working.replace(bracketTypeMatch[0], ' ').trim();
  } else {
    const trailingTypeMatch = working.match(
      /(?:\s+[-–—|]\s+|\s*,\s*)(movie|film|tv\s*series|tv\s*show|web\s*series|series|tv)\s*$/i
    );
    if (trailingTypeMatch) {
      const parsedType = parseMediaTypeToken(trailingTypeMatch[1]);
      if (parsedType) mediaTypeHint = parsedType;
      working = working.slice(0, trailingTypeMatch.index).trim();
    }
  }

  // 5. Extract release year in parentheses/brackets or trailing delimiter: (2023), [2019], - 2024
  const parenYearMatch = working.match(/[\[(]\s*((?:19|20)\d{2})\s*[\])]/);
  if (parenYearMatch) {
    const candidateYear = parseInt(parenYearMatch[1], 10);
    const stripped = working.replace(parenYearMatch[0], ' ').trim();
    if (stripped.length >= 1) {
      yearHint = candidateYear;
      working = stripped;
    }
  } else if (!isProtectedNumericTitle(working)) {
    const trailingYearMatch = working.match(
      /(?:\s+[-–—|]\s+|\s+)((?:19|20)\d{2})\s*$/
    );
    if (trailingYearMatch) {
      const candidateYear = parseInt(trailingYearMatch[1], 10);
      const prefixTitle = working.slice(0, trailingYearMatch.index).trim();
      // Keep numbers that are genuinely part of a title like "Blade Runner 2049" or "1917"
      if (
        prefixTitle.length >= 2 &&
        candidateYear <= new Date().getFullYear() + 1 &&
        !isProtectedNumericTitle(`${prefixTitle} ${candidateYear}`)
      ) {
        yearHint = candidateYear;
        working = prefixTitle;
      }
    }
  }

  // Clean trailing punctuation / separators
  const cleanTitle = working
    .replace(/(?:\s*[-–—|•:]+\s*)+$/, '')
    .replace(/^\s*["'“”‘’]+|["'“”‘’]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanTitle || cleanTitle.length > 200) return null;

  // Skip common header words if someone pasted a table header
  if (
    /^(title|movie|movies|tv\s*series|series|watched\s*list|completed\s*list|name)$/i.test(
      cleanTitle
    ) &&
    !yearHint
  ) {
    return null;
  }

  return {
    id: `ext-${index}-${Date.now()}`,
    rawLine,
    title: cleanTitle,
    mediaTypeHint,
    yearHint,
    seasonNumber,
    episodeNumbers,
    watchedAtHint,
    personalRatingHint,
  };
}

export function parseTextImportList(rawText: string): {
  items: ExtractedImportItem[];
  error: string | null;
} {
  const text = String(rawText || '').trim();
  if (!text) {
    return {
      items: [],
      error: 'Please enter or paste at least one movie or TV series title.',
    };
  }

  const lines = text.split(/\r?\n/);
  const items: ExtractedImportItem[] = [];

  lines.forEach((line, idx) => {
    const parsed = parseSingleTextLine(line, idx);
    if (parsed) {
      items.push(parsed);
    }
  });

  if (items.length === 0) {
    return {
      items: [],
      error:
        'Could not find any valid movie or TV series titles in the provided text.',
    };
  }

  return { items, error: null };
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

export function parseCsvImportFile(csvContent: string): {
  items: ExtractedImportItem[];
  error: string | null;
} {
  const trimmed = String(csvContent || '').trim();
  if (!trimmed) {
    return { items: [], error: 'The selected CSV file is empty.' };
  }

  const rows = parseCsvRows(trimmed);
  if (rows.length === 0) {
    return { items: [], error: 'No rows found in the CSV file.' };
  }

  // If single-column CSV, treat as line-by-line text
  if (rows.every((r) => r.length === 1)) {
    return parseTextImportList(rows.map((r) => r[0]).join('\n'));
  }

  const firstRowLower = rows[0].map((c) => c.toLowerCase().trim());
  const titleHeaderIdx = firstRowLower.findIndex((h) =>
    ['title', 'name', 'movie', 'series', 'show', 'media', 'item', 'film'].includes(
      h
    )
  );
  const typeHeaderIdx = firstRowLower.findIndex((h) =>
    ['type', 'media_type', 'mediatype', 'format', 'category', 'kind'].includes(h)
  );
  const yearHeaderIdx = firstRowLower.findIndex((h) =>
    ['year', 'release_year', 'releaseyear', 'released'].includes(h)
  );
  const dateHeaderIdx = firstRowLower.findIndex((h) =>
    [
      'watched_at',
      'watchedat',
      'watched_date',
      'watcheddate',
      'date',
      'completed_at',
      'completed_date',
    ].includes(h)
  );
  const ratingHeaderIdx = firstRowLower.findIndex((h) =>
    ['rating', 'personal_rating', 'score', 'my_rating', 'user_rating'].includes(
      h
    )
  );
  const notesHeaderIdx = firstRowLower.findIndex((h) =>
    ['notes', 'review', 'review_notes', 'personal_notes', 'comment'].includes(h)
  );
  const seasonHeaderIdx = firstRowLower.findIndex((h) =>
    ['season', 'season_number'].includes(h)
  );
  const episodeHeaderIdx = firstRowLower.findIndex((h) =>
    ['episode', 'episodes', 'episode_number'].includes(h)
  );

  const hasHeader = titleHeaderIdx !== -1 || typeHeaderIdx !== -1 || yearHeaderIdx !== -1;
  const startRow = hasHeader ? 1 : 0;
  const effectiveTitleCol = titleHeaderIdx !== -1 ? titleHeaderIdx : 0;

  const items: ExtractedImportItem[] = [];

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const rawTitleCell = row[effectiveTitleCol] || '';
    if (!rawTitleCell) continue;

    const baseParsed = parseSingleTextLine(rawTitleCell, i) || {
      id: `csv-${i}-${Date.now()}`,
      rawLine: row.join(', '),
      title: rawTitleCell.trim(),
    };

    const explicitType =
      typeHeaderIdx !== -1 ? parseMediaTypeToken(row[typeHeaderIdx]) : undefined;
    const rawYear =
      yearHeaderIdx !== -1 ? parseInt(row[yearHeaderIdx], 10) : NaN;
    const explicitYear =
      Number.isInteger(rawYear) && rawYear >= 1888 && rawYear <= 2035
        ? rawYear
        : undefined;
    const explicitDate =
      dateHeaderIdx !== -1
        ? normalizeDateString(row[dateHeaderIdx])
        : undefined;
    const rawRating =
      ratingHeaderIdx !== -1 ? parseFloat(row[ratingHeaderIdx]) : NaN;
    const explicitRating =
      Number.isFinite(rawRating) && rawRating >= 1 && rawRating <= 10
        ? Math.round(rawRating)
        : undefined;
    const explicitNotes =
      notesHeaderIdx !== -1 && row[notesHeaderIdx]
        ? row[notesHeaderIdx].trim()
        : undefined;
    const rawSeason =
      seasonHeaderIdx !== -1 ? parseInt(row[seasonHeaderIdx], 10) : NaN;
    const explicitSeason =
      Number.isInteger(rawSeason) && rawSeason >= 1 && rawSeason <= 100
        ? rawSeason
        : undefined;
    const rawEp =
      episodeHeaderIdx !== -1 ? parseInt(row[episodeHeaderIdx], 10) : NaN;
    const explicitEpisodes =
      Number.isInteger(rawEp) && rawEp >= 1 && rawEp <= 2000
        ? [rawEp]
        : undefined;

    items.push({
      ...baseParsed,
      rawLine: row.join(' · '),
      mediaTypeHint: explicitType || baseParsed.mediaTypeHint,
      yearHint: explicitYear || baseParsed.yearHint,
      watchedAtHint: explicitDate || baseParsed.watchedAtHint,
      personalRatingHint: explicitRating || baseParsed.personalRatingHint,
      notesHint: explicitNotes || baseParsed.notesHint,
      seasonNumber: explicitSeason || baseParsed.seasonNumber,
      episodeNumbers: explicitEpisodes || baseParsed.episodeNumbers,
    });
  }

  if (items.length === 0) {
    return {
      items: [],
      error:
        'Could not extract any valid movie or TV series titles from this CSV file.',
    };
  }

  return { items, error: null };
}

export function parseJsonImportFile(jsonContent: string): {
  items: ExtractedImportItem[];
  error: string | null;
} {
  const trimmed = String(jsonContent || '').trim();
  if (!trimmed) {
    return { items: [], error: 'The selected JSON file is empty.' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err: any) {
    return {
      items: [],
      error: `Invalid JSON format: ${
        err?.message || 'Could not parse JSON syntax.'
      }`,
    };
  }

  let rawList: any[] = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const candidateArray =
      parsed.items ||
      parsed.completed ||
      parsed.watchlist ||
      parsed.history ||
      parsed.titles ||
      parsed.movies ||
      parsed.series ||
      parsed.data;
    if (Array.isArray(candidateArray)) {
      rawList = candidateArray;
    } else {
      return {
        items: [],
        error:
          'JSON file must contain an array of titles or an object with an "items", "completed", "watchlist", or "titles" array.',
      };
    }
  } else {
    return {
      items: [],
      error: 'Unsupported JSON structure. Expected a list of titles or objects.',
    };
  }

  const items: ExtractedImportItem[] = [];

  rawList.forEach((entry, idx) => {
    if (typeof entry === 'string') {
      const parsedLine = parseSingleTextLine(entry, idx);
      if (parsedLine) items.push(parsedLine);
      return;
    }

    if (entry && typeof entry === 'object') {
      const snapshot = entry.mediaSnapshot || entry.media_snapshot || {};
      const rawTitle = String(
        entry.title ||
          entry.name ||
          entry.movie ||
          entry.series ||
          snapshot.title ||
          ''
      ).trim();

      if (!rawTitle) return;

      const base = parseSingleTextLine(rawTitle, idx) || {
        id: `json-${idx}-${Date.now()}`,
        rawLine: rawTitle,
        title: rawTitle,
      };

      const explicitType = parseMediaTypeToken(
        entry.type ||
          entry.mediaType ||
          entry.media_type ||
          snapshot.type ||
          undefined
      );

      const rawYear = Number(
        entry.year || entry.releaseYear || entry.release_year || snapshot.year
      );
      const explicitYear =
        Number.isInteger(rawYear) && rawYear >= 1888 && rawYear <= 2035
          ? rawYear
          : undefined;

      const explicitDate = normalizeDateString(
        entry.watchedAt ||
          entry.watched_at ||
          entry.watchedDate ||
          entry.date ||
          entry.addedAt ||
          entry.added_at
      );

      const rawRating = Number(
        entry.personalRating ||
          entry.personal_rating ||
          entry.rating ||
          entry.score
      );
      const explicitRating =
        Number.isFinite(rawRating) && rawRating >= 1 && rawRating <= 10
          ? Math.round(rawRating)
          : undefined;

      const explicitNotes = String(
        entry.personalNotes ||
          entry.reviewNotes ||
          entry.review_notes ||
          entry.notes ||
          ''
      ).trim();

      const rawSeason = Number(entry.season || entry.seasonNumber || entry.season_number);
      const explicitSeason =
        Number.isInteger(rawSeason) && rawSeason >= 1 && rawSeason <= 100
          ? rawSeason
          : undefined;

      let explicitEpisodes: number[] | undefined;
      if (Array.isArray(entry.episodeNumbers || entry.episodes)) {
        const arr = (entry.episodeNumbers || entry.episodes)
          .map((n: unknown) => Number(n))
          .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 2000);
        if (arr.length > 0) explicitEpisodes = arr;
      } else if (Number.isInteger(Number(entry.episode || entry.episodeNumber))) {
        const epNum = Number(entry.episode || entry.episodeNumber);
        if (epNum >= 1 && epNum <= 2000) explicitEpisodes = [epNum];
      }

      items.push({
        id: `json-${idx}-${Date.now()}`,
        rawLine: `${rawTitle}${explicitYear ? ` (${explicitYear})` : ''}${
          explicitType ? ` [${explicitType.toUpperCase()}]` : ''
        }`,
        title: base.title,
        mediaTypeHint: explicitType || base.mediaTypeHint,
        yearHint: explicitYear || base.yearHint,
        seasonNumber: explicitSeason || base.seasonNumber,
        episodeNumbers: explicitEpisodes || base.episodeNumbers,
        watchedAtHint: explicitDate || base.watchedAtHint,
        personalRatingHint: explicitRating || base.personalRatingHint,
        notesHint: explicitNotes || base.notesHint,
      });
    }
  });

  if (items.length === 0) {
    return {
      items: [],
      error:
        'No valid movie or TV series entries were found in the JSON file.',
    };
  }

  return { items, error: null };
}

/**
 * Extracts completed movie and TV series titles from a screenshot locally in the browser
 * using Tesseract.js OCR and passes the extracted text through parseTextImportList().
 * Never uploads screenshot image data to any server.
 */
export async function extractTitlesFromImageFile(
  file: File,
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<{
  items: ExtractedImportItem[];
  error: string | null;
}> {
  const ocrResult = await extractTextFromImageWithOcr(file, onProgress);
  if (ocrResult.error || !ocrResult.rawText.trim()) {
    return {
      items: [],
      error:
        ocrResult.error ||
        'Could not read any movie or TV series titles from this screenshot. Please paste your list as text or upload a TXT/CSV file.',
    };
  }

  const parsed = parseTextImportList(ocrResult.rawText);
  if (parsed.error || parsed.items.length === 0) {
    return {
      items: [],
      error:
        'Text was detected in the screenshot, but no recognizable movie or TV titles could be parsed. Please paste your list as text or upload a TXT/CSV file.',
    };
  }

  return {
    items: parsed.items.map((item, idx) => ({
      ...item,
      id: `ocr-${idx}-${Date.now()}`,
    })),
    error: null,
  };
}

export async function parseImportFile(
  file: File,
  onOcrProgress?: (update: OcrProgressUpdate) => void
): Promise<{
  items: ExtractedImportItem[];
  error: string | null;
}> {
  const validation = validateImportFile(file);
  if (!validation.valid || !validation.kind) {
    return { items: [], error: validation.error || 'Invalid file.' };
  }

  if (validation.kind === 'image') {
    return extractTitlesFromImageFile(file, onOcrProgress);
  }

  const textContent = await file.text();
  if (validation.kind === 'json') {
    return parseJsonImportFile(textContent);
  }
  if (validation.kind === 'csv') {
    return parseCsvImportFile(textContent);
  }
  return parseTextImportList(textContent);
}

// ============================================================================
// Deterministic TMDB & Catalog Title Matching
// ============================================================================

export function scoreMediaCandidate(
  item: ExtractedImportItem,
  candidate: MediaItem
): number {
  return scoreDeterministicCandidate(
    {
      title: item.title,
      normalizedTitle: item.normalizedTitle,
      alternateQueries: item.alternateQueries,
      mediaTypeHint: item.mediaTypeHint ?? null,
      yearHint: item.yearHint ?? null,
      inferredTypeHint: item.inferredMediaTypeHint ?? null,
      inferredYearHint: item.inferredYearHint ?? null,
      confidence: item.matchConfidence,
      isAmbiguous: item.isAmbiguousHint,
    },
    candidate
  );
}

function findAccountMatch(
  media: MediaItem,
  watchlist: WatchlistEntry[],
  watchHistory: WatchHistoryEntry[]
): {
  existingState: ExistingAccountState;
  existingWatchlistEntry?: WatchlistEntry;
  existingHistoryEntry?: WatchHistoryEntry;
} {
  const targetKey = getCanonicalMediaKey(media);

  const existingWatchlistEntry = watchlist.find((w) => {
    if (w.mediaId === media.id) return true;
    const wSnapshot = w.mediaSnapshot;
    if (wSnapshot && getCanonicalMediaKey(wSnapshot) === targetKey) return true;
    const wIdCanonical = extractCanonicalTmdbIdentity(
      w.mediaId,
      w.mediaType || 'movie'
    );
    const mCanonical = extractCanonicalTmdbIdentity(media.id, media.type);
    if (
      wIdCanonical &&
      mCanonical &&
      wIdCanonical.mediaType === mCanonical.mediaType &&
      wIdCanonical.tmdbId === mCanonical.tmdbId
    ) {
      return true;
    }
    return false;
  });

  const existingHistoryEntry = watchHistory.find((h) => {
    if (h.mediaId === media.id) return true;
    if (h.mediaSnapshot && getCanonicalMediaKey(h.mediaSnapshot) === targetKey) {
      return true;
    }
    const hCanonical = extractCanonicalTmdbIdentity(h.mediaId, h.mediaType);
    const mCanonical = extractCanonicalTmdbIdentity(media.id, media.type);
    if (
      hCanonical &&
      mCanonical &&
      hCanonical.mediaType === mCanonical.mediaType &&
      hCanonical.tmdbId === mCanonical.tmdbId
    ) {
      return true;
    }
    return false;
  });

  if (
    existingWatchlistEntry?.status === 'completed' &&
    existingHistoryEntry
  ) {
    return {
      existingState: 'already_completed',
      existingWatchlistEntry,
      existingHistoryEntry,
    };
  }

  if (existingWatchlistEntry || existingHistoryEntry) {
    return {
      existingState: 'upgrade_to_completed',
      existingWatchlistEntry,
      existingHistoryEntry,
    };
  }

  return { existingState: 'none' };
}

export async function resolveExtractedImportItems(params: {
  extractedItems: ExtractedImportItem[];
  allMedia: MediaItem[];
  watchlist: WatchlistEntry[];
  watchHistory: WatchHistoryEntry[];
  defaultWatchedDate: string;
  onProgress?: (resolvedCount: number, totalCount: number) => void;
}): Promise<ResolvedImportRow[]> {
  const {
    extractedItems,
    allMedia,
    watchlist,
    watchHistory,
    defaultWatchedDate,
    onProgress,
  } = params;

  // Deduplicate identical extracted rows within the same import batch
  const dedupedExtracted: ExtractedImportItem[] = [];
  const seenKeys = new Set<string>();
  for (const item of extractedItems) {
    const key = `${normalizeMediaTitle(item.title)}|${
      item.mediaTypeHint || 'any'
    }|${item.yearHint || 'any'}`;
    if (!normalizeMediaTitle(item.title) || seenKeys.has(key)) continue;
    seenKeys.add(key);
    dedupedExtracted.push({ ...item });
  }

  // Step 1: Deterministic batch title normalization & alias expansion (zero external AI calls)
  const deterministicBatch = resolveDeterministicTitlesBatch(
    dedupedExtracted.map((it) => ({
      rowId: it.id,
      title: it.title,
      mediaTypeHint: it.mediaTypeHint ?? null,
      yearHint: it.yearHint ?? null,
    }))
  );
  const deterministicByRowId = new Map(
    deterministicBatch.map((res) => [res.rowId, res])
  );

  const enrichedExtracted: ExtractedImportItem[] = dedupedExtracted.map(
    (item, idx) => {
      const resolved =
        deterministicByRowId.get(item.id) ||
        resolveDeterministicTitle(
          {
            rowId: item.id,
            title: item.title,
            mediaTypeHint: item.mediaTypeHint ?? null,
            yearHint: item.yearHint ?? null,
          },
          idx
        );

      return {
        ...item,
        normalizedTitle: resolved.normalizedTitle || item.title,
        alternateQueries: resolved.alternateQueries,
        inferredMediaTypeHint:
          resolved.mediaTypeHint === 'movie' || resolved.mediaTypeHint === 'tv'
            ? resolved.mediaTypeHint
            : undefined,
        inferredYearHint:
          typeof resolved.yearHint === 'number' && resolved.yearHint >= 1888
            ? resolved.yearHint
            : undefined,
        matchConfidence: resolved.confidence,
        smartMatched: resolved.smartMatched,
        isAmbiguousHint: resolved.isAmbiguous,
        ambiguityReasonHint: resolved.ambiguityReason,
      };
    }
  );

  const localPool = dedupeMediaItems([
    ...allMedia,
    ...MEDIA_ITEMS,
    ...EXTRA_ANCHOR_ITEMS,
    ...INDIAN_TRENDING_ITEMS,
  ]);

  const results: ResolvedImportRow[] = new Array(enrichedExtracted.length);
  let completedCount = 0;

  // Step 2: Resolve against TMDB & local catalog in bounded concurrency batches of 4
  const CONCURRENCY = 4;
  for (let start = 0; start < enrichedExtracted.length; start += CONCURRENCY) {
    const slice = enrichedExtracted.slice(start, start + CONCURRENCY);
    await Promise.all(
      slice.map(async (extracted, sliceIdx) => {
        const index = start + sliceIdx;

        // 1. Start with local catalog candidates
        let candidatePool = [...localPool];

        // 2. Build bounded TMDB search queries (normalizedTitle + original title + up to 1 alternate)
        const queriesToRun: string[] = [];
        const seenQueryLower = new Set<string>();
        const addSearchQuery = (q?: string) => {
          const clean = String(q || '').replace(/\s+/g, ' ').trim();
          if (!clean) return;
          const lower = clean.toLowerCase();
          if (seenQueryLower.has(lower)) return;
          seenQueryLower.add(lower);
          queriesToRun.push(clean);
        };

        if (extracted.normalizedTitle) {
          addSearchQuery(extracted.normalizedTitle);
        }
        addSearchQuery(extracted.title);
        for (const alt of extracted.alternateQueries || []) {
          if (queriesToRun.length >= 3) break;
          addSearchQuery(alt);
        }

        const effectiveTypeFilter = extracted.mediaTypeHint || 'all';

        try {
          const searchResponses = await Promise.all(
            queriesToRun.slice(0, 3).map((q) =>
              fetchCatalogue({
                query: q,
                type: effectiveTypeFilter,
              }).catch(() => null)
            )
          );

          const apiItems: MediaItem[] = [];
          for (const apiRes of searchResponses) {
            if (apiRes && Array.isArray(apiRes.items)) {
              apiItems.push(...apiRes.items.slice(0, 12));
            }
          }
          if (apiItems.length > 0) {
            candidatePool = dedupeMediaItems([...apiItems, ...candidatePool]);
          }
        } catch {
          // Fallback to localPool if offline
        }

        // Filter and score candidates deterministically
        const scored = candidatePool
          .map((media) => ({
            media,
            score: scoreMediaCandidate(extracted, media),
          }))
          .filter((entry) => entry.score >= 38)
          .sort((a, b) => b.score - a.score);

        const topCandidates = scored.slice(0, 6).map((s) => s.media);
        const best = scored[0];

        let matchStatus: ImportMatchStatus = 'unmatched';
        let matchReason: string | undefined;
        let selectedMedia: MediaItem | null = null;

        if (!best) {
          matchStatus = 'unmatched';
          matchReason = 'No matching movie or TV series found in TMDB.';
        } else {
          selectedMedia = best.media;
          const normQuery = normalizeMediaTitle(extracted.title);
          const normCanonical = extracted.normalizedTitle
            ? normalizeMediaTitle(extracted.normalizedTitle)
            : normQuery;
          const normBest = normalizeMediaTitle(best.media.title);
          const exactTitle =
            normQuery === normBest ||
            (normCanonical === normBest && (extracted.matchConfidence ?? 0) >= 0.75);

          const resolvedMeta =
            deterministicByRowId.get(extracted.id) ||
            resolveDeterministicTitle({
              rowId: extracted.id,
              title: extracted.title,
              mediaTypeHint: extracted.mediaTypeHint ?? null,
              yearHint: extracted.yearHint ?? null,
            });

          const ambiguityCheck = detectCandidateAmbiguity({
            rawTitle: extracted.title,
            resolved: resolvedMeta,
            explicitType: extracted.mediaTypeHint ?? null,
            explicitYear: extracted.yearHint ?? null,
            scoredCandidates: scored,
          });

          const smartTransformedTitle =
            extracted.title.trim().toLowerCase() !==
            best.media.title.trim().toLowerCase();

          if (ambiguityCheck.isAmbiguous) {
            matchStatus = 'ambiguous';
            matchReason =
              ambiguityCheck.reason ||
              'Multiple possible TMDB matches found — please confirm the exact title.';
          } else if (best.score >= 88 || (exactTitle && best.score >= 76)) {
            matchStatus = 'matched';
            if (smartTransformedTitle) {
              matchReason = `TMDB Smart Match resolved '${extracted.title}' to '${best.media.title}' (${best.media.year}).`;
            } else {
              matchReason = `TMDB verified '${best.media.title}' (${best.media.year}).`;
            }
          } else {
            matchStatus = 'ambiguous';
            matchReason = smartTransformedTitle
              ? `TMDB Smart Match suggested '${best.media.title}' for '${extracted.title}' — please confirm this match.`
              : 'Partial title similarity — please confirm this match.';
          }
        }

        const accountInfo = selectedMedia
          ? findAccountMatch(selectedMedia, watchlist, watchHistory)
          : { existingState: 'none' as ExistingAccountState };

        const existingWatchedDate = accountInfo.existingHistoryEntry?.watchedAt
          ? String(accountInfo.existingHistoryEntry.watchedAt).split('T')[0]
          : undefined;

        const initialDate =
          extracted.watchedAtHint ||
          existingWatchedDate ||
          defaultWatchedDate;

        const showSmartBadge = Boolean(
          selectedMedia &&
            (extracted.smartMatched ||
              (extracted.normalizedTitle &&
                extracted.normalizedTitle.toLowerCase() !==
                  extracted.title.toLowerCase()))
        );

        results[index] = {
          rowId: extracted.id,
          extracted,
          matchStatus,
          matchReason,
          smartMatched: showSmartBadge,
          normalizedTitle: extracted.normalizedTitle,
          selectedMedia,
          candidates: topCandidates,
          existingState: accountInfo.existingState,
          existingWatchlistEntry: accountInfo.existingWatchlistEntry,
          existingHistoryEntry: accountInfo.existingHistoryEntry,
          // Select high-confidence matches automatically; ambiguous rows stay unselected until user confirms
          selected: matchStatus === 'matched',
          watchedDateOverride: initialDate,
          hasExplicitDateOverride: Boolean(extracted.watchedAtHint),
        };

        completedCount++;
        onProgress?.(completedCount, enrichedExtracted.length);
      })
    );
  }

  return results;
}

export async function searchMediaForImportOverride(params: {
  query: string;
  typeFilter: 'all' | 'movie' | 'tv';
  allMedia: MediaItem[];
}): Promise<MediaItem[]> {
  const cleanQuery = params.query.trim();
  if (!cleanQuery) return [];

  const localPool = dedupeMediaItems([
    ...params.allMedia,
    ...MEDIA_ITEMS,
    ...EXTRA_ANCHOR_ITEMS,
    ...INDIAN_TRENDING_ITEMS,
  ]);

  let combined: MediaItem[] = [];
  try {
    const res = await executeSmartSearch({
      query: cleanQuery,
      typeFilter: params.typeFilter,
    });
    if (res.items && res.items.length > 0) {
      combined = [...res.items.slice(0, 12)];
    }
  } catch {
    // Offline fallback
  }

  const normQ = normalizeMediaTitle(cleanQuery);
  const localMatches = localPool.filter((m) => {
    if (params.typeFilter !== 'all' && m.type !== params.typeFilter) {
      return false;
    }
    return normalizeMediaTitle(m.title).includes(normQ);
  });

  return dedupeMediaItems([...combined, ...localMatches]).slice(0, 10);
}

export function recalculateRowAccountState(
  row: ResolvedImportRow,
  newMedia: MediaItem,
  watchlist: WatchlistEntry[],
  watchHistory: WatchHistoryEntry[],
  defaultWatchedDate: string
): ResolvedImportRow {
  const accountInfo = findAccountMatch(newMedia, watchlist, watchHistory);
  const existingWatchedDate = accountInfo.existingHistoryEntry?.watchedAt
    ? String(accountInfo.existingHistoryEntry.watchedAt).split('T')[0]
    : undefined;

  const nextCandidates = dedupeMediaItems([newMedia, ...row.candidates]).slice(
    0,
    6
  );

  return {
    ...row,
    selectedMedia: newMedia,
    candidates: nextCandidates,
    matchStatus: 'matched',
    matchReason: undefined,
    existingState: accountInfo.existingState,
    existingWatchlistEntry: accountInfo.existingWatchlistEntry,
    existingHistoryEntry: accountInfo.existingHistoryEntry,
    selected: true,
    watchedDateOverride: row.hasExplicitDateOverride
      ? row.watchedDateOverride
      : row.extracted.watchedAtHint ||
        existingWatchedDate ||
        defaultWatchedDate,
  };
}

// ============================================================================
// Idempotent Supabase Persistence Engine
// ============================================================================

export async function executeCompletedImport(params: {
  userId: string;
  rows: ResolvedImportRow[];
  watchlist: WatchlistEntry[];
  watchHistory: WatchHistoryEntry[];
  defaultWatchedDate: string;
  onlyRowIds?: Set<string>;
  onProgress?: (processedCount: number, totalToProcess: number) => void;
}): Promise<ImportExecutionResult> {
  const {
    userId,
    rows,
    watchlist,
    watchHistory,
    defaultWatchedDate,
    onlyRowIds,
    onProgress,
  } = params;

  let importedNewCount = 0;
  let updatedExistingCount = 0;
  let skippedCount = 0;
  let unmatchedCount = 0;
  const failedItems: ImportFailedItem[] = [];
  const savedWatchlistEntries: WatchlistEntry[] = [];
  const savedHistoryEntries: WatchHistoryEntry[] = [];
  const savedEpisodeEntries: WatchedEpisodeEntry[] = [];
  const newlyDiscoveredMedia: MediaItem[] = [];
  let migrationNeeded = false;

  // Count unmatched and skipped rows when running a full import
  if (!onlyRowIds) {
    for (const row of rows) {
      if (!row.selectedMedia || row.matchStatus === 'unmatched') {
        unmatchedCount++;
      } else if (!row.selected) {
        skippedCount++;
      }
    }
  }

  const actionableRows = rows.filter((row) => {
    if (onlyRowIds) {
      return onlyRowIds.has(row.rowId) && Boolean(row.selectedMedia);
    }
    return row.selected && Boolean(row.selectedMedia);
  });

  // Deduplicate by canonical media key so if two rows resolved to the same TMDB item, we only write once
  const uniqueActionable: ResolvedImportRow[] = [];
  const seenCanonical = new Set<string>();
  for (const row of actionableRows) {
    if (!row.selectedMedia) continue;
    const key = getCanonicalMediaKey(row.selectedMedia);
    if (seenCanonical.has(key)) continue;
    seenCanonical.add(key);
    uniqueActionable.push(row);
  }

  let processed = 0;

  for (const row of uniqueActionable) {
    const media = row.selectedMedia!;
    const accountInfo = findAccountMatch(media, watchlist, watchHistory);
    const existingWl = accountInfo.existingWatchlistEntry;
    const existingHist = accountInfo.existingHistoryEntry;
    const wasAlreadyInAccount = Boolean(existingWl || existingHist);

    // Use existing mediaId if present in user's account to prevent duplicate seed vs tmdb-* records
    const canonicalMediaId =
      existingWl?.mediaId || existingHist?.mediaId || media.id;
    const canonicalIdentity = extractCanonicalTmdbIdentity(
      canonicalMediaId,
      media.type
    );
    const tmdbId = canonicalIdentity?.tmdbId;

    // Preserve existing rating, notes, favourite flag, and addedAt
    const mergedRating =
      existingWl?.personalRating && existingWl.personalRating >= 1
        ? existingWl.personalRating
        : existingHist?.personalRating && existingHist.personalRating >= 1
        ? existingHist.personalRating
        : row.extracted.personalRatingHint;

    const mergedNotes =
      existingWl?.personalNotes?.trim() ||
      existingHist?.reviewNotes?.trim() ||
      row.extracted.notesHint ||
      '';

    const mergedFavourite = Boolean(existingWl?.isFavourite);
    const mergedAddedAt =
      existingWl?.addedAt || new Date().toISOString().split('T')[0];

    // Determine watchedAt timestamp:
    // - If import or user explicitly supplied a date override, use it.
    // - Else if an existing history entry already has a watchedAt timestamp, preserve it.
    // - Otherwise use the selected defaultWatchedDate (today by default).
    let targetWatchedAt: string;
    if (row.hasExplicitDateOverride && row.watchedDateOverride) {
      targetWatchedAt = `${row.watchedDateOverride}T12:00:00.000Z`;
    } else if (row.extracted.watchedAtHint) {
      targetWatchedAt = `${row.extracted.watchedAtHint}T12:00:00.000Z`;
    } else if (existingHist?.watchedAt) {
      targetWatchedAt = existingHist.watchedAt;
    } else {
      const fallbackDate = row.watchedDateOverride || defaultWatchedDate || getTodayDateIso();
      targetWatchedAt = `${fallbackDate}T12:00:00.000Z`;
    }

    const mediaSnapshot: MediaItem = {
      ...media,
      id: canonicalMediaId,
    };

    // 1. Upsert into watchlist_items with status = 'completed'
    const wlRes = await upsertWatchlistItem(userId, {
      id: existingWl?.id,
      mediaId: canonicalMediaId,
      tmdbId,
      mediaType: media.type,
      status: 'completed',
      isFavourite: mergedFavourite,
      addedAt: mergedAddedAt,
      personalRating: mergedRating,
      personalNotes: mergedNotes,
      mediaSnapshot,
    });

    if (wlRes.migrationNeeded) {
      migrationNeeded = true;
    }

    if (wlRes.error || !wlRes.item) {
      failedItems.push({
        rowId: row.rowId,
        title: media.title,
        error: wlRes.error || 'Failed to save to watchlist_items.',
      });
      processed++;
      onProgress?.(processed, uniqueActionable.length);
      continue;
    }

    // 2. Upsert into watch_history
    const histRes = await upsertWatchHistoryItem(userId, {
      mediaId: canonicalMediaId,
      media: mediaSnapshot,
      watchedAt: targetWatchedAt,
      personalRating: mergedRating,
      reviewNotes: mergedNotes,
    });

    if (histRes.error || !histRes.entry) {
      failedItems.push({
        rowId: row.rowId,
        title: media.title,
        error: histRes.error || 'Failed to save to watch_history.',
      });
      processed++;
      onProgress?.(processed, uniqueActionable.length);
      continue;
    }

    // 3. Optional: ONLY if explicit season/episode numbers were provided for a TV series, sync those episodes
    if (
      media.type === 'tv' &&
      row.extracted.seasonNumber &&
      row.extracted.episodeNumbers &&
      row.extracted.episodeNumbers.length > 0
    ) {
      const epRes = await setSeasonEpisodesWatchedInDb(
        userId,
        canonicalMediaId,
        row.extracted.seasonNumber,
        row.extracted.episodeNumbers,
        true
      );
      if (epRes.migrationNeeded) {
        migrationNeeded = true;
      }
      if (epRes.entries && epRes.entries.length > 0) {
        savedEpisodeEntries.push(...epRes.entries);
      }
    }

    savedWatchlistEntries.push(wlRes.item);
    savedHistoryEntries.push(histRes.entry);
    newlyDiscoveredMedia.push(mediaSnapshot);

    if (wasAlreadyInAccount) {
      updatedExistingCount++;
    } else {
      importedNewCount++;
    }

    processed++;
    onProgress?.(processed, uniqueActionable.length);
  }

  return {
    importedNewCount,
    updatedExistingCount,
    skippedCount,
    unmatchedCount,
    failedItems,
    savedWatchlistEntries,
    savedHistoryEntries,
    savedEpisodeEntries,
    newlyDiscoveredMedia,
    migrationNeeded,
  };
}

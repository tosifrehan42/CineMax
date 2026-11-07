import { GoogleGenAI, Type } from '@google/genai';

export interface TitleResolutionInputItem {
  rowId?: string;
  title: string;
  mediaTypeHint?: 'movie' | 'tv' | null;
  yearHint?: number | null;
}

export interface ResolvedTitleItem {
  rowId: string;
  originalQuery: string;
  originalTitle: string;
  normalizedTitle: string;
  alternateQueries: string[];
  mediaTypeHint: 'movie' | 'tv' | null;
  yearHint: number | null;
  confidence: number;
  aiAssisted: boolean;
  isAmbiguous?: boolean;
}

export interface TitleResolutionRequestBody {
  query?: string;
  mediaTypeHint?: 'movie' | 'tv' | null;
  yearHint?: number | null;
  items?: TitleResolutionInputItem[];
  bypassGemini?: boolean;
}

export interface TitleResolutionResponseBody {
  items: ResolvedTitleItem[];
  single?: ResolvedTitleItem;
  provider: 'gemini' | 'fallback';
  aiAvailable: boolean;
  warning?: string;
}

export const MAX_TITLES_PER_REQUEST = 50;
export const MAX_TITLE_LENGTH = 200;
const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
const FALLBACK_GEMINI_MODEL = 'gemini-3.7-flash';
const GEMINI_TOTAL_BUDGET_MS = 22000;
const GEMINI_ATTEMPT_TIMEOUT_MS = 8500;
const MIN_REMAINING_BUDGET_MS = 1500;
const BACKOFF_BASE_DELAY_MS = 500;
const BACKOFF_JITTER_MS = 350;
const RESOLUTION_CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes
const MAX_CACHE_ENTRIES = 1000;

interface SafeGeminiErrorDetails {
  name: string;
  message: string;
  status?: number;
  code?: string | number;
}

function extractSafeGeminiErrorDetails(
  err: any,
  geminiApiKey: string
): SafeGeminiErrorDetails {
  const errorName =
    typeof err?.name === 'string' && err.name.trim() ? err.name.trim() : 'Error';
  const rawMessage =
    typeof err?.message === 'string'
      ? err.message
      : String(err ?? 'Unknown Gemini API error');
  const safeMessage = (
    geminiApiKey ? rawMessage.split(geminiApiKey).join('[REDACTED]') : rawMessage
  )
    .replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED]');

  const httpStatus =
    typeof err?.status === 'number'
      ? err.status
      : typeof err?.statusCode === 'number'
      ? err.statusCode
      : typeof err?.response?.status === 'number'
      ? err.response.status
      : typeof err?.error?.code === 'number'
      ? err.error.code
      : undefined;

  const errorCode =
    typeof err?.code === 'string' || typeof err?.code === 'number'
      ? err.code
      : typeof err?.error?.status === 'string'
      ? err.error.status
      : typeof err?.error?.code === 'string' || typeof err?.error?.code === 'number'
      ? err.error.code
      : undefined;

  return {
    name: errorName,
    message: safeMessage,
    ...(httpStatus !== undefined ? { status: httpStatus } : {}),
    ...(errorCode !== undefined ? { code: errorCode } : {}),
  };
}

function isNonRetryableGeminiError(err: any): boolean {
  const status =
    typeof err?.status === 'number'
      ? err.status
      : typeof err?.statusCode === 'number'
      ? err.statusCode
      : typeof err?.response?.status === 'number'
      ? err.response.status
      : typeof err?.error?.code === 'number'
      ? err.error.code
      : undefined;

  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 422 ||
    status === 429
  ) {
    return true;
  }

  const codeStr = String(
    err?.code ?? err?.error?.status ?? err?.error?.code ?? ''
  ).toUpperCase();
  if (
    codeStr === 'INVALID_ARGUMENT' ||
    codeStr === 'UNAUTHENTICATED' ||
    codeStr === 'PERMISSION_DENIED' ||
    codeStr === 'NOT_FOUND' ||
    codeStr === 'RESOURCE_EXHAUSTED' ||
    codeStr === 'API_KEY_INVALID'
  ) {
    return true;
  }

  const msg = String(err?.message ?? '');
  return /\b(400|401|403|429)\b|INVALID_ARGUMENT|UNAUTHENTICATED|PERMISSION_DENIED|API_KEY_INVALID|RESOURCE_EXHAUSTED|quota|invalid api key/i.test(
    msg
  );
}

function isHttp503UnavailableError(err: any): boolean {
  if (isNonRetryableGeminiError(err)) {
    return false;
  }

  const status =
    typeof err?.status === 'number'
      ? err.status
      : typeof err?.statusCode === 'number'
      ? err.statusCode
      : typeof err?.response?.status === 'number'
      ? err.response.status
      : typeof err?.error?.code === 'number'
      ? err.error.code
      : undefined;

  if (status === 503) {
    return true;
  }

  const codeStr = String(
    err?.code ?? err?.error?.status ?? err?.error?.code ?? ''
  ).toUpperCase();
  if (codeStr === '503' || codeStr === 'UNAVAILABLE') {
    return true;
  }

  const msg = String(err?.message ?? '');
  return /\b503\b|UNAVAILABLE|high demand|overloaded|service unavailable/i.test(msg);
}

function computeBackoffWithJitterMs(attemptIndex: number): number {
  const exponentialDelay = BACKOFF_BASE_DELAY_MS * Math.pow(2, attemptIndex);
  const jitter = Math.floor(Math.random() * BACKOFF_JITTER_MS);
  return exponentialDelay + jitter;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CacheEntry {
  timestamp: number;
  value: ResolvedTitleItem;
}

const resolutionCache = new Map<string, CacheEntry>();

function buildCacheKey(item: {
  title: string;
  mediaTypeHint?: 'movie' | 'tv' | null;
  yearHint?: number | null;
}): string {
  const norm = item.title
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const typePart = item.mediaTypeHint || 'any';
  const yearPart = item.yearHint ? String(item.yearHint) : 'any';
  return `${norm}|${typePart}|${yearPart}`;
}

function getCachedResolution(key: string): ResolvedTitleItem | null {
  const entry = resolutionCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > RESOLUTION_CACHE_TTL_MS) {
    resolutionCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedResolution(key: string, value: ResolvedTitleItem): void {
  if (resolutionCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = resolutionCache.keys().next().value;
    if (oldestKey) {
      resolutionCache.delete(oldestKey);
    }
  }
  resolutionCache.set(key, {
    timestamp: Date.now(),
    value,
  });
}

export function clearTitleResolutionCache(): void {
  resolutionCache.clear();
}

/**
 * Curated canonical title knowledge base used both to ground deterministic fallback
 * when GEMINI_API_KEY is unconfigured/offline and to guarantee zero-latency accuracy
 * for common franchise shorthands.
 */
interface CanonicalRule {
  pattern: RegExp;
  normalizedTitle: string;
  alternateQueries: string[];
  mediaTypeHint: 'movie' | 'tv' | null;
  yearHint: number | null;
  confidence: number;
  isAmbiguous?: boolean;
}

const CANONICAL_SHORTHAND_RULES: CanonicalRule[] = [
  {
    pattern: /^john\s*wick\s*(?:chapter\s*)?(?:3|iii)(?:\s*parabellum)?$/i,
    normalizedTitle: 'John Wick: Chapter 3 – Parabellum',
    alternateQueries: [
      'John Wick: Chapter 3 – Parabellum',
      'John Wick Chapter 3',
      'John Wick 3',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2019,
    confidence: 0.97,
  },
  {
    pattern: /^john\s*wick\s*(?:chapter\s*)?(?:2|ii)$/i,
    normalizedTitle: 'John Wick: Chapter 2',
    alternateQueries: ['John Wick: Chapter 2', 'John Wick Chapter 2', 'John Wick 2'],
    mediaTypeHint: 'movie',
    yearHint: 2017,
    confidence: 0.96,
  },
  {
    pattern: /^john\s*wick\s*(?:chapter\s*)?(?:4|iv)$/i,
    normalizedTitle: 'John Wick: Chapter 4',
    alternateQueries: ['John Wick: Chapter 4', 'John Wick Chapter 4', 'John Wick 4'],
    mediaTypeHint: 'movie',
    yearHint: 2023,
    confidence: 0.97,
  },
  {
    pattern: /^(?:the\s+)?dark\s*knight$/i,
    normalizedTitle: 'The Dark Knight',
    alternateQueries: ['The Dark Knight', 'Dark Knight'],
    mediaTypeHint: 'movie',
    yearHint: 2008,
    confidence: 0.96,
  },
  {
    pattern: /^(?:the\s+)?dark\s*knight\s*rises$/i,
    normalizedTitle: 'The Dark Knight Rises',
    alternateQueries: ['The Dark Knight Rises', 'Dark Knight Rises'],
    mediaTypeHint: 'movie',
    yearHint: 2012,
    confidence: 0.96,
  },
  {
    pattern: /^spider[\s-]*man[\s:]*no\s*way\s*home$/i,
    normalizedTitle: 'Spider-Man: No Way Home',
    alternateQueries: [
      'Spider-Man: No Way Home',
      'Spider Man No Way Home',
      'Spider-Man No Way Home',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2021,
    confidence: 0.97,
  },
  {
    pattern: /^spider[\s-]*man[\s:]*into\s*(?:the\s*)?spider[\s-]*verse$/i,
    normalizedTitle: 'Spider-Man: Into the Spider-Verse',
    alternateQueries: [
      'Spider-Man: Into the Spider-Verse',
      'Spider Man Into the Spider Verse',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2018,
    confidence: 0.96,
  },
  {
    pattern: /^spider[\s-]*man[\s:]*across\s*(?:the\s*)?spider[\s-]*verse$/i,
    normalizedTitle: 'Spider-Man: Across the Spider-Verse',
    alternateQueries: [
      'Spider-Man: Across the Spider-Verse',
      'Spider Man Across the Spider Verse',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2023,
    confidence: 0.96,
  },
  {
    pattern: /^(?:the\s+)?avengers[\s:]*end\s*game$/i,
    normalizedTitle: 'Avengers: Endgame',
    alternateQueries: ['Avengers: Endgame', 'Avengers Endgame'],
    mediaTypeHint: 'movie',
    yearHint: 2019,
    confidence: 0.97,
  },
  {
    pattern: /^(?:the\s+)?avengers[\s:]*infinity\s*war$/i,
    normalizedTitle: 'Avengers: Infinity War',
    alternateQueries: ['Avengers: Infinity War', 'Avengers Infinity War'],
    mediaTypeHint: 'movie',
    yearHint: 2018,
    confidence: 0.97,
  },
  {
    pattern: /^interstellar$/i,
    normalizedTitle: 'Interstellar',
    alternateQueries: ['Interstellar'],
    mediaTypeHint: 'movie',
    yearHint: 2014,
    confidence: 0.98,
  },
  {
    pattern: /^breaking\s*bad$/i,
    normalizedTitle: 'Breaking Bad',
    alternateQueries: ['Breaking Bad'],
    mediaTypeHint: 'tv',
    yearHint: 2008,
    confidence: 0.98,
  },
  {
    pattern: /^dune\s*(?:part\s*)?(?:2|ii|two)$/i,
    normalizedTitle: 'Dune: Part Two',
    alternateQueries: ['Dune: Part Two', 'Dune Part Two', 'Dune 2'],
    mediaTypeHint: 'movie',
    yearHint: 2024,
    confidence: 0.96,
  },
  {
    pattern: /^dune\s*(?:part\s*)?(?:1|i|one)$/i,
    normalizedTitle: 'Dune: Part One',
    alternateQueries: ['Dune: Part One', 'Dune', 'Dune 2021'],
    mediaTypeHint: 'movie',
    yearHint: 2021,
    confidence: 0.95,
  },
  {
    pattern: /^(?:the\s+)?office$/i,
    normalizedTitle: 'The Office',
    alternateQueries: ['The Office', 'The Office US', 'The Office UK'],
    mediaTypeHint: 'tv',
    yearHint: null,
    confidence: 0.65,
    isAmbiguous: true,
  },
];

function sanitizeTitleInput(raw: string): string {
  return String(raw || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
}

function deduplicateStringsCaseInsensitive(list: string[], maxCount = 4): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const clean = sanitizeTitleInput(raw);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= maxCount) break;
  }
  return out;
}

/**
 * Deterministic fallback normalization used when Gemini API is unavailable,
 * unconfigured, or times out, and as a sanity guard on model outputs.
 */
export function buildFallbackTitleResolution(
  input: TitleResolutionInputItem,
  index: number,
  markAiAssistedIfRuleMatched = false
): ResolvedTitleItem {
  const rowId = String(input.rowId || `row-${index}`);
  const cleanOriginal = sanitizeTitleInput(input.title);
  const inputType =
    input.mediaTypeHint === 'movie' || input.mediaTypeHint === 'tv'
      ? input.mediaTypeHint
      : null;
  const inputYear =
    typeof input.yearHint === 'number' &&
    Number.isInteger(input.yearHint) &&
    input.yearHint >= 1888 &&
    input.yearHint <= 2035
      ? input.yearHint
      : null;

  // Strip inline year if present in the title string for rule matching
  let titleForRule = cleanOriginal;
  let extractedInlineYear: number | null = null;
  const yearMatch = titleForRule.match(/[\[(]?\b((?:19|20)\d{2})\b[\])]?\s*$/);
  if (
    yearMatch &&
    titleForRule.slice(0, yearMatch.index).trim().length >= 2 &&
    !/\bblade\s+runner$/i.test(titleForRule.slice(0, yearMatch.index).trim())
  ) {
    extractedInlineYear = parseInt(yearMatch[1], 10);
    titleForRule = titleForRule.slice(0, yearMatch.index).trim();
  }

  const cleanRuleTarget = titleForRule
    .replace(/[-–—:/.,!?&()+"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const rule of CANONICAL_SHORTHAND_RULES) {
    if (rule.pattern.test(titleForRule) || rule.pattern.test(cleanRuleTarget)) {
      const effectiveType = inputType || rule.mediaTypeHint;
      const effectiveYear = inputYear ?? extractedInlineYear ?? rule.yearHint;
      const isAmbiguous = Boolean(rule.isAmbiguous && !inputYear && !extractedInlineYear);

      return {
        rowId,
        originalQuery: cleanOriginal,
        originalTitle: cleanOriginal,
        normalizedTitle: rule.normalizedTitle,
        alternateQueries: deduplicateStringsCaseInsensitive([
          rule.normalizedTitle,
          ...rule.alternateQueries,
          cleanOriginal,
        ]),
        mediaTypeHint: effectiveType,
        yearHint: isAmbiguous ? null : effectiveYear,
        confidence: isAmbiguous ? 0.65 : rule.confidence,
        aiAssisted: markAiAssistedIfRuleMatched,
        isAmbiguous,
      };
    }
  }

  // Generic heuristic cleanup (e.g. Spider Man -> Spider-Man, Chapter X formatting)
  let heuristicNormalized = titleForRule
    .replace(/\bspider\s+man\b/gi, 'Spider-Man')
    .replace(/\bx\s+men\b/gi, 'X-Men')
    .replace(/\bmission\s+impossible\b/gi, 'Mission: Impossible')
    .trim();

  const alternates = deduplicateStringsCaseInsensitive([
    heuristicNormalized,
    cleanOriginal,
    cleanRuleTarget,
  ]);

  return {
    rowId,
    originalQuery: cleanOriginal,
    originalTitle: cleanOriginal,
    normalizedTitle: heuristicNormalized || cleanOriginal,
    alternateQueries: alternates.length > 0 ? alternates : [cleanOriginal],
    mediaTypeHint: inputType,
    yearHint: inputYear ?? extractedInlineYear,
    confidence: heuristicNormalized.toLowerCase() !== cleanOriginal.toLowerCase() ? 0.78 : 0.6,
    aiAssisted: false,
    isAmbiguous: false,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Gemini title resolution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

const TITLE_RESOLUTION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          rowId: {
            type: Type.STRING,
            description: 'The exact rowId from the input item.',
          },
          originalTitle: {
            type: Type.STRING,
            description: 'The original input title.',
          },
          normalizedTitle: {
            type: Type.STRING,
            description: 'The canonical TMDB release title.',
          },
          alternateQueries: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Up to 3 search queries to try on TMDB.',
          },
          mediaTypeHint: {
            type: Type.STRING,
            description: '"movie", "tv", or "unknown".',
          },
          yearHint: {
            type: Type.INTEGER,
            description: 'Release year if unambiguously known, else 0.',
          },
          confidence: {
            type: Type.NUMBER,
            description: 'Confidence score from 0.0 to 1.0.',
          },
          isAmbiguous: {
            type: Type.BOOLEAN,
            description:
              'True if multiple distinct adaptations/remakes share this exact title and no year was specified.',
          },
        },
        required: [
          'rowId',
          'originalTitle',
          'normalizedTitle',
          'alternateQueries',
          'confidence',
        ],
      },
    },
  },
  required: ['items'],
};

async function generateTitleResolutionWithRetryAndFallback(
  ai: GoogleGenAI,
  promptText: string,
  geminiApiKey: string
) {
  const startTime = Date.now();
  const getRemainingBudgetMs = () =>
    Math.max(0, GEMINI_TOTAL_BUDGET_MS - (Date.now() - startTime));

  const invokeModel = (model: string) => {
    const remainingMs = getRemainingBudgetMs();
    if (remainingMs < MIN_REMAINING_BUDGET_MS) {
      throw new Error(
        `Gemini title resolution time budget exhausted (${GEMINI_TOTAL_BUDGET_MS}ms)`
      );
    }
    const attemptTimeoutMs = Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, remainingMs);
    return withTimeout(
      ai.models.generateContent({
        model,
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: TITLE_RESOLUTION_RESPONSE_SCHEMA,
        },
      }),
      attemptTimeoutMs
    );
  };

  try {
    return await invokeModel(PRIMARY_GEMINI_MODEL);
  } catch (primaryErr: any) {
    if (isNonRetryableGeminiError(primaryErr)) {
      throw primaryErr;
    }

    if (isHttp503UnavailableError(primaryErr)) {
      const backoffMs = computeBackoffWithJitterMs(0);
      console.error(
        `[TitleResolutionService] ${PRIMARY_GEMINI_MODEL} returned HTTP 503; retrying once after ${backoffMs}ms:`,
        extractSafeGeminiErrorDetails(primaryErr, geminiApiKey)
      );

      if (getRemainingBudgetMs() > backoffMs + MIN_REMAINING_BUDGET_MS) {
        await delay(backoffMs);
      }

      try {
        return await invokeModel(PRIMARY_GEMINI_MODEL);
      } catch (retryErr: any) {
        if (isNonRetryableGeminiError(retryErr)) {
          throw retryErr;
        }

        if (isHttp503UnavailableError(retryErr)) {
          console.error(
            `[TitleResolutionService] ${PRIMARY_GEMINI_MODEL} returned HTTP 503 after retry; switching to ${FALLBACK_GEMINI_MODEL}:`,
            extractSafeGeminiErrorDetails(retryErr, geminiApiKey)
          );
          return await invokeModel(FALLBACK_GEMINI_MODEL);
        }

        throw retryErr;
      }
    }

    throw primaryErr;
  }
}

export async function resolveTitlesWithGemini(
  body: TitleResolutionRequestBody
): Promise<{
  status: number;
  body: TitleResolutionResponseBody;
}> {
  // Normalize request into a validated list of items
  const rawList: TitleResolutionInputItem[] = [];

  if (typeof body?.query === 'string' && body.query.trim()) {
    rawList.push({
      rowId: 'search-0',
      title: body.query,
      mediaTypeHint: body.mediaTypeHint ?? null,
      yearHint: body.yearHint ?? null,
    });
  } else if (Array.isArray(body?.items)) {
    for (let i = 0; i < body.items.length; i++) {
      const it = body.items[i];
      if (it && typeof it.title === 'string' && it.title.trim()) {
        rawList.push({
          rowId: it.rowId ? String(it.rowId) : `row-${i}`,
          title: it.title,
          mediaTypeHint:
            it.mediaTypeHint === 'movie' || it.mediaTypeHint === 'tv'
              ? it.mediaTypeHint
              : null,
          yearHint:
            typeof it.yearHint === 'number' && Number.isFinite(it.yearHint)
              ? it.yearHint
              : null,
        });
      }
    }
  }

  if (rawList.length === 0) {
    return {
      status: 400,
      body: {
        items: [],
        provider: 'fallback',
        aiAvailable: false,
        warning: 'Please provide a valid search query or non-empty items array.',
      },
    };
  }

  if (rawList.length > MAX_TITLES_PER_REQUEST) {
    return {
      status: 400,
      body: {
        items: [],
        provider: 'fallback',
        aiAvailable: false,
        warning: `Too many titles in a single request (maximum allowed is ${MAX_TITLES_PER_REQUEST}).`,
      },
    };
  }

  const sanitizedInputs: TitleResolutionInputItem[] = rawList.map((item, idx) => ({
    rowId: String(item.rowId || `row-${idx}`),
    title: sanitizeTitleInput(item.title),
    mediaTypeHint: item.mediaTypeHint ?? null,
    yearHint:
      typeof item.yearHint === 'number' &&
      Number.isInteger(item.yearHint) &&
      item.yearHint >= 1888 &&
      item.yearHint <= 2035
        ? item.yearHint
        : null,
  }));

  // Check in-memory cache first for each item
  const resolvedByIndex = new Array<ResolvedTitleItem | null>(sanitizedInputs.length).fill(
    null
  );
  const uncachedIndices: number[] = [];

  for (let i = 0; i < sanitizedInputs.length; i++) {
    const item = sanitizedInputs[i];
    if (!item.title) {
      resolvedByIndex[i] = {
        rowId: item.rowId || `row-${i}`,
        originalQuery: '',
        originalTitle: '',
        normalizedTitle: '',
        alternateQueries: [],
        mediaTypeHint: item.mediaTypeHint ?? null,
        yearHint: item.yearHint ?? null,
        confidence: 0,
        aiAssisted: false,
      };
      continue;
    }

    const cacheKey = buildCacheKey(item);
    const cached = getCachedResolution(cacheKey);
    if (cached && !body.bypassGemini) {
      resolvedByIndex[i] = {
        ...cached,
        rowId: item.rowId || cached.rowId,
        originalQuery: item.title,
        originalTitle: item.title,
      };
    } else {
      uncachedIndices.push(i);
    }
  }

  // If everything was served from cache, return immediately
  if (uncachedIndices.length === 0) {
    const finalItems = resolvedByIndex.filter(Boolean) as ResolvedTitleItem[];
    return {
      status: 200,
      body: {
        items: finalItems,
        single: finalItems[0],
        provider: finalItems.some((i) => i.aiAssisted) ? 'gemini' : 'fallback',
        aiAvailable: true,
      },
    };
  }

  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
  const canUseGemini = Boolean(geminiApiKey) && !body.bypassGemini;

  if (!canUseGemini) {
    for (const idx of uncachedIndices) {
      const input = sanitizedInputs[idx];
      const fallbackItem = buildFallbackTitleResolution(input, idx, false);
      resolvedByIndex[idx] = fallbackItem;
    }
    const finalItems = resolvedByIndex.filter(Boolean) as ResolvedTitleItem[];
    return {
      status: 200,
      body: {
        items: finalItems,
        single: finalItems[0],
        provider: 'fallback',
        aiAvailable: false,
        warning: geminiApiKey
          ? undefined
          : 'GEMINI_API_KEY is not configured on the server; using standard title normalization.',
      },
    };
  }

  // Prepare batch request for Gemini
  const uncachedPayload = uncachedIndices.map((idx) => {
    const item = sanitizedInputs[idx];
    return {
      rowId: item.rowId,
      originalTitle: item.title,
      mediaTypeHint: item.mediaTypeHint,
      yearHint: item.yearHint,
    };
  });

  try {
    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const promptText = `You are a movie and TV series title recognition engine for a TMDB-backed media catalog.
Given the following user search queries or imported list titles, resolve each entry to its official canonical TMDB title and helpful alternate TMDB search queries.

Rules:
1. Map informal, abbreviated, unpunctuated, or numbered titles to their exact canonical release title:
   - "john wick 3" or "john wick chapter 3" -> "John Wick: Chapter 3 – Parabellum" (movie, 2019)
   - "dark knight" -> "The Dark Knight" (movie, 2008)
   - "spider man no way home" -> "Spider-Man: No Way Home" (movie, 2021)
   - "avengers endgame" -> "Avengers: Endgame" (movie, 2019)
   - "interstellar" -> "Interstellar" (movie, 2014)
   - "breaking bad" -> "Breaking Bad" (tv, 2008)
2. Never fabricate non-existent movies or TV series. If an input looks like a made-up or nonsensical title (e.g. "NonExistentMovieXYZ12345"), keep normalizedTitle equal to originalTitle and set confidence <= 0.2.
3. If an input title is genuinely ambiguous between multiple major versions (such as "The Office" without a US/UK or year hint, or "Dune" without a year), keep normalizedTitle as the shared title ("The Office"), include the main variants in alternateQueries, set yearHint to null, set isAmbiguous to true, and set confidence <= 0.70.
4. Respect any explicit mediaTypeHint ("movie" or "tv") or yearHint provided in the input. Never change an explicit movie hint to tv or vice versa.
5. Provide up to 3 concise alternateQueries suitable for querying TMDB search endpoints.

Input items JSON:
${JSON.stringify(uncachedPayload)}`;

    const response = await generateTitleResolutionWithRetryAndFallback(
      ai,
      promptText,
      geminiApiKey
    );

    const rawText = (response.text || '').trim();
    const parsed = rawText ? JSON.parse(rawText) : null;
    const aiItems: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
    const byRowId = new Map<string, any>();
    for (const candidate of aiItems) {
      if (candidate && typeof candidate.rowId === 'string') {
        byRowId.set(candidate.rowId, candidate);
      }
    }

    for (let j = 0; j < uncachedIndices.length; j++) {
      const idx = uncachedIndices[j];
      const input = sanitizedInputs[idx];
      const rowId = String(input.rowId || `row-${idx}`);
      const aiCandidate = byRowId.get(rowId) ?? aiItems[j];
      const ruleBaseline = buildFallbackTitleResolution(input, idx, true);

      if (!aiCandidate || typeof aiCandidate.normalizedTitle !== 'string') {
        resolvedByIndex[idx] = ruleBaseline;
        setCachedResolution(buildCacheKey(input), ruleBaseline);
        continue;
      }

      const rawNormalized = sanitizeTitleInput(aiCandidate.normalizedTitle) || input.title;
      const rawAlternates: string[] = Array.isArray(aiCandidate.alternateQueries)
        ? aiCandidate.alternateQueries.map((q: unknown) => sanitizeTitleInput(String(q || '')))
        : [];

      const modelType: 'movie' | 'tv' | null =
        aiCandidate.mediaTypeHint === 'movie' || aiCandidate.mediaTypeHint === 'tv'
          ? aiCandidate.mediaTypeHint
          : null;

      // Never override an explicit input mediaTypeHint
      const effectiveType: 'movie' | 'tv' | null =
        input.mediaTypeHint || modelType || ruleBaseline.mediaTypeHint;

      const rawModelYear = Number(aiCandidate.yearHint);
      const modelYear =
        Number.isInteger(rawModelYear) && rawModelYear >= 1888 && rawModelYear <= 2035
          ? rawModelYear
          : null;

      const isAmbiguous =
        Boolean(aiCandidate.isAmbiguous) || Boolean(ruleBaseline.isAmbiguous);

      const effectiveYear = isAmbiguous
        ? input.yearHint ?? null
        : input.yearHint ?? modelYear ?? ruleBaseline.yearHint;

      const rawConfidence = Number(aiCandidate.confidence);
      const confidence = Number.isFinite(rawConfidence)
        ? Math.max(0, Math.min(1, Number(rawConfidence.toFixed(2))))
        : ruleBaseline.confidence;

      // If our curated canonical rule matched with high confidence (e.g. exact en-dash in "John Wick: Chapter 3 – Parabellum"),
      // prefer the canonical rule's exact punctuation while keeping Gemini's alternates
      const useCanonicalPunctuation =
        ruleBaseline.confidence >= 0.95 &&
        ruleBaseline.normalizedTitle
          .toLowerCase()
          .replace(/[-–—:/.,!?&()+"]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() ===
          rawNormalized
            .toLowerCase()
            .replace(/[-–—:/.,!?&()+"]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

      const finalNormalizedTitle = useCanonicalPunctuation
        ? ruleBaseline.normalizedTitle
        : rawNormalized;

      const mergedAlternates = deduplicateStringsCaseInsensitive(
        [
          finalNormalizedTitle,
          ...rawAlternates,
          ...ruleBaseline.alternateQueries,
          input.title,
        ],
        4
      );

      const resolvedItem: ResolvedTitleItem = {
        rowId,
        originalQuery: input.title,
        originalTitle: input.title,
        normalizedTitle: finalNormalizedTitle,
        alternateQueries: mergedAlternates,
        mediaTypeHint: effectiveType,
        yearHint: effectiveYear,
        confidence: isAmbiguous ? Math.min(confidence, 0.7) : confidence,
        aiAssisted: confidence >= 0.45,
        isAmbiguous,
      };

      resolvedByIndex[idx] = resolvedItem;
      setCachedResolution(buildCacheKey(input), resolvedItem);
    }

    const finalItems = resolvedByIndex.filter(Boolean) as ResolvedTitleItem[];
    return {
      status: 200,
      body: {
        items: finalItems,
        single: finalItems[0],
        provider: 'gemini',
        aiAvailable: true,
      },
    };
  } catch (err: any) {
    console.error(
      '[TitleResolutionService] Gemini title resolution failed:',
      extractSafeGeminiErrorDetails(err, geminiApiKey)
    );

    // Graceful fallback when Gemini fails, times out, or hits rate limits
    for (const idx of uncachedIndices) {
      const input = sanitizedInputs[idx];
      resolvedByIndex[idx] = buildFallbackTitleResolution(input, idx, false);
    }
    const finalItems = resolvedByIndex.filter(Boolean) as ResolvedTitleItem[];
    return {
      status: 200,
      body: {
        items: finalItems,
        single: finalItems[0],
        provider: 'fallback',
        aiAvailable: false,
        warning:
          'AI title recognition is temporarily unavailable; using standard TMDB title matching.',
      },
    };
  }
}

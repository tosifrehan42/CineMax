import { MediaItem, MediaType } from '../types';
import {
  dedupeMediaItems,
  extractCanonicalTmdbIdentity,
  getCanonicalMediaKey,
  normalizeMediaTitle,
} from '../utils/mediaIntegrity';

export interface DeterministicTitleInput {
  rowId?: string;
  title: string;
  mediaTypeHint?: MediaType | null;
  yearHint?: number | null;
}

export interface DeterministicResolvedTitle {
  rowId: string;
  originalQuery: string;
  originalTitle: string;
  normalizedTitle: string;
  alternateQueries: string[];
  mediaTypeHint: MediaType | null;
  yearHint: number | null;
  tmdbIdHint?: number | null;
  franchiseKey?: string | null;
  installmentNumber?: number | null;
  confidence: number;
  smartMatched: boolean;
  isAmbiguous: boolean;
  ambiguityReason?: string;
}

export const MAX_TITLE_LENGTH = 200;

/**
 * Titles where a number (especially a 4-digit year-like number or iconic number)
 * is genuinely part of the canonical title rather than a release year suffix or sequel number.
 */
const NUMERIC_TITLE_PATTERNS: RegExp[] = [
  /^\s*(?:1917|2012|300|1984|1408|1922|1899|1883|1923|2046|1900|1776)\s*$/i,
  /\bblade\s+runner\s+2049$/i,
  /\b2001\s*:?\s*a?\s*space\s+odyssey$/i,
  /\b2010\s*:?\s*(?:the\s+year\s+we\s+make\s+contact)?$/i,
  /\bwonder\s+woman\s+1984$/i,
  /\bdeath\s+race\s+2000$/i,
  /\bblues\s+brothers\s+2000$/i,
  /\bfantasia\s+2000$/i,
  /\bgodzilla\s+2000$/i,
  /\bknight\s+rider\s+2000$/i,
  /\bdracula\s+2000$/i,
  /\bheavy\s+metal\s+2000$/i,
  /\bspace\s*:?\s*1999$/i,
  /\bclass\s+of\s+1984$/i,
  /\bclass\s+of\s+1999$/i,
  /\bfear\s+street\s+(?:part\s+)?(?:one|two|three|1|2|3)?\s*:?\s*(?:1994|1978|1666)$/i,
  /\breply\s+(?:1997|1994|1988)$/i,
  /\bkalki\s+2898\s*ad$/i,
];

export function isProtectedNumericTitle(rawTitle: string): boolean {
  const clean = String(rawTitle || '').replace(/\s+/g, ' ').trim();
  return NUMERIC_TITLE_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Extracts explicit inline release year and movie/TV type hints from a raw query
 * while preserving numeric titles like "1917" and "Blade Runner 2049".
 */
export function extractInlineTitleHints(rawInput: string): {
  cleanTitle: string;
  extractedYear: number | null;
  extractedType: MediaType | null;
} {
  let working = String(rawInput || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_LENGTH);

  let extractedType: MediaType | null = null;
  let extractedYear: number | null = null;

  // 1. Extract explicit bracketed or trailing media type tags: (Movie), [TV Series], - TV
  const bracketTypeMatch = working.match(
    /[\[(]\s*(movie|movies|film|tv\s*series|tv\s*show|web\s*series|mini\s*series|limited\s*series|series|tv|show)\s*[\])]/i
  );
  if (bracketTypeMatch) {
    const token = bracketTypeMatch[1].toLowerCase();
    extractedType =
      token.includes('movie') || token.includes('film') ? 'movie' : 'tv';
    working = working.replace(bracketTypeMatch[0], ' ').replace(/\s+/g, ' ').trim();
  } else {
    const trailingTypeMatch = working.match(
      /(?:\s+[-–—|]\s+|\s*,\s*)(movie|film|tv\s*series|tv\s*show|web\s*series|series|tv)\s*$/i
    );
    if (trailingTypeMatch && working.slice(0, trailingTypeMatch.index).trim().length >= 2) {
      const token = trailingTypeMatch[1].toLowerCase();
      extractedType =
        token.includes('movie') || token.includes('film') ? 'movie' : 'tv';
      working = working.slice(0, trailingTypeMatch.index).trim();
    }
  }

  // 2. Extract parenthesized/bracketed release year: e.g. "Dune (2021)" or "The Office [2005]"
  const parenYearMatch = working.match(/[\[(]\s*((?:19|20)\d{2})\s*[\])]/);
  if (parenYearMatch) {
    const candidateYear = parseInt(parenYearMatch[1], 10);
    const stripped = working.replace(parenYearMatch[0], ' ').replace(/\s+/g, ' ').trim();
    if (stripped.length >= 1 && candidateYear >= 1888 && candidateYear <= 2035) {
      extractedYear = candidateYear;
      working = stripped;
    }
  } else if (!isProtectedNumericTitle(working)) {
    // Extract trailing bare year e.g. "The Office 2005" or "Dune 1984" when not part of a protected numeric title
    const trailingYearMatch = working.match(
      /(?:\s+[-–—|]\s+|\s+)((?:19|20)\d{2})\s*$/
    );
    if (trailingYearMatch) {
      const candidateYear = parseInt(trailingYearMatch[1], 10);
      const prefix = working.slice(0, trailingYearMatch.index).trim();
      const maxAllowedYear = new Date().getFullYear() + 2;
      if (
        prefix.length >= 2 &&
        candidateYear >= 1920 &&
        candidateYear <= maxAllowedYear &&
        !isProtectedNumericTitle(`${prefix} ${candidateYear}`)
      ) {
        extractedYear = candidateYear;
        working = prefix;
      }
    }
  }

  return {
    cleanTitle: working || String(rawInput || '').trim(),
    extractedYear,
    extractedType,
  };
}

const ROMAN_TO_ARABIC: Record<string, string> = {
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  x: '10',
  xi: '11',
  xii: '12',
};

const ARABIC_TO_ROMAN: Record<string, string> = {
  '2': 'II',
  '3': 'III',
  '4': 'IV',
  '5': 'V',
  '6': 'VI',
  '7': 'VII',
  '8': 'VIII',
  '9': 'IX',
  '10': 'X',
};

const WORD_NUMERAL_TO_ARABIC: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
};

/**
 * Normalizes a title for deterministic comparison:
 * - Lowercases and strips diacritics
 * - Standardizes compound words (spider man <-> spider-man, batman, etc.)
 * - Normalizes punctuation and spaces
 */
export function normalizeForSearch(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\bspider[\s-]+man\b/g, 'spider man')
    .replace(/\bspiderman\b/g, 'spider man')
    .replace(/\bx[\s-]+men\b/g, 'x men')
    .replace(/\bant[\s-]+man\b/g, 'ant man')
    .replace(/\bantman\b/g, 'ant man')
    .replace(/\bbat[\s-]+man\b/g, 'batman')
    .replace(/\bsuper[\s-]+man\b/g, 'superman')
    .replace(/\biron[\s-]+man\b/g, 'iron man')
    .replace(/\bironman\b/g, 'iron man')
    .replace(/\bspider[\s-]+verse\b/g, 'spider verse')
    .replace(/\bspiderverse\b/g, 'spider verse')
    .replace(/\bblood\s+lines\b/g, 'bloodlines')
    .replace(/\bsci[\s-]+fi\b/g, 'sci fi')
    .replace(/[-–—:/.,!?()+"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts trailing or sequel Roman and word numerals to Arabic numerals in a normalized string
 * so "Part II" and "Part 2" or "Chapter III" and "Chapter 3" can be compared deterministically.
 */
export function normalizeNumeralsInTitle(normText: string): string {
  if (!normText) return '';
  const withWordNumerals = normText.replace(
    /\b(part|chapter|vol|volume|episode|season)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/g,
    (_match, prefix, wordNum) => `${prefix} ${WORD_NUMERAL_TO_ARABIC[wordNum] || wordNum}`
  );

  return withWordNumerals
    .split(' ')
    .map((token, idx, arr) => {
      if (idx > 0 && ROMAN_TO_ARABIC[token]) {
        const prev = arr[idx - 1];
        if (
          (token === 'v' || token === 'x') &&
          idx < arr.length - 1 &&
          prev !== 'part' &&
          prev !== 'chapter' &&
          prev !== 'episode' &&
          prev !== 'rocky' &&
          prev !== 'saw' &&
          prev !== 'fast'
        ) {
          return token;
        }
        return ROMAN_TO_ARABIC[token];
      }
      return token;
    })
    .join(' ');
}

/**
 * Normalizes singular/plural and common English morphological suffixes for search tokens
 * (e.g., "bloodline" <-> "bloodlines", "aliens" <-> "alien", "knights" <-> "knight").
 */
export function stemSearchToken(token: string): string {
  const clean = token.toLowerCase().trim();
  if (clean.length < 5) return clean;
  if (clean.endsWith('ies') && clean.length >= 6) {
    return clean.slice(0, -3) + 'y';
  }
  if (
    clean.endsWith('s') &&
    !clean.endsWith('ss') &&
    !clean.endsWith('us') &&
    !clean.endsWith('is') &&
    clean !== 'rises' &&
    clean !== 'series' &&
    clean !== 'jaws'
  ) {
    return clean.slice(0, -1);
  }
  return clean;
}

/**
 * Computes bounded Levenshtein edit distance between two lowercase tokens.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;
  if (Math.abs(lenA - lenB) > 4) return Math.abs(lenA - lenB);

  const prev = new Array<number>(lenB + 1);
  const curr = new Array<number>(lenB + 1);
  for (let j = 0; j <= lenB; j++) prev[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= lenB; j++) prev[j] = curr[j];
  }
  return prev[lenB];
}

/**
 * Computes similarity (0..1) between a query token and a candidate token,
 * handling exact matches, singular/plural stems ("bloodline" <-> "bloodlines"),
 * prefix matches, and minor spelling typos ("interstelar" <-> "interstellar").
 */
export function computeTokenSimilarity(qToken: string, cToken: string): number {
  if (!qToken || !cToken) return 0;
  if (qToken === cToken) return 1.0;

  const stemQ = stemSearchToken(qToken);
  const stemC = stemSearchToken(cToken);
  if (stemQ && stemQ === stemC) {
    return 0.97;
  }

  if (qToken.length >= 4 && cToken.startsWith(qToken)) {
    const ratio = qToken.length / cToken.length;
    return ratio >= 0.8 ? 0.94 : 0.88;
  }
  if (cToken.length >= 4 && qToken.startsWith(cToken)) {
    const ratio = cToken.length / qToken.length;
    return ratio >= 0.8 ? 0.94 : 0.86;
  }

  // Fuzzy spelling similarity for tokens of length >= 4
  if (qToken.length >= 4 && cToken.length >= 4 && Math.abs(qToken.length - cToken.length) <= 2) {
    // Require matching first character to prevent false-positive short-word rhymes
    if (qToken[0] === cToken[0]) {
      const dist = levenshteinDistance(stemQ, stemC);
      const maxLen = Math.max(stemQ.length, stemC.length);
      const sim = 1 - dist / maxLen;
      if (sim >= 0.82) return 0.90;
      if (sim >= 0.75 && maxLen >= 6) return 0.84;
    }
  }

  return 0;
}

export interface FranchiseInstallmentEntry {
  franchiseKey: string;
  baseFranchiseQuery: string;
  installmentNumber: number | null;
  canonicalTitle: string;
  officialTitleVariants: string[];
  queryPatterns: RegExp[];
  alternateQueries: string[];
  mediaTypeHint: MediaType | null;
  yearHint: number | null;
  tmdbIdHint?: number | null;
  confidence: number;
  isAmbiguous?: boolean;
  ambiguityReason?: string;
}

/**
 * Maintainable Franchise & Installment Registry.
 * Maps user shorthand, sequel numbers ("final destination 6", "john wick 3", "dune 2"),
 * Roman numerals ("john wick chapter iii"), and subtitle variations ("final destination bloodline")
 * to official canonical TMDB titles and installment metadata.
 */
export const FRANCHISE_INSTALLMENT_REGISTRY: FranchiseInstallmentEntry[] = [
  // ==========================================================================
  // Final Destination Franchise (Installments 1 - 6)
  // ==========================================================================
  {
    franchiseKey: 'final-destination',
    baseFranchiseQuery: 'Final Destination',
    installmentNumber: 6,
    canonicalTitle: 'Final Destination Bloodlines',
    officialTitleVariants: [
      'Final Destination Bloodlines',
      'Final Destination: Bloodlines',
      'Final Destination Bloodline',
      'Final Destination 6',
      'Final Destination VI',
    ],
    queryPatterns: [
      /^final\s*destination\s*(?:[:–—-]?\s*)?(?:part\s*|chapter\s*)?(?:6|vi|six)(?:\s*[:–—-]?\s*blood\s*lines?)?$/i,
      /^final\s*destination\s*(?:[:–—-]?\s*)?blood\s*lines?$/i,
      /^fd\s*6$/i,
    ],
    alternateQueries: [
      'Final Destination Bloodlines',
      'Final Destination: Bloodlines',
      'Final Destination',
      'Final Destination 6',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2025,
    tmdbIdHint: 574475,
    confidence: 0.98,
  },
  {
    franchiseKey: 'final-destination',
    baseFranchiseQuery: 'Final Destination',
    installmentNumber: 5,
    canonicalTitle: 'Final Destination 5',
    officialTitleVariants: ['Final Destination 5', 'Final Destination V'],
    queryPatterns: [
      /^final\s*destination\s*(?:[:–—-]?\s*)?(?:part\s*|chapter\s*)?(?:5|v|five)$/i,
    ],
    alternateQueries: ['Final Destination 5', 'Final Destination'],
    mediaTypeHint: 'movie',
    yearHint: 2011,
    tmdbIdHint: 55779,
    confidence: 0.97,
  },
  {
    franchiseKey: 'final-destination',
    baseFranchiseQuery: 'Final Destination',
    installmentNumber: 4,
    canonicalTitle: 'The Final Destination',
    officialTitleVariants: [
      'The Final Destination',
      'Final Destination 4',
      'Final Destination IV',
    ],
    queryPatterns: [
      /^final\s*destination\s*(?:[:–—-]?\s*)?(?:part\s*|chapter\s*)?(?:4|iv|four)$/i,
      /^the\s+final\s+destination$/i,
    ],
    alternateQueries: ['The Final Destination', 'Final Destination 4', 'Final Destination'],
    mediaTypeHint: 'movie',
    yearHint: 2009,
    tmdbIdHint: 19912,
    confidence: 0.96,
  },
  {
    franchiseKey: 'final-destination',
    baseFranchiseQuery: 'Final Destination',
    installmentNumber: 3,
    canonicalTitle: 'Final Destination 3',
    officialTitleVariants: ['Final Destination 3', 'Final Destination III'],
    queryPatterns: [
      /^final\s*destination\s*(?:[:–—-]?\s*)?(?:part\s*|chapter\s*)?(?:3|iii|three)$/i,
    ],
    alternateQueries: ['Final Destination 3', 'Final Destination'],
    mediaTypeHint: 'movie',
    yearHint: 2006,
    tmdbIdHint: 9286,
    confidence: 0.97,
  },
  {
    franchiseKey: 'final-destination',
    baseFranchiseQuery: 'Final Destination',
    installmentNumber: 2,
    canonicalTitle: 'Final Destination 2',
    officialTitleVariants: ['Final Destination 2', 'Final Destination II'],
    queryPatterns: [
      /^final\s*destination\s*(?:[:–—-]?\s*)?(?:part\s*|chapter\s*)?(?:2|ii|two)$/i,
    ],
    alternateQueries: ['Final Destination 2', 'Final Destination'],
    mediaTypeHint: 'movie',
    yearHint: 2003,
    tmdbIdHint: 9358,
    confidence: 0.97,
  },
  {
    franchiseKey: 'final-destination',
    baseFranchiseQuery: 'Final Destination',
    installmentNumber: 1,
    canonicalTitle: 'Final Destination',
    officialTitleVariants: ['Final Destination', 'Final Destination 1'],
    queryPatterns: [
      /^final\s*destination\s*(?:[:–—-]?\s*)?(?:part\s*|chapter\s*)?(?:1|i|one)$/i,
      /^final\s*destination$/i,
    ],
    alternateQueries: ['Final Destination', 'Final Destination Bloodlines'],
    mediaTypeHint: 'movie',
    yearHint: 2000,
    tmdbIdHint: 9532,
    confidence: 0.95,
  },

  // ==========================================================================
  // John Wick Franchise (Installments 1 - 4)
  // ==========================================================================
  {
    franchiseKey: 'john-wick',
    baseFranchiseQuery: 'John Wick',
    installmentNumber: 3,
    canonicalTitle: 'John Wick: Chapter 3 – Parabellum',
    officialTitleVariants: [
      'John Wick: Chapter 3 – Parabellum',
      'John Wick: Chapter 3 - Parabellum',
      'John Wick Chapter 3 Parabellum',
      'John Wick: Chapter 3',
      'John Wick Chapter 3',
      'John Wick Chapter III',
      'John Wick 3',
    ],
    queryPatterns: [
      /^john\s*wick\s*(?:[:–—-]?\s*)?(?:chapter\s*)?(?:3|iii|three)(?:\s*[-–—:]?\s*parabellum)?$/i,
      /^john\s*wick\s*(?:[:–—-]?\s*)?parabellum$/i,
    ],
    alternateQueries: [
      'John Wick: Chapter 3 – Parabellum',
      'John Wick: Chapter 3 - Parabellum',
      'John Wick Chapter 3',
      'John Wick',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2019,
    tmdbIdHint: 458156,
    confidence: 0.98,
  },
  {
    franchiseKey: 'john-wick',
    baseFranchiseQuery: 'John Wick',
    installmentNumber: 4,
    canonicalTitle: 'John Wick: Chapter 4',
    officialTitleVariants: [
      'John Wick: Chapter 4',
      'John Wick Chapter 4',
      'John Wick Chapter IV',
      'John Wick 4',
    ],
    queryPatterns: [
      /^john\s*wick\s*(?:[:–—-]?\s*)?(?:chapter\s*)?(?:4|iv|four)$/i,
    ],
    alternateQueries: ['John Wick: Chapter 4', 'John Wick Chapter 4', 'John Wick 4', 'John Wick'],
    mediaTypeHint: 'movie',
    yearHint: 2023,
    tmdbIdHint: 603692,
    confidence: 0.97,
  },
  {
    franchiseKey: 'john-wick',
    baseFranchiseQuery: 'John Wick',
    installmentNumber: 2,
    canonicalTitle: 'John Wick: Chapter 2',
    officialTitleVariants: [
      'John Wick: Chapter 2',
      'John Wick Chapter 2',
      'John Wick Chapter II',
      'John Wick 2',
    ],
    queryPatterns: [
      /^john\s*wick\s*(?:[:–—-]?\s*)?(?:chapter\s*)?(?:2|ii|two)$/i,
    ],
    alternateQueries: ['John Wick: Chapter 2', 'John Wick Chapter 2', 'John Wick 2', 'John Wick'],
    mediaTypeHint: 'movie',
    yearHint: 2017,
    tmdbIdHint: 324552,
    confidence: 0.97,
  },
  {
    franchiseKey: 'john-wick',
    baseFranchiseQuery: 'John Wick',
    installmentNumber: 1,
    canonicalTitle: 'John Wick',
    officialTitleVariants: ['John Wick', 'John Wick 1', 'John Wick: Chapter 1'],
    queryPatterns: [
      /^john\s*wick\s*(?:[:–—-]?\s*)?(?:chapter\s*)?(?:1|i|one)$/i,
      /^john\s*wick$/i,
    ],
    alternateQueries: ['John Wick'],
    mediaTypeHint: 'movie',
    yearHint: 2014,
    tmdbIdHint: 245891,
    confidence: 0.96,
  },

  // ==========================================================================
  // The Dark Knight Trilogy
  // ==========================================================================
  {
    franchiseKey: 'dark-knight',
    baseFranchiseQuery: 'The Dark Knight',
    installmentNumber: 2,
    canonicalTitle: 'The Dark Knight',
    officialTitleVariants: ['The Dark Knight', 'Dark Knight', 'Batman: The Dark Knight'],
    queryPatterns: [
      /^(?:the\s+)?dark\s*knight$/i,
      /^(?:the\s+)?dark\s*knight\s*(?:2|ii)$/i,
      /^batman\s*(?:[:–—-]?\s*)?(?:the\s+)?dark\s*knight$/i,
    ],
    alternateQueries: ['The Dark Knight', 'Dark Knight'],
    mediaTypeHint: 'movie',
    yearHint: 2008,
    tmdbIdHint: 155,
    confidence: 0.98,
  },
  {
    franchiseKey: 'dark-knight',
    baseFranchiseQuery: 'The Dark Knight',
    installmentNumber: 3,
    canonicalTitle: 'The Dark Knight Rises',
    officialTitleVariants: ['The Dark Knight Rises', 'Dark Knight Rises', 'The Dark Knight 3'],
    queryPatterns: [
      /^(?:the\s+)?dark\s*knight\s*rises$/i,
      /^(?:the\s+)?dark\s*knight\s*(?:3|iii)$/i,
    ],
    alternateQueries: ['The Dark Knight Rises', 'Dark Knight Rises', 'The Dark Knight'],
    mediaTypeHint: 'movie',
    yearHint: 2012,
    tmdbIdHint: 49026,
    confidence: 0.97,
  },
  {
    franchiseKey: 'dark-knight',
    baseFranchiseQuery: 'The Dark Knight',
    installmentNumber: 1,
    canonicalTitle: 'Batman Begins',
    officialTitleVariants: ['Batman Begins', 'Dark Knight 1'],
    queryPatterns: [
      /^batman\s*begins$/i,
      /^(?:the\s+)?dark\s*knight\s*(?:1|i)$/i,
    ],
    alternateQueries: ['Batman Begins', 'The Dark Knight'],
    mediaTypeHint: 'movie',
    yearHint: 2005,
    tmdbIdHint: 272,
    confidence: 0.97,
  },

  // ==========================================================================
  // Spider-Man (MCU & Spider-Verse)
  // ==========================================================================
  {
    franchiseKey: 'spider-man-mcu',
    baseFranchiseQuery: 'Spider-Man',
    installmentNumber: 3,
    canonicalTitle: 'Spider-Man: No Way Home',
    officialTitleVariants: [
      'Spider-Man: No Way Home',
      'Spider Man No Way Home',
      'Spider-Man No Way Home',
      'Spiderman No Way Home',
    ],
    queryPatterns: [
      /^spider[\s-]*man[\s:–—-]*no\s*way\s*home$/i,
      /^no\s*way\s*home$/i,
    ],
    alternateQueries: [
      'Spider-Man: No Way Home',
      'Spider Man No Way Home',
      'Spider-Man No Way Home',
      'Spider-Man',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2021,
    tmdbIdHint: 634649,
    confidence: 0.98,
  },
  {
    franchiseKey: 'spider-man-mcu',
    baseFranchiseQuery: 'Spider-Man',
    installmentNumber: 2,
    canonicalTitle: 'Spider-Man: Far From Home',
    officialTitleVariants: ['Spider-Man: Far From Home', 'Spider Man Far From Home'],
    queryPatterns: [
      /^spider[\s-]*man[\s:–—-]*far\s*from\s*home$/i,
      /^far\s*from\s*home$/i,
    ],
    alternateQueries: ['Spider-Man: Far From Home', 'Spider Man Far From Home', 'Spider-Man'],
    mediaTypeHint: 'movie',
    yearHint: 2019,
    tmdbIdHint: 429617,
    confidence: 0.97,
  },
  {
    franchiseKey: 'spider-man-mcu',
    baseFranchiseQuery: 'Spider-Man',
    installmentNumber: 1,
    canonicalTitle: 'Spider-Man: Homecoming',
    officialTitleVariants: ['Spider-Man: Homecoming', 'Spider Man Homecoming'],
    queryPatterns: [/^spider[\s-]*man[\s:–—-]*homecoming$/i],
    alternateQueries: ['Spider-Man: Homecoming', 'Spider Man Homecoming', 'Spider-Man'],
    mediaTypeHint: 'movie',
    yearHint: 2017,
    tmdbIdHint: 315635,
    confidence: 0.97,
  },
  {
    franchiseKey: 'spider-verse',
    baseFranchiseQuery: 'Spider-Man',
    installmentNumber: 1,
    canonicalTitle: 'Spider-Man: Into the Spider-Verse',
    officialTitleVariants: [
      'Spider-Man: Into the Spider-Verse',
      'Spider Man Into the Spider Verse',
      'Into the Spider-Verse',
    ],
    queryPatterns: [
      /^(?:spider[\s-]*man[\s:–—-]*)?into\s*(?:the\s*)?spider[\s-]*verse$/i,
      /^spider[\s-]*verse\s*(?:1|i|one)$/i,
    ],
    alternateQueries: [
      'Spider-Man: Into the Spider-Verse',
      'Spider Man Into the Spider Verse',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2018,
    tmdbIdHint: 324857,
    confidence: 0.97,
  },
  {
    franchiseKey: 'spider-verse',
    baseFranchiseQuery: 'Spider-Man',
    installmentNumber: 2,
    canonicalTitle: 'Spider-Man: Across the Spider-Verse',
    officialTitleVariants: [
      'Spider-Man: Across the Spider-Verse',
      'Spider Man Across the Spider Verse',
      'Across the Spider-Verse',
    ],
    queryPatterns: [
      /^(?:spider[\s-]*man[\s:–—-]*)?across\s*(?:the\s*)?spider[\s-]*verse$/i,
      /^spider[\s-]*verse\s*(?:2|ii|two)$/i,
    ],
    alternateQueries: [
      'Spider-Man: Across the Spider-Verse',
      'Spider Man Across the Spider Verse',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2023,
    tmdbIdHint: 569094,
    confidence: 0.97,
  },

  // ==========================================================================
  // Dune Franchise (Installments & Multi-Adaptation Rules)
  // ==========================================================================
  {
    franchiseKey: 'dune',
    baseFranchiseQuery: 'Dune',
    installmentNumber: 2,
    canonicalTitle: 'Dune: Part Two',
    officialTitleVariants: ['Dune: Part Two', 'Dune Part Two', 'Dune Part 2', 'Dune 2', 'Dune II'],
    queryPatterns: [
      /^dune\s*(?:[:–—-]?\s*)?(?:part\s*)?(?:2|ii|two)$/i,
    ],
    alternateQueries: ['Dune: Part Two', 'Dune Part Two', 'Dune 2', 'Dune'],
    mediaTypeHint: 'movie',
    yearHint: 2024,
    tmdbIdHint: 693134,
    confidence: 0.98,
  },
  {
    franchiseKey: 'dune',
    baseFranchiseQuery: 'Dune',
    installmentNumber: 1,
    canonicalTitle: 'Dune',
    officialTitleVariants: ['Dune: Part One', 'Dune Part One', 'Dune Part 1', 'Dune 1'],
    queryPatterns: [
      /^dune\s*(?:[:–—-]?\s*)?(?:part\s*)?(?:1|i|one)$/i,
    ],
    alternateQueries: ['Dune', 'Dune: Part One', 'Dune Part One'],
    mediaTypeHint: 'movie',
    yearHint: 2021,
    tmdbIdHint: 438631,
    confidence: 0.96,
  },
  {
    franchiseKey: 'dune',
    baseFranchiseQuery: 'Dune',
    installmentNumber: null,
    canonicalTitle: 'Dune',
    officialTitleVariants: ['Dune'],
    queryPatterns: [/^dune$/i],
    alternateQueries: ['Dune', 'Dune: Part One', 'Dune: Part Two'],
    mediaTypeHint: 'movie',
    yearHint: null,
    confidence: 0.65,
    isAmbiguous: true,
    ambiguityReason:
      "Multiple screen adaptations exist for 'Dune' (2021, 1984, and Dune: Part Two 2024). Please select the exact release year.",
  },

  // ==========================================================================
  // Avengers & Marvel
  // ==========================================================================
  {
    franchiseKey: 'avengers',
    baseFranchiseQuery: 'Avengers',
    installmentNumber: 4,
    canonicalTitle: 'Avengers: Endgame',
    officialTitleVariants: ['Avengers: Endgame', 'Avengers Endgame', 'Avengers 4'],
    queryPatterns: [
      /^(?:the\s+)?avengers[\s:–—-]*end\s*game$/i,
      /^(?:the\s+)?avengers\s*(?:4|iv)$/i,
    ],
    alternateQueries: ['Avengers: Endgame', 'Avengers Endgame', 'Avengers'],
    mediaTypeHint: 'movie',
    yearHint: 2019,
    tmdbIdHint: 299534,
    confidence: 0.98,
  },
  {
    franchiseKey: 'avengers',
    baseFranchiseQuery: 'Avengers',
    installmentNumber: 3,
    canonicalTitle: 'Avengers: Infinity War',
    officialTitleVariants: ['Avengers: Infinity War', 'Avengers Infinity War', 'Avengers 3'],
    queryPatterns: [
      /^(?:the\s+)?avengers[\s:–—-]*infinity\s*war$/i,
      /^(?:the\s+)?avengers\s*(?:3|iii)$/i,
    ],
    alternateQueries: ['Avengers: Infinity War', 'Avengers Infinity War', 'Avengers'],
    mediaTypeHint: 'movie',
    yearHint: 2018,
    tmdbIdHint: 299536,
    confidence: 0.98,
  },
  {
    franchiseKey: 'avengers',
    baseFranchiseQuery: 'Avengers',
    installmentNumber: 2,
    canonicalTitle: 'Avengers: Age of Ultron',
    officialTitleVariants: ['Avengers: Age of Ultron', 'Avengers Age of Ultron', 'Avengers 2'],
    queryPatterns: [
      /^(?:the\s+)?avengers[\s:–—-]*age\s*of\s*ultron$/i,
      /^(?:the\s+)?avengers\s*(?:2|ii)$/i,
    ],
    alternateQueries: ['Avengers: Age of Ultron', 'Avengers Age of Ultron', 'Avengers'],
    mediaTypeHint: 'movie',
    yearHint: 2015,
    tmdbIdHint: 99861,
    confidence: 0.97,
  },

  // ==========================================================================
  // Mission: Impossible Franchise
  // ==========================================================================
  {
    franchiseKey: 'mission-impossible',
    baseFranchiseQuery: 'Mission: Impossible',
    installmentNumber: 6,
    canonicalTitle: 'Mission: Impossible - Fallout',
    officialTitleVariants: [
      'Mission: Impossible - Fallout',
      'Mission Impossible Fallout',
      'Mission Impossible 6',
      'Mission: Impossible 6',
    ],
    queryPatterns: [
      /^mission[\s:]*impossible\s*(?:[-–—:]?\s*)?fallout$/i,
      /^mission[\s:]*impossible\s*(?:6|vi)$/i,
    ],
    alternateQueries: ['Mission: Impossible - Fallout', 'Mission Impossible Fallout'],
    mediaTypeHint: 'movie',
    yearHint: 2018,
    tmdbIdHint: 353081,
    confidence: 0.97,
  },
  {
    franchiseKey: 'mission-impossible',
    baseFranchiseQuery: 'Mission: Impossible',
    installmentNumber: 7,
    canonicalTitle: 'Mission: Impossible - Dead Reckoning Part One',
    officialTitleVariants: [
      'Mission: Impossible - Dead Reckoning Part One',
      'Mission Impossible Dead Reckoning',
      'Mission Impossible 7',
      'Mission: Impossible 7',
    ],
    queryPatterns: [
      /^mission[\s:]*impossible\s*(?:[-–—:]?\s*)?dead\s*reckoning(?:\s*part\s*(?:one|1))?$/i,
      /^mission[\s:]*impossible\s*(?:7|vii)$/i,
    ],
    alternateQueries: [
      'Mission: Impossible - Dead Reckoning Part One',
      'Mission Impossible Dead Reckoning',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2023,
    tmdbIdHint: 575264,
    confidence: 0.96,
  },

  // ==========================================================================
  // The Lord of the Rings
  // ==========================================================================
  {
    franchiseKey: 'lotr',
    baseFranchiseQuery: 'The Lord of the Rings',
    installmentNumber: 1,
    canonicalTitle: 'The Lord of the Rings: The Fellowship of the Ring',
    officialTitleVariants: [
      'The Lord of the Rings: The Fellowship of the Ring',
      'Fellowship of the Ring',
      'Lord of the Rings 1',
    ],
    queryPatterns: [
      /^(?:the\s+)?(?:lord\s+of\s+the\s+rings|lotr)[\s:]*(?:the\s+)?fellowship\s+of\s+the\s+ring$/i,
      /^(?:the\s+)?(?:lord\s+of\s+the\s+rings|lotr)\s*(?:1|i)$/i,
    ],
    alternateQueries: [
      'The Lord of the Rings: The Fellowship of the Ring',
      'Fellowship of the Ring',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2001,
    tmdbIdHint: 120,
    confidence: 0.97,
  },
  {
    franchiseKey: 'lotr',
    baseFranchiseQuery: 'The Lord of the Rings',
    installmentNumber: 2,
    canonicalTitle: 'The Lord of the Rings: The Two Towers',
    officialTitleVariants: [
      'The Lord of the Rings: The Two Towers',
      'The Two Towers',
      'Lord of the Rings 2',
    ],
    queryPatterns: [
      /^(?:the\s+)?(?:lord\s+of\s+the\s+rings|lotr)[\s:]*(?:the\s+)?two\s+towers$/i,
      /^(?:the\s+)?(?:lord\s+of\s+the\s+rings|lotr)\s*(?:2|ii)$/i,
    ],
    alternateQueries: ['The Lord of the Rings: The Two Towers', 'The Two Towers'],
    mediaTypeHint: 'movie',
    yearHint: 2002,
    tmdbIdHint: 121,
    confidence: 0.97,
  },
  {
    franchiseKey: 'lotr',
    baseFranchiseQuery: 'The Lord of the Rings',
    installmentNumber: 3,
    canonicalTitle: 'The Lord of the Rings: The Return of the King',
    officialTitleVariants: [
      'The Lord of the Rings: The Return of the King',
      'The Return of the King',
      'Lord of the Rings 3',
    ],
    queryPatterns: [
      /^(?:the\s+)?(?:lord\s+of\s+the\s+rings|lotr)[\s:]*(?:the\s+)?return\s+of\s+the\s+king$/i,
      /^(?:the\s+)?(?:lord\s+of\s+the\s+rings|lotr)\s*(?:3|iii)$/i,
    ],
    alternateQueries: [
      'The Lord of the Rings: The Return of the King',
      'Return of the King',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2003,
    tmdbIdHint: 122,
    confidence: 0.97,
  },

  // ==========================================================================
  // Protected Numeric, Landmark & Subtitled Sequels
  // ==========================================================================
  {
    franchiseKey: 'blade-runner',
    baseFranchiseQuery: 'Blade Runner',
    installmentNumber: 2,
    canonicalTitle: 'Blade Runner 2049',
    officialTitleVariants: ['Blade Runner 2049', 'Blade Runner 2'],
    queryPatterns: [/^blade\s*runner\s*2049$/i, /^blade\s*runner\s*(?:2|ii)$/i],
    alternateQueries: ['Blade Runner 2049', 'Blade Runner'],
    mediaTypeHint: 'movie',
    yearHint: 2017,
    tmdbIdHint: 335984,
    confidence: 0.98,
  },
  {
    franchiseKey: 'blade-runner',
    baseFranchiseQuery: 'Blade Runner',
    installmentNumber: 1,
    canonicalTitle: 'Blade Runner (The Final Cut)',
    officialTitleVariants: ['Blade Runner', 'Blade Runner (The Final Cut)', 'Blade Runner 1'],
    queryPatterns: [/^blade\s*runner(?:\s*the\s*final\s*cut)?$/i, /^blade\s*runner\s*1$/i],
    alternateQueries: ['Blade Runner', 'Blade Runner (The Final Cut)'],
    mediaTypeHint: 'movie',
    yearHint: 1982,
    tmdbIdHint: 78,
    confidence: 0.96,
  },
  {
    franchiseKey: 'standalone-1917',
    baseFranchiseQuery: '1917',
    installmentNumber: null,
    canonicalTitle: '1917',
    officialTitleVariants: ['1917'],
    queryPatterns: [/^1917$/i],
    alternateQueries: ['1917'],
    mediaTypeHint: 'movie',
    yearHint: 2019,
    tmdbIdHint: 530915,
    confidence: 0.98,
  },
  {
    franchiseKey: 'standalone-interstellar',
    baseFranchiseQuery: 'Interstellar',
    installmentNumber: null,
    canonicalTitle: 'Interstellar',
    officialTitleVariants: ['Interstellar'],
    queryPatterns: [/^interstell?ar$/i],
    alternateQueries: ['Interstellar'],
    mediaTypeHint: 'movie',
    yearHint: 2014,
    tmdbIdHint: 157336,
    confidence: 0.98,
  },
  {
    franchiseKey: 'breaking-bad',
    baseFranchiseQuery: 'Breaking Bad',
    installmentNumber: null,
    canonicalTitle: 'Breaking Bad',
    officialTitleVariants: ['Breaking Bad'],
    queryPatterns: [/^breaking\s*bad$/i],
    alternateQueries: ['Breaking Bad'],
    mediaTypeHint: 'tv',
    yearHint: 2008,
    tmdbIdHint: 1396,
    confidence: 0.98,
  },
  {
    franchiseKey: 'breaking-bad-universe',
    baseFranchiseQuery: 'Better Call Saul',
    installmentNumber: null,
    canonicalTitle: 'Better Call Saul',
    officialTitleVariants: ['Better Call Saul'],
    queryPatterns: [/^better\s*call\s*saul$/i],
    alternateQueries: ['Better Call Saul'],
    mediaTypeHint: 'tv',
    yearHint: 2015,
    tmdbIdHint: 60059,
    confidence: 0.98,
  },
  {
    franchiseKey: 'standalone-shawshank',
    baseFranchiseQuery: 'The Shawshank Redemption',
    installmentNumber: null,
    canonicalTitle: 'The Shawshank Redemption',
    officialTitleVariants: ['The Shawshank Redemption', 'Shawshank Redemption'],
    queryPatterns: [/^(?:the\s+)?shawshank\s*redemption$/i],
    alternateQueries: ['The Shawshank Redemption', 'Shawshank Redemption'],
    mediaTypeHint: 'movie',
    yearHint: 1994,
    tmdbIdHint: 278,
    confidence: 0.98,
  },
  {
    franchiseKey: 'godfather',
    baseFranchiseQuery: 'The Godfather',
    installmentNumber: 2,
    canonicalTitle: 'The Godfather Part II',
    officialTitleVariants: ['The Godfather Part II', 'The Godfather: Part II', 'The Godfather 2'],
    queryPatterns: [/^(?:the\s+)?godfather(?:\s*part)?\s*(?:2|ii|two)$/i],
    alternateQueries: ['The Godfather Part II', 'The Godfather 2', 'The Godfather'],
    mediaTypeHint: 'movie',
    yearHint: 1974,
    tmdbIdHint: 240,
    confidence: 0.97,
  },
  {
    franchiseKey: 'godfather',
    baseFranchiseQuery: 'The Godfather',
    installmentNumber: 1,
    canonicalTitle: 'The Godfather',
    officialTitleVariants: ['The Godfather', 'Godfather', 'The Godfather 1'],
    queryPatterns: [/^(?:the\s+)?godfather(?:\s*1)?$/i],
    alternateQueries: ['The Godfather', 'Godfather'],
    mediaTypeHint: 'movie',
    yearHint: 1972,
    tmdbIdHint: 238,
    confidence: 0.97,
  },

  // ==========================================================================
  // The Office (US 2005 vs UK 2001) & Multi-Adaptation Ambiguous Titles
  // ==========================================================================
  {
    franchiseKey: 'the-office',
    baseFranchiseQuery: 'The Office',
    installmentNumber: null,
    canonicalTitle: 'The Office',
    officialTitleVariants: ['The Office (US)', 'The Office US', 'The Office American'],
    queryPatterns: [/^(?:the\s+)?office\s*(?:us|u\.s\.|american)$/i],
    alternateQueries: ['The Office'],
    mediaTypeHint: 'tv',
    yearHint: 2005,
    tmdbIdHint: 2316,
    confidence: 0.96,
  },
  {
    franchiseKey: 'the-office',
    baseFranchiseQuery: 'The Office',
    installmentNumber: null,
    canonicalTitle: 'The Office',
    officialTitleVariants: ['The Office (UK)', 'The Office UK', 'The Office British'],
    queryPatterns: [/^(?:the\s+)?office\s*(?:uk|u\.k\.|british)$/i],
    alternateQueries: ['The Office'],
    mediaTypeHint: 'tv',
    yearHint: 2001,
    tmdbIdHint: 2996,
    confidence: 0.96,
  },
  {
    franchiseKey: 'the-office',
    baseFranchiseQuery: 'The Office',
    installmentNumber: null,
    canonicalTitle: 'The Office',
    officialTitleVariants: ['The Office'],
    queryPatterns: [/^(?:the\s+)?office$/i],
    alternateQueries: ['The Office'],
    mediaTypeHint: 'tv',
    yearHint: null,
    confidence: 0.65,
    isAmbiguous: true,
    ambiguityReason:
      "Multiple editions found for 'The Office' (US 2005 vs UK 2001). Please select the edition you watched.",
  },
  {
    franchiseKey: 'fargo',
    baseFranchiseQuery: 'Fargo',
    installmentNumber: null,
    canonicalTitle: 'Fargo',
    officialTitleVariants: ['Fargo'],
    queryPatterns: [/^fargo$/i],
    alternateQueries: ['Fargo'],
    mediaTypeHint: null,
    yearHint: null,
    confidence: 0.65,
    isAmbiguous: true,
    ambiguityReason:
      "Both the 1996 movie and the 2014 TV series are titled 'Fargo'. Please specify Movie or Series.",
  },
  {
    franchiseKey: 'the-thing',
    baseFranchiseQuery: 'The Thing',
    installmentNumber: null,
    canonicalTitle: 'The Thing',
    officialTitleVariants: ['The Thing'],
    queryPatterns: [/^(?:the\s+)?thing$/i],
    alternateQueries: ['The Thing'],
    mediaTypeHint: 'movie',
    yearHint: null,
    confidence: 0.65,
    isAmbiguous: true,
    ambiguityReason:
      "Multiple films share the title 'The Thing' (1982 vs 2011). Please select the release year.",
  },
  {
    franchiseKey: 'scarface',
    baseFranchiseQuery: 'Scarface',
    installmentNumber: null,
    canonicalTitle: 'Scarface',
    officialTitleVariants: ['Scarface'],
    queryPatterns: [/^scarface$/i],
    alternateQueries: ['Scarface'],
    mediaTypeHint: 'movie',
    yearHint: null,
    confidence: 0.68,
    isAmbiguous: true,
    ambiguityReason:
      "Multiple films share the title 'Scarface' (1983 vs 1932). Please confirm the release year.",
  },
  {
    franchiseKey: 'ghostbusters',
    baseFranchiseQuery: 'Ghostbusters',
    installmentNumber: null,
    canonicalTitle: 'Ghostbusters',
    officialTitleVariants: ['Ghostbusters'],
    queryPatterns: [/^ghostbusters$/i],
    alternateQueries: ['Ghostbusters'],
    mediaTypeHint: 'movie',
    yearHint: null,
    confidence: 0.68,
    isAmbiguous: true,
    ambiguityReason:
      "Multiple releases share the title 'Ghostbusters' (1984 vs 2016). Please confirm the release year.",
  },
];

/**
 * Identifies the franchise and installment number for a given query or candidate title.
 * Used to link numbered sequel queries (e.g. "final destination 6") to subtitled official
 * titles (e.g. "Final Destination Bloodlines") while distinguishing wrong installments
 * (e.g. "Final Destination 2" or "Final Destination" [2000]).
 */
export function identifyFranchiseInstallment(
  rawText: string,
  candidateYear?: number | null,
  candidateTmdbId?: number | null
): {
  franchiseKey: string;
  installmentNumber: number | null;
  canonicalTitle: string;
  entry: FranchiseInstallmentEntry;
} | null {
  const clean = String(rawText || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;

  // 1. Direct TMDB ID match if provided and unambiguous
  if (candidateTmdbId && candidateTmdbId > 0) {
    const byId = FRANCHISE_INSTALLMENT_REGISTRY.find(
      (entry) => !entry.isAmbiguous && entry.tmdbIdHint === candidateTmdbId
    );
    if (byId) {
      return {
        franchiseKey: byId.franchiseKey,
        installmentNumber: byId.installmentNumber,
        canonicalTitle: byId.canonicalTitle,
        entry: byId,
      };
    }
  }

  const normText = normalizeForSearch(clean);
  const numNormText = normalizeNumeralsInTitle(normText);
  const punctuationStripped = clean
    .replace(/[-–—:/.,!?&()+"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Check explicit queryPatterns in registry order (which includes ambiguous bare patterns like "dune" and "the office")
  for (const entry of FRANCHISE_INSTALLMENT_REGISTRY) {
    const matchesPattern = entry.queryPatterns.some(
      (p) => p.test(clean) || p.test(punctuationStripped) || p.test(normText)
    );
    if (matchesPattern) {
      return {
        franchiseKey: entry.franchiseKey,
        installmentNumber: entry.installmentNumber,
        canonicalTitle: entry.canonicalTitle,
        entry,
      };
    }
  }

  // 3. Check officialTitleVariants in registry
  for (const entry of FRANCHISE_INSTALLMENT_REGISTRY) {
    const matchesVariant = entry.officialTitleVariants.some((v) => {
      const nv = normalizeForSearch(v);
      return nv === normText || normalizeNumeralsInTitle(nv) === numNormText;
    });

    if (matchesVariant) {
      if (
        entry.franchiseKey === 'dune' &&
        entry.installmentNumber === 1 &&
        candidateYear &&
        candidateYear < 2000
      ) {
        continue;
      }
      return {
        franchiseKey: entry.franchiseKey,
        installmentNumber: entry.installmentNumber,
        canonicalTitle: entry.canonicalTitle,
        entry,
      };
    }
  }

  return null;
}

function deduplicateStringsCaseInsensitive(list: string[], maxCount = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const clean = String(raw || '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_TITLE_LENGTH);
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
 * Generates multi-variant search queries for a title:
 * - Canonical official title variants & known franchise aliases
 * - Original query & normalized query
 * - Query without punctuation
 * - Arabic and Roman numeral variants
 * - Partial franchise/base title (without removing numbers from protected numeric titles like "1917" or "Blade Runner 2049")
 */
export function generateSearchQueryVariants(
  cleanOriginal: string,
  heuristicNormalized: string,
  matchedEntry?: FranchiseInstallmentEntry | null
): string[] {
  const candidates: string[] = [];

  if (matchedEntry) {
    candidates.push(matchedEntry.canonicalTitle);
    candidates.push(...matchedEntry.alternateQueries);
    if (matchedEntry.baseFranchiseQuery) {
      candidates.push(matchedEntry.baseFranchiseQuery);
    }
  }

  candidates.push(heuristicNormalized, cleanOriginal);

  // Query without punctuation
  const withoutPunctuation = heuristicNormalized
    .replace(/[-–—:/.,!?()+"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (withoutPunctuation) {
    candidates.push(withoutPunctuation);
  }

  const protectedNumeric =
    isProtectedNumericTitle(cleanOriginal) || isProtectedNumericTitle(heuristicNormalized);

  if (!protectedNumeric) {
    // Arabic -> Roman and Part/Chapter variants for trailing digit (2..10)
    const trailingDigitMatch = heuristicNormalized.match(/^(.+?)\s+([2-9]|10)$/);
    if (trailingDigitMatch) {
      const base = trailingDigitMatch[1].trim();
      const digit = trailingDigitMatch[2];
      const roman = ARABIC_TO_ROMAN[digit];
      if (!/\b(?:part|chapter|season|episode|vol|volume)\b/i.test(base)) {
        if (roman) {
          candidates.push(`${base} ${roman}`);
        }
        candidates.push(`${base}: Part ${digit}`);
        candidates.push(`${base}: Chapter ${digit}`);
        if (base.length >= 3) {
          candidates.push(base);
        }
      } else {
        const strippedBase = base
          .replace(/\s*[:–—-]?\s*\b(?:part|chapter|vol|volume)\s*$/i, '')
          .trim();
        if (roman) {
          candidates.push(`${base} ${roman}`);
        }
        if (strippedBase.length >= 3) {
          candidates.push(`${strippedBase} ${digit}`);
          candidates.push(strippedBase);
        }
      }
    }

    // Roman -> Arabic variants (e.g., "John Wick Chapter III" -> "John Wick Chapter 3", "John Wick 3", "John Wick")
    const trailingRomanMatch = heuristicNormalized.match(
      /^(.+?)\s+(ii|iii|iv|v|vi|vii|viii|ix|x)$/i
    );
    if (trailingRomanMatch) {
      const base = trailingRomanMatch[1].trim();
      const romanLower = trailingRomanMatch[2].toLowerCase();
      const arabic = ROMAN_TO_ARABIC[romanLower];
      if (arabic) {
        candidates.push(`${base} ${arabic}`);
        const strippedBase = base
          .replace(/\s*[:–—-]?\s*\b(?:part|chapter|vol|volume)\s*$/i, '')
          .trim();
        if (strippedBase && strippedBase !== base) {
          candidates.push(`${strippedBase} ${arabic}`);
          candidates.push(strippedBase);
        } else if (base.length >= 3) {
          candidates.push(base);
        }
      }
    }
  }

  // If title has a colon or dash subtitle, include the base franchise prefix
  if (/[:–—]/.test(heuristicNormalized)) {
    const prefix = heuristicNormalized.split(/[:–—]/)[0]?.trim();
    if (prefix && prefix.length >= 3) {
      candidates.push(prefix);
    }
  }

  return deduplicateStringsCaseInsensitive(candidates, 6);
}

/**
 * Deterministically normalizes a movie or TV series title, extracts inline hints,
 * applies franchise shorthand rules, and produces a bounded list of TMDB search queries.
 */
export function resolveDeterministicTitle(
  input: DeterministicTitleInput,
  index = 0
): DeterministicResolvedTitle {
  const rowId = String(input.rowId || `row-${index}`);
  const rawOriginal = String(input.title || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_LENGTH);

  const { cleanTitle, extractedYear, extractedType } = extractInlineTitleHints(rawOriginal);

  const explicitType: MediaType | null =
    input.mediaTypeHint === 'movie' || input.mediaTypeHint === 'tv'
      ? input.mediaTypeHint
      : extractedType;

  const explicitYear: number | null =
    typeof input.yearHint === 'number' &&
    Number.isInteger(input.yearHint) &&
    input.yearHint >= 1888 &&
    input.yearHint <= 2035
      ? input.yearHint
      : extractedYear;

  const matchedInstallment = identifyFranchiseInstallment(cleanTitle, explicitYear);

  if (matchedInstallment) {
    const rule = matchedInstallment.entry;
    const isDisambiguatedByYear = Boolean(explicitYear);
    const isDisambiguatedByType = Boolean(
      rule.franchiseKey === 'fargo' && explicitType
    );
    const isAmbiguous = Boolean(
      rule.isAmbiguous && !isDisambiguatedByYear && !isDisambiguatedByType
    );

    const effectiveType = explicitType || rule.mediaTypeHint;
    const effectiveYear = isAmbiguous ? null : explicitYear ?? rule.yearHint;
    const canonicalDiffers =
      rule.canonicalTitle.toLowerCase() !== cleanTitle.toLowerCase();

    const variants = generateSearchQueryVariants(cleanTitle, rule.canonicalTitle, rule);

    return {
      rowId,
      originalQuery: rawOriginal,
      originalTitle: rawOriginal,
      normalizedTitle: rule.canonicalTitle,
      alternateQueries: variants,
      mediaTypeHint: effectiveType,
      yearHint: effectiveYear,
      tmdbIdHint: isAmbiguous ? null : rule.tmdbIdHint ?? null,
      franchiseKey: rule.franchiseKey,
      installmentNumber: rule.installmentNumber,
      confidence: isAmbiguous ? 0.65 : rule.confidence,
      smartMatched:
        canonicalDiffers || isAmbiguous || Boolean(extractedYear || extractedType),
      isAmbiguous,
      ambiguityReason: isAmbiguous ? rule.ambiguityReason : undefined,
    };
  }

  // Generic deterministic compound & punctuation cleanup
  const heuristicNormalized = cleanTitle
    .replace(/\bspider[\s-]+man\b/gi, 'Spider-Man')
    .replace(/\bspiderman\b/gi, 'Spider-Man')
    .replace(/\bx[\s-]+men\b/gi, 'X-Men')
    .replace(/\bant[\s-]+man\b/gi, 'Ant-Man')
    .replace(/\bantman\b/gi, 'Ant-Man')
    .replace(/\bmission\s+impossible\b/gi, 'Mission: Impossible')
    .replace(/\bstar\s+wars\s+episode\b/gi, 'Star Wars: Episode')
    .trim();

  const alternates = generateSearchQueryVariants(cleanTitle, heuristicNormalized, null);
  const changedByHeuristic =
    heuristicNormalized.toLowerCase() !== rawOriginal.toLowerCase() ||
    Boolean(extractedYear) ||
    Boolean(extractedType);

  return {
    rowId,
    originalQuery: rawOriginal,
    originalTitle: rawOriginal,
    normalizedTitle: heuristicNormalized || cleanTitle || rawOriginal,
    alternateQueries: alternates.length > 0 ? alternates : [rawOriginal],
    mediaTypeHint: explicitType,
    yearHint: explicitYear,
    tmdbIdHint: null,
    franchiseKey: null,
    installmentNumber: null,
    confidence: changedByHeuristic ? 0.8 : 0.65,
    smartMatched: changedByHeuristic,
    isAmbiguous: false,
  };
}

export function resolveDeterministicTitlesBatch(
  inputs: DeterministicTitleInput[]
): DeterministicResolvedTitle[] {
  if (!Array.isArray(inputs) || inputs.length === 0) return [];
  return inputs.map((item, idx) => resolveDeterministicTitle(item, idx));
}

/**
 * Parses a formatted voteCount string (e.g., "24k", "1.2M", "850") into an approximate numeric count
 * for secondary tie-breaking.
 */
export function parseNumericVoteCount(voteCount?: string | number): number {
  if (typeof voteCount === 'number') return Number.isFinite(voteCount) ? voteCount : 0;
  const raw = String(voteCount || '0').trim();
  if (!raw) return 0;
  if (/m$/i.test(raw)) {
    return Math.round((parseFloat(raw) || 0) * 1_000_000);
  }
  if (/k$/i.test(raw)) {
    return Math.round((parseFloat(raw) || 0) * 1_000);
  }
  return parseInt(raw.replace(/,/g, ''), 10) || 0;
}

/**
 * Extracts explicit sequel numbers (2..19) from a normalized title while ignoring
 * protected 4-digit or iconic numeric titles (like "1917" or "Blade Runner 2049").
 */
function extractSequelNumbers(numNormText: string, rawText: string): string[] {
  if (!numNormText || isProtectedNumericTitle(rawText)) return [];
  const matches = numNormText.match(/\b([2-9]|1[0-9])\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Computes deterministic title similarity (0..100) between a query and a candidate title,
 * accounting for:
 * - Exact & article-insensitive matches ("dark knight" === "The Dark Knight")
 * - Roman/Arabic numeral equivalence ("john wick chapter iii" === "John Wick: Chapter 3")
 * - Franchise-aware subtitled sequel identity ("final destination 6" === "Final Destination Bloodlines",
 *   without penalizing the subtitled sequel for omitting "6", while strongly penalizing wrong installments)
 * - Inflection & singular/plural equivalence ("final destination bloodline" === "Final Destination Bloodlines")
 * - Fuzzy spelling tolerance ("interstelar" === "Interstellar")
 * - Protected numeric titles ("1917", "Blade Runner 2049")
 */
export function computeDeterministicTitleSimilarity(
  rawQuery: string,
  rawCandidate: string
): number {
  const normQuery = normalizeForSearch(rawQuery);
  const normCandidate = normalizeForSearch(rawCandidate);
  if (!normQuery || !normCandidate) return 0;

  if (normCandidate === normQuery) {
    return 100;
  }

  const numNormQuery = normalizeNumeralsInTitle(normQuery);
  const numNormCandidate = normalizeNumeralsInTitle(normCandidate);
  if (numNormQuery && numNormQuery === numNormCandidate) {
    return 99;
  }

  // Strip leading "the " or "a " for article-insensitive exact match (e.g. "dark knight" === "the dark knight")
  const bareQuery = numNormQuery.replace(/^(?:the|a|an)\s+/, '');
  const bareCandidate = numNormCandidate.replace(/^(?:the|a|an)\s+/, '');
  if (bareQuery && bareQuery === bareCandidate) {
    return 98;
  }

  // Franchise-aware installment check:
  // If both query and candidate resolve to a known franchise in FRANCHISE_INSTALLMENT_REGISTRY,
  // compare their installment numbers directly so subtitled sequels (e.g. "Final Destination Bloodlines" for #6)
  // score 100 instead of suffering a missing-sequel-number penalty, while wrong installments get penalized.
  const queryFranchise = identifyFranchiseInstallment(rawQuery);
  const candidateFranchise = identifyFranchiseInstallment(rawCandidate);

  if (
    queryFranchise &&
    candidateFranchise &&
    queryFranchise.franchiseKey === candidateFranchise.franchiseKey
  ) {
    if (
      queryFranchise.installmentNumber !== null &&
      candidateFranchise.installmentNumber !== null
    ) {
      if (queryFranchise.installmentNumber === candidateFranchise.installmentNumber) {
        return 100;
      }
      // Same franchise, genuinely wrong installment (e.g. "final destination 6" vs "Final Destination 5" or "Final Destination" [2000])
      return 44;
    }
  }

  // Also check if queryFranchise's canonicalTitle matches the candidate (including singular/plural or subtitle)
  if (queryFranchise && !queryFranchise.entry.isAmbiguous) {
    const normCanonical = normalizeNumeralsInTitle(
      normalizeForSearch(queryFranchise.canonicalTitle)
    );
    if (normCanonical && (normCanonical === numNormCandidate || normCanonical === bareCandidate)) {
      return 100;
    }
  }

  const qWords = bareQuery.split(' ').filter(Boolean);
  const cWords = bareCandidate.split(' ').filter(Boolean);

  // Check 1-to-1 inflection (singular/plural) or high-confidence fuzzy typo equivalence across all tokens
  if (qWords.length > 0 && qWords.length === cWords.length) {
    let minPairSim = 1.0;
    for (let i = 0; i < qWords.length; i++) {
      const sim = computeTokenSimilarity(qWords[i], cWords[i]);
      if (sim < minPairSim) minPairSim = sim;
    }
    if (minPairSim >= 0.95) {
      return 97;
    }
    if (minPairSim >= 0.84) {
      return 92;
    }
  }

  // Sequel number protection (for non-protected titles):
  // A missing sequel number is ONLY penalized when franchise metadata did NOT establish candidate as that installment.
  const querySequelTokens = extractSequelNumbers(numNormQuery, rawQuery);
  const candidateSequelTokens = extractSequelNumbers(numNormCandidate, rawCandidate);

  const isEstablishedFranchiseInstallment = Boolean(
    queryFranchise &&
      candidateFranchise &&
      queryFranchise.franchiseKey === candidateFranchise.franchiseKey &&
      queryFranchise.installmentNumber !== null &&
      queryFranchise.installmentNumber === candidateFranchise.installmentNumber
  );

  const candidateMissingSequelNumber =
    !isEstablishedFranchiseInstallment &&
    querySequelTokens.length > 0 &&
    querySequelTokens.some(
      (numToken) => !new RegExp(`\\b${numToken}\\b`).test(numNormCandidate)
    );

  // Also check explicit conflicting sequel numbers (e.g., query has "3" and candidate has "2")
  const hasConflictingSequelNumber =
    !isEstablishedFranchiseInstallment &&
    querySequelTokens.length > 0 &&
    candidateSequelTokens.length > 0 &&
    querySequelTokens.some((qn) => !candidateSequelTokens.includes(qn));

  // If query has NO sequel number (e.g. "John Wick" or "Final Destination") and candidate has a sequel marker
  const candidateHasExtraSequelMarker =
    querySequelTokens.length === 0 &&
    (/\b(?:chapter|part|vol|volume)\s+[2-9]\b|\b[2-9]$/.test(numNormCandidate) ||
      Boolean(
        candidateFranchise &&
          candidateFranchise.installmentNumber !== null &&
          candidateFranchise.installmentNumber > 1 &&
          (!queryFranchise || queryFranchise.installmentNumber === 1)
      ));

  // Protected numeric token check: if rawQuery is a protected numeric title like "Blade Runner 2049" or "1917",
  // require the numeric token ("2049", "1917") to be present in the candidate for a high score
  const queryProtectedNumbers = isProtectedNumericTitle(rawQuery)
    ? numNormQuery.match(/\b\d{3,4}\b/g) || []
    : [];
  const candidateMissingProtectedNumber =
    queryProtectedNumbers.length > 0 &&
    queryProtectedNumbers.some((num) => !new RegExp(`\\b${num}\\b`).test(numNormCandidate));

  if (
    (numNormCandidate.startsWith(numNormQuery + ' ') ||
      bareCandidate.startsWith(bareQuery + ' ')) &&
    !candidateMissingProtectedNumber
  ) {
    return candidateHasExtraSequelMarker ? 72 : 85;
  }

  if (
    (numNormQuery.startsWith(numNormCandidate + ' ') ||
      bareQuery.startsWith(bareCandidate + ' ')) &&
    !candidateMissingSequelNumber &&
    !candidateMissingProtectedNumber
  ) {
    return 75;
  }

  if (
    numNormCandidate.includes(numNormQuery) &&
    !candidateMissingSequelNumber &&
    !candidateMissingProtectedNumber
  ) {
    return candidateHasExtraSequelMarker ? 64 : 72;
  }

  if (qWords.length > 0 && cWords.length > 0) {
    let totalSim = 0;
    let matchedCount = 0;

    for (const qw of qWords) {
      let bestWordSim = 0;
      for (const cw of cWords) {
        const sim = computeTokenSimilarity(qw, cw);
        if (sim > bestWordSim) bestWordSim = sim;
      }
      if (bestWordSim >= 0.84) {
        matchedCount++;
        totalSim += bestWordSim;
      }
    }

    const recall = matchedCount / qWords.length;
    const avgSim = matchedCount > 0 ? totalSim / qWords.length : 0;
    const precision = matchedCount / cWords.length;

    if (recall >= 0.75) {
      const base = Math.round(avgSim * 58 + precision * 26);
      if (hasConflictingSequelNumber) return Math.max(0, base - 34);
      if (candidateMissingProtectedNumber) return Math.max(0, base - 26);
      if (candidateMissingSequelNumber) return Math.max(0, base - 26);
      if (candidateHasExtraSequelMarker) return Math.max(0, base - 10);
      return base;
    }

    if (recall >= 0.5 && qWords.length >= 2) {
      const base = Math.round(avgSim * 44 + precision * 12);
      if (hasConflictingSequelNumber) return Math.max(0, base - 28);
      if (candidateMissingSequelNumber || candidateMissingProtectedNumber) {
        return Math.max(0, base - 18);
      }
      return base;
    }
  }

  return 0;
}

export interface DeterministicCandidateScoreInput {
  title: string;
  normalizedTitle?: string;
  alternateQueries?: string[];
  mediaTypeHint?: MediaType | null;
  yearHint?: number | null;
  inferredTypeHint?: MediaType | null;
  inferredYearHint?: number | null;
  tmdbIdHint?: number | null;
  franchiseKey?: string | null;
  installmentNumber?: number | null;
  confidence?: number;
  isAmbiguous?: boolean;
}

/**
 * Scores a MediaItem candidate against a deterministically normalized query/import item.
 * Combines:
 * - Exact official title, original title, & canonical alias match
 * - Franchise & installment identity match (boosting exact subtitled sequels, penalizing wrong installments)
 * - Token overlap & fuzzy spelling similarity
 * - Release year alignment
 * - Media type alignment
 * - Canonical TMDB identity
 * - Popularity / vote count & rating strictly as secondary tie-breakers (max 0..5 pts)
 */
export function scoreDeterministicCandidate(
  input: DeterministicCandidateScoreInput,
  candidate: MediaItem
): number {
  const normOriginal = normalizeMediaTitle(input.title);
  const normCandidate = normalizeMediaTitle(candidate.title);
  if (!normOriginal || !normCandidate) return 0;

  // Hard constraint: if an explicit mediaTypeHint ('movie' or 'tv') was supplied by the user,
  // never match the opposite media type.
  if (input.mediaTypeHint && candidate.type !== input.mediaTypeHint) {
    return -100;
  }

  const candidateTitles = [candidate.title];
  if (
    candidate.originalTitle &&
    candidate.originalTitle.toLowerCase() !== candidate.title.toLowerCase()
  ) {
    candidateTitles.push(candidate.originalTitle);
  }

  let bestTitleScore = 0;
  for (const cTitle of candidateTitles) {
    const directSim = computeDeterministicTitleSimilarity(input.title, cTitle);
    if (directSim > bestTitleScore) {
      bestTitleScore = directSim;
    }

    if (input.normalizedTitle) {
      const canonicalSim = computeDeterministicTitleSimilarity(
        input.normalizedTitle,
        cTitle
      );
      if (canonicalSim > bestTitleScore) {
        bestTitleScore = canonicalSim;
      }
      if (
        normalizeForSearch(input.normalizedTitle) === normalizeForSearch(cTitle) &&
        (input.confidence ?? 0.8) >= 0.85 &&
        !input.isAmbiguous
      ) {
        bestTitleScore = Math.max(bestTitleScore, 104);
      }
    }

    if (Array.isArray(input.alternateQueries)) {
      for (const alt of input.alternateQueries.slice(0, 5)) {
        // Only give full 0.95 weight to specific alternate queries, not broad base-franchise fallback queries
        // when the query itself specified a specific installment
        const altSim = Math.round(computeDeterministicTitleSimilarity(alt, cTitle) * 0.92);
        if (altSim > bestTitleScore) {
          bestTitleScore = altSim;
        }
      }
    }
  }

  let score = bestTitleScore;
  if (score <= 0) return 0;

  // Canonical TMDB identity extraction
  const tmdbIdentity = extractCanonicalTmdbIdentity(candidate.id, candidate.type);

  // Franchise & Installment Identity Alignment
  const queryFranchise =
    input.franchiseKey !== undefined && input.franchiseKey !== null
      ? {
          franchiseKey: input.franchiseKey,
          installmentNumber: input.installmentNumber ?? null,
        }
      : identifyFranchiseInstallment(input.title, input.yearHint ?? input.inferredYearHint);

  const candidateFranchise = identifyFranchiseInstallment(
    candidate.title,
    candidate.year,
    tmdbIdentity?.tmdbId ?? null
  );

  if (
    input.tmdbIdHint &&
    tmdbIdentity?.tmdbId === input.tmdbIdHint &&
    !input.isAmbiguous
  ) {
    score += 24;
  }

  if (
    queryFranchise &&
    candidateFranchise &&
    queryFranchise.franchiseKey === candidateFranchise.franchiseKey
  ) {
    if (
      queryFranchise.installmentNumber !== null &&
      candidateFranchise.installmentNumber !== null
    ) {
      if (queryFranchise.installmentNumber === candidateFranchise.installmentNumber) {
        score += 18;
      } else {
        // Strong wrong-installment penalty so e.g. Final Destination (2000) or Final Destination 5
        // never outranks Final Destination Bloodlines (2025) when searching "final destination 6"
        score -= 35;
      }
    }
  }

  // Media type alignment
  if (input.mediaTypeHint && candidate.type === input.mediaTypeHint) {
    score += 18;
  } else if (
    !input.mediaTypeHint &&
    input.inferredTypeHint &&
    candidate.type === input.inferredTypeHint
  ) {
    score += 10;
  }

  // Release year alignment
  if (input.yearHint && candidate.year > 0) {
    const yearDiff = Math.abs(candidate.year - input.yearHint);
    if (yearDiff === 0) {
      score += 26;
    } else if (yearDiff === 1) {
      score += 14;
    } else if (yearDiff <= 2) {
      score -= 6;
    } else {
      score -= 26;
    }
  } else if (
    !input.yearHint &&
    !input.isAmbiguous &&
    input.inferredYearHint &&
    candidate.year > 0 &&
    (input.confidence ?? 0) >= 0.85
  ) {
    const inferredDiff = Math.abs(candidate.year - input.inferredYearHint);
    if (inferredDiff === 0) {
      score += 14;
    } else if (inferredDiff === 1) {
      score += 6;
    }
  }

  // Canonical TMDB identity bonus
  if (tmdbIdentity) {
    score += 10;
  }

  // Secondary tie-breakers: vote count and rating (strictly bounded to 0..5 points so popularity never overrides title accuracy)
  const numericVotes = parseNumericVoteCount(candidate.voteCount);
  if (numericVotes >= 50_000) {
    score += 3;
  } else if (numericVotes >= 5_000) {
    score += 2;
  } else if (numericVotes >= 200) {
    score += 1;
  }

  if (candidate.rating >= 7.5) {
    score += 2;
  } else if (candidate.rating >= 6.5) {
    score += 1;
  }

  return Math.max(0, score);
}

/**
 * Ranks a merged pool of TMDB search candidates for Smart Search using deterministic
 * resolution metadata, preserves the active Movie / TV / All format filter,
 * and filters out irrelevant low-score tail items.
 */
export function rankSmartSearchCandidates(
  items: MediaItem[],
  originalQuery: string,
  resolved: DeterministicResolvedTitle,
  typeFilter: 'all' | 'movie' | 'tv'
): MediaItem[] {
  let pool = dedupeMediaItems(items);
  if (typeFilter !== 'all') {
    pool = pool.filter((item) => item.type === typeFilter);
  }

  const scored = pool.map((item, idx) => {
    const score = scoreDeterministicCandidate(
      {
        title: originalQuery,
        normalizedTitle: resolved.normalizedTitle,
        alternateQueries: resolved.alternateQueries,
        mediaTypeHint: typeFilter === 'all' ? null : typeFilter,
        yearHint: resolved.isAmbiguous ? null : resolved.yearHint,
        inferredTypeHint: resolved.mediaTypeHint,
        inferredYearHint: resolved.yearHint,
        tmdbIdHint: resolved.tmdbIdHint,
        franchiseKey: resolved.franchiseKey,
        installmentNumber: resolved.installmentNumber,
        confidence: resolved.confidence,
        isAmbiguous: resolved.isAmbiguous,
      },
      item
    );

    return { item, idx, score };
  });

  scored.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
    return a.idx - b.idx;
  });

  const bestScore = scored[0]?.score ?? 0;
  // Filter out irrelevant items so unrelated results never pad the list when strong matches exist
  const minThreshold = bestScore >= 95 ? 32 : bestScore >= 70 ? 20 : 1;
  const relevant = scored.filter((s) => s.score >= minThreshold);

  return (relevant.length > 0 ? relevant : scored.filter((s) => s.score > 0)).map(
    (s) => s.item
  );
}

/**
 * Detects whether a sorted list of scored candidates has multi-edition, cross-format,
 * or close-score ambiguity when no explicit year/type disambiguated the query.
 */
export function detectCandidateAmbiguity(params: {
  rawTitle: string;
  resolved: DeterministicResolvedTitle;
  explicitType?: MediaType | null;
  explicitYear?: number | null;
  scoredCandidates: Array<{ media: MediaItem; score: number }>;
}): {
  isAmbiguous: boolean;
  reason?: string;
} {
  const { rawTitle, resolved, explicitType, explicitYear, scoredCandidates } = params;
  const best = scoredCandidates[0];
  const second = scoredCandidates[1];

  if (!best) {
    return { isAmbiguous: false };
  }

  // 1. Explicit year mismatch (> 1 year difference from user-supplied year)
  if (explicitYear && best.media.year > 0 && Math.abs(best.media.year - explicitYear) > 1) {
    return {
      isAmbiguous: true,
      reason: `Closest title match is from ${best.media.year} (input specified ${explicitYear}). Please verify.`,
    };
  }

  // 2. Known multi-adaptation / year ambiguity from deterministic rule when no explicit year was supplied
  if (resolved.isAmbiguous && !explicitYear) {
    if (second && getCanonicalMediaKey(second.media) !== getCanonicalMediaKey(best.media)) {
      return {
        isAmbiguous: true,
        reason:
          resolved.ambiguityReason ||
          `Multiple editions found for '${rawTitle}' (${best.media.title} ${best.media.year} vs ${second.media.title} ${second.media.year}). Please select the edition you watched.`,
      };
    }
    return {
      isAmbiguous: true,
      reason:
        resolved.ambiguityReason ||
        `Multiple adaptations exist for '${rawTitle}'. Please verify the release year (${best.media.year}).`,
    };
  }

  if (!second || getCanonicalMediaKey(second.media) === getCanonicalMediaKey(best.media)) {
    return { isAmbiguous: false };
  }

  const normBest = normalizeMediaTitle(best.media.title);
  const normSecond = normalizeMediaTitle(second.media.title);

  // 3. Same normalized title across different release years or different media types when user didn't specify year
  if (
    !explicitYear &&
    normBest === normSecond &&
    best.media.year !== second.media.year &&
    second.score >= 78 &&
    best.score - second.score <= 15
  ) {
    return {
      isAmbiguous: true,
      reason: `Multiple editions found for '${rawTitle}' (${best.media.title} ${best.media.year} [${best.media.type === 'tv' ? 'Series' : 'Movie'}] vs ${second.media.title} ${second.media.year} [${second.media.type === 'tv' ? 'Series' : 'Movie'}]). Please select the edition you watched.`,
    };
  }

  // 4. Close rival candidates (score gap <= 12) when neither type nor year was explicitly specified
  if (
    !explicitType &&
    !explicitYear &&
    resolved.confidence < 0.9 &&
    best.score - second.score <= 12
  ) {
    return {
      isAmbiguous: true,
      reason: `Multiple similar titles found (${best.media.title} ${best.media.year} [${best.media.type === 'tv' ? 'Series' : 'Movie'}] vs ${second.media.title} ${second.media.year} [${second.media.type === 'tv' ? 'Series' : 'Movie'}]). Please verify.`,
    };
  }

  return { isAmbiguous: false };
}

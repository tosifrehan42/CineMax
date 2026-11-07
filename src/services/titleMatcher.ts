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
  confidence: number;
  smartMatched: boolean;
  isAmbiguous: boolean;
  ambiguityReason?: string;
}

export const MAX_TITLE_LENGTH = 200;

/**
 * Titles where a 4-digit number is genuinely part of the canonical title
 * rather than a release year suffix.
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
};

/**
 * Normalizes a title for deterministic comparison:
 * - Lowercases and strips diacritics
 * - Standardizes compound words (spider man -> spiderman / spider man equivalence)
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
    .replace(/\bx[\s-]+men\b/g, 'x men')
    .replace(/\bant[\s-]+man\b/g, 'ant man')
    .replace(/\bbat[\s-]+man\b/g, 'batman')
    .replace(/\bsuper[\s-]+man\b/g, 'superman')
    .replace(/\biron[\s-]+man\b/g, 'iron man')
    .replace(/\bspider[\s-]+verse\b/g, 'spider verse')
    .replace(/\bsci[\s-]+fi\b/g, 'sci fi')
    .replace(/[-–—:/.,!?()+"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts trailing or sequel Roman numerals to Arabic numerals in a normalized string
 * so "Part II" and "Part 2" or "Chapter III" and "Chapter 3" can be compared deterministically.
 */
export function normalizeNumeralsInTitle(normText: string): string {
  if (!normText) return '';
  return normText
    .replace(/\bpart\s+one\b/g, 'part 1')
    .replace(/\bpart\s+two\b/g, 'part 2')
    .replace(/\bpart\s+three\b/g, 'part 3')
    .replace(/\bpart\s+four\b/g, 'part 4')
    .replace(/\bchapter\s+one\b/g, 'chapter 1')
    .replace(/\bchapter\s+two\b/g, 'chapter 2')
    .replace(/\bchapter\s+three\b/g, 'chapter 3')
    .replace(/\bchapter\s+four\b/g, 'chapter 4')
    .split(' ')
    .map((token, idx, arr) => {
      // Only map standalone sequel Roman numerals (not single 'i' or 'v' unless preceded by part/chapter or at end)
      if (idx > 0 && ROMAN_TO_ARABIC[token]) {
        if (token === 'v' && idx < arr.length - 1 && arr[idx - 1] !== 'part' && arr[idx - 1] !== 'episode') {
          return token;
        }
        return ROMAN_TO_ARABIC[token];
      }
      return token;
    })
    .join(' ');
}

interface CanonicalAliasRule {
  pattern: RegExp;
  normalizedTitle: string;
  alternateQueries: string[];
  mediaTypeHint: MediaType | null;
  yearHint: number | null;
  confidence: number;
  isAmbiguous?: boolean;
  ambiguityReason?: string;
}

const CANONICAL_ALIAS_RULES: CanonicalAliasRule[] = [
  // John Wick Franchise
  {
    pattern: /^john\s*wick\s*(?:chapter\s*)?(?:3|iii)(?:\s*[-–—:]?\s*parabellum)?$/i,
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
    pattern: /^john\s*wick\s*(?:chapter\s*)?(?:1|i)$/i,
    normalizedTitle: 'John Wick',
    alternateQueries: ['John Wick'],
    mediaTypeHint: 'movie',
    yearHint: 2014,
    confidence: 0.95,
  },

  // The Dark Knight Trilogy
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
    pattern: /^batman\s*begins$/i,
    normalizedTitle: 'Batman Begins',
    alternateQueries: ['Batman Begins'],
    mediaTypeHint: 'movie',
    yearHint: 2005,
    confidence: 0.96,
  },

  // Spider-Man Franchise
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
    pattern: /^spider[\s-]*man[\s:]*far\s*from\s*home$/i,
    normalizedTitle: 'Spider-Man: Far From Home',
    alternateQueries: ['Spider-Man: Far From Home', 'Spider Man Far From Home'],
    mediaTypeHint: 'movie',
    yearHint: 2019,
    confidence: 0.96,
  },
  {
    pattern: /^spider[\s-]*man[\s:]*homecoming$/i,
    normalizedTitle: 'Spider-Man: Homecoming',
    alternateQueries: ['Spider-Man: Homecoming', 'Spider Man Homecoming'],
    mediaTypeHint: 'movie',
    yearHint: 2017,
    confidence: 0.96,
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

  // Avengers & Marvel
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
    pattern: /^(?:the\s+)?avengers[\s:]*age\s*of\s*ultron$/i,
    normalizedTitle: 'Avengers: Age of Ultron',
    alternateQueries: ['Avengers: Age of Ultron', 'Avengers Age of Ultron'],
    mediaTypeHint: 'movie',
    yearHint: 2015,
    confidence: 0.96,
  },

  // Mission: Impossible Franchise
  {
    pattern: /^mission[\s:]*impossible\s*(?:[-–—:]?\s*)?fallout$/i,
    normalizedTitle: 'Mission: Impossible - Fallout',
    alternateQueries: ['Mission: Impossible - Fallout', 'Mission Impossible Fallout'],
    mediaTypeHint: 'movie',
    yearHint: 2018,
    confidence: 0.96,
  },
  {
    pattern: /^mission[\s:]*impossible\s*(?:[-–—:]?\s*)?dead\s*reckoning(?:\s*part\s*(?:one|1))?$/i,
    normalizedTitle: 'Mission: Impossible - Dead Reckoning Part One',
    alternateQueries: [
      'Mission: Impossible - Dead Reckoning Part One',
      'Mission Impossible Dead Reckoning',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2023,
    confidence: 0.95,
  },

  // Lord of the Rings
  {
    pattern: /^(?:the\s+)?(?:lord\s+of\s+the\s+rings|lotr)[\s:]*(?:the\s+)?fellowship\s+of\s+the\s+ring$/i,
    normalizedTitle: 'The Lord of the Rings: The Fellowship of the Ring',
    alternateQueries: [
      'The Lord of the Rings: The Fellowship of the Ring',
      'Fellowship of the Ring',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2001,
    confidence: 0.97,
  },
  {
    pattern: /^(?:the\s+)?(?:lord\s+of\s+the\s+rings|lotr)[\s:]*(?:the\s+)?two\s+towers$/i,
    normalizedTitle: 'The Lord of the Rings: The Two Towers',
    alternateQueries: ['The Lord of the Rings: The Two Towers', 'The Two Towers'],
    mediaTypeHint: 'movie',
    yearHint: 2002,
    confidence: 0.97,
  },
  {
    pattern: /^(?:the\s+)?(?:lord\s+of\s+the\s+rings|lotr)[\s:]*(?:the\s+)?return\s+of\s+the\s+king$/i,
    normalizedTitle: 'The Lord of the Rings: The Return of the King',
    alternateQueries: [
      'The Lord of the Rings: The Return of the King',
      'Return of the King',
    ],
    mediaTypeHint: 'movie',
    yearHint: 2003,
    confidence: 0.97,
  },

  // Protected Numeric & Landmark Titles
  {
    pattern: /^blade\s*runner\s*2049$/i,
    normalizedTitle: 'Blade Runner 2049',
    alternateQueries: ['Blade Runner 2049'],
    mediaTypeHint: 'movie',
    yearHint: 2017,
    confidence: 0.98,
  },
  {
    pattern: /^1917$/i,
    normalizedTitle: '1917',
    alternateQueries: ['1917'],
    mediaTypeHint: 'movie',
    yearHint: 2019,
    confidence: 0.96,
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
    pattern: /^better\s*call\s*saul$/i,
    normalizedTitle: 'Better Call Saul',
    alternateQueries: ['Better Call Saul'],
    mediaTypeHint: 'tv',
    yearHint: 2015,
    confidence: 0.98,
  },
  {
    pattern: /^(?:the\s+)?shawshank\s*redemption$/i,
    normalizedTitle: 'The Shawshank Redemption',
    alternateQueries: ['The Shawshank Redemption', 'Shawshank Redemption'],
    mediaTypeHint: 'movie',
    yearHint: 1994,
    confidence: 0.98,
  },
  {
    pattern: /^(?:the\s+)?godfather(?:\s*part\s*(?:2|ii))$/i,
    normalizedTitle: 'The Godfather Part II',
    alternateQueries: ['The Godfather Part II', 'The Godfather 2'],
    mediaTypeHint: 'movie',
    yearHint: 1974,
    confidence: 0.97,
  },
  {
    pattern: /^(?:the\s+)?godfather$/i,
    normalizedTitle: 'The Godfather',
    alternateQueries: ['The Godfather', 'Godfather'],
    mediaTypeHint: 'movie',
    yearHint: 1972,
    confidence: 0.97,
  },

  // Dune Specific & Ambiguous Rules
  {
    pattern: /^dune\s*(?:[:–—-]?\s*)?(?:part\s*)?(?:2|ii|two)$/i,
    normalizedTitle: 'Dune: Part Two',
    alternateQueries: ['Dune: Part Two', 'Dune Part Two', 'Dune 2'],
    mediaTypeHint: 'movie',
    yearHint: 2024,
    confidence: 0.97,
  },
  {
    pattern: /^dune\s*(?:[:–—-]?\s*)?part\s*(?:1|i|one)$/i,
    normalizedTitle: 'Dune',
    alternateQueries: ['Dune', 'Dune: Part One'],
    mediaTypeHint: 'movie',
    yearHint: 2021,
    confidence: 0.96,
  },
  {
    pattern: /^dune$/i,
    normalizedTitle: 'Dune',
    alternateQueries: ['Dune', 'Dune: Part Two'],
    mediaTypeHint: 'movie',
    yearHint: null,
    confidence: 0.65,
    isAmbiguous: true,
    ambiguityReason:
      "Multiple screen adaptations exist for 'Dune' (2021, 1984, and Dune: Part Two 2024). Please select the exact release year.",
  },

  // The Office (US 2005 vs UK 2001) & Multi-Adaptation Ambiguous Titles
  {
    pattern: /^(?:the\s+)?office\s*(?:us|u\.s\.|american)$/i,
    normalizedTitle: 'The Office',
    alternateQueries: ['The Office'],
    mediaTypeHint: 'tv',
    yearHint: 2005,
    confidence: 0.95,
  },
  {
    pattern: /^(?:the\s+)?office\s*(?:uk|u\.k\.|british)$/i,
    normalizedTitle: 'The Office',
    alternateQueries: ['The Office'],
    mediaTypeHint: 'tv',
    yearHint: 2001,
    confidence: 0.95,
  },
  {
    pattern: /^(?:the\s+)?office$/i,
    normalizedTitle: 'The Office',
    alternateQueries: ['The Office'],
    mediaTypeHint: 'tv',
    yearHint: null,
    confidence: 0.65,
    isAmbiguous: true,
    ambiguityReason:
      "Multiple editions found for 'The Office' (US 2005 vs UK 2001). Please select the edition you watched.",
  },
  {
    pattern: /^fargo$/i,
    normalizedTitle: 'Fargo',
    alternateQueries: ['Fargo'],
    mediaTypeHint: null,
    yearHint: null,
    confidence: 0.65,
    isAmbiguous: true,
    ambiguityReason:
      "Both the 1996 movie and the 2014 TV series are titled 'Fargo'. Please specify Movie or Series.",
  },
  {
    pattern: /^(?:the\s+)?thing$/i,
    normalizedTitle: 'The Thing',
    alternateQueries: ['The Thing'],
    mediaTypeHint: 'movie',
    yearHint: null,
    confidence: 0.65,
    isAmbiguous: true,
    ambiguityReason:
      "Multiple films share the title 'The Thing' (1982 vs 2011). Please select the release year.",
  },
  {
    pattern: /^scarface$/i,
    normalizedTitle: 'Scarface',
    alternateQueries: ['Scarface'],
    mediaTypeHint: 'movie',
    yearHint: null,
    confidence: 0.68,
    isAmbiguous: true,
    ambiguityReason:
      "Multiple films share the title 'Scarface' (1983 vs 1932). Please confirm the release year.",
  },
  {
    pattern: /^ghostbusters$/i,
    normalizedTitle: 'Ghostbusters',
    alternateQueries: ['Ghostbusters'],
    mediaTypeHint: 'movie',
    yearHint: null,
    confidence: 0.68,
    isAmbiguous: true,
    ambiguityReason:
      "Multiple releases share the title 'Ghostbusters' (1984 vs 2016). Please confirm the release year.",
  },
];

function deduplicateStringsCaseInsensitive(list: string[], maxCount = 4): string[] {
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
 * Generates deterministic alternative TMDB search queries for a cleaned title
 * (e.g., hyphenation variants, Chapter/Part variants, Roman/Arabic numeral variants,
 * and leading article variations).
 */
function buildHeuristicAlternateQueries(
  cleanOriginal: string,
  heuristicNormalized: string
): string[] {
  const candidates: string[] = [heuristicNormalized, cleanOriginal];

  // If title ends with a single sequel digit (2..9) and doesn't already say "Chapter" or "Part",
  // add "Part X" and Roman numeral variants as secondary queries
  const trailingDigitMatch = heuristicNormalized.match(/^(.+?)\s+([2-9])$/);
  if (trailingDigitMatch) {
    const base = trailingDigitMatch[1].trim();
    const digit = trailingDigitMatch[2];
    if (!/\b(?:part|chapter|season|episode|vol|volume)\b/i.test(base)) {
      const roman = ARABIC_TO_ROMAN[digit];
      if (roman) {
        candidates.push(`${base} ${roman}`);
      }
      candidates.push(`${base}: Part ${digit}`);
    }
  }

  // If title has a colon or dash subtitle, include the space-separated version
  if (/[:–—-]/.test(heuristicNormalized)) {
    candidates.push(
      heuristicNormalized
        .replace(/[:–—-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  return deduplicateStringsCaseInsensitive(candidates, 4);
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

  const punctuationStripped = cleanTitle
    .replace(/[-–—:/.,!?&()+"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const rule of CANONICAL_ALIAS_RULES) {
    if (rule.pattern.test(cleanTitle) || rule.pattern.test(punctuationStripped)) {
      // If the rule is marked ambiguous (e.g. "Dune" or "The Office"), check whether the user
      // provided an explicit year or type that disambiguates it!
      const isDisambiguatedByYear = Boolean(explicitYear);
      const isDisambiguatedByType = Boolean(
        rule.pattern.source === '^fargo$' && explicitType
      );
      const isAmbiguous = Boolean(
        rule.isAmbiguous && !isDisambiguatedByYear && !isDisambiguatedByType
      );

      const effectiveType = explicitType || rule.mediaTypeHint;
      const effectiveYear = isAmbiguous ? null : explicitYear ?? rule.yearHint;
      const canonicalDiffers =
        rule.normalizedTitle.toLowerCase() !== cleanTitle.toLowerCase();

      return {
        rowId,
        originalQuery: rawOriginal,
        originalTitle: rawOriginal,
        normalizedTitle: rule.normalizedTitle,
        alternateQueries: deduplicateStringsCaseInsensitive(
          [rule.normalizedTitle, ...rule.alternateQueries, cleanTitle],
          4
        ),
        mediaTypeHint: effectiveType,
        yearHint: effectiveYear,
        confidence: isAmbiguous ? 0.65 : rule.confidence,
        smartMatched: canonicalDiffers || isAmbiguous || Boolean(extractedYear || extractedType),
        isAmbiguous,
        ambiguityReason: isAmbiguous ? rule.ambiguityReason : undefined,
      };
    }
  }

  // Generic deterministic compound & punctuation cleanup
  const heuristicNormalized = cleanTitle
    .replace(/\bspider\s+man\b/gi, 'Spider-Man')
    .replace(/\bx\s+men\b/gi, 'X-Men')
    .replace(/\bant\s+man\b/gi, 'Ant-Man')
    .replace(/\bmission\s+impossible\b/gi, 'Mission: Impossible')
    .replace(/\bstar\s+wars\s+episode\b/gi, 'Star Wars: Episode')
    .trim();

  const alternates = buildHeuristicAlternateQueries(cleanTitle, heuristicNormalized);
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
 * Computes deterministic title similarity (0..100) between a query and a candidate title,
 * accounting for articles ("The"), numeral equivalence ("Part II" vs "Part 2"),
 * and penalizing sequel-number mismatches (so "John Wick 3" never scores high against "John Wick").
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

  // Sequel number protection: if query specifies a sequel number (2..19 or ii..ix),
  // penalize candidates that omit that sequel number
  const querySequelTokens = numNormQuery.match(/\b([2-9]|1[0-9])\b/g);
  const candidateMissingSequelNumber = Boolean(
    querySequelTokens &&
      querySequelTokens.some(
        (numToken) => !new RegExp(`\\b${numToken}\\b`).test(numNormCandidate)
      )
  );

  // Also check reverse: if query has NO sequel number (e.g. "John Wick" or "Dune")
  // and candidate has "chapter 2/3/4" or "part 2", penalize the sequel slightly below the original
  const candidateHasSequelMarker =
    /\b(?:chapter|part|vol|volume)\s+[2-9]\b|\b[2-9]$/.test(numNormCandidate) &&
    !/\b(?:chapter|part|vol|volume)\s+[2-9]\b|\b[2-9]$/.test(numNormQuery);

  if (numNormCandidate.startsWith(numNormQuery + ' ') || bareCandidate.startsWith(bareQuery + ' ')) {
    return candidateHasSequelMarker ? 72 : 82;
  }

  if (
    (numNormQuery.startsWith(numNormCandidate + ' ') ||
      bareQuery.startsWith(bareCandidate + ' ')) &&
    !candidateMissingSequelNumber
  ) {
    return 74;
  }

  if (numNormCandidate.includes(numNormQuery) && !candidateMissingSequelNumber) {
    return candidateHasSequelMarker ? 62 : 68;
  }

  const qWords = bareQuery.split(' ').filter(Boolean);
  const cWords = bareCandidate.split(' ').filter(Boolean);
  if (qWords.length > 0 && cWords.length > 0) {
    const matchedWords = qWords.filter((qw) =>
      cWords.some((cw) => cw === qw || (qw.length >= 4 && cw.startsWith(qw)))
    );
    const recall = matchedWords.length / qWords.length;
    const precision = matchedWords.length / cWords.length;

    if (recall >= 0.75) {
      const base = Math.round(recall * 54 + precision * 24);
      if (candidateMissingSequelNumber) return Math.max(0, base - 28);
      if (candidateHasSequelMarker) return Math.max(0, base - 10);
      return base;
    }

    if (recall >= 0.5 && qWords.length >= 2) {
      const base = Math.round(recall * 38);
      return candidateMissingSequelNumber ? Math.max(0, base - 22) : base;
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
  confidence?: number;
  isAmbiguous?: boolean;
}

/**
 * Scores a MediaItem candidate against a deterministically normalized query/import item.
 * Combines:
 * - Exact normalized title & canonical alias match
 * - Token overlap & title similarity
 * - Release year alignment
 * - Media type alignment
 * - Canonical TMDB identity
 * - Popularity / vote count & rating strictly as secondary tie-breakers
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

  let bestTitleScore = computeDeterministicTitleSimilarity(input.title, candidate.title);

  if (input.normalizedTitle) {
    const canonicalSim = computeDeterministicTitleSimilarity(
      input.normalizedTitle,
      candidate.title
    );
    if (canonicalSim > bestTitleScore) {
      bestTitleScore = canonicalSim;
    }
    if (
      normalizeForSearch(input.normalizedTitle) === normalizeForSearch(candidate.title) &&
      (input.confidence ?? 0.8) >= 0.85 &&
      !input.isAmbiguous
    ) {
      bestTitleScore = Math.max(bestTitleScore, 102);
    }
  }

  if (Array.isArray(input.alternateQueries)) {
    for (const alt of input.alternateQueries.slice(0, 4)) {
      const altSim = Math.round(
        computeDeterministicTitleSimilarity(alt, candidate.title) * 0.95
      );
      if (altSim > bestTitleScore) {
        bestTitleScore = altSim;
      }
    }
  }

  let score = bestTitleScore;
  if (score <= 0) return 0;

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
  if (extractCanonicalTmdbIdentity(candidate.id, candidate.type)) {
    score += 10;
  }

  // Secondary tie-breakers: vote count and rating (bounded to 0..5 points so popularity never overrides title accuracy)
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

  return score;
}

/**
 * Ranks a merged pool of TMDB search candidates for Smart Search using deterministic
 * resolution metadata and preserves the active Movie / TV / All format filter.
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

  return scored.map((s) => s.item);
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

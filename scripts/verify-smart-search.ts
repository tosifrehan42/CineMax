import {
  computeDeterministicTitleSimilarity,
  computeTokenSimilarity,
  detectCandidateAmbiguity,
  generateSearchQueryVariants,
  identifyFranchiseInstallment,
  isProtectedNumericTitle,
  normalizeForSearch,
  normalizeNumeralsInTitle,
  rankSmartSearchCandidates,
  resolveDeterministicTitle,
  scoreDeterministicCandidate,
} from '../src/services/titleMatcher.ts';
import { executeSmartSearch } from '../src/services/mediaApi.ts';
import {
  parseTextImportList,
  resolveExtractedImportItems,
} from '../src/services/completedImportService.ts';
import { MEDIA_ITEMS } from '../src/data/mediaData.ts';
import {
  EXTRA_ANCHOR_ITEMS,
  INDIAN_TRENDING_ITEMS,
} from '../src/data/franchiseData.ts';
import { dedupeMediaItems } from '../src/utils/mediaIntegrity.ts';
import type { MediaItem } from '../src/types/index.ts';

const fullCatalogPool: MediaItem[] = dedupeMediaItems([
  ...MEDIA_ITEMS,
  ...EXTRA_ANCHOR_ITEMS,
  ...INDIAN_TRENDING_ITEMS,
]);

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    passed++;
    console.log(`PASS: ${description}`);
  } else {
    failed++;
    console.error(`FAIL: ${description}`);
  }
}

async function runVerificationSuite() {
  console.log('=== 1. Query Normalization, Numerals, Fuzzy Tokens & Protected Titles ===');

  assert(
    isProtectedNumericTitle('1917') && isProtectedNumericTitle('Blade Runner 2049'),
    'Protected numeric titles ("1917", "Blade Runner 2049") are recognized and preserved'
  );
  assert(
    !isProtectedNumericTitle('final destination 6') && !isProtectedNumericTitle('john wick 3'),
    'Sequel queries ("final destination 6", "john wick 3") are not misclassified as protected numeric titles'
  );
  assert(
    normalizeNumeralsInTitle(normalizeForSearch('John Wick Chapter III')) ===
      'john wick chapter 3',
    'Roman numeral normalization converts "John Wick Chapter III" -> "john wick chapter 3"'
  );
  assert(
    computeTokenSimilarity('bloodline', 'bloodlines') >= 0.95,
    'Singular/plural token similarity ("bloodline" <-> "bloodlines") >= 0.95'
  );
  assert(
    computeTokenSimilarity('interstelar', 'interstellar') >= 0.84,
    'Fuzzy typo token similarity ("interstelar" <-> "interstellar") >= 0.84'
  );

  console.log('\n=== 2. Franchise Registry, Multi-Variant Query Expansion & Sequel Scoring ===');

  const fd6Inst = identifyFranchiseInstallment('final destination 6');
  const fdBloodlinesInst = identifyFranchiseInstallment('Final Destination Bloodlines');
  assert(
    Boolean(
      fd6Inst &&
        fdBloodlinesInst &&
        fd6Inst.franchiseKey === 'final-destination' &&
        fd6Inst.installmentNumber === 6 &&
        fdBloodlinesInst.installmentNumber === 6
    ),
    'Franchise registry maps both "final destination 6" and "Final Destination Bloodlines" to Final Destination installment #6'
  );

  const fd6SimToBloodlines = computeDeterministicTitleSimilarity(
    'final destination 6',
    'Final Destination Bloodlines'
  );
  const fd6SimToFd1 = computeDeterministicTitleSimilarity(
    'final destination 6',
    'Final Destination'
  );
  const fd6SimToFd5 = computeDeterministicTitleSimilarity(
    'final destination 6',
    'Final Destination 5'
  );

  assert(
    fd6SimToBloodlines === 100 && fd6SimToBloodlines > fd6SimToFd1 + 40 && fd6SimToBloodlines > fd6SimToFd5 + 40,
    `Franchise-aware sequel scoring: "final destination 6" vs "Final Destination Bloodlines" (${fd6SimToBloodlines}) >> "Final Destination" (${fd6SimToFd1}) & "Final Destination 5" (${fd6SimToFd5})`
  );

  const fdBloodlineSim = computeDeterministicTitleSimilarity(
    'final destination bloodline',
    'Final Destination Bloodlines'
  );
  assert(
    fdBloodlineSim >= 97,
    `"final destination bloodline" similarity to "Final Destination Bloodlines" is ${fdBloodlineSim} (>= 97)`
  );

  const jwRomanVariants = generateSearchQueryVariants(
    'john wick chapter iii',
    'John Wick: Chapter 3 – Parabellum',
    identifyFranchiseInstallment('john wick chapter iii')?.entry
  );
  assert(
    jwRomanVariants.includes('John Wick: Chapter 3 – Parabellum') &&
      jwRomanVariants.some((q) => q.toLowerCase().includes('john wick')),
    `Multi-variant query expansion for "john wick chapter iii" produces: [${jwRomanVariants.join(', ')}]`
  );

  console.log('\n=== 3. Exact 12 Required Search Queries (Ranking & Live Smart Search) ===');

  const requiredCases: Array<{
    query: string;
    expectedTopTitle: string;
    expectedYear?: number;
    expectedType?: 'movie' | 'tv';
    expectAmbiguous?: boolean;
  }> = [
    {
      query: 'final destination 6',
      expectedTopTitle: 'Final Destination Bloodlines',
      expectedYear: 2025,
      expectedType: 'movie',
    },
    {
      query: 'final destination bloodline',
      expectedTopTitle: 'Final Destination Bloodlines',
      expectedYear: 2025,
      expectedType: 'movie',
    },
    {
      query: 'john wick 3',
      expectedTopTitle: 'John Wick: Chapter 3 – Parabellum',
      expectedYear: 2019,
      expectedType: 'movie',
    },
    {
      query: 'john wick chapter iii',
      expectedTopTitle: 'John Wick: Chapter 3 – Parabellum',
      expectedYear: 2019,
      expectedType: 'movie',
    },
    {
      query: 'dark knight',
      expectedTopTitle: 'The Dark Knight',
      expectedYear: 2008,
      expectedType: 'movie',
    },
    {
      query: 'spider man no way home',
      expectedTopTitle: 'Spider-Man: No Way Home',
      expectedYear: 2021,
      expectedType: 'movie',
    },
    {
      query: 'dune 2',
      expectedTopTitle: 'Dune: Part Two',
      expectedYear: 2024,
      expectedType: 'movie',
    },
    {
      query: 'the office',
      expectedTopTitle: 'The Office',
      expectedType: 'tv',
      expectAmbiguous: true,
    },
    {
      query: 'breaking bad',
      expectedTopTitle: 'Breaking Bad',
      expectedYear: 2008,
      expectedType: 'tv',
    },
    {
      query: 'blade runner 2049',
      expectedTopTitle: 'Blade Runner 2049',
      expectedYear: 2017,
      expectedType: 'movie',
    },
    {
      query: '1917',
      expectedTopTitle: '1917',
      expectedYear: 2019,
      expectedType: 'movie',
    },
    {
      query: 'interstellar',
      expectedTopTitle: 'Interstellar',
      expectedYear: 2014,
      expectedType: 'movie',
    },
  ];

  for (const tc of requiredCases) {
    const resolved = resolveDeterministicTitle({ title: tc.query });
    const ranked = rankSmartSearchCandidates(
      fullCatalogPool,
      tc.query,
      resolved,
      'all'
    );
    const top = ranked[0];
    const smartRes = await executeSmartSearch({
      query: tc.query,
      typeFilter: 'all',
    });
    const smartTop = smartRes.items[0];

    const matchesTitle =
      top?.title === tc.expectedTopTitle && smartTop?.title === tc.expectedTopTitle;
    const matchesYear = tc.expectedYear
      ? top?.year === tc.expectedYear && smartTop?.year === tc.expectedYear
      : true;
    const matchesType = tc.expectedType
      ? top?.type === tc.expectedType && smartTop?.type === tc.expectedType
      : true;
    const matchesAmbiguity = tc.expectAmbiguous
      ? resolved.isAmbiguous === true
      : true;

    assert(
      Boolean(matchesTitle && matchesYear && matchesType && matchesAmbiguity),
      `Query "${tc.query}" -> #1 result: "${smartTop?.title} (${smartTop?.year})" [${smartTop?.type}]${
        tc.expectAmbiguous ? ` (ambiguous=${resolved.isAmbiguous})` : ''
      }`
    );

    if (tc.query === 'the office') {
      const officeEditions = smartRes.items.filter((i) => i.title === 'The Office');
      const years = officeEditions.map((i) => i.year).sort();
      assert(
        years.includes(2001) && years.includes(2005),
        `Query "the office" surfaces both genuine editions: UK (2001) and US (2005) -> [${years.join(', ')}]`
      );
    }
  }

  console.log('\n=== 4. Completed List Import Compatibility & Ambiguity Detection ===');

  const importSample = parseTextImportList(
    [
      'final destination 6',
      'final destination bloodline',
      'john wick chapter iii',
      'dune 2',
      'the office',
      'blade runner 2049',
      '1917',
    ].join('\n')
  );

  const importResolved = await resolveExtractedImportItems({
    extractedItems: importSample.items,
    allMedia: fullCatalogPool,
    watchlist: [],
    watchHistory: [],
    defaultWatchedDate: '2026-11-07',
  });

  const byRawLine = new Map(
    importResolved.map((r) => [r.extracted.rawLine.trim(), r])
  );

  assert(
    byRawLine.get('final destination 6')?.matchStatus === 'matched' &&
      byRawLine.get('final destination 6')?.selectedMedia?.title ===
        'Final Destination Bloodlines' &&
      byRawLine.get('final destination 6')?.selectedMedia?.year === 2025,
    'Import "final destination 6" auto-matches to "Final Destination Bloodlines (2025)"'
  );
  assert(
    byRawLine.get('john wick chapter iii')?.matchStatus === 'matched' &&
      byRawLine.get('john wick chapter iii')?.selectedMedia?.title ===
        'John Wick: Chapter 3 – Parabellum',
    'Import "john wick chapter iii" auto-matches to "John Wick: Chapter 3 – Parabellum (2019)"'
  );
  assert(
    byRawLine.get('the office')?.matchStatus === 'ambiguous' &&
      byRawLine.get('the office')?.selected === false,
    'Import "the office" is flagged as ambiguous and not auto-selected without year'
  );

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runVerificationSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});

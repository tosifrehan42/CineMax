import { GoogleGenAI, Type } from '@google/genai';

export interface ServerExtractedImportItem {
  rawLine: string;
  title: string;
  mediaTypeHint?: 'movie' | 'tv';
  yearHint?: number;
  seasonNumber?: number;
  episodeNumbers?: number[];
  watchedAtHint?: string;
  personalRatingHint?: number;
  notesHint?: string;
}

const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export async function extractCompletedTitlesFromImage(params: {
  mimeType: string;
  dataBase64: string;
  apiKey?: string;
}): Promise<{
  status: number;
  body: {
    items: ServerExtractedImportItem[];
    error?: string;
  };
}> {
  const cleanMime = String(params.mimeType || '')
    .trim()
    .toLowerCase();

  if (!ALLOWED_IMAGE_MIMES.has(cleanMime)) {
    return {
      status: 400,
      body: {
        items: [],
        error:
          'Unsupported image format. Please upload a PNG, JPG/JPEG, or WEBP image.',
      },
    };
  }

  const rawBase64 = String(params.dataBase64 || '')
    .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
    .trim();

  if (!rawBase64) {
    return {
      status: 400,
      body: {
        items: [],
        error: 'The uploaded image file is empty or could not be read.',
      },
    };
  }

  const estimatedBytes = Math.floor((rawBase64.length * 3) / 4);
  if (estimatedBytes <= 0) {
    return {
      status: 400,
      body: {
        items: [],
        error: 'The uploaded image file is empty.',
      },
    };
  }

  if (estimatedBytes > MAX_IMAGE_BYTES) {
    return {
      status: 413,
      body: {
        items: [],
        error: `Image is too large (${(estimatedBytes / (1024 * 1024)).toFixed(
          1
        )} MB). Maximum supported image size is 8 MB.`,
      },
    };
  }

  const geminiApiKey = String(
    params.apiKey !== undefined ? params.apiKey : process.env.GEMINI_API_KEY || ''
  ).trim();

  if (
    !geminiApiKey ||
    geminiApiKey === 'MY_GEMINI_API_KEY' ||
    geminiApiKey === 'YOUR_GEMINI_API_KEY'
  ) {
    return {
      status: 503,
      body: {
        items: [],
        error:
          'Server-side image text extraction is not configured on this server (GEMINI_API_KEY is missing). You can still import immediately using a TXT, CSV, or JSON file, or by pasting your list as text.',
      },
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const normalizedMime = cleanMime === 'image/jpg' ? 'image/jpeg' : cleanMime;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: normalizedMime,
              data: rawBase64,
            },
          },
          {
            text: [
              'Extract all movie and TV series titles visible in this image or screenshot of a watch list.',
              'Rules:',
              '1. Extract ONLY real titles that are actually visible in the image. Never invent, guess, or fabricate titles that are not in the image.',
              '2. If the image does not contain any movie or TV series titles, return an empty items array.',
              '3. Strip leading list numbers, bullets, checkboxes, or emojis from the "title" field, while keeping the original text in "rawLine".',
              '4. Set "mediaTypeHint" to "movie" or "tv" ONLY if the image or entry explicitly indicates it is a movie/film or a TV series/show/season/episode. Otherwise set "mediaTypeHint" to "".',
              '5. Set "yearHint" to the 4-digit release year if visible next to the title, otherwise 0.',
              '6. If explicit season or episode numbers are shown (e.g. "Season 2", "S01E03", "Episodes 1-4"), set "seasonNumber" and "episodeNumbers" accordingly; otherwise set seasonNumber to 0 and episodeNumbers to [].',
              '7. If a watched date is explicitly shown for the item, format it as YYYY-MM-DD in "watchedAtHint"; otherwise "".',
              '8. If a personal rating out of 10 is shown, include it in "personalRatingHint"; otherwise 0.',
            ].join('\n'),
          },
        ],
      },
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rawLine: { type: Type.STRING },
                  title: { type: Type.STRING },
                  mediaTypeHint: { type: Type.STRING },
                  yearHint: { type: Type.INTEGER },
                  seasonNumber: { type: Type.INTEGER },
                  episodeNumbers: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                  },
                  watchedAtHint: { type: Type.STRING },
                  personalRatingHint: { type: Type.NUMBER },
                  notesHint: { type: Type.STRING },
                },
                required: ['rawLine', 'title'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const rawText = response.text || '';
    if (!rawText.trim()) {
      return {
        status: 422,
        body: {
          items: [],
          error:
            'Could not extract any readable text from this image. Please try a clearer screenshot or paste your list as text.',
        },
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return {
        status: 502,
        body: {
          items: [],
          error:
            'The image parser returned an unreadable response. Please retry or use TXT/CSV/JSON/Paste input.',
        },
      };
    }

    const rawItems: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
    const cleanedItems: ServerExtractedImportItem[] = [];

    for (const raw of rawItems) {
      const title = String(raw?.title || '')
        .replace(/^\s*(?:\d+[.)\]:-]\s*|[-*•✓✔☑]+\s*)/, '')
        .trim();
      if (!title || title.length > 220) continue;

      const rawLine = String(raw?.rawLine || title).trim();
      const rawType = String(raw?.mediaTypeHint || '')
        .trim()
        .toLowerCase();
      const mediaTypeHint: 'movie' | 'tv' | undefined =
        rawType === 'movie' || rawType === 'film'
          ? 'movie'
          : rawType === 'tv' || rawType === 'series' || rawType === 'show'
          ? 'tv'
          : undefined;

      const yearNum = Number(raw?.yearHint);
      const yearHint =
        Number.isInteger(yearNum) && yearNum >= 1888 && yearNum <= 2035
          ? yearNum
          : undefined;

      const seasonNum = Number(raw?.seasonNumber);
      const seasonNumber =
        Number.isInteger(seasonNum) && seasonNum >= 1 && seasonNum <= 100
          ? seasonNum
          : undefined;

      const episodeNumbers: number[] | undefined = Array.isArray(raw?.episodeNumbers)
        ? Array.from(
            new Set<number>(
              raw.episodeNumbers
                .map((n: unknown) => Number(n))
                .filter(
                  (n: number): n is number =>
                    Number.isInteger(n) && n >= 1 && n <= 2000
                )
            )
          ).sort((a: number, b: number) => a - b)
        : undefined;

      const rawWatched = String(raw?.watchedAtHint || '').trim();
      const watchedAtHint = /^\d{4}-\d{2}-\d{2}$/.test(rawWatched)
        ? rawWatched
        : undefined;

      const ratingNum = Number(raw?.personalRatingHint);
      const personalRatingHint =
        Number.isFinite(ratingNum) && ratingNum >= 1 && ratingNum <= 10
          ? Math.round(ratingNum)
          : undefined;

      const notesHint = String(raw?.notesHint || '').trim() || undefined;

      cleanedItems.push({
        rawLine,
        title,
        mediaTypeHint:
          mediaTypeHint ||
          (seasonNumber || (episodeNumbers && episodeNumbers.length > 0)
            ? 'tv'
            : undefined),
        yearHint,
        seasonNumber,
        episodeNumbers:
          episodeNumbers && episodeNumbers.length > 0
            ? episodeNumbers
            : undefined,
        watchedAtHint,
        personalRatingHint,
        notesHint,
      });
    }

    if (cleanedItems.length === 0) {
      return {
        status: 422,
        body: {
          items: [],
          error:
            'No movie or TV series titles could be detected in this image. Please upload a clear screenshot containing a list of titles, or paste the titles as text.',
        },
      };
    }

    return {
      status: 200,
      body: {
        items: cleanedItems,
      },
    };
  } catch (err: any) {
    return {
      status: 500,
      body: {
        items: [],
        error:
          err?.message ||
          'Failed to extract titles from the uploaded image. Please try again or paste your list as text.',
      },
    };
  }
}

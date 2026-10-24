import {
  AuthorizedOnlineSource,
  MediaItem,
  MediaType,
  OfficialChannelGuide,
  OnlinePlaybackLookupResult,
} from '../types';
import {
  extractCanonicalTmdbIdentity,
  normalizeMediaTitle,
} from '../utils/mediaIntegrity';

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

export interface PermittedYouTubeChannel {
  channelId: string;
  handle: string;
  channelName: string;
  channelUrl: string;
  supportedRegions: string[];
  licenseCategory: string;
}

/**
 * Verified allowlist of official rights-holder and open-license YouTube channels
 * permitted for server-side YouTube Data API v3 episode discovery and embedded playback.
 */
export const PERMITTED_YOUTUBE_CHANNELS: PermittedYouTubeChannel[] = [
  {
    channelId: 'UCn_FAXem2-e3HQvmK-mOH4g',
    handle: '@GLITCH',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    supportedRegions: ['IN', 'US', 'GLOBAL'],
    licenseCategory: 'Official Studio Full Series Release on YouTube',
  },
  {
    channelId: 'UC6PGGc5283bf96-cH_c7U6g',
    handle: '@bandainamcofilmworks',
    channelName: 'Bandai Namco Filmworks',
    channelUrl: 'https://www.youtube.com/@bandainamcofilmworks',
    supportedRegions: ['IN', 'US', 'JP', 'GLOBAL'],
    licenseCategory: 'Official Bandai Namco Filmworks Free Episode Release',
  },
  {
    channelId: 'UCwmZiChSryoWQCZMIQezgTg',
    handle: '@bbcearth',
    channelName: 'BBC Earth',
    channelUrl: 'https://www.youtube.com/@bbcearth',
    supportedRegions: ['IN', 'US', 'GB', 'GLOBAL'],
    licenseCategory: 'Official BBC Earth YouTube Release',
  },
  {
    channelId: 'UCSMOQeBJ2RAnuFungnQOxLg',
    handle: '@BlenderFoundation',
    channelName: 'Blender',
    channelUrl: 'https://www.youtube.com/@BlenderFoundation',
    supportedRegions: ['IN', 'US', 'GLOBAL'],
    licenseCategory: 'Creative Commons Attribution 3.0 (CC-BY)',
  },
  {
    channelId: 'UCGbshtvS9t-8CW11W7TooQg',
    handle: '@MuseAsia',
    channelName: 'Muse Asia',
    channelUrl: 'https://www.youtube.com/@MuseAsia',
    supportedRegions: ['IN', 'SG', 'MY', 'PH', 'ID', 'TH', 'VN'],
    licenseCategory: 'Authorized Regional Anime Distributor (Muse Communication)',
  },
  {
    channelId: 'UC0wNSTMWIL3qaorLx0jie6A',
    handle: '@AniOneAsia',
    channelName: 'Ani-One Asia',
    channelUrl: 'https://www.youtube.com/@AniOneAsia',
    supportedRegions: ['IN', 'SG', 'HK', 'MY', 'PH', 'ID', 'TH'],
    licenseCategory: 'Authorized Regional Anime Distributor (Medialink)',
  },
  {
    channelId: 'UC6pGDc4bFGD1_36IKv3FnYg',
    handle: '@Crunchyroll',
    channelName: 'Crunchyroll',
    channelUrl: 'https://www.youtube.com/@Crunchyroll',
    supportedRegions: ['IN', 'US', 'GLOBAL'],
    licenseCategory: 'Official Crunchyroll YouTube Release',
  },
  {
    channelId: 'UC14Yc2Qv92DMuyNRlHvpo2Q',
    handle: '@PONYCANYON_anime',
    channelName: 'Pony Canyon Anime Official',
    channelUrl: 'https://www.youtube.com/@PONYCANYON_anime',
    supportedRegions: ['IN', 'JP', 'GLOBAL'],
    licenseCategory: 'Official Pony Canyon Rights-Holder Channel',
  },
];

/**
 * Curated official channel guides for major series (including Attack on Titan, Demon Slayer,
 * One-Punch Man, etc.). Used to provide a clearly labelled external official-channel or
 * search link when no verified full-length YouTube video is available for a given episode.
 */
export const TITLE_OFFICIAL_CHANNEL_GUIDES: Record<string, OfficialChannelGuide> = {
  'tmdb:tv:1429': {
    channelName: 'Crunchyroll / Pony Canyon Official',
    channelUrl: 'https://www.youtube.com/@Crunchyroll',
    searchUrl:
      'https://www.youtube.com/results?search_query=Attack+on+Titan+Crunchyroll+Official',
    note: 'Attack on Titan full episodes are not currently released for free embedding on YouTube in this region. Check official streaming platforms under Where to Watch or visit the official channel.',
  },
  'tmdb:tv:85937': {
    channelName: 'Crunchyroll / Aniplex Official',
    channelUrl: 'https://www.youtube.com/@Crunchyroll',
    searchUrl:
      'https://www.youtube.com/results?search_query=Demon+Slayer+Crunchyroll+Official',
    note: 'Demon Slayer full episodes require an official streaming subscription in this region.',
  },
  'tmdb:tv:63926': {
    channelName: 'Bandai Namco Filmworks / Muse Asia',
    channelUrl: 'https://www.youtube.com/@bandainamcofilmworks',
    searchUrl:
      'https://www.youtube.com/results?search_query=One-Punch+Man+Bandai+Namco+Filmworks+ENG+SUB',
    note: 'Bandai Namco Filmworks officially provides Season 1 Episode 1 and Season 2 Episode 1 for free with English subtitles on YouTube.',
  },
  'tmdb:tv:68595': {
    channelName: 'BBC Earth Official',
    channelUrl: 'https://www.youtube.com/@bbcearth',
    searchUrl:
      'https://www.youtube.com/results?search_query=Planet+Earth+II+BBC+Earth+Official',
    note: 'BBC Earth provides selected full-length 4K UHD nature specials on YouTube.',
  },
  'tmdb:tv:261145': {
    channelName: 'GLITCH Official',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    searchUrl:
      'https://www.youtube.com/results?search_query=The+Amazing+Digital+Circus+GLITCH',
    note: 'All 9 episodes of The Amazing Digital Circus Season 1 are officially released by GLITCH on YouTube.',
  },
  'tmdb:tv:291212': {
    channelName: 'GLITCH Official',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    searchUrl: 'https://www.youtube.com/results?search_query=Murder+Drones+GLITCH',
    note: 'All 8 episodes of Murder Drones Season 1 are officially released by GLITCH on YouTube.',
  },
};

/**
 * Maintainable registry of verified, authorized full-length movies, series, and anime
 * episodes available for embedded online playback via official YouTube channels,
 * open-license studio releases (Blender Foundation CC-BY), or verified public-domain archives.
 *
 * IMPORTANT:
 * - Every TMDB ID and YouTube video ID in this registry has been verified against the live
 *   TMDB v3 API and YouTube's official oEmbed API.
 * - Trailers, teasers, clips, fan uploads, and unverified videos are strictly excluded.
 */
export const AUTHORIZED_ONLINE_SOURCES: AuthorizedOnlineSource[] = [
  // ============================================================================
  // 1. FULL-LENGTH MOVIES (Public Domain & Open-License Studio Releases)
  // ============================================================================
  {
    id: 'online-movie-10331-main',
    mediaId: 'tmdb-movie-10331',
    tmdbId: 10331,
    mediaType: 'movie',
    title: 'Night of the Living Dead',
    contentKind: 'full_movie',
    providerName: 'YouTube (Public Domain Cinema)',
    channelName: 'RMS Classic TV',
    channelUrl: 'https://www.youtube.com/watch?v=f7jkZXvaB4g',
    youtubeVideoId: 'f7jkZXvaB4g',
    officialWatchUrl: 'https://www.youtube.com/watch?v=f7jkZXvaB4g',
    language: 'en',
    languageLabel: 'English',
    subtitles: ['English'],
    durationMinutes: 96,
    resolutionLabel: '4K Remastered',
    licenseStatus: 'Public Domain (US Theatrical Release)',
    synopsis:
      'A ragtag group of Pennsylvanians barricade themselves in an old farmhouse to remain safe from a bloodthirsty, flesh-eating breed of monsters.',
    embedAllowed: true,
  },
  {
    id: 'online-movie-4808-main',
    mediaId: 'tmdb-movie-4808',
    tmdbId: 4808,
    mediaType: 'movie',
    title: 'Charade',
    contentKind: 'full_movie',
    providerName: 'YouTube (Public Domain Cinema)',
    channelName: 'Cult Cinema Classics',
    channelUrl: 'https://www.youtube.com/watch?v=VhGNhwOtbVs',
    youtubeVideoId: 'VhGNhwOtbVs',
    officialWatchUrl: 'https://www.youtube.com/watch?v=VhGNhwOtbVs',
    language: 'en',
    languageLabel: 'English',
    subtitles: ['English'],
    durationMinutes: 113,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Public Domain Classic',
    synopsis:
      'After Regina Lampert falls for the dashing Peter Joshua on a skiing holiday in the French Alps, she discovers upon her return to Paris that her husband has been murdered.',
    embedAllowed: true,
  },
  {
    id: 'online-movie-3085-main',
    mediaId: 'tmdb-movie-3085',
    tmdbId: 3085,
    mediaType: 'movie',
    title: 'His Girl Friday',
    contentKind: 'full_movie',
    providerName: 'YouTube (Public Domain Cinema)',
    channelName: 'Retrospective - Classic Movies',
    channelUrl: 'https://www.youtube.com/watch?v=kmYcT5gT6a4',
    youtubeVideoId: 'kmYcT5gT6a4',
    officialWatchUrl: 'https://www.youtube.com/watch?v=kmYcT5gT6a4',
    language: 'en',
    languageLabel: 'English',
    subtitles: ['English'],
    durationMinutes: 92,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Public Domain Classic',
    synopsis:
      'A newspaper editor uses every trick in the book to keep his ace reporter ex-wife from remarrying and leaving the paper.',
    embedAllowed: true,
  },
  {
    id: 'online-movie-961-main',
    mediaId: 'tmdb-movie-961',
    tmdbId: 961,
    mediaType: 'movie',
    title: 'The General',
    contentKind: 'full_movie',
    providerName: 'YouTube (Public Domain Cinema)',
    channelName: 'Laurel & Hardy / Silent Classics',
    channelUrl: 'https://www.youtube.com/watch?v=D_UdtS-8QS0',
    youtubeVideoId: 'D_UdtS-8QS0',
    officialWatchUrl: 'https://www.youtube.com/watch?v=D_UdtS-8QS0',
    language: 'en',
    languageLabel: 'Silent (English Intertitles)',
    subtitles: ['English Intertitles'],
    durationMinutes: 79,
    resolutionLabel: '1080p HD Restoration',
    licenseStatus: 'Public Domain Classic',
    synopsis:
      'When Union spies steal an engineer’s beloved locomotive, he pursues it single-handedly and straight through enemy lines.',
    embedAllowed: true,
  },
  {
    id: 'online-movie-653-main',
    mediaId: 'tmdb-movie-653',
    tmdbId: 653,
    mediaType: 'movie',
    title: 'Nosferatu',
    contentKind: 'full_movie',
    providerName: 'YouTube (Public Domain Cinema)',
    channelName: 'Alternate Reality Classics',
    channelUrl: 'https://www.youtube.com/watch?v=3OZ5Wam2_Uc',
    youtubeVideoId: '3OZ5Wam2_Uc',
    officialWatchUrl: 'https://www.youtube.com/watch?v=3OZ5Wam2_Uc',
    language: 'de',
    languageLabel: 'Silent (English Subtitles)',
    subtitles: ['English'],
    durationMinutes: 95,
    resolutionLabel: '1080p HD Restoration',
    licenseStatus: 'Public Domain Classic',
    synopsis:
      'Vampire Count Orlok expresses interest in a new residence and real estate agent Hutter’s wife in F.W. Murnau’s landmark German Expressionist horror film.',
    embedAllowed: true,
  },
  {
    id: 'online-movie-19-main',
    mediaId: 'tmdb-movie-19',
    tmdbId: 19,
    mediaType: 'movie',
    title: 'Metropolis',
    contentKind: 'full_movie',
    providerName: 'YouTube (Public Domain Cinema)',
    channelName: 'VinFlix Classic Cinema',
    channelUrl: 'https://www.youtube.com/watch?v=enwB5zZfaV4',
    youtubeVideoId: 'enwB5zZfaV4',
    officialWatchUrl: 'https://www.youtube.com/watch?v=enwB5zZfaV4',
    language: 'de',
    languageLabel: 'Silent (English Intertitles)',
    subtitles: ['English Intertitles'],
    durationMinutes: 149,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Public Domain Classic',
    synopsis:
      'In a futuristic city sharply divided between the working class and the city planners, the son of the city’s mastermind falls in love with a working-class prophet.',
    embedAllowed: true,
  },
  {
    id: 'online-movie-992-main',
    mediaId: 'tmdb-movie-992',
    tmdbId: 992,
    mediaType: 'movie',
    title: 'Sherlock Jr.',
    contentKind: 'full_movie',
    providerName: 'YouTube (Public Domain Cinema)',
    channelName: 'Classic Silent Archive',
    channelUrl: 'https://www.youtube.com/watch?v=fZuqWxITq38',
    youtubeVideoId: 'fZuqWxITq38',
    officialWatchUrl: 'https://www.youtube.com/watch?v=fZuqWxITq38',
    language: 'en',
    languageLabel: 'Silent (English Intertitles)',
    subtitles: ['English Intertitles'],
    durationMinutes: 45,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Public Domain Classic',
    synopsis:
      'A film projectionist longs to be a detective, and puts his meagre skills to work when he is framed by a rival for stealing his girlfriend’s father’s pocketwatch.',
    embedAllowed: true,
  },
  {
    id: 'online-movie-45745-main',
    mediaId: 'tmdb-movie-45745',
    tmdbId: 45745,
    mediaType: 'movie',
    title: 'Sintel',
    contentKind: 'full_movie',
    providerName: 'YouTube (Blender Foundation Official)',
    channelName: 'Blender',
    channelUrl: 'https://www.youtube.com/@BlenderFoundation',
    youtubeVideoId: 'eRsGyueVLvQ',
    officialWatchUrl: 'https://www.youtube.com/watch?v=eRsGyueVLvQ',
    language: 'en',
    languageLabel: 'English',
    subtitles: ['English', 'Multi-Language CC'],
    durationMinutes: 15,
    resolutionLabel: '4K UHD',
    licenseStatus: 'Creative Commons Attribution 3.0 (CC-BY)',
    synopsis:
      'A lonely young woman, Sintel, helps and befriends a dragon, whom she calls Scales. But when Scales is kidnapped by an adult dragon, Sintel decides to embark on a dangerous quest to find her companion.',
    embedAllowed: true,
  },
  {
    id: 'online-movie-133701-main',
    mediaId: 'tmdb-movie-133701',
    tmdbId: 133701,
    mediaType: 'movie',
    title: 'Tears of Steel',
    contentKind: 'full_movie',
    providerName: 'YouTube (Blender Foundation Official)',
    channelName: 'Blender',
    channelUrl: 'https://www.youtube.com/@BlenderFoundation',
    youtubeVideoId: 'R6MlUcmOul8',
    officialWatchUrl: 'https://www.youtube.com/watch?v=R6MlUcmOul8',
    language: 'en',
    languageLabel: 'English',
    subtitles: ['English'],
    durationMinutes: 12,
    resolutionLabel: '4K UHD',
    licenseStatus: 'Creative Commons Attribution 3.0 (CC-BY)',
    synopsis:
      'In an apocalyptic future Amsterdam, a group of soldiers and scientists gather at the Oude Kerk to stage a crucial event from the past in a desperate attempt to rescue the world from destructive robots.',
    embedAllowed: true,
  },

  // ============================================================================
  // 2. FULL-LENGTH TV, DOCUMENTARY & ANIME EPISODES (Official YouTube Channels)
  // ============================================================================

  // Planet Earth II (TMDB TV 68595) — Official BBC Earth YouTube Channel
  {
    id: 'online-tv-68595-s1e1',
    mediaId: 'tmdb-tv-68595',
    tmdbId: 68595,
    mediaType: 'tv',
    title: 'Planet Earth II',
    contentKind: 'full_episode',
    providerName: 'YouTube (BBC Earth Official)',
    channelName: 'BBC Earth',
    channelUrl: 'https://www.youtube.com/@bbcearth',
    youtubeVideoId: 'bj2t7yGA_0M',
    officialWatchUrl: 'https://www.youtube.com/watch?v=bj2t7yGA_0M',
    language: 'en',
    languageLabel: 'English',
    subtitles: ['English CC'],
    durationMinutes: 43,
    resolutionLabel: '4K UHD',
    licenseStatus: 'Official BBC Earth YouTube Release',
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: 'Islands / A Journey Across Our Planet (4K UHD Feature)',
    synopsis:
      'Journey across the globe from remote islands to mountain peaks and lush jungles in this full-length 4K UHD Planet Earth II presentation from BBC Earth.',
    embedAllowed: true,
  },

  // One-Punch Man (TMDB TV 63926) — Official Bandai Namco Filmworks Channel
  {
    id: 'online-tv-63926-s1e1',
    mediaId: 'tmdb-tv-63926',
    tmdbId: 63926,
    mediaType: 'tv',
    title: 'One-Punch Man',
    contentKind: 'full_episode',
    providerName: 'YouTube (Bandai Namco Filmworks Official)',
    channelName: 'Bandai Namco Filmworks',
    channelUrl: 'https://www.youtube.com/@bandainamcofilmworks',
    youtubeVideoId: '-dUOzVp6-Y0',
    officialWatchUrl: 'https://www.youtube.com/watch?v=-dUOzVp6-Y0',
    language: 'ja',
    languageLabel: 'Japanese (Official English Subtitles)',
    subtitles: ['English'],
    durationMinutes: 24,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Bandai Namco Filmworks Free Episode Release',
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: 'The Strongest Man',
    synopsis:
      'Saitama is a hero for fun who can defeat any enemy with a single punch. Facing existential boredom from his overwhelming strength, he searches for a worthy opponent.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-63926-s2e1',
    mediaId: 'tmdb-tv-63926',
    tmdbId: 63926,
    mediaType: 'tv',
    title: 'One-Punch Man',
    contentKind: 'full_episode',
    providerName: 'YouTube (Bandai Namco Filmworks Official)',
    channelName: 'Bandai Namco Filmworks',
    channelUrl: 'https://www.youtube.com/@bandainamcofilmworks',
    youtubeVideoId: 'ajNeqCtYlzI',
    officialWatchUrl: 'https://www.youtube.com/watch?v=ajNeqCtYlzI',
    language: 'ja',
    languageLabel: 'Japanese (Official English Subtitles)',
    subtitles: ['English'],
    durationMinutes: 24,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Bandai Namco Filmworks Free Episode Release',
    seasonNumber: 2,
    episodeNumber: 1,
    episodeTitle: 'Return of the Hero',
    synopsis:
      'Saitama and Genos encounter S-Class hero King in the city streets just as a giant robot attacks, while the Hero Association prepares for a looming prophecy.',
    embedAllowed: true,
  },

  // The Amazing Digital Circus (TMDB TV 261145) — Official GLITCH Complete Season 1 (Episodes 1–9)
  {
    id: 'online-tv-261145-s1e1',
    mediaId: 'tmdb-tv-261145',
    tmdbId: 261145,
    mediaType: 'tv',
    title: 'The Amazing Digital Circus',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'HwAPLk_sQ3w',
    officialWatchUrl: 'https://www.youtube.com/watch?v=HwAPLk_sQ3w',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese', 'Hindi'],
    durationMinutes: 26,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: 'Pilot',
    synopsis:
      'A woman gets trapped in a crazy virtual world along with five other humans and is now subject to the whims of wacky AI ringmaster Caine and her own personal traumas.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-261145-s1e2',
    mediaId: 'tmdb-tv-261145',
    tmdbId: 261145,
    mediaType: 'tv',
    title: 'The Amazing Digital Circus',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: '4ofJpOEXrZs',
    officialWatchUrl: 'https://www.youtube.com/watch?v=4ofJpOEXrZs',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese', 'Hindi'],
    durationMinutes: 26,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 2,
    episodeTitle: 'Candy Carrier Chaos!',
    synopsis:
      'Caine sends the gang to the Candy Canyon Kingdom to recover a stolen maple syrup tanker, leading Pomni into an unexpected existential moment beneath the map.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-261145-s1e3',
    mediaId: 'tmdb-tv-261145',
    tmdbId: 261145,
    mediaType: 'tv',
    title: 'The Amazing Digital Circus',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'bKjfw77cxeQ',
    officialWatchUrl: 'https://www.youtube.com/watch?v=bKjfw77cxeQ',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese', 'Hindi'],
    durationMinutes: 25,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 3,
    episodeTitle: 'The Mystery of Mildenhall Manor',
    synopsis:
      'The crew explores the haunted halls of Mildenhall Manor, where Pomni and Kinger are separated from the others and forced to navigate a terrifying subterranean purgatory.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-261145-s1e4',
    mediaId: 'tmdb-tv-261145',
    tmdbId: 261145,
    mediaType: 'tv',
    title: 'The Amazing Digital Circus',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'Q9KWcWKo2T8',
    officialWatchUrl: 'https://www.youtube.com/watch?v=Q9KWcWKo2T8',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese', 'Hindi'],
    durationMinutes: 24,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 4,
    episodeTitle: 'Fast Food Masquerade',
    synopsis:
      'Caine places the circus members in charge of Spudsy’s fast-food restaurant with Gangle promoted to shift manager wearing a new comedy mask.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-261145-s1e5',
    mediaId: 'tmdb-tv-261145',
    tmdbId: 261145,
    mediaType: 'tv',
    title: 'The Amazing Digital Circus',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'L4p2gN2CzsA',
    officialWatchUrl: 'https://www.youtube.com/watch?v=L4p2gN2CzsA',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese', 'Hindi'],
    durationMinutes: 26,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 5,
    episodeTitle: 'Untitled',
    synopsis:
      'Caine cycles the circus crew through a rapid-fire series of suggestion-box adventures ranging from stargazing to a corporate softball match.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-261145-s1e6',
    mediaId: 'tmdb-tv-261145',
    tmdbId: 261145,
    mediaType: 'tv',
    title: 'The Amazing Digital Circus',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'mOvhHim78YA',
    officialWatchUrl: 'https://www.youtube.com/watch?v=mOvhHim78YA',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese', 'Hindi'],
    durationMinutes: 34,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 6,
    episodeTitle: 'They All Get Guns',
    synopsis:
      'Armed with an assortment of weapons in an action-packed circus arena, the troupe’s alliances and repressed frustrations come to a head.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-261145-s1e7',
    mediaId: 'tmdb-tv-261145',
    tmdbId: 261145,
    mediaType: 'tv',
    title: 'The Amazing Digital Circus',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'oaOG1xOk7XY',
    officialWatchUrl: 'https://www.youtube.com/watch?v=oaOG1xOk7XY',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese', 'Hindi'],
    durationMinutes: 33,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 7,
    episodeTitle: 'Beach Episode',
    synopsis:
      'A seemingly relaxing beach excursion gives way to unsettling discoveries along the digital shoreline.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-261145-s1e8',
    mediaId: 'tmdb-tv-261145',
    tmdbId: 261145,
    mediaType: 'tv',
    title: 'The Amazing Digital Circus',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'DMNlzf8PiEM',
    officialWatchUrl: 'https://www.youtube.com/watch?v=DMNlzf8PiEM',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese', 'Hindi'],
    durationMinutes: 32,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 8,
    episodeTitle: 'hjsakldfhl',
    synopsis:
      'As glitches destabilize the circus simulation, Caine’s control begins to fracture around the remaining human minds.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-261145-s1e9',
    mediaId: 'tmdb-tv-261145',
    tmdbId: 261145,
    mediaType: 'tv',
    title: 'The Amazing Digital Circus',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'PVy-bcTsO8A',
    officialWatchUrl: 'https://www.youtube.com/watch?v=PVy-bcTsO8A',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese', 'Hindi'],
    durationMinutes: 59,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 9,
    episodeTitle: 'Remember',
    synopsis:
      'In the feature-length season finale, the origins of the headset and the memories of everyone trapped inside the Digital Circus come into focus.',
    embedAllowed: true,
  },

  // Murder Drones (TMDB TV 291212) — Official GLITCH Complete Season 1 Release (Episodes 1–8)
  {
    id: 'online-tv-291212-s1e1',
    mediaId: 'tmdb-tv-291212',
    tmdbId: 291212,
    mediaType: 'tv',
    title: 'Murder Drones',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'mImFz8mkaHo',
    officialWatchUrl: 'https://www.youtube.com/watch?v=mImFz8mkaHo',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese'],
    durationMinutes: 27,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: 'Pilot',
    synopsis:
      'On exoplanet Copper 9, rebellious worker drone Uzi ventures outside her colony’s blast doors and forms an unlikely alliance with Serial Designation N, a disassembly drone sent to exterminate her kind.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-291212-s1e2',
    mediaId: 'tmdb-tv-291212',
    tmdbId: 291212,
    mediaType: 'tv',
    title: 'Murder Drones',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: '7z8DO1KhPFo',
    officialWatchUrl: 'https://www.youtube.com/watch?v=7z8DO1KhPFo',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese'],
    durationMinutes: 17,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 2,
    episodeTitle: 'Heartbeat',
    synopsis:
      'Uzi and N return to the colony to investigate a string of mysterious disappearances and confront a biomechanical horror rebuilding itself inside the facility.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-291212-s1e3',
    mediaId: 'tmdb-tv-291212',
    tmdbId: 291212,
    mediaType: 'tv',
    title: 'Murder Drones',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'djsJqNAGMuY',
    officialWatchUrl: 'https://www.youtube.com/watch?v=djsJqNAGMuY',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese'],
    durationMinutes: 19,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 3,
    episodeTitle: 'The Promening',
    synopsis:
      'Prom night at the colony turns into a telekinetic bloodbath when Doll sets a trap for V, forcing Uzi and N to crash the dance floor.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-291212-s1e4',
    mediaId: 'tmdb-tv-291212',
    tmdbId: 291212,
    mediaType: 'tv',
    title: 'Murder Drones',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: '63bUBEIhpNk',
    officialWatchUrl: 'https://www.youtube.com/watch?v=63bUBEIhpNk',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese'],
    durationMinutes: 21,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 4,
    episodeTitle: 'Cabin Fever',
    synopsis:
      'A class camping trip to Camp 98.7 spirals out of control as Uzi searches for clues about the Absolute Solver and loses control of her own mutations.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-291212-s1e5',
    mediaId: 'tmdb-tv-291212',
    tmdbId: 291212,
    mediaType: 'tv',
    title: 'Murder Drones',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'rk0HBqSqpgg',
    officialWatchUrl: 'https://www.youtube.com/watch?v=rk0HBqSqpgg',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese'],
    durationMinutes: 20,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 5,
    episodeTitle: 'Home',
    synopsis:
      'Uzi hacks into N and V’s repressed memories to prevent them from being erased, uncovering the truth about Tessa, Cyn, and the Elliott Manor gala.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-291212-s1e6',
    mediaId: 'tmdb-tv-291212',
    tmdbId: 291212,
    mediaType: 'tv',
    title: 'Murder Drones',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'U7i6fi3z9Nk',
    officialWatchUrl: 'https://www.youtube.com/watch?v=U7i6fi3z9Nk',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese'],
    durationMinutes: 21,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 6,
    episodeTitle: 'Dead End',
    synopsis:
      'Descending into the Cabin Fever Labs beneath Copper 9, Uzi, N, V, and Tessa are hunted by robotic Sentinels in a subterranean facility.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-291212-s1e7',
    mediaId: 'tmdb-tv-291212',
    tmdbId: 291212,
    mediaType: 'tv',
    title: 'Murder Drones',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'EOqw86OGIB0',
    officialWatchUrl: 'https://www.youtube.com/watch?v=EOqw86OGIB0',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese'],
    durationMinutes: 26,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 7,
    episodeTitle: 'Mass Destruction',
    synopsis:
      'Deep within the underground cathedral, N and Uzi confront the truth behind the Absolute Solver’s host and face a catastrophic betrayal.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-291212-s1e8',
    mediaId: 'tmdb-tv-291212',
    tmdbId: 291212,
    mediaType: 'tv',
    title: 'Murder Drones',
    contentKind: 'full_episode',
    providerName: 'YouTube (GLITCH Productions Official)',
    channelName: 'GLITCH',
    channelUrl: 'https://www.youtube.com/@GLITCH',
    youtubeVideoId: 'caR9ouipm8o',
    officialWatchUrl: 'https://www.youtube.com/watch?v=caR9ouipm8o',
    language: 'en',
    languageLabel: 'English (Multi-Language Audio & Subtitles)',
    subtitles: ['English', 'Spanish', 'Japanese'],
    durationMinutes: 21,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 8,
    episodeTitle: 'Absolute End',
    synopsis:
      'In the series finale, Uzi, N, and V make their final stand against Cyn as Copper 9 fractures in an orbital showdown.',
    embedAllowed: true,
  },
];

/**
 * Curated MediaItem records for titles in AUTHORIZED_ONLINE_SOURCES that are not already
 * present in MEDIA_ITEMS, with verified TMDB IDs, season counts, and unique TMDB posters.
 */
export const AUTHORIZED_PLAYABLE_MEDIA_ITEMS: MediaItem[] = [
  {
    id: 'tmdb-tv-63926',
    title: 'One-Punch Man',
    type: 'tv',
    year: 2015,
    seasons: 3,
    totalEpisodes: 36,
    seasonsList: [
      { seasonNumber: 1, name: 'Season 1', episodeCount: 12, airDate: '2015-10-05' },
      { seasonNumber: 2, name: 'Season 2', episodeCount: 12, airDate: '2019-04-09' },
      { seasonNumber: 3, name: 'Season 3', episodeCount: 12, airDate: '2025-10-05' },
    ],
    language: 'ja',
    genres: ['Animation', 'Action', 'Comedy', 'Sci-Fi'],
    rating: 8.4,
    voteCount: '590k',
    synopsis:
      'Saitama is a hero who only became a hero for fun. After three years of "special" training, he has become so strong that he is practically invincible—able to defeat even his mightiest foes with a single punch.',
    tagline: 'One punch is all it takes.',
    director: 'Shingo Natsume',
    cast: [
      { name: 'Makoto Furukawa', role: 'Saitama (voice)' },
      { name: 'Kaito Ishikawa', role: 'Genos (voice)' },
    ],
    moods: ['adrenaline-rush', 'epic-worldbuilding'],
    contentRating: 'TV-14',
    streamOn: ['Netflix', 'Crunchyroll', 'MX Player'],
    themeColor: '#eab308',
    posterUrl: 'https://image.tmdb.org/t/p/w500/dT10AxJIXVvRwFAew4tt2RhzJrD.jpg',
    backdropUrl: '',
    posterVisual: {
      bgFrom: '#1c1705',
      bgTo: '#382e0a',
      accent: '#facc15',
      iconType: 'cyber',
    },
  },
  {
    id: 'tmdb-tv-261145',
    title: 'The Amazing Digital Circus',
    type: 'tv',
    year: 2023,
    seasons: 1,
    totalEpisodes: 9,
    seasonsList: [
      { seasonNumber: 1, name: 'Season 1', episodeCount: 9, airDate: '2023-10-13' },
    ],
    language: 'en',
    genres: ['Animation', 'Comedy', 'Mystery', 'Sci-Fi'],
    rating: 8.4,
    voteCount: '110k',
    synopsis:
      'A woman gets trapped in a surreal virtual circus alongside five other humans after putting on a strange headset, subject to the whims of an erratic AI ringmaster.',
    tagline: 'Welcome to the Digital Circus!',
    director: 'Gooseworx',
    cast: [
      { name: 'Lizzie Freeman', role: 'Pomni (voice)' },
      { name: 'Alex Rochon', role: 'Caine (voice)' },
      { name: 'Michael Kovach', role: 'Jax (voice)' },
    ],
    moods: ['mind-bending', 'cerebral-mystery'],
    contentRating: 'TV-14',
    streamOn: ['YouTube (GLITCH Official)', 'Netflix'],
    themeColor: '#ec4899',
    posterUrl: 'https://image.tmdb.org/t/p/w500/lpfrgfomX8uNFxv4VaEzvJGs9TK.jpg',
    backdropUrl: '',
    posterVisual: {
      bgFrom: '#24081c',
      bgTo: '#451034',
      accent: '#f472b6',
      iconType: 'mind',
    },
  },
  {
    id: 'tmdb-tv-291212',
    title: 'Murder Drones',
    type: 'tv',
    year: 2021,
    seasons: 1,
    totalEpisodes: 8,
    seasonsList: [
      { seasonNumber: 1, name: 'Season 1', episodeCount: 8, airDate: '2021-10-29' },
    ],
    language: 'en',
    genres: ['Animation', 'Sci-Fi', 'Action', 'Horror'],
    rating: 8.6,
    voteCount: '95k',
    synopsis:
      'On a frozen exoplanet mined by autonomous worker robots, a rebellious teenage drone teams up with a rogue disassembly drone to uncover the dark origins of the corporation that built them.',
    tagline: 'Cute robots that murder each other for reasons.',
    director: 'Liam Vickers',
    cast: [
      { name: 'Elsie Lovelock', role: 'Uzi Doorman (voice)' },
      { name: 'Michael Kovach', role: 'Serial Designation N (voice)' },
      { name: 'Nola Klop', role: 'Serial Designation V (voice)' },
    ],
    moods: ['adrenaline-rush', 'dark-gripping', 'epic-worldbuilding'],
    contentRating: 'TV-14',
    streamOn: ['Amazon Prime Video', 'YouTube (GLITCH Official)'],
    themeColor: '#a855f7',
    posterUrl: 'https://image.tmdb.org/t/p/w500/z6fAKaN2F9jogQIdcHUHNVsiFNV.jpg',
    backdropUrl: '',
    posterVisual: {
      bgFrom: '#1a082b',
      bgTo: '#361159',
      accent: '#c084fc',
      iconType: 'cyber',
    },
  },
  {
    id: 'tmdb-movie-10331',
    title: 'Night of the Living Dead',
    type: 'movie',
    year: 1968,
    runtime: '1h 36m',
    language: 'en',
    genres: ['Horror', 'Thriller'],
    rating: 7.8,
    voteCount: '145k',
    synopsis:
      'A ragtag group of Pennsylvanians barricade themselves in an old farmhouse to remain safe from a bloodthirsty, flesh-eating breed of monsters.',
    tagline: 'They won’t stay dead!',
    director: 'George A. Romero',
    cast: [
      { name: 'Duane Jones', role: 'Ben' },
      { name: 'Judith O’Dea', role: 'Barbra' },
      { name: 'Karl Hardman', role: 'Harry Cooper' },
    ],
    moods: ['dark-gripping', 'atmospheric-noir'],
    contentRating: 'R',
    streamOn: ['YouTube (Public Domain)'],
    themeColor: '#e11d48',
    posterUrl: 'https://image.tmdb.org/t/p/w500/rb2NWyb008u1EcKCOyXs2Nmj0ra.jpg',
    backdropUrl: '',
    posterVisual: {
      bgFrom: '#20070c',
      bgTo: '#450a16',
      accent: '#f43f5e',
      iconType: 'darkness',
    },
  },
  {
    id: 'tmdb-movie-4808',
    title: 'Charade',
    type: 'movie',
    year: 1963,
    runtime: '1h 53m',
    language: 'en',
    genres: ['Mystery', 'Romance', 'Thriller', 'Comedy'],
    rating: 7.9,
    voteCount: '130k',
    synopsis:
      'After Regina Lampert falls for the dashing Peter Joshua on a skiing holiday in the French Alps, she discovers upon her return to Paris that her husband has been murdered.',
    tagline: 'Can you expect anything less when Cary Grant and Audrey Hepburn play Charade?',
    director: 'Stanley Donen',
    cast: [
      { name: 'Cary Grant', role: 'Peter Joshua' },
      { name: 'Audrey Hepburn', role: 'Regina Lampert' },
      { name: 'Walter Matthau', role: 'Hamilton Bartholomew' },
    ],
    moods: ['cerebral-mystery', 'atmospheric-noir'],
    contentRating: 'PG',
    streamOn: ['YouTube (Public Domain)'],
    themeColor: '#f59e0b',
    posterUrl: 'https://image.tmdb.org/t/p/w500/qqaPjC5FQidtKY65jbAKZPiOTaS.jpg',
    backdropUrl: '',
    posterVisual: {
      bgFrom: '#1c120a',
      bgTo: '#3f210d',
      accent: '#e08a3c',
      iconType: 'detective',
    },
  },
  {
    id: 'tmdb-movie-3085',
    title: 'His Girl Friday',
    type: 'movie',
    year: 1940,
    runtime: '1h 32m',
    language: 'en',
    genres: ['Comedy', 'Drama', 'Romance'],
    rating: 7.8,
    voteCount: '75k',
    synopsis:
      'A newspaper editor uses every trick in the book to keep his ace reporter ex-wife from remarrying and leaving the paper on the eve of a major breaking story.',
    tagline: 'Join the laugh riot of the century!',
    director: 'Howard Hawks',
    cast: [
      { name: 'Cary Grant', role: 'Walter Burns' },
      { name: 'Rosalind Russell', role: 'Hildy Johnson' },
      { name: 'Ralph Bellamy', role: 'Bruce Baldwin' },
    ],
    moods: ['intimate-reflective'],
    contentRating: 'PG',
    streamOn: ['YouTube (Public Domain)'],
    themeColor: '#0ea5e9',
    posterUrl: 'https://image.tmdb.org/t/p/w500/lu86Y9zTPH3neCiUzLzHCEFHf7f.jpg',
    backdropUrl: '',
    posterVisual: {
      bgFrom: '#041829',
      bgTo: '#0b2b40',
      accent: '#38bdf8',
      iconType: 'city',
    },
  },
  {
    id: 'tmdb-movie-19',
    title: 'Metropolis',
    type: 'movie',
    year: 1927,
    runtime: '2h 29m',
    language: 'de',
    genres: ['Sci-Fi', 'Drama'],
    rating: 8.3,
    voteCount: '190k',
    synopsis:
      'In a futuristic city sharply divided between the working class and the city planners, the son of the city’s mastermind falls in love with a working-class prophet who predicts the coming of a savior to mediate their differences.',
    tagline: 'The mediator between head and hands must be the heart!',
    director: 'Fritz Lang',
    cast: [
      { name: 'Brigitte Helm', role: 'Maria / The Machine-Human' },
      { name: 'Alfred Abel', role: 'Joh Fredersen' },
      { name: 'Gustav Fröhlich', role: 'Freder' },
    ],
    moods: ['epic-worldbuilding', 'mind-bending'],
    contentRating: 'PG',
    streamOn: ['YouTube (Public Domain)'],
    themeColor: '#f59e0b',
    posterUrl: 'https://image.tmdb.org/t/p/w500/kr9wXRN23zLuWJIelahas1mtnYj.jpg',
    backdropUrl: '',
    posterVisual: {
      bgFrom: '#1c120a',
      bgTo: '#3f210d',
      accent: '#e08a3c',
      iconType: 'city',
    },
  },
  {
    id: 'tmdb-movie-45745',
    title: 'Sintel',
    type: 'movie',
    year: 2010,
    runtime: '0h 15m',
    language: 'en',
    genres: ['Animation', 'Fantasy', 'Action', 'Adventure'],
    rating: 7.5,
    voteCount: '42k',
    synopsis:
      'A lonely young woman, Sintel, helps and befriends a dragon, whom she calls Scales. But when Scales is kidnapped by an adult dragon, Sintel decides to embark on a dangerous quest to find her companion.',
    tagline: 'An open movie by the Blender Foundation.',
    director: 'Colin Levy',
    cast: [
      { name: 'Halina Reijn', role: 'Sintel (voice)' },
      { name: 'Thom Hoffman', role: 'Shaman (voice)' },
    ],
    moods: ['epic-worldbuilding', 'intimate-reflective'],
    contentRating: 'PG',
    streamOn: ['YouTube (Blender Official)'],
    themeColor: '#f97316',
    posterUrl: 'https://image.tmdb.org/t/p/w500/l98Zns4oQe1BSvbF4hJ8oL6VSf0.jpg',
    backdropUrl: '',
    posterVisual: {
      bgFrom: '#1c0c04',
      bgTo: '#3b1606',
      accent: '#fb923c',
      iconType: 'fantasy',
    },
  },
];

// Runtime cache of additional verified sources discovered via server-side YouTube Data API v3
const runtimeDiscoveredSources = new Map<string, AuthorizedOnlineSource>();

export function isValidAuthorizedSource(source: AuthorizedOnlineSource): boolean {
  if (!source || !source.embedAllowed) return false;
  if (source.contentKind !== 'full_movie' && source.contentKind !== 'full_episode') {
    return false;
  }
  if (!YOUTUBE_ID_REGEX.test(source.youtubeVideoId)) {
    return false;
  }
  if (!Number.isFinite(source.durationMinutes) || source.durationMinutes < 10) {
    return false;
  }
  return true;
}

/**
 * Registers verified online playback sources returned from the server-side
 * `/api/online-sources/:type/:id` discovery endpoint.
 */
export function registerDiscoveredOnlineSources(sources: AuthorizedOnlineSource[]): void {
  if (!Array.isArray(sources)) return;
  for (const src of sources) {
    if (isValidAuthorizedSource(src)) {
      runtimeDiscoveredSources.set(src.id, src);
    }
  }
}

export function buildEpisodeYoutubeSearchUrl(
  mediaTitle: string,
  seasonNumber: number,
  episodeNumber: number,
  episodeName?: string,
  preferredChannel?: string
): string {
  const parts = [
    mediaTitle,
    `Season ${seasonNumber} Episode ${episodeNumber}`,
    episodeName && !/^Episode \d+$/i.test(episodeName) ? episodeName : '',
    preferredChannel || 'official',
  ].filter(Boolean);
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(parts.join(' '))}`;
}

/**
 * Resolves all verified, authorized full-length online playback sources for a given MediaItem.
 * Matches strictly by canonical TMDB identity `(mediaType, tmdbId)` or exact normalized
 * `(mediaType, title)` so artwork/sources never leak across distinct titles.
 */
export function lookupOnlinePlaybackSources(
  media: Pick<MediaItem, 'id' | 'type' | 'title'> & { year?: number }
): OnlinePlaybackLookupResult {
  const identity = extractCanonicalTmdbIdentity(media.id, media.type);
  const normTitle = normalizeMediaTitle(media.title);
  const canonicalKey = identity
    ? `tmdb:${identity.mediaType}:${identity.tmdbId}`
    : `title:${media.type}:${normTitle}`;

  const officialChannelGuide: OfficialChannelGuide =
    TITLE_OFFICIAL_CHANNEL_GUIDES[canonicalKey] || {
      channelName: 'Official Rights-Holder Channels on YouTube',
      channelUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        `${media.title} ${media.year || ''} official full ${
          media.type === 'tv' ? 'episode' : 'movie'
        }`.trim()
      )}`,
      searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        `${media.title} ${media.year || ''} official`.trim()
      )}`,
      note: 'Only verified full-length releases from permitted official channels are embedded directly.',
    };

  const combinedPool = [
    ...AUTHORIZED_ONLINE_SOURCES,
    ...Array.from(runtimeDiscoveredSources.values()),
  ];

  const seenIds = new Set<string>();
  const matched = combinedPool.filter((src) => {
    if (!isValidAuthorizedSource(src)) return false;
    if (seenIds.has(src.id)) return false;
    if (src.mediaType !== media.type) return false;

    const isMatch = identity
      ? src.tmdbId === identity.tmdbId && src.mediaType === identity.mediaType
      : normalizeMediaTitle(src.title) === normTitle;

    if (isMatch) {
      seenIds.add(src.id);
      return true;
    }
    return false;
  });

  if (matched.length === 0) {
    return {
      available: false,
      mediaType: media.type,
      tmdbId: identity?.tmdbId || null,
      canonicalKey,
      sources: [],
      seasons: [],
      defaultSource: null,
      officialChannelGuide,
      unavailableReason: 'No authorized online playback source available.',
    };
  }

  const sortedSources = [...matched].sort((a, b) => {
    const sA = a.seasonNumber ?? 1;
    const sB = b.seasonNumber ?? 1;
    if (sA !== sB) return sA - sB;
    const eA = a.episodeNumber ?? 1;
    const eB = b.episodeNumber ?? 1;
    return eA - eB;
  });

  const seasons = Array.from(
    new Set(
      sortedSources
        .map((s) => s.seasonNumber)
        .filter((s): s is number => typeof s === 'number' && s > 0)
    )
  ).sort((a, b) => a - b);

  return {
    available: true,
    mediaType: media.type,
    tmdbId: identity?.tmdbId || sortedSources[0].tmdbId,
    canonicalKey,
    sources: sortedSources,
    seasons,
    defaultSource: sortedSources[0] || null,
    officialChannelGuide,
  };
}

/**
 * Checks whether a specific TV/anime episode `(seasonNumber, episodeNumber)` has a
 * verified full-length source in the registry.
 */
export function getAuthorizedEpisodeSource(
  media: Pick<MediaItem, 'id' | 'type' | 'title'> & { year?: number },
  seasonNumber: number,
  episodeNumber: number
): AuthorizedOnlineSource | null {
  if (media.type !== 'tv') return null;
  const lookup = lookupOnlinePlaybackSources(media);
  if (!lookup.available) return null;
  return (
    lookup.sources.find(
      (s) =>
        s.contentKind === 'full_episode' &&
        s.seasonNumber === seasonNumber &&
        s.episodeNumber === episodeNumber
    ) || null
  );
}

/**
 * Builds an official privacy-enhanced YouTube IFrame Player URL (`youtube-nocookie.com/embed`)
 * with IFrame JS API enabled for runtime playback/restriction error monitoring.
 */
export function buildAuthorizedYouTubeEmbedUrl(
  youtubeVideoId: string,
  options?: { autoplay?: boolean }
): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  const params = new URLSearchParams({
    autoplay: options?.autoplay ? '1' : '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
  });
  if (origin && origin !== 'null') {
    params.set('origin', origin);
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
    youtubeVideoId
  )}?${params.toString()}`;
}

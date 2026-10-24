import {
  AuthorizedOnlineSource,
  MediaItem,
  MediaType,
  OnlinePlaybackLookupResult,
} from '../types';
import {
  extractCanonicalTmdbIdentity,
  normalizeMediaTitle,
} from '../utils/mediaIntegrity';

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/**
 * Maintainable registry of verified, authorized full-length movies, series, and anime
 * episodes available for embedded online playback via official YouTube channels,
 * open-license studio releases (Blender Foundation CC-BY), or verified public-domain archives.
 *
 * IMPORTANT:
 * - Trailers, teasers, and short promotional clips are strictly excluded from this registry.
 * - Commercial subscription-only titles without an official free full-length release are
 *   never added with fabricated video IDs.
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
    id: 'online-movie-136835-main',
    mediaId: 'tmdb-movie-136835',
    tmdbId: 136835,
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
    episodeTitle: 'A Journey Across Our Planet (4K UHD Feature)',
    synopsis:
      'Journey across the globe from remote islands to mountain peaks and lush jungles in this full-length 4K UHD Planet Earth II special presentation from BBC Earth.',
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

  // The Amazing Digital Circus (TMDB TV 237062) — Official GLITCH Channel
  {
    id: 'online-tv-237062-s1e1',
    mediaId: 'tmdb-tv-237062',
    tmdbId: 237062,
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
    id: 'online-tv-237062-s1e2',
    mediaId: 'tmdb-tv-237062',
    tmdbId: 237062,
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
    durationMinutes: 25,
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
    id: 'online-tv-237062-s1e3',
    mediaId: 'tmdb-tv-237062',
    tmdbId: 237062,
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
    episodeTitle: 'The Mystery Of Mildenhall Manor',
    synopsis:
      'The crew explores the haunted halls of Mildenhall Manor, where Pomni and Kinger are separated from the others and forced to navigate a terrifying subterranean purgatory.',
    embedAllowed: true,
  },
  {
    id: 'online-tv-237062-s1e4',
    mediaId: 'tmdb-tv-237062',
    tmdbId: 237062,
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
    durationMinutes: 23,
    resolutionLabel: '1080p HD',
    licenseStatus: 'Official Studio Full Series Release on YouTube',
    seasonNumber: 1,
    episodeNumber: 4,
    episodeTitle: 'Fast Food Masquerade',
    synopsis:
      'Caine places the circus members in charge of Spudsy’s fast-food restaurant with Gangle promoted to shift manager wearing a new comedy mask.',
    embedAllowed: true,
  },

  // Murder Drones (TMDB TV 137643) — Official GLITCH Complete Season 1 Release
  {
    id: 'online-tv-137643-s1e1',
    mediaId: 'tmdb-tv-137643',
    tmdbId: 137643,
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
    id: 'online-tv-137643-s1e2',
    mediaId: 'tmdb-tv-137643',
    tmdbId: 137643,
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
    id: 'online-tv-137643-s1e3',
    mediaId: 'tmdb-tv-137643',
    tmdbId: 137643,
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
    id: 'online-tv-137643-s1e4',
    mediaId: 'tmdb-tv-137643',
    tmdbId: 137643,
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
    id: 'online-tv-137643-s1e5',
    mediaId: 'tmdb-tv-137643',
    tmdbId: 137643,
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
    id: 'online-tv-137643-s1e6',
    mediaId: 'tmdb-tv-137643',
    tmdbId: 137643,
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
    id: 'online-tv-137643-s1e7',
    mediaId: 'tmdb-tv-137643',
    tmdbId: 137643,
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
    id: 'online-tv-137643-s1e8',
    mediaId: 'tmdb-tv-137643',
    tmdbId: 137643,
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
 * present in MEDIA_ITEMS, ensuring they can be browsed, searched, and played online even
 * in offline/static-host environments (such as GitHub Pages).
 */
export const AUTHORIZED_PLAYABLE_MEDIA_ITEMS: MediaItem[] = [
  {
    id: 'tmdb-tv-63926',
    title: 'One-Punch Man',
    type: 'tv',
    year: 2015,
    seasons: 2,
    totalEpisodes: 24,
    seasonsList: [
      { seasonNumber: 1, name: 'Season 1', episodeCount: 12, airDate: '2015-10-05' },
      { seasonNumber: 2, name: 'Season 2', episodeCount: 12, airDate: '2019-04-09' },
    ],
    language: 'ja',
    genres: ['Animation', 'Action', 'Comedy', 'Sci-Fi'],
    rating: 8.7,
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
    streamOn: ['YouTube (Bandai Namco Official)', 'Crunchyroll', 'Hulu'],
    themeColor: '#eab308',
    posterUrl: 'https://image.tmdb.org/t/p/w500/iE3s0lG5QVdEHOEZnoAxjmMtvne.jpg',
    backdropUrl: '',
    posterVisual: {
      bgFrom: '#1c1705',
      bgTo: '#382e0a',
      accent: '#facc15',
      iconType: 'cyber',
    },
  },
  {
    id: 'tmdb-tv-237062',
    title: 'The Amazing Digital Circus',
    type: 'tv',
    year: 2023,
    seasons: 1,
    totalEpisodes: 4,
    seasonsList: [
      { seasonNumber: 1, name: 'Season 1', episodeCount: 4, airDate: '2023-10-13' },
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
    posterUrl: '',
    backdropUrl: '',
    posterVisual: {
      bgFrom: '#24081c',
      bgTo: '#451034',
      accent: '#f472b6',
      iconType: 'mind',
    },
  },
  {
    id: 'tmdb-tv-137643',
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
    streamOn: ['YouTube (GLITCH Official)', 'Prime Video'],
    themeColor: '#a855f7',
    posterUrl: '',
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
    streamOn: ['YouTube (Public Domain)', 'Max', 'Criterion Channel'],
    themeColor: '#e11d48',
    posterUrl: '',
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
    streamOn: ['YouTube (Public Domain)', 'Prime Video', 'Criterion Channel'],
    themeColor: '#f59e0b',
    posterUrl: '',
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
    streamOn: ['YouTube (Public Domain)', 'Criterion Channel'],
    themeColor: '#0ea5e9',
    posterUrl: '',
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
    streamOn: ['YouTube (Public Domain)', 'Kino Cult'],
    themeColor: '#f59e0b',
    posterUrl: '',
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
    posterUrl: '',
    backdropUrl: '',
    posterVisual: {
      bgFrom: '#1c0c04',
      bgTo: '#3b1606',
      accent: '#fb923c',
      iconType: 'fantasy',
    },
  },
];

function isValidAuthorizedSource(source: AuthorizedOnlineSource): boolean {
  if (!source.embedAllowed) return false;
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
 * Resolves all verified, authorized full-length online playback sources for a given MediaItem.
 * Matches strictly by canonical TMDB identity `(mediaType, tmdbId)` or exact normalized
 * `(mediaType, title, year)` so artwork/sources never leak across distinct titles.
 */
export function lookupOnlinePlaybackSources(
  media: Pick<MediaItem, 'id' | 'type' | 'title' | 'year'>
): OnlinePlaybackLookupResult {
  const identity = extractCanonicalTmdbIdentity(media.id, media.type);
  const normTitle = normalizeMediaTitle(media.title);
  const canonicalKey = identity
    ? `tmdb:${identity.mediaType}:${identity.tmdbId}`
    : `title:${media.type}:${normTitle}`;

  const matched = AUTHORIZED_ONLINE_SOURCES.filter((src) => {
    if (!isValidAuthorizedSource(src)) return false;
    if (src.mediaType !== media.type) return false;

    if (identity) {
      return src.tmdbId === identity.tmdbId && src.mediaType === identity.mediaType;
    }

    return normalizeMediaTitle(src.title) === normTitle;
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
  };
}

/**
 * Checks whether a specific TV/anime episode `(seasonNumber, episodeNumber)` has a
 * verified full-length source in the registry.
 */
export function getAuthorizedEpisodeSource(
  media: Pick<MediaItem, 'id' | 'type' | 'title' | 'year'>,
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

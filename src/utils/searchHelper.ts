import { Episode, HubCategory } from '../types';

/**
 * Normalizes text for search by:
 * - Removing diacritics / accents (é, è, ê -> e)
 * - Converting to lowercase
 * - Replacing punctuation, dashes, underscores, and dots with spaces
 * - Trimming and removing extra whitespace
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .replace(/['’]/g, ' ') // apostrophes to space (e.g. l'attaque -> l attaque)
    .replace(/[-_.:,;/\\+()\[\]{}!?]/g, ' ') // separators to space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fast Levenshtein distance algorithm
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Calculates a similarity score between 0.0 (completely different) and 1.0 (identical)
 */
export function stringSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  // Substring bonus
  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length);
    const maxLen = Math.max(normA.length, normB.length);
    return Math.max(0.75, minLen / maxLen);
  }

  const maxLen = Math.max(normA.length, normB.length);
  const dist = levenshteinDistance(normA, normB);
  return Math.max(0, (maxLen - dist) / maxLen);
}

/**
 * Generates alternative search queries for Telegram's search API.
 * Helps overcome Telegram's strict exact-string match when users include accents,
 * apostrophes, punctuation, or season/episode tags.
 */
export function generateSearchVariants(rawQuery: string): string[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const variants = new Set<string>();
  variants.add(trimmed);

  // 1. Normalized query (accents removed, apostrophes converted)
  const norm = normalizeText(trimmed);
  if (norm && norm !== trimmed.toLowerCase()) {
    variants.add(norm);
  }

  // 2. Remove French / English apostrophe prefixes (e.g. "l'attaque" -> "attaque", "d'or" -> "or")
  const withoutApostrophePrefix = trimmed.replace(/\b[ldjstmnLDJSTMN]['’]/gi, '').trim();
  if (withoutApostrophePrefix && withoutApostrophePrefix !== trimmed) {
    variants.add(withoutApostrophePrefix);
    const normWithoutApos = normalizeText(withoutApostrophePrefix);
    if (normWithoutApos) variants.add(normWithoutApos);
  }

  // 3. Without spaces or dashes (e.g. "spider man" or "spider-man" -> "spiderman")
  const compact = trimmed.replace(/[\s\-_.]+/g, '');
  if (compact.length >= 3 && compact !== trimmed) {
    variants.add(compact);
  }

  // 4. Remove common season / episode / format qualifiers (e.g. "s01", "saison 2", "vostfr", "vf")
  const strippedQualifiers = trimmed
    .replace(/\b(s\d{1,2}|saison\s*\d{1,2}|season\s*\d{1,2}|ep\s*\d{1,3}|episode\s*\d{1,3}|vostfr|vf|1080p|720p|4k)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (strippedQualifiers && strippedQualifiers.length >= 3 && strippedQualifiers !== trimmed) {
    variants.add(strippedQualifiers);
  }

  // 5. If query has multiple words (>= 3 words), extract first 2 main words as franchise core
  const words = norm.split(' ').filter(w => w.length > 1);
  if (words.length >= 3) {
    variants.add(`${words[0]} ${words[1]}`);
  }

  return Array.from(variants);
}

/**
 * Curated catalog of popular franchises and keywords by Hub Category
 */
export const POPULAR_SUGGESTIONS_BY_CATEGORY: Record<HubCategory, string[]> = {
  anime: [
    'Attack on Titan',
    'Avenger',
    'Bleach',
    'Black Clover',
    'Blue Lock',
    'Baki',
    'Berserk',
    'Chainsaw Man',
    'Cyberpunk Edgerunners',
    'Death Note',
    'Demon Slayer',
    'Dragon Ball Super',
    'Dragon Ball Z',
    'Dr. Stone',
    'DanDaDan',
    'Evangelion',
    'Fairy Tail',
    'Fullmetal Alchemist',
    'Fate',
    'Gintama',
    'Hunter x Hunter',
    'Haikyuu',
    'Hell\'s Paradise',
    'Inuyasha',
    'Jujutsu Kaisen',
    'JoJo Bizarre Adventure',
    'Kaiju No. 8',
    'Kuroko no Basket',
    'Mob Psycho 100',
    'My Hero Academia',
    'Mushoku Tensei',
    'Monster',
    'Naruto Shippuden',
    'Nanatsu no Taizai',
    'One Piece',
    'One Punch Man',
    'Overlord',
    'Pokemon',
    'Re:Zero',
    'Solo Leveling',
    'Spy x Family',
    'Sword Art Online',
    'Steins Gate',
    'Tokyo Ghoul',
    'Tokyo Revengers',
    'Toriko',
    'Vinland Saga',
    'Wind Breaker',
  ],
  movie_series: [
    'Avatar',
    'Avengers',
    'Alien',
    'Batman',
    'Breaking Bad',
    'Better Call Saul',
    'Black Panther',
    'Blade Runner',
    'Captain America',
    'Cyberpunk',
    'Deadpool',
    'Dune',
    'Doctor Strange',
    'Fast and Furious',
    'Fight Club',
    'Forrest Gump',
    'Game of Thrones',
    'Gladiator',
    'Godfather',
    'Harry Potter',
    'House of the Dragon',
    'Inception',
    'Interstellar',
    'Iron Man',
    'John Wick',
    'Joker',
    'Jurassic Park',
    'Loki',
    'Lord of the Rings',
    'Matrix',
    'Mission Impossible',
    'Marvel',
    'Oppenheimer',
    'Peaky Blinders',
    'Prison Break',
    'Pulp Fiction',
    'Spider-Man',
    'Squid Game',
    'Star Wars',
    'Stranger Things',
    'Superman',
    'The Batman',
    'The Boys',
    'The Last of Us',
    'The Witcher',
    'Titanic',
    'Top Gun',
    'Wednesday',
  ],
  games: [
    'Assassin\'s Creed',
    'Call of Duty',
    'Cyberpunk 2077',
    'Dark Souls',
    'Dragon Ball Xenoverse',
    'Elden Ring',
    'FIFA',
    'Final Fantasy',
    'Forza Horizon',
    'God of War',
    'Grand Theft Auto',
    'Gran Turismo',
    'Halo',
    'Hogwarts Legacy',
    'Minecraft',
    'Monster Hunter',
    'Naruto Storm',
    'Need for Speed',
    'Overwatch',
    'Pokemon',
    'Red Dead Redemption',
    'Resident Evil',
    'Sekiro',
    'Spider-Man',
    'Super Mario',
    'Tekken',
    'The Last of Us',
    'The Witcher 3',
    'Uncharted',
    'Valorant',
    'Zelda Breath of the Wild',
  ],
  music: [
    'Beyonce',
    'Billie Eilish',
    'Booba',
    'Coldplay',
    'Daft Punk',
    'Damso',
    'Drake',
    'Dua Lipa',
    'Eminem',
    'Freeze Corleone',
    'Gazo',
    'Hamza',
    'Jul',
    'Kendrick Lamar',
    'Laylow',
    'Michael Jackson',
    'Ninho',
    'Niska',
    'Orelsan',
    'PLK',
    'PNL',
    'Post Malone',
    'Rihanna',
    'SCH',
    'SDM',
    'Stromae',
    'Taylor Swift',
    'The Weeknd',
    'Tiakola',
    'Travis Scott',
    'Werenoi',
  ],
  document: [
    'Berserk Tome',
    'Bleach Manga',
    'Chainsaw Man Scan',
    'Death Note Scan',
    'Demon Slayer Scan',
    'Dragon Ball Manga',
    'Hunter x Hunter Scan',
    'Jujutsu Kaisen Scan',
    'Kingdom Scan',
    'Monster Manga',
    'My Hero Academia Scan',
    'Naruto Manga',
    'One Piece Scan',
    'Solo Leveling Webtoon',
    'Tokyo Ghoul Scan',
    'Tokyo Revengers Scan',
    'Vagabond Manga',
    'Vinland Saga Manga',
  ],
  wallpapers: [
    'Amoled Dark 4K',
    'Anime 4K Ultra HD',
    'Cars Supercar 4K',
    'Cyberpunk Neon City',
    'Fantasy Landscape 4K',
    'Gaming Setup 4K',
    'Marvel Heroes 4K',
    'Minimalist Abstract',
    'Nature Forest Mountain',
    'Sci-Fi Space Galaxy',
  ],
  mature: [],
};

/**
 * Instant autocomplete suggestions matching user input.
 * Strictly respects category: leaves 'mature' intact (empty array).
 */
export function getAutocompleteSuggestions(
  rawQuery: string,
  category: HubCategory,
  knownTitles: string[] = [],
  limit: number = 5
): string[] {
  // Never show suggestions or alter mature space
  if (category === 'mature') return [];

  const trimmed = rawQuery.trim();
  if (!trimmed || trimmed.length < 1) return [];

  const normQuery = normalizeText(trimmed);
  if (!normQuery) return [];

  const categoryPool = POPULAR_SUGGESTIONS_BY_CATEGORY[category] || [];
  const pool = new Set<string>();

  // Add category curated titles
  for (const item of categoryPool) {
    if (item) pool.add(item);
  }

  // Add known titles from feed
  for (const item of knownTitles) {
    if (item && item.length >= 2) pool.add(item);
  }

  const prefixMatches: string[] = [];
  const containsMatches: string[] = [];

  for (const candidate of pool) {
    const normCand = normalizeText(candidate);
    if (!normCand) continue;

    // Do not suggest if identical
    if (normCand === normQuery) continue;

    // Check if candidate starts with query or if any word in candidate starts with query
    const words = normCand.split(' ');
    const startsOnWord = words.some(w => w.startsWith(normQuery));

    if (normCand.startsWith(normQuery) || startsOnWord) {
      prefixMatches.push(candidate);
    } else if (normCand.includes(normQuery)) {
      containsMatches.push(candidate);
    }
  }

  // Sort prefix matches by length (shorter / more concise first)
  prefixMatches.sort((a, b) => a.length - b.length);
  containsMatches.sort((a, b) => a.length - b.length);

  return [...prefixMatches, ...containsMatches].slice(0, limit);
}

/**
 * Finds the best typo correction or "Did you mean?" suggestion for a query
 */
export function findTypoCorrection(
  rawQuery: string,
  category: HubCategory,
  knownTitles: string[] = []
): { suggestion: string; score: number } | null {
  const normQuery = normalizeText(rawQuery);
  if (!normQuery || normQuery.length < 3) return null;

  // Build candidate pool: knownTitles + category popular titles
  const categoryPool = POPULAR_SUGGESTIONS_BY_CATEGORY[category] || [];
  const candidateSet = new Set<string>([...knownTitles, ...categoryPool]);

  let bestMatch: { suggestion: string; score: number } | null = null;

  for (const candidate of candidateSet) {
    if (!candidate) continue;
    const normCand = normalizeText(candidate);
    if (!normCand) continue;

    // If identical after normalization, no typo correction needed
    if (normCand === normQuery) continue;

    // Compute similarity
    let score = stringSimilarity(normQuery, normCand);

    // Also check token-level similarity (e.g. "narutu" in "Naruto Shippuden")
    const candTokens = normCand.split(' ');
    for (const token of candTokens) {
      if (token.length >= 3) {
        const tokenScore = stringSimilarity(normQuery, token);
        if (tokenScore > score) {
          score = tokenScore;
        }
      }
    }

    // Heuristics threshold:
    // If query length <= 5, need distance <= 1 or score >= 0.78
    // If query length > 5, score >= 0.70
    const minThreshold = normQuery.length <= 5 ? 0.78 : 0.68;

    if (score >= minThreshold) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { suggestion: candidate, score };
      }
    }
  }

  return bestMatch;
}

/**
 * Fuzzy episode filtering for client-side search:
 * Matches if normalized query is substring, or all query tokens are present,
 * or Levenshtein distance is small enough to tolerate typos.
 */
export function fuzzyMatchEpisode(episode: Episode, rawQuery: string): boolean {
  if (!rawQuery || !rawQuery.trim()) return true;

  const normQuery = normalizeText(rawQuery);
  const target = normalizeText(`${episode.title || ''} ${episode.file_name || ''}`);

  if (!target) return false;

  // 1. Direct normalized substring match
  if (target.includes(normQuery)) return true;

  // 2. Compact match (e.g. "spiderman" matches "spider man")
  const compactQuery = normQuery.replace(/\s+/g, '');
  const compactTarget = target.replace(/\s+/g, '');
  if (compactTarget.includes(compactQuery)) return true;

  // 3. Multi-token match: all words of query appear in target, or with minor typo
  const queryTokens = normQuery.split(' ').filter(t => t.length > 1);
  if (queryTokens.length > 1) {
    const allTokensMatch = queryTokens.every(qToken => {
      if (target.includes(qToken)) return true;
      // Allow 1 typo on tokens >= 4 characters
      if (qToken.length >= 4) {
        const targetWords = target.split(' ');
        return targetWords.some(tWord => levenshteinDistance(qToken, tWord) <= 1);
      }
      return false;
    });
    if (allTokensMatch) return true;
  }

  // 4. Single-word typo tolerance on target words
  if (queryTokens.length === 1) {
    const singleToken = queryTokens[0];
    const targetWords = target.split(' ');
    const maxAllowedDist = singleToken.length <= 4 ? 1 : singleToken.length <= 7 ? 2 : 3;

    return targetWords.some(tWord => {
      if (Math.abs(tWord.length - singleToken.length) > maxAllowedDist) return false;
      return levenshteinDistance(singleToken, tWord) <= maxAllowedDist;
    });
  }

  return false;
}

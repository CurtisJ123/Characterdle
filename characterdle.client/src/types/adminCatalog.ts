export interface AdminCharacter {
  id: number;
  version: string;
  displayName: string;
  aliases: string[];
  gender: string;
  species: string;
  house: string[];
  occupation: string[];
  debutSeason: number;
  lastSeason: number;
  alive: boolean;
  portraitUrl: string | null;
}
export interface AdminQuote {
  id: number;
  version: string;
  characterId: number;
  quoteText: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitleId: number | null;
}
export interface AdminCatalogOptions {
  characters: { id: number; displayName: string }[];
  episodes: { id: number; seasonNumber: number; episodeNumber: number; title: string }[];
}

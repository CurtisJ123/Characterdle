import type { QuotePrompt } from '../types/universeGame';

export function formatQuoteEpisodeLabel(prompt: QuotePrompt): string {
  const seasonEpisode = `S${prompt.seasonNumber} E${prompt.episodeNumber}`;

  return prompt.episodeTitle
    ? `${seasonEpisode} - ${prompt.episodeTitle}`
    : seasonEpisode;
}

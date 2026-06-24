import type { CharacterAttribute } from '../types/game';
import type {
  CharacterGameRow,
  CharacterGameStatus,
  QuoteGameRow,
} from '../types/universeGame';

const MAX_VISIBLE_SHARE_ROWS = 10;
const MAX_X_TEXT_LENGTH = 250;
const X_HEADER_EMOJI = '🐉';
const QUOTE_HEADER_EMOJI = '🗨️';
const PRODUCTION_SITE_ORIGIN = 'https://characterdle.com';

type ShareableStatus = Extract<CharacterGameStatus, 'won' | 'lost'>;

interface BaseSharePayload {
  gameId: number;
  guessCount: number;
  hintCount: number;
  status: ShareableStatus;
  universeName: string;
}

interface CharacterSharePayload extends BaseSharePayload {
  mode: 'character';
  rows: CharacterGameRow[];
}

interface QuoteSharePayload extends BaseSharePayload {
  mode: 'quote';
  rows: QuoteGameRow[];
}

export type GameSharePayload = CharacterSharePayload | QuoteSharePayload;

interface BuildShareOptions {
  footerText: string;
  includeHintLine: boolean;
  maxRows: number;
}

function getHeaderIcon(mode: GameSharePayload['mode']): string {
  return mode === 'character'
    ? X_HEADER_EMOJI
    : QUOTE_HEADER_EMOJI;
}

function getTitle(payload: GameSharePayload): string {
  return payload.mode === 'character'
    ? `${payload.universeName} Characterdle #${payload.gameId}`
    : `${payload.universeName} Quote #${payload.gameId}`;
}

function getGuessSummary(payload: GameSharePayload): string {
  if (payload.status === 'lost') {
    return 'X';
  }

  return `${payload.guessCount} ${payload.guessCount === 1 ? 'guess' : 'guesses'}`;
}

function getHintSummary(hintCount: number): string {
  return `💡 ${hintCount} ${hintCount === 1 ? 'hint' : 'hints'}`;
}

function mapAttributeToneToEmoji(attribute: CharacterAttribute): string {
  switch (attribute.tone) {
    case 'correct':
      return '🟩';
    case 'partial':
      return '🟨';
    default:
      return '⬛';
  }
}

function buildCharacterRows(rows: CharacterGameRow[], maxRows: number): string[] {
  return rows
    .slice(0, maxRows)
    .reverse()
    .map((row) => row.cells.map(mapAttributeToneToEmoji).join(''));
}

function buildQuoteRows(rows: QuoteGameRow[], maxRows: number): string[] {
  return rows
    .slice(0, maxRows)
    .reverse()
    .map((row) => (row.isCorrect ? '🟩' : '⬛'));
}

function buildRows(payload: GameSharePayload, maxRows: number): string[] {
  return payload.mode === 'character'
    ? buildCharacterRows(payload.rows, maxRows)
    : buildQuoteRows(payload.rows, maxRows);
}

function buildShareText(
  payload: GameSharePayload,
  options: BuildShareOptions,
): string {
  const rows = buildRows(payload, options.maxRows);
  const sections = [
    `${getHeaderIcon(payload.mode)} ${getTitle(payload)}`,
    getGuessSummary(payload),
  ];

  if (options.includeHintLine) {
    sections.push(getHintSummary(payload.hintCount));
  }

  if (rows.length > 0) {
    sections.push(rows.join('\n'));
  }

  if (options.footerText.trim().length > 0) {
    sections.push(options.footerText);
  }

  return sections.join('\n\n');
}

function getCharacterCount(value: string): number {
  return Array.from(value).length;
}

function getDisplayFooter(shareUrl: string): string {
  try {
    const parsedUrl = new URL(shareUrl);
    const normalizedHost = parsedUrl.host.replace(/^www\./i, '');

    if (normalizedHost.toLowerCase() === 'characterdle.com') {
      return 'Characterdle.com';
    }

    return normalizedHost;
  } catch {
    return 'Characterdle.com';
  }
}

export function getProductionShareUrl(): string {
  if (typeof window === 'undefined') {
    return PRODUCTION_SITE_ORIGIN;
  }

  const productionUrl = new URL(PRODUCTION_SITE_ORIGIN);
  productionUrl.pathname = window.location.pathname;
  productionUrl.search = window.location.search;
  productionUrl.hash = window.location.hash;

  return productionUrl.toString();
}

function buildConstrainedShareText(
  payload: GameSharePayload,
  footerText: string,
  maxLength: number,
): string {
  const maxShareRows = Math.min(MAX_VISIBLE_SHARE_ROWS, payload.rows.length);

  for (const includeHintLine of [true, false]) {
    for (let rowCount = maxShareRows; rowCount >= 0; rowCount -= 1) {
      const text = buildShareText(payload, {
        footerText,
        includeHintLine,
        maxRows: rowCount,
      });

      if (getCharacterCount(text) <= maxLength) {
        return text;
      }
    }
  }

  return buildShareText(payload, {
    footerText,
    includeHintLine: false,
    maxRows: 0,
  });
}

export function buildClipboardShareText(payload: GameSharePayload, shareUrl: string): string {
  return buildShareText(payload, {
    footerText: shareUrl,
    includeHintLine: true,
    maxRows: Math.min(MAX_VISIBLE_SHARE_ROWS, payload.rows.length),
  });
}

export function buildNativeShareText(payload: GameSharePayload, shareUrl: string): string {
  return buildShareText(payload, {
    footerText: getDisplayFooter(shareUrl),
    includeHintLine: true,
    maxRows: Math.min(MAX_VISIBLE_SHARE_ROWS, payload.rows.length),
  });
}

export function buildXShareText(payload: GameSharePayload, _shareUrl: string): string {
  const shareText = buildConstrainedShareText(payload, '', MAX_X_TEXT_LENGTH - 2);
  return `${shareText}\n\n`;
}

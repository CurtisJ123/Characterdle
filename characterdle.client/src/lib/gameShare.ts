import type { CharacterAttribute } from '../types/game';
import { getShareUrlForCurrentLocation, getUniverseGamePath } from './siteRouting';
import type {
  CharacterGameRow,
  CharacterGameStatus,
  QuoteGameRow,
} from '../types/universeGame';

const MAX_VISIBLE_SHARE_ROWS = 10;
const MAX_X_TEXT_LENGTH = 250;
const X_HASHTAGS = '#GameOfThrones #HOTD';
const X_HEADER_EMOJI = '🐉';
const QUOTE_HEADER_EMOJI = '🗨️';
type ShareableStatus = Extract<CharacterGameStatus, 'won' | 'lost'>;

interface BaseSharePayload {
  gameId: number;
  guessCount: number;
  hintCount: number;
  streak: number;
  status: ShareableStatus;
  universeId: string;
  universeName: string;
}

interface CharacterSharePayload extends BaseSharePayload {
  mode: 'character';
  rows: CharacterGameRow[];
}

interface QuoteSharePayload extends BaseSharePayload {
  mode: 'quote';
  quoteText: string;
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

  return getGuessCountSummary(payload.guessCount);
}

function getGuessCountSummary(guessCount: number): string {
  return `${guessCount} ${guessCount === 1 ? 'guess' : 'guesses'}`;
}

function getHintSummary(hintCount: number): string {
  return `💡 ${hintCount} ${hintCount === 1 ? 'hint' : 'hints'}`;
}

function getStreakSummary(streak: number): string {
  return `\u{1F525} ${streak} day streak`;
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

function buildXCharacterShareText(payload: CharacterSharePayload, maxRows: number): string {
  const rows = buildCharacterRows(payload.rows, maxRows);
  const resultSummary = [
    `${getGuessCountSummary(payload.guessCount)} ·${getHintSummary(payload.hintCount)}`,
    getStreakSummary(payload.streak),
  ].join('\n');
  const sections = [
    `${getHeaderIcon(payload.mode)} ${getTitle(payload)}`,
    resultSummary,
  ];

  if (rows.length > 0) {
    sections.push(rows.join('\n'));
  }

  sections.push(X_HASHTAGS);
  return sections.join('\n\n');
}

function truncateToCharacterCount(value: string, maxLength: number): string {
  const characters = Array.from(value);

  if (characters.length <= maxLength) {
    return value;
  }

  if (maxLength <= 1) {
    return '\u2026'.slice(0, maxLength);
  }

  return `${characters.slice(0, maxLength - 1).join('')}\u2026`;
}

function buildXQuoteShareText(payload: QuoteSharePayload, maxLength: number): string {
  const header = `${getHeaderIcon(payload.mode)} ${getTitle(payload)}`;
  const callToAction = `Think you know who said it? \u{1F440}\nMake your guess`;
  const fixedText = [header, '\u201C\u201D', callToAction, X_HASHTAGS].join('\n\n');
  const availableQuoteLength = Math.max(0, maxLength - getCharacterCount(fixedText));
  const quoteText = truncateToCharacterCount(payload.quoteText.trim(), availableQuoteLength);

  return [
    header,
    `\u201C${quoteText}\u201D`,
    callToAction,
    X_HASHTAGS,
  ].join('\n\n');
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

  if (payload.streak > 0) {
    sections.push(getStreakSummary(payload.streak));
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
  return getShareUrlForCurrentLocation('got');
}

export function getShareUrl(payload: GameSharePayload): string {
  const shareUrl = new URL(getShareUrlForCurrentLocation(payload.universeId));

  if (
    typeof window !== 'undefined'
    && payload.universeId === 'got'
    && payload.mode === 'character'
  ) {
    const normalizedPathname = window.location.pathname.replace(/\/+$/, '').toLowerCase() || '/';
    const canonicalDailyCharacterPath = getUniverseGamePath(payload.universeId, 'character', null).toLowerCase();

    if (
      normalizedPathname === '/'
      || normalizedPathname === '/game/character'
      || normalizedPathname === canonicalDailyCharacterPath
      || normalizedPathname === `${canonicalDailyCharacterPath}/game/character`
    ) {
      shareUrl.pathname = canonicalDailyCharacterPath;
      shareUrl.search = '';
      shareUrl.hash = '';
    }
  }

  return shareUrl.toString();
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
  void _shareUrl;
  const maxTextLength = MAX_X_TEXT_LENGTH - 2;

  if (payload.mode === 'quote') {
    return `${buildXQuoteShareText(payload, maxTextLength)}\n\n`;
  }

  const maxShareRows = Math.min(MAX_VISIBLE_SHARE_ROWS, payload.rows.length);

  for (let rowCount = maxShareRows; rowCount >= 0; rowCount -= 1) {
    const shareText = buildXCharacterShareText(payload, rowCount);

    if (getCharacterCount(shareText) <= maxTextLength) {
      return `${shareText}\n\n`;
    }
  }

  const shareText = buildXCharacterShareText(payload, 0);
  return `${shareText}\n\n`;
}

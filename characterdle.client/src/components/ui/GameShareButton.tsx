import { useEffect, useId, useRef, useState } from 'react';
import {
  buildClipboardShareText,
  buildNativeShareText,
  buildXShareText,
  getProductionShareUrl,
  type GameSharePayload,
} from '../../lib/gameShare';

interface GameShareButtonProps {
  payload: GameSharePayload;
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard not available.');
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', 'true');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();

  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textArea);
  }
}

export function GameShareButton({ payload }: GameShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const feedbackId = useId();
  const panelId = useId();
  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (wrapperRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFeedback(null);
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [feedback]);

  function resolveShareUrl(): string {
    return getProductionShareUrl();
  }

  function openShareWindow(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer,width=640,height=720');
    setIsOpen(false);
  }

  async function handleCopy() {
    try {
      const shareUrl = resolveShareUrl();
      const shareText = buildClipboardShareText(payload, shareUrl);
      await copyTextToClipboard(shareText);
      setFeedback('Copied results.');
      setIsOpen(false);
    } catch {
      setFeedback('Unable to copy.');
    }
  }

  async function handleNativeShare() {
    if (!hasNativeShare) {
      return;
    }

    try {
      const shareUrl = resolveShareUrl();
      await navigator.share({
        title: payload.mode === 'character'
          ? `${payload.universeName} Characterdle #${payload.gameId}`
          : `${payload.universeName} Quote #${payload.gameId}`,
        text: buildNativeShareText(payload, shareUrl),
        url: shareUrl,
      });
      setIsOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setFeedback('Share cancelled.');
    }
  }

  function handleShareOnX() {
    const shareUrl = resolveShareUrl();
    const intentUrl = new URL('https://twitter.com/intent/tweet');
    intentUrl.searchParams.set('text', buildXShareText(payload, shareUrl));
    intentUrl.searchParams.set('url', shareUrl);
    openShareWindow(intentUrl.toString());
  }

  function handleShareOnFacebook() {
    const shareUrl = resolveShareUrl();
    const shareWindowUrl = new URL('https://www.facebook.com/sharer/sharer.php');
    shareWindowUrl.searchParams.set('u', shareUrl);
    openShareWindow(shareWindowUrl.toString());
  }

  return (
    <div ref={wrapperRef} className="share-menu">
      <button
        className="secondary-button share-trigger-button"
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-describedby={feedback ? feedbackId : undefined}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        Share
      </button>

      {isOpen && (
        <div id={panelId} className="share-menu-panel glass-card" role="dialog" aria-label="Share results">
          <div className="share-menu-header">
            <p className="card-kicker">Share Results</p>
          </div>

          <div className="share-menu-actions">
            <button className="share-option-button" type="button" onClick={handleShareOnX}>
              X / Twitter
            </button>
            <button className="share-option-button" type="button" onClick={handleShareOnFacebook}>
              Facebook
            </button>
            <button className="share-option-button" type="button" onClick={handleCopy}>
              Copy
            </button>
            {hasNativeShare && (
              <button className="share-option-button" type="button" onClick={handleNativeShare}>
                More
              </button>
            )}
          </div>
        </div>
      )}

      <span id={feedbackId} className="share-menu-feedback" aria-live="polite">
        {feedback ?? ''}
      </span>
    </div>
  );
}

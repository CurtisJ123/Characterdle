import type { MouseEvent } from 'react';

type LinkClick = Pick<MouseEvent<HTMLAnchorElement>,
  'button' | 'defaultPrevented' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'preventDefault'>;

export function navigateFromLink(
  event: LinkClick,
  onNavigate?: () => void,
  target?: string,
  download?: string | boolean,
): void {
  // Preserve native new-tab, new-window, and download behavior.
  if (!onNavigate || event.defaultPrevented || event.button !== 0
    || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    || (target && target !== '_self') || (download !== undefined && download !== false)) {
    return;
  }

  event.preventDefault();
  onNavigate();
}

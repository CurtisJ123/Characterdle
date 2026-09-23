export interface LadderCardBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type LadderDropTarget = { mode: 'swap'; to: number }
  | { mode: 'insert'; to: number; boundary: number };

export const LADDER_DRAG_SCALE = 1.015;
export const LADDER_DRAG_EDGE_ROOM = 64;

export function constrainLadderDragOffset(bounds: readonly LadderCardBounds[], from: number, offset: number,
  pageHeight: number): number {
  const source = bounds[from];
  if (!source || !Number.isFinite(offset) || !Number.isFinite(pageHeight) || pageHeight <= 0) return 0;
  const scaleOverflow = (source.bottom - source.top) * (LADDER_DRAG_SCALE - 1) / 2;
  // Leave room to distinguish end insertions from swaps without creating page overflow.
  const min = Math.max(0, bounds[0].top - LADDER_DRAG_EDGE_ROOM) - source.top + scaleOverflow;
  const max = Math.min(pageHeight, bounds.at(-1)!.bottom + LADDER_DRAG_EDGE_ROOM) - source.bottom - scaleOverflow;
  return min > max ? 0 : Math.max(min, Math.min(max, offset));
}

// Use the pointer's drop position against the original layout, not the translated card.
export function resolveLadderDropTarget(bounds: readonly LadderCardBounds[], from: number,
  locked: readonly number[], x: number, y: number): LadderDropTarget | null {
  if (!Number.isInteger(from) || !bounds[from] || locked.includes(from) || !Number.isFinite(x) || !Number.isFinite(y)) return null;

  function insertion(boundary: number): LadderDropTarget | null {
    const slots = bounds.map((_, index) => index).filter(index => !locked.includes(index));
    const destination = slots.filter(index => index < boundary && index !== from).length;
    const to = slots[destination];
    if (to === undefined || to === from) return null;
    // When locked slots intervene, preview the actual available destination.
    return { mode: 'insert', to, boundary: to > from ? to + 1 : to };
  }

  for (let index = 0; index < bounds.length; index++) {
    const rect = bounds[index];
    if (y < rect.top) return insertion(index);
    if (y > rect.bottom) continue;
    // A captured drag remains valid outside the board, including to either side.
    const fraction = (y - rect.top) / (rect.bottom - rect.top);
    if (fraction <= 0.2) return insertion(index);
    if (fraction >= 0.8) return insertion(index + 1);
    if (locked.includes(index)) return insertion(fraction < 0.5 ? index : index + 1);
    return index !== from ? { mode: 'swap', to: index } : null;
  }
  return insertion(bounds.length);
}

export function getLadderPreviewOffsets(count: number, from: number, locked: readonly number[],
  target: LadderDropTarget | null): number[] {
  const offsets = Array<number>(count).fill(0);
  const movable = (slot: number) => slot >= 0 && slot < count && slot !== from && !locked.includes(slot);
  if (!target) return offsets;
  if (target.mode === 'swap') {
    if (movable(target.to)) offsets[target.to] = target.to > from ? -12 : 12;
    return offsets;
  }
  const before = target.boundary - 1, after = target.boundary;
  // Open an 8px gap without moving a locked card or the card under the pointer.
  if (movable(before)) offsets[before] = movable(after) ? -4 : -8;
  if (movable(after)) offsets[after] = movable(before) ? 4 : 8;
  return offsets;
}

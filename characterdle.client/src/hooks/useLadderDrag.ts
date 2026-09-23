import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { constrainLadderDragOffset, resolveLadderDropTarget, type LadderCardBounds, type LadderDropTarget } from '../lib/ladderDropTarget';

export function useLadderDrag(order: number[], locked: number[], disabled: boolean,
  move: (from: number, to: number, mode: 'swap' | 'insert') => void) {
  const cards = useRef(new Map<number, HTMLLIElement>());
  const [visual, setVisual] = useState<{ from: number; target: LadderDropTarget | null; offset: number } | null>(null);
  const active = useRef<{ from: number; startY: number; originOffset: number; x: number; y: number; scrollY: number; lastScrollY: number; pageHeight: number;
    bounds: LadderCardBounds[]; order: number[]; locked: number[]; pointerId: number; element: HTMLLIElement } | null>(null);
  const frame = useRef(0);
  const moves = useRef(new Map<number, Animation>());
  const pendingMove = useRef<{ order: number[]; rects: Map<number, DOMRect>; grabbedId?: number } | null>(null);
  useEffect(() => () => {
    active.current = null;
    cancelAnimationFrame(frame.current);
    moves.current.forEach(animation => animation.cancel());
  }, []);
  useLayoutEffect(() => {
    const pending = pendingMove.current;
    if (!pending) return;
    pendingMove.current = null;
    if (order.length !== pending.order.length || order.some((id, index) => id !== pending.order[index])) return;
    moves.current.forEach(animation => animation.cancel());
    moves.current.clear();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    order.forEach((id, slot) => {
      const card = cards.current.get(id), before = pending.rects.get(id);
      if (!card || !before || locked.includes(slot)) return;
      // End preview transitions before measuring the final layout for the drop animation.
      card.getAnimations().forEach(animation => {
        if (animation instanceof CSSTransition && ['translate', 'scale'].includes(animation.transitionProperty)) animation.cancel();
      });
      if (reducedMotion) return;
      const after = card.getBoundingClientRect();
      const offset = before.top - after.top + (before.height - after.height) / 2;
      const scaleX = before.width / after.width, scaleY = before.height / after.height;
      if (Math.abs(offset) < .5 && Math.abs(scaleX - 1) < .001 && Math.abs(scaleY - 1) < .001) return;
      // Animate from the previous visual position after React commits the new order.
      const zIndex = id === pending.grabbedId ? 3 : 2;
      const animation = card.animate([
        { transform: `translateY(${offset}px) scale(${scaleX}, ${scaleY})`, zIndex },
        { transform: 'none', zIndex },
      ], { duration: id === pending.grabbedId ? 180 : 340, easing: 'cubic-bezier(.2, .7, .2, 1)' });
      animation.id = 'ladder-reorder';
      moves.current.set(id, animation);
      animation.onfinish = () => { if (moves.current.get(id) === animation) moves.current.delete(id); };
    });
  }, [order, locked]);

  function prepareMove(nextOrder: number[], grabbedId?: number) {
    pendingMove.current = { order: nextOrder, grabbedId,
      rects: new Map(order.filter((_, slot) => !locked.includes(slot)).map(id => [id, cards.current.get(id)!.getBoundingClientRect()])) };
  }

  function update() {
    const drag = active.current;
    if (!drag) return;
    drag.lastScrollY = window.scrollY;
    // Allow some movement past the board while preserving the original page height.
    const offset = constrainLadderDragOffset(drag.bounds, drag.from,
      drag.originOffset + drag.y - drag.startY + window.scrollY - drag.scrollY, drag.pageHeight);
    const target = resolveLadderDropTarget(drag.bounds, drag.from, drag.locked, drag.x, drag.y + window.scrollY);
    setVisual({ from: drag.from, target, offset });
  }
  function scroll() {
    const drag = active.current;
    if (!drag) return;
    const speed = drag.y < 70 ? -8 : drag.y > window.innerHeight - 70 ? 8 : 0;
    const minY = Math.max(0, drag.bounds[0].top - 70);
    const maxY = Math.max(0, Math.min(drag.pageHeight, drag.bounds.at(-1)!.bottom + 70) - window.innerHeight);
    let nextY = window.scrollY;
    if (speed < 0 && nextY > minY) nextY = Math.max(minY, nextY + speed);
    if (speed > 0 && nextY < maxY) nextY = Math.min(maxY, nextY + speed);
    if (nextY !== window.scrollY) window.scrollTo({ top: nextY, behavior: 'instant' });
    if (window.scrollY !== drag.lastScrollY) update();
    frame.current = requestAnimationFrame(scroll);
  }
  function cancel(event?: PointerEvent<HTMLLIElement>) {
    const drag = active.current;
    if (event && drag && event.pointerId !== drag.pointerId) return;
    active.current = null;
    cancelAnimationFrame(frame.current);
    setVisual(null);
    if (drag?.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId);
  }
  function start(event: PointerEvent<HTMLLIElement>, from: number) {
    if (disabled || active.current || locked.includes(from) || !event.isPrimary || event.button !== 0) return;
    // A dedicated touch grip leaves the event copy available for normal page scrolling.
    if (event.pointerType === 'touch' && !(event.target as HTMLElement).closest('.ladder-grip')) return;
    event.preventDefault();
    const grabbed = event.currentTarget.getBoundingClientRect();
    moves.current.get(order[from])?.cancel();
    moves.current.delete(order[from]);
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = { from, startY: event.clientY, originOffset: 0, x: event.clientX, y: event.clientY, scrollY: window.scrollY, lastScrollY: window.scrollY,
      pageHeight: document.documentElement.scrollHeight,
      pointerId: event.pointerId, element: event.currentTarget, order: [...order], locked: [...locked],
      bounds: order.map(id => {
        const card = cards.current.get(id)!;
        const parent = card.offsetParent!;
        const rect = parent.getBoundingClientRect();
        // Layout offsets exclude previews, even if a previous drag is still easing back.
        const top = rect.top + parent.clientTop + card.offsetTop + window.scrollY;
        const left = rect.left + parent.clientLeft + card.offsetLeft;
        return { top, bottom: top + card.offsetHeight, left, right: left + card.offsetWidth };
      }) };
    const source = active.current.bounds[from];
    active.current.originOffset = grabbed.top + window.scrollY - source.top + (grabbed.height - (source.bottom - source.top)) / 2;
    update();
    frame.current = requestAnimationFrame(scroll);
  }
  function pointerMove(event: PointerEvent<HTMLLIElement>) {
    if (active.current?.pointerId !== event.pointerId) return;
    active.current.x = event.clientX;
    active.current.y = event.clientY;
    update();
  }
  function end(event: PointerEvent<HTMLLIElement>) {
    if (active.current?.pointerId !== event.pointerId) return;
    const drag = active.current;
    const target = resolveLadderDropTarget(drag.bounds, drag.from, locked, event.clientX, event.clientY + window.scrollY);
    const unchanged = order.length === drag.order.length && order.every((id, index) => id === drag.order[index])
      && locked.length === drag.locked.length && locked.every((slot, index) => slot === drag.locked[index]);
    cancel();
    if (target && !disabled && unchanged) move(drag.from, target.to, target.mode);
  }
  return { cards, visual, start, pointerMove, end, cancel, prepareMove };
}

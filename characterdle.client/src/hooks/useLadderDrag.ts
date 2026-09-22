import { useEffect, useRef, useState, type PointerEvent } from 'react';

export function useLadderDrag(order: number[], locked: number[], disabled: boolean, move: (from: number, to: number) => void) {
  const cards = useRef(new Map<number, HTMLLIElement>());
  const [visual, setVisual] = useState<{ from: number; to: number; offset: number } | null>(null);
  const active = useRef<{ from: number; to: number; startY: number; y: number; scrollY: number; centers: number[]; pointerId: number } | null>(null);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function update() {
    const drag = active.current;
    if (!drag) return;
    const offset = drag.y - drag.startY + window.scrollY - drag.scrollY;
    const center = drag.centers[drag.from] + offset;
    const slots = order.map((_, index) => index).filter(index => !locked.includes(index));
    drag.to = slots.reduce((nearest, index) => Math.abs(drag.centers[index] - center) < Math.abs(drag.centers[nearest] - center) ? index : nearest, drag.from);
    setVisual({ from: drag.from, to: drag.to, offset });
  }
  function scroll() {
    const drag = active.current;
    if (!drag) return;
    const speed = drag.y < 70 ? -8 : drag.y > window.innerHeight - 70 ? 8 : 0;
    if (speed) { window.scrollBy(0, speed); update(); }
    frame.current = requestAnimationFrame(scroll);
  }
  function cancel() {
    active.current = null;
    cancelAnimationFrame(frame.current);
    setVisual(null);
  }
  function start(event: PointerEvent<HTMLLIElement>, from: number) {
    if (disabled || locked.includes(from) || !event.isPrimary || event.button !== 0) return;
    // A dedicated touch grip leaves the event copy available for normal page scrolling.
    if (event.pointerType === 'touch' && !(event.target as HTMLElement).closest('.ladder-grip')) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = { from, to: from, startY: event.clientY, y: event.clientY, scrollY: window.scrollY, pointerId: event.pointerId,
      centers: order.map(id => { const rect = cards.current.get(id)!.getBoundingClientRect(); return rect.top + rect.height / 2 + window.scrollY; }) };
    update();
    frame.current = requestAnimationFrame(scroll);
  }
  function pointerMove(event: PointerEvent<HTMLLIElement>) {
    if (active.current?.pointerId !== event.pointerId) return;
    active.current.y = event.clientY;
    update();
  }
  function end(event: PointerEvent<HTMLLIElement>) {
    if (active.current?.pointerId !== event.pointerId) return;
    const { from, to } = active.current;
    cancel();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    move(from, to);
  }
  return { cards, visual, start, pointerMove, end, cancel };
}

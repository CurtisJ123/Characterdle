import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clampCatalogColumnWidth, maxCatalogColumnWidth, minCatalogColumnWidth } from '../../lib/adminCatalogWidths';

export function CatalogColumnResize({ columnKey, label, width, onResize, onCommit, leftEdge = false }: {
  columnKey: string; label: string; width?: number;
  onResize: (key: string, width: number) => void; onCommit: () => void; leftEdge?: boolean;
}) {
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const handle = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState<number>();
  useEffect(() => {
    const header = handle.current?.closest('th');
    if (!header) return;
    const observer = new ResizeObserver(() => setMeasuredWidth(Math.round(header.getBoundingClientRect().width)));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  function measure(element: HTMLElement) { return element.closest('th')!.getBoundingClientRect().width; }
  function start(event: PointerEvent<HTMLSpanElement>) {
    if (!event.isPrimary || event.button !== 0 || drag.current) return;
    event.preventDefault(); event.stopPropagation();
    const element = event.currentTarget;
    element.focus({ preventScroll: true });
    drag.current = { pointerId: event.pointerId, x: event.clientX, width: measure(element) };
    element.setPointerCapture(event.pointerId);
    setActive(true);
  }
  function move(event: PointerEvent<HTMLSpanElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    onResize(columnKey, clampCatalogColumnWidth(columnKey, drag.current.width + (event.clientX - drag.current.x) * (leftEdge ? -1 : 1)));
  }
  function finish(event: PointerEvent<HTMLSpanElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current = null; setActive(false); onCommit();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 50 : 10;
    const next = event.key === 'Home' ? minCatalogColumnWidth(columnKey) : event.key === 'End' ? maxCatalogColumnWidth
      : measure(event.currentTarget) + (event.key === 'ArrowLeft' ? -step : step);
    onResize(columnKey, clampCatalogColumnWidth(columnKey, next)); onCommit();
  }
  const currentWidth = width ?? measuredWidth ?? minCatalogColumnWidth(columnKey);
  return <span ref={handle} className={`admin-catalog-resize${leftEdge ? ' admin-catalog-resize--left' : ''}${active ? ' is-resizing' : ''}`}
    role="separator" tabIndex={0} aria-label={`Resize ${label} column`} aria-orientation="vertical"
    aria-valuemin={minCatalogColumnWidth(columnKey)} aria-valuemax={maxCatalogColumnWidth}
    aria-valuenow={currentWidth} aria-valuetext={`${currentWidth} pixels`}
    onFocus={event => setMeasuredWidth(Math.round(measure(event.currentTarget)))}
    onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
    onKeyDown={keyDown} onClick={event => { event.preventDefault(); event.stopPropagation(); }} />;
}

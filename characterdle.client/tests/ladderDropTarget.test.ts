import assert from 'node:assert/strict';
import { test } from 'node:test';
import { constrainLadderDragOffset, getLadderPreviewOffsets, LADDER_DRAG_EDGE_ROOM, LADDER_DRAG_SCALE, resolveLadderDropTarget } from '../src/lib/ladderDropTarget.ts';

const bounds = [0, 1, 2, 3, 4].map(index => ({ top: 100 + index * 120, bottom: 200 + index * 120, left: 20, right: 320 }));
const hit = (y: number, from = 0, locked: number[] = [], x = 200) => resolveLadderDropTarget(bounds, from, locked, x, y);

test('middle 60% swaps; top and bottom 20% insert with distinct targets', () => {
  assert.deepEqual(hit(350), { mode: 'insert', to: 1, boundary: 2 });
  assert.deepEqual(hit(361), { mode: 'swap', to: 2 });
  assert.deepEqual(hit(419), { mode: 'swap', to: 2 });
  assert.deepEqual(hit(430), { mode: 'insert', to: 2, boundary: 3 });
});

test('card gaps, beginning and end are insertion targets', () => {
  assert.deepEqual(hit(330), { mode: 'insert', to: 1, boundary: 2 });
  assert.deepEqual(hit(450), { mode: 'insert', to: 2, boundary: 3 });
  assert.deepEqual(hit(94, 4), { mode: 'insert', to: 0, boundary: 0 });
  assert.deepEqual(hit(686), { mode: 'insert', to: 4, boundary: 5 });
});

test('inserting up and down accounts for removal of the dragged event', () => {
  assert.deepEqual(hit(350, 4), { mode: 'insert', to: 2, boundary: 2 });
  assert.deepEqual(hit(430, 4), { mode: 'insert', to: 3, boundary: 3 });
  assert.equal(hit(350, 1), null);
  assert.equal(hit(430, 3), null);
});

test('locked centers resolve to adjacent insertions rather than swapping a locked event', () => {
  assert.deepEqual(hit(390, 0, [2]), { mode: 'insert', to: 1, boundary: 2 });
  assert.equal(hit(390, 1, [1]), null);
  assert.deepEqual(hit(230, 4, [1]), { mode: 'insert', to: 2, boundary: 2 });
  assert.deepEqual(hit(590, 0, [3]), { mode: 'insert', to: 2, boundary: 3 });
  assert.equal(hit(350, 0, [1, 2, 3, 4]), null);
});

test('insert previews open an 8px gap without shifting the whole board', () => {
  assert.deepEqual(getLadderPreviewOffsets(5, 0, [], { mode: 'insert', to: 2, boundary: 3 }), [0, 0, -4, 4, 0]);
  assert.deepEqual(getLadderPreviewOffsets(5, 4, [], { mode: 'insert', to: 0, boundary: 0 }), [8, 0, 0, 0, 0]);
  assert.deepEqual(getLadderPreviewOffsets(5, 0, [], { mode: 'insert', to: 4, boundary: 5 }), [0, 0, 0, 0, -8]);
  assert.deepEqual(getLadderPreviewOffsets(5, 0, [3], { mode: 'insert', to: 2, boundary: 3 }), [0, 0, -8, 0, 0]);
  assert.deepEqual(getLadderPreviewOffsets(5, 0, [], { mode: 'insert', to: 1, boundary: 2 }), [0, -4, 4, 0, 0]);
  assert.deepEqual(getLadderPreviewOffsets(5, 0, [], null), [0, 0, 0, 0, 0]);
});

test('swap preview nudges only the target toward the original position', () => {
  assert.deepEqual(getLadderPreviewOffsets(5, 0, [], { mode: 'swap', to: 3 }), [0, 0, 0, -12, 0]);
  assert.deepEqual(getLadderPreviewOffsets(5, 4, [], { mode: 'swap', to: 1 }), [0, 12, 0, 0, 0]);
  assert.deepEqual(getLadderPreviewOffsets(5, 0, [3], { mode: 'swap', to: 3 }), [0, 0, 0, 0, 0]);
});

test('previews never translate a locked or dragged card for any lock combination', () => {
  for (let mask = 0; mask < 32; mask++) {
    const locked = [0, 1, 2, 3, 4].filter(slot => mask & (1 << slot));
    for (let from = 0; from < 5; from++) {
      for (let y = 94; y < 693; y += 6) {
        const target = hit(y, from, locked);
        const offsets = getLadderPreviewOffsets(5, from, locked, target);
        assert.equal(offsets[from], 0);
        locked.forEach(slot => assert.equal(offsets[slot], 0));
        if (target?.mode === 'insert') assert.equal(offsets.reduce((sum, offset) => sum + Math.abs(offset), 0), 8);
        if (target?.mode === 'swap') assert.equal(offsets.filter(Boolean).length, 1);
      }
    }
  }
});

test('self-drops and invalid drag coordinates do nothing', () => {
  for (const y of [110, 150, 190]) assert.equal(hit(y), null);
  for (const [x, y] of [[NaN, 390], [200, NaN], [Infinity, 390], [200, Infinity]]) assert.equal(hit(y, 0, [], x), null);
  assert.equal(resolveLadderDropTarget([], 0, [], 0, 0), null);
});

test('drops anywhere above or below the board insert at the first or last available position', () => {
  for (const y of [-100000, 0, 87]) assert.deepEqual(hit(y, 4), { mode: 'insert', to: 0, boundary: 0 });
  for (const y of [693, 1000, 100000]) assert.deepEqual(hit(y), { mode: 'insert', to: 4, boundary: 5 });
  assert.deepEqual(hit(-1000, 4, [0, 1]), { mode: 'insert', to: 2, boundary: 2 });
  assert.deepEqual(hit(1000, 0, [3, 4]), { mode: 'insert', to: 2, boundary: 3 });
  assert.equal(hit(-1000, 0), null);
  assert.equal(hit(1000, 4), null);
  assert.equal(hit(-1000, 2, [0, 1]), null);
  assert.equal(hit(1000, 2, [3, 4]), null);
});

test('horizontal drift outside either side still uses the intended timeline position', () => {
  for (const x of [-100000, 19, 321, 100000]) {
    assert.deepEqual(hit(390, 0, [], x), { mode: 'swap', to: 2 });
    assert.deepEqual(hit(430, 0, [], x), { mode: 'insert', to: 2, boundary: 3 });
    assert.deepEqual(hit(-1000, 4, [], x), { mode: 'insert', to: 0, boundary: 0 });
    assert.deepEqual(hit(1000, 0, [], x), { mode: 'insert', to: 4, boundary: 5 });
    assert.equal(hit(150, 0, [], x), null);
  }
});

test('dragged cards have bounded extra room past both ends including their scale', () => {
  for (let from = 0; from < bounds.length; from++) {
    const source = bounds[from];
    const overflow = (source.bottom - source.top) * (LADDER_DRAG_SCALE - 1) / 2;
    for (const requested of [-1000000, -500, 0, 500, 1000000]) {
      const offset = constrainLadderDragOffset(bounds, from, requested, 1000);
      assert.ok(source.top + offset - overflow >= bounds[0].top - LADDER_DRAG_EDGE_ROOM);
      assert.ok(source.bottom + offset + overflow <= bounds.at(-1)!.bottom + LADDER_DRAG_EDGE_ROOM);
    }
  }
  assert.equal(constrainLadderDragOffset(bounds, 2, 25, 1000), 25);
  assert.equal(constrainLadderDragOffset(bounds, 2, -272, 1000), -272);
  assert.equal(constrainLadderDragOffset(bounds, 2, 272, 1000), 272);
  assert.equal(constrainLadderDragOffset(bounds, 2, NaN, 1000), 0);
  assert.equal(constrainLadderDragOffset(bounds, 2, 100, NaN), 0);
  assert.equal(constrainLadderDragOffset([], 0, 100, 1000), 0);
});

test('extra edge room stops at the original page boundaries when space is limited', () => {
  const nearEdges = bounds.map(rect => ({ ...rect, top: rect.top - 90, bottom: rect.bottom - 90 }));
  for (let from = 0; from < nearEdges.length; from++) {
    const source = nearEdges[from];
    const overflow = (source.bottom - source.top) * (LADDER_DRAG_SCALE - 1) / 2;
    const topOffset = constrainLadderDragOffset(nearEdges, from, -1000000, 600);
    const bottomOffset = constrainLadderDragOffset(nearEdges, from, 1000000, 600);
    assert.ok(Math.abs(source.top + topOffset - overflow) < .001);
    assert.ok(Math.abs(source.bottom + bottomOffset + overflow - 600) < .001);
  }
});

test('hit zones follow variable card heights and document coordinates after scrolling', () => {
  const variable = [{ top: 1000, bottom: 1100, left: 20, right: 320 },
    { top: 1112, bottom: 1312, left: 20, right: 320 }, { top: 1324, bottom: 1424, left: 20, right: 320 }];
  assert.deepEqual(resolveLadderDropTarget(variable, 2, [], 200, 1130), { mode: 'insert', to: 1, boundary: 1 });
  assert.deepEqual(resolveLadderDropTarget(variable, 2, [], 200, 1200), { mode: 'swap', to: 1 });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { navigateFromLink } from '../src/lib/linkNavigation.ts';
import { buildRoutePath } from '../src/lib/routePaths.ts';

function click(overrides = {}) {
  return {
    button: 0, defaultPrevented: false,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    preventDefault() { this.defaultPrevented = true; },
    ...overrides,
  };
}

test('ordinary link activation uses the existing router without a full-page reload', () => {
  const event = click();
  let navigations = 0;
  navigateFromLink(event, () => { navigations += 1; });
  assert.equal(event.defaultPrevented, true);
  assert.equal(navigations, 1);
});

test('modified and non-primary clicks keep native browser behavior', () => {
  for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true },
    { altKey: true }, { button: 1 }, { button: 2 }]) {
    const event = click(modifiers);
    navigateFromLink(event, () => assert.fail('Must not navigate the current tab'));
    assert.equal(event.defaultPrevented, false);
  }
});

test('canceled clicks, target links, downloads, and links without callbacks are not intercepted', () => {
  navigateFromLink(click({ defaultPrevented: true }), () => assert.fail('Canceled click'));
  for (const target of ['_blank', '_parent', 'preview']) {
    const event = click();
    navigateFromLink(event, () => assert.fail('Targeted link'), target);
    assert.equal(event.defaultPrevented, false);
  }
  for (const download of ['', 'game.txt', true]) {
    const event = click();
    navigateFromLink(event, () => assert.fail('Download'), undefined, download);
    assert.equal(event.defaultPrevented, false);
  }
  const event = click();
  navigateFromLink(event);
  assert.equal(event.defaultPrevented, false);
});

test('a router guard can cancel navigation without falling back to a page reload', () => {
  const event = click();
  navigateFromLink(event, () => { /* Simulate the router declining navigation. */ });
  assert.equal(event.defaultPrevented, true);
});

test('game destinations preserve the universe, mode and archive number', () => {
  const route = { authMode: 'login' as const, universeId: 'got', gameMode: 'character' as const, gameId: null, page: 'game' as const };
  assert.equal(buildRoutePath(route), '/got');
  assert.equal(buildRoutePath({ ...route, gameMode: 'quote' }), '/got/game/quote');
  assert.equal(buildRoutePath({ ...route, gameId: 50 }), '/got/game/character/50');
  assert.equal(buildRoutePath({ ...route, gameMode: 'quote', gameId: 50 }), '/got/game/quote/50');
  assert.equal(buildRoutePath({ ...route, page: 'history', gameMode: 'quote' }), '/got/archive/quote');
  assert.equal(buildRoutePath({ ...route, page: 'leaderboard' }), '/got/leaderboard');
});

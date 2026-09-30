import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, detectPlatform, splitLinks } from '../../docs/lumiere/js/lib/links.js';

test('adds https:// when missing', () => {
  const r = normalizeUrl('instagram.com/reel/abc');
  assert.equal(r.ok, true);
  assert.equal(r.url, 'https://instagram.com/reel/abc');
  assert.equal(r.platform, 'instagram');
});

test('keeps http and handles protocol-relative links', () => {
  assert.equal(normalizeUrl('http://example.com').url, 'http://example.com/');
  assert.equal(normalizeUrl('//www.youtube.com/watch?v=1').url, 'https://www.youtube.com/watch?v=1');
});

test('detects platforms including short links and subdomains', () => {
  assert.equal(normalizeUrl('https://vm.tiktok.com/ZM123/').platform, 'tiktok');
  assert.equal(normalizeUrl('www.tiktok.com/@brand/video/1').platform, 'tiktok');
  assert.equal(normalizeUrl('youtu.be/xyz').platform, 'youtube');
  assert.equal(normalizeUrl('m.youtube.com/shorts/xyz').platform, 'youtube');
  assert.equal(normalizeUrl('pin.it/abc').platform, 'pinterest');
  assert.equal(normalizeUrl('pinterest.co.uk/pin/1').platform, 'pinterest');
  assert.equal(normalizeUrl('instagr.am/p/1').platform, 'instagram');
  assert.equal(normalizeUrl('vogue.com/article').platform, 'web');
  assert.equal(detectPlatform('notinstagram.com'), 'web');
});

test('invalid links return a warning instead of throwing', () => {
  for (const bad of ['', '   ', 'not a link', 'hello', 'javascript:alert(1)', 'ftp://files.com/x', 'http://', 'https://exa mple.com']) {
    const r = normalizeUrl(bad);
    assert.equal(r.ok, false, bad);
    assert.ok(r.error, bad);
  }
  assert.equal(normalizeUrl(null).ok, false);
});

test('splits pasted text into unique links', () => {
  assert.deepEqual(splitLinks('a.com\n b.com, a.com  c.com'), ['a.com', 'b.com', 'c.com']);
  assert.deepEqual(splitLinks(''), []);
  assert.deepEqual(splitLinks('not a link\ninstagram.com/p/1'), ['not a link', 'instagram.com/p/1']);
});

import { describe, expect, it } from 'vitest';
import { safeExternalHref } from './safe-external-href';

describe('safeExternalHref', () => {
  it('returns http(s) URLs unchanged', () => {
    expect(safeExternalHref('https://git.ejad.net/mobile/ninja-store')).toBe('https://git.ejad.net/mobile/ninja-store');
    expect(safeExternalHref('http://git.ejad.net/mobile/ninja-store/-/merge_requests/3')).toBe(
      'http://git.ejad.net/mobile/ninja-store/-/merge_requests/3',
    );
  });

  it.each([
    ['javascript URL', 'javascript:alert(1)'],
    ['data URL', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript URL', 'vbscript:msgbox(1)'],
    ['file URL', 'file:///etc/passwd'],
    ['relative path (no scheme to validate)', '/mobile/ninja-store'],
    ['protocol-relative', '//evil.com'],
    ['not a URL at all', 'not a url'],
    ['empty', ''],
    ['undefined', undefined],
    ['null', null],
  ])('rejects %s', (_label, url) => {
    expect(safeExternalHref(url)).toBeUndefined();
  });
});

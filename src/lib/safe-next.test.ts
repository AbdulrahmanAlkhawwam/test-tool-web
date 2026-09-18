import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

const origin = 'https://tests.ejad.example';

describe('safeNext', () => {
  it('keeps same-origin paths with their query and hash', () => {
    expect(safeNext('/projects/NINJA', origin)).toBe('/projects/NINJA');
    expect(safeNext('/projects/NINJA/cases?page=2#top', origin)).toBe('/projects/NINJA/cases?page=2#top');
    expect(safeNext('/projects/./NINJA/../NINJA/runs?x=1', origin)).toBe('/projects/NINJA/runs?x=1');
  });

  it('uses the current window origin by default', () => {
    expect(safeNext('/projects/NINJA')).toBe('/projects/NINJA');
    expect(safeNext('/\\evil.com')).toBe('/');
  });

  it.each([
    ['protocol-relative', '//evil.com'],
    ['backslash', '/\\evil.com'],
    ['double backslash', '/\\\\evil.com'],
    // `?next=/%5Cevil.com` reaches the page already decoded by URLSearchParams.
    ['decoded %5C', new URLSearchParams('next=/%5Cevil.com').get('next')],
    ['decoded %5C%5C', new URLSearchParams('next=/%5C%5Cevil.com').get('next')],
    ['tab', '/\t/evil.com'],
    ['decoded %09', new URLSearchParams('next=/%09/evil.com').get('next')],
    ['absolute URL', 'https://evil.com'],
    ['javascript URL', 'javascript:alert(1)'],
    // Dot segments collapse while resolving and would leave `//evil.com` as the path.
    ['dot slash', '/.//evil.com'],
    ['dot-dot slash', '/..//evil.com'],
    ['segment then dot-dot', '/a/..//evil.com'],
    ['encoded dot', '/%2e//evil.com'],
    ['dot backslash', '/./\\evil.com'],
    ['empty', ''],
    ['null', null],
  ])('rejects %s', (_label, next) => {
    expect(safeNext(next, origin)).toBe('/');
  });
});

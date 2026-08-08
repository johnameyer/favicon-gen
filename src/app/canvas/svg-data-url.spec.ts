import { svgToDataUrl } from './svg-data-url';

describe('svgToDataUrl', () => {
  it('produces a base64 svg+xml data URL', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>';
    const url = svgToDataUrl(svg);
    expect(url).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('round-trips the original markup', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>';
    const url = svgToDataUrl(svg);
    const base64 = url.replace('data:image/svg+xml;base64,', '');
    const decoded = decodeURIComponent(escape(atob(base64)));
    expect(decoded).toBe(svg);
  });

  it('handles non-ASCII characters in the markup', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>😀</text></svg>';
    expect(() => svgToDataUrl(svg)).not.toThrow();
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeHtml, renderMarkdown, sanitizeHref } from '../lib/blog-markdown.js';

test('markdown renderer supports the v1 allowlist', () => {
  const html = renderMarkdown([
    '## Studio note',
    '',
    'A **bold** and *italic* paragraph with a [safe link](https://maisondart.example).',
    '',
    '- linen',
    '- pigment',
    '',
    '1. stretch',
    '2. varnish',
    '',
    '### Aftercare',
    'Visit [/explore](/explore) or write [us](mailto:atelier@maisondart.example).',
  ].join('\n'));

  assert.match(html, /<h2>Studio note<\/h2>/);
  assert.match(html, /<h3>Aftercare<\/h3>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<ul><li>linen<\/li><li>pigment<\/li><\/ul>/);
  assert.match(html, /<ol><li>stretch<\/li><li>varnish<\/li><\/ol>/);
  assert.match(html, /<a href="https:\/\/maisondart\.example" rel="noopener noreferrer">safe link<\/a>/);
  assert.match(html, /<a href="\/explore" rel="noopener noreferrer">\/explore<\/a>/);
  assert.match(html, /<a href="mailto:atelier@maisondart\.example" rel="noopener noreferrer">us<\/a>/);
});

test('markdown renderer escapes raw HTML and rejects unsafe URL protocols', () => {
  const html = renderMarkdown([
    '<script>alert(1)</script>',
    '[xss](javascript:alert(1))',
    '[data](data:text/html;base64,aaaa)',
    '[proto](//evil.example)',
  ].join('\n\n'));

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /href="javascript:/i);
  assert.doesNotMatch(html, /href="data:/i);
  assert.doesNotMatch(html, /href="\/\//);
  assert.match(html, />xss</);
  assert.equal(sanitizeHref('javascript:alert(1)'), null);
  assert.equal(sanitizeHref('https://ok.example'), 'https://ok.example');
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

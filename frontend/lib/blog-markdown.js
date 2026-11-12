const UNSAFE_PROTOCOL = /^(javascript|data|vbscript):/i;

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeHref(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed || UNSAFE_PROTOCOL.test(trimmed) || trimmed.startsWith('//')) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || (trimmed.startsWith('/') && !trimmed.startsWith('//'))) {
    return trimmed;
  }
  return null;
}

function renderInline(source) {
  let remaining = String(source || '');
  const out = [];

  while (remaining.length > 0) {
    const link = remaining.match(/^\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/);
    if (link) {
      const href = sanitizeHref(link[2]);
      const label = escapeHtml(link[1]);
      if (href) {
        out.push(`<a href="${escapeHtml(href)}" rel="noopener noreferrer">${label}</a>`);
      } else {
        out.push(label);
      }
      remaining = remaining.slice(link[0].length);
      continue;
    }

    const bold = remaining.match(/^\*\*([^*]+)\*\*/);
    if (bold) {
      out.push(`<strong>${escapeHtml(bold[1])}</strong>`);
      remaining = remaining.slice(bold[0].length);
      continue;
    }

    const italic = remaining.match(/^\*([^*]+)\*/);
    if (italic) {
      out.push(`<em>${escapeHtml(italic[1])}</em>`);
      remaining = remaining.slice(italic[0].length);
      continue;
    }

    const nextSpecial = remaining.search(/\[|\*/);
    const take = nextSpecial <= 0 ? 1 : nextSpecial;
    out.push(escapeHtml(remaining.slice(0, take)));
    remaining = remaining.slice(take);
  }

  return out.join('');
}

function isUnordered(line) {
  return /^\s*[-*]\s+/.test(line);
}

function isOrdered(line) {
  return /^\s*\d+\.\s+/.test(line);
}

function isHeading(line) {
  return /^(#{2,3})\s+\S/.test(line);
}

export function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading && isHeading(line)) {
      const tag = heading[1].length === 2 ? 'h2' : 'h3';
      html.push(`<${tag}>${renderInline(heading[2].trim())}</${tag}>`);
      index += 1;
      continue;
    }

    if (isUnordered(line)) {
      const items = [];
      while (index < lines.length && isUnordered(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\s*[-*]\s+/, ''))}</li>`);
        index += 1;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (isOrdered(line)) {
      const items = [];
      while (index < lines.length && isOrdered(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        index += 1;
      }
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    const parts = [];
    while (
      index < lines.length
      && lines[index].trim()
      && !isHeading(lines[index])
      && !isUnordered(lines[index])
      && !isOrdered(lines[index])
    ) {
      parts.push(lines[index]);
      index += 1;
    }
    html.push(`<p>${renderInline(parts.join(' '))}</p>`);
  }

  return html.join('');
}

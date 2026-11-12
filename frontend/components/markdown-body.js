import { renderMarkdown } from '@/lib/blog-markdown';

export function MarkdownBody({ markdown, className = '' }) {
  const html = renderMarkdown(markdown);
  if (!html) {
    return null;
  }

  return (
    <div
      className={`journal-body ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

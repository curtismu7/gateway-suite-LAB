// Markdown rendering for the agent answer: sanitized, no scripts, no event handlers.
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export function renderSafeMarkdown(text) {
  const html = marked.parse(String(text ?? ''), { async: false });
  return sanitizeHtml(html, {
    allowedTags: ['a', 'blockquote', 'br', 'code', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'ol', 'p', 'pre', 'strong', 'ul'],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

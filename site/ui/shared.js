export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

export function field(label, path, value, options = {}) {
  const { type = 'text', placeholder = '', full = false, autocomplete = '', rows = 0 } = options;
  const safePath = escapeHtml(path);
  const classes = `field${full ? ' full' : ''}`;
  if (type === 'textarea') return `<label class="${classes}"><span>${escapeHtml(label)}</span><textarea data-path="${safePath}" placeholder="${escapeHtml(placeholder)}"${rows ? ` rows="${rows}"` : ''}>${escapeHtml(value)}</textarea></label>`;
  return `<label class="${classes}"><span>${escapeHtml(label)}</span><input type="${type}" data-path="${safePath}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${autocomplete ? ` autocomplete="${autocomplete}"` : ''}></label>`;
}

export function scoreLabel(score) {
  if (score >= 85) return 'Strong submission baseline';
  if (score >= 70) return 'Competitive with targeted edits';
  if (score >= 55) return 'Needs meaningful refinement';
  return 'Build the fundamentals first';
}

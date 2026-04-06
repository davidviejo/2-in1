export const renderMarkdown = (text: string): string => {
  if (!text) return '';

  const html = text
    // Basic sanitization
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Headers
    .replace(
      /^### (.*$)/gim,
      '<h3 class="text-lg font-bold text-slate-800 dark:text-slate-200 mt-4 mb-2">$1</h3>',
    )
    .replace(
      /^#### (.*$)/gim,
      '<h4 class="text-md font-bold text-slate-700 dark:text-slate-300 mt-3 mb-1">$1</h4>',
    )

    // Bold
    .replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>',
    )

    // Lists (using flex container to simulate bullet points cleanly)
    .replace(
      /^- (.*$)/gim,
      '<div class="flex gap-2 ml-1 mb-1"><span class="text-slate-400 select-none">•</span><span class="text-slate-600 dark:text-slate-300">$1</span></div>',
    )

    // Newlines
    .replace(/\n/g, '<br/>');

  return html;
};

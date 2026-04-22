import React from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { NoteScopeType } from '@/types';
import { openContextualNotes } from '@/utils/noteEvents';

interface ContextNoteButtonProps {
  scopeType: NoteScopeType;
  scopeId: string;
  title: string;
  tags?: string[];
  suggestedContent?: string;
  className?: string;
  compact?: boolean;
}

const ContextNoteButton: React.FC<ContextNoteButtonProps> = ({
  scopeType,
  scopeId,
  title,
  tags,
  suggestedContent,
  className = '',
  compact = false,
}) => (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      openContextualNotes({ scopeType, scopeId, title, tags, suggestedContent });
    }}
    className={
      className ||
      `inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-primary/40 hover:text-primary ${compact ? '' : 'bg-white dark:bg-slate-800'}`
    }
    title={`Añadir nota contextual: ${title}`}
  >
    <MessageSquarePlus size={compact ? 14 : 15} />
    {!compact && <span>Nota</span>}
  </button>
);

export default ContextNoteButton;

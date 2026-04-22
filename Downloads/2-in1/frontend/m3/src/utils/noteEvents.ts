import { NoteScopeType } from '@/types';

export interface NoteContextRequest {
  scopeType: NoteScopeType;
  scopeId: string;
  title?: string;
  tags?: string[];
  suggestedContent?: string;
}

export const NOTE_CONTEXT_EVENT = 'mediaflow:open-context-notes';

export const openContextualNotes = (detail: NoteContextRequest) => {
  window.dispatchEvent(new CustomEvent<NoteContextRequest>(NOTE_CONTEXT_EVENT, { detail }));
};

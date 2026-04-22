import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, StickyNote, Globe, Pin, Lock, ListTodo, Filter } from 'lucide-react';
import { Note } from '../types';
import { NoteContextRequest } from '@/utils/noteEvents';

interface NotesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectNotes: Note[];
  generalNotes: Note[];
  onAddNote: (
    content: string,
    type: 'project' | 'general',
    options?: Partial<Pick<Note, 'scopeType' | 'scopeId' | 'author' | 'tags' | 'isInternal' | 'isPinned' | 'trace'>>,
  ) => void;
  onUpdateNote: (noteId: string, content: string, type: 'project' | 'general') => void;
  onDeleteNote: (noteId: string, type: 'project' | 'general') => void;
  onTogglePinNote: (noteId: string, type: 'project' | 'general') => void;
  onToggleInternalNote: (noteId: string, type: 'project' | 'general') => void;
  onConvertNoteToTask: (noteId: string, type: 'project' | 'general', moduleId?: number) => void;
  projectName: string;
  contextRequest?: NoteContextRequest | null;
}

const NotesPanel: React.FC<NotesPanelProps> = ({
  isOpen,
  onClose,
  projectNotes,
  generalNotes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onTogglePinNote,
  onToggleInternalNote,
  onConvertNoteToTask,
  projectName,
  contextRequest,
}) => {
  const [activeTab, setActiveTab] = useState<'project' | 'general'>('project');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'context' | 'pinned'>('all');

  useEffect(() => {
    if (!contextRequest) return;
    setActiveTab(contextRequest.scopeType === 'global' ? 'general' : 'project');
    setScopeFilter('context');
    setNewNoteContent(contextRequest.suggestedContent || '');
  }, [contextRequest]);

  const handleAddNote = () => {
    if (!newNoteContent.trim()) return;
    onAddNote(newNoteContent, activeTab, {
      scopeType: contextRequest?.scopeType || (activeTab === 'general' ? 'global' : 'client'),
      scopeId: contextRequest?.scopeId || (activeTab === 'general' ? 'global' : projectName),
      tags: contextRequest?.tags || [],
      author: 'Equipo SEO',
      trace: {
        timestamp: Date.now(),
      },
    });
    setNewNoteContent('');
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const saveEdit = (noteId: string) => {
    if (!editContent.trim()) return;
    onUpdateNote(noteId, editContent, activeTab);
    setEditingNoteId(null);
    setEditContent('');
  };

  const notesByTab = activeTab === 'project' ? projectNotes : generalNotes;

  const activeNotes = useMemo(() => {
    const filtered = notesByTab.filter((note) => {
      if (scopeFilter === 'pinned') return !!note.isPinned;
      if (scopeFilter === 'context' && contextRequest) {
        return note.scopeType === contextRequest.scopeType && note.scopeId === contextRequest.scopeId;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });
  }, [contextRequest, notesByTab, scopeFilter]);

  const contextLabel = contextRequest ? `${contextRequest.scopeType} · ${contextRequest.title || contextRequest.scopeId}` : null;

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" onClick={onClose} />}

      <div
        className={`
        fixed inset-y-0 right-0 z-50 w-full sm:w-[30rem] bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <StickyNote className="text-blue-600" size={20} />
              Notas
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button onClick={() => setActiveTab('project')} className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'project' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500'}`}>
              {projectName}
            </button>
            <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'general' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500'}`}>
              <span className="flex items-center justify-center gap-2">
                <Globe size={14} /> Globales
              </span>
            </button>
          </div>

          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
            {contextLabel && <div className="text-xs text-primary font-medium">Contexto activo: {contextLabel}</div>}
            <div className="flex gap-2">
              {(['all', 'context', 'pinned'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setScopeFilter(item)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs border ${scopeFilter === item ? 'border-primary text-primary bg-primary/10' : 'border-slate-200 text-slate-500'}`}
                >
                  <Filter size={12} />
                  {item === 'all' ? 'Todas' : item === 'context' ? 'Contextuales' : 'Fijadas'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {activeNotes.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                <StickyNote size={48} className="mx-auto mb-3 opacity-20" />
                <p>No hay notas para este filtro.</p>
                <p className="text-sm">Crea una nota para este contexto.</p>
              </div>
            ) : (
              activeNotes.map((note) => (
                <div key={note.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700 group">
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full p-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg" autoFocus />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingNoteId(null)} className="px-2 py-1 text-xs text-slate-500">Cancelar</button>
                        <button onClick={() => saveEdit(note.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded"> <Check size={12} className="inline" /> Guardar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-slate-700 dark:text-slate-200 text-sm whitespace-pre-wrap mb-2">{note.content}</div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="text-[10px] rounded-full px-2 py-0.5 bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-200">{note.scopeType || 'global'} · {note.scopeId || 'n/a'}</span>
                        {note.tags?.map((tag) => <span key={tag} className="text-[10px] rounded-full px-2 py-0.5 border border-slate-200 dark:border-slate-700 text-slate-500">#{tag}</span>)}
                        {note.isInternal && <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">Interna</span>}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{new Date(note.updatedAt || note.createdAt).toLocaleString()}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onTogglePinNote(note.id, activeTab)} className="p-1 text-slate-500 rounded" title="Fijar"><Pin size={14} className={note.isPinned ? 'text-primary fill-primary/20' : ''} /></button>
                          <button onClick={() => onToggleInternalNote(note.id, activeTab)} className="p-1 text-slate-500 rounded" title="Marcar interna"><Lock size={14} className={note.isInternal ? 'text-amber-600' : ''} /></button>
                          <button onClick={() => onConvertNoteToTask(note.id, activeTab)} className="p-1 text-slate-500 rounded" title="Convertir en tarea"><ListTodo size={14} /></button>
                          <button onClick={() => startEditing(note)} className="p-1 text-blue-600 rounded" title="Editar"><Edit2 size={14} /></button>
                          <button onClick={() => onDeleteNote(note.id, activeTab)} className="p-1 text-red-600 rounded" title="Eliminar"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="relative">
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder={`Añadir nota ${contextRequest ? `en ${contextRequest.title || contextRequest.scopeId}` : `en ${activeTab === 'project' ? projectName : 'Global'}`}...`}
                className="w-full pl-3 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none min-h-[80px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
              />
              <button onClick={handleAddNote} disabled={!newNoteContent.trim()} className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotesPanel;

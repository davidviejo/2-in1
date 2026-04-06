import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, StickyNote, Globe } from 'lucide-react';
import { Note } from '../types';

interface NotesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectNotes: Note[];
  generalNotes: Note[];
  onAddNote: (content: string, type: 'project' | 'general') => void;
  onUpdateNote: (noteId: string, content: string, type: 'project' | 'general') => void;
  onDeleteNote: (noteId: string, type: 'project' | 'general') => void;
  projectName: string;
}

const NotesPanel: React.FC<NotesPanelProps> = ({
  isOpen,
  onClose,
  projectNotes,
  generalNotes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  projectName,
}) => {
  const [activeTab, setActiveTab] = useState<'project' | 'general'>('project');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleAddNote = () => {
    if (!newNoteContent.trim()) return;
    onAddNote(newNoteContent, activeTab);
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

  const activeNotes = activeTab === 'project' ? projectNotes : generalNotes;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" onClick={onClose} />
      )}

      {/* Drawer */}
      <div
        className={`
        fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <StickyNote className="text-blue-600" size={20} />
              Notas
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('project')}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'project'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {projectName}
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'general'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <Globe size={14} /> Globales
              </span>
            </button>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {activeNotes.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                <StickyNote size={48} className="mx-auto mb-3 opacity-20" />
                <p>No hay notas todavía.</p>
                <p className="text-sm">Añade una nueva nota abajo.</p>
              </div>
            ) : (
              activeNotes.map((note) => (
                <div
                  key={note.id}
                  className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700 group hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                >
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none min-h-[80px]"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => saveEdit(note.id)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                        >
                          <Check size={12} /> Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-slate-700 dark:text-slate-200 text-sm whitespace-pre-wrap mb-2">
                        {note.content}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditing(note)}
                            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 rounded"
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => onDeleteNote(note.id, activeTab)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="relative">
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder={`Añadir nota en ${activeTab === 'project' ? projectName : 'Global'}...`}
                className="w-full pl-3 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none min-h-[80px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
              />
              <button
                onClick={handleAddNote}
                disabled={!newNoteContent.trim()}
                className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/30"
              >
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

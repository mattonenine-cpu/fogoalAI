
import React, { useState } from 'react';
import { Note, NoteFolder, Language, TRANSLATIONS } from '../types';
import { GlassCard, GlassInput } from './GlassCard';
import { Plus, Search, Folder, MoreVertical, Trash2, StickyNote, X, Calendar, Edit3, ArrowLeft, FolderPlus, Check } from 'lucide-react';

interface NotesViewProps {
  notes: Note[];
  folders: NoteFolder[];
  onUpdateNotes: (notes: Note[]) => void;
  onUpdateFolders: (folders: NoteFolder[]) => void;
  lang: Language;
}

const NOTE_COLORS = [
  'transparent',
  '#f87171', // Red
  '#fb923c', // Orange
  '#facc15', // Yellow
  '#4ade80', // Green
  '#60a5fa', // Blue
  '#c084fc', // Purple
];

export const NotesView: React.FC<NotesViewProps> = ({ notes, folders, onUpdateNotes, onUpdateFolders, lang }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderTitle, setNewFolderTitle] = useState('');

  const filteredNotes = notes.filter(n => {
    const matchesFolder = activeFolder ? n.folderId === activeFolder : true;
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const handleCreateNote = () => {
      const newNote: Note = {
          id: Date.now().toString(),
          title: '',
          content: '',
          color: 'transparent',
          folderId: activeFolder || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };
      setEditingNote(newNote);
      setIsCreating(true);
  };

  const handleSaveNote = () => {
      if (!editingNote) return;
      const updated = { ...editingNote, updatedAt: new Date().toISOString() };
      
      if (isCreating) {
          onUpdateNotes([updated, ...notes]);
      } else {
          onUpdateNotes(notes.map(n => n.id === updated.id ? updated : n));
      }
      setEditingNote(null);
      setIsCreating(false);
  };

  const handleDeleteNote = (id: string) => {
      onUpdateNotes(notes.filter(n => n.id !== id));
      setEditingNote(null);
  };

  const saveNewFolder = () => {
      if (newFolderTitle.trim()) {
          const newFolder: NoteFolder = {
              id: Date.now().toString(),
              title: newFolderTitle.trim(),
              color: '#6366f1',
              createdAt: new Date().toISOString()
          };
          onUpdateFolders([...folders, newFolder]);
          setNewFolderTitle('');
          setShowFolderModal(false);
      }
  };

  const deleteFolder = (id: string) => {
      if (confirm(t.folderDelete)) {
          onUpdateFolders(folders.filter(f => f.id !== id));
          if (activeFolder === id) setActiveFolder(null);
      }
  };

  return (
    <div className="h-full flex flex-col animate-fadeIn pb-24">
      <div className="flex justify-between items-center mb-6 px-1">
        <h1 className="text-3xl font-medium text-[var(--text-primary)] tracking-tight">{t.notesTitle}</h1>
      </div>

      <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-50" size={16} />
          <input 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.notesSearch}
            className="w-full h-12 bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-[24px] pl-11 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/30 transition-all placeholder:text-[var(--text-secondary)]"
          />
      </div>

      <div className="flex items-center gap-3 mb-6 px-1">
          <div className="flex-1 flex gap-3 overflow-x-auto scrollbar-hide py-2 items-center">
              <button 
                onClick={() => setActiveFolder(null)}
                className={`px-5 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${!activeFolder ? 'bg-[var(--theme-accent)] text-white border-transparent shadow-md' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-glass)] hover:bg-white/5'}`}
              >
                  All
              </button>
              {folders.map(f => (
                  <button 
                    key={f.id}
                    onClick={() => setActiveFolder(f.id)}
                    className={`px-5 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-2 ${activeFolder === f.id ? 'bg-[var(--theme-accent)] text-white border-transparent shadow-md' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-glass)]'}`}
                  >
                      {f.title}
                      {activeFolder === f.id && (
                          <span onClick={(e) => { e.stopPropagation(); deleteFolder(f.id); }} className="ml-1 w-4 h-4 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40"><X size={10} strokeWidth={3} /></span>
                      )}
                  </button>
              ))}
          </div>
          <button 
            onClick={() => setShowFolderModal(true)}
            className="w-12 h-12 rounded-full bg-white/5 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-secondary)] hover:text-white shrink-0 active:scale-95 transition-all shadow-sm"
          >
              <FolderPlus size={20} />
          </button>
      </div>

      <div className="grid grid-cols-2 gap-4 pb-24">
          <button onClick={handleCreateNote} className="aspect-[4/5] rounded-[32px] border border-dashed border-[var(--border-glass)] flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all group">
              <Plus size={24} />
              <span className="text-xs font-medium">{t.add}</span>
          </button>

          {filteredNotes.map(note => (
              <GlassCard 
                key={note.id} 
                onClick={() => { setEditingNote(note); setIsCreating(false); }}
                className="aspect-[4/5] p-5 rounded-[32px] flex flex-col justify-between cursor-pointer transition-all relative overflow-hidden border-[var(--border-glass)] shadow-sm"
                style={{ backgroundColor: note.color !== 'transparent' ? `${note.color}10` : 'var(--bg-card)' }}
              >
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-tight mb-2 line-clamp-2">{note.title || t.notesNoTitle}</h3>
                    <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed line-clamp-4 font-normal opacity-90">{note.content || '...'}</p>
                  </div>
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] opacity-40">{new Date(note.updatedAt).toLocaleDateString()}</span>
              </GlassCard>
          ))}
      </div>

      {/* NEW FOLDER MODAL */}
      {showFolderModal && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-fadeIn bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-xs bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[32px] p-6 shadow-2xl space-y-4">
                  <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{t.folderNew}</h3>
                      <button onClick={() => setShowFolderModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-white"><X size={16}/></button>
                  </div>
                  <GlassInput 
                      value={newFolderTitle}
                      onChange={e => setNewFolderTitle(e.target.value)}
                      placeholder={t.folderName}
                      className="h-12 rounded-2xl"
                      autoFocus
                  />
                  <button onClick={saveNewFolder} className="w-full h-12 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-full font-black uppercase text-[11px] shadow-lg active:scale-95 transition-all">
                      {t.save}
                  </button>
              </div>
          </div>
      )}

      {editingNote && (
          <div className="fixed inset-0 z-[900] bg-[var(--bg-main)] flex flex-col animate-slide-up">
              <header className="px-6 py-4 flex justify-between items-center border-b border-[var(--border-glass)] bg-[var(--bg-main)] shrink-0">
                  <button onClick={() => setEditingNote(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)]">
                      <ArrowLeft size={20} />
                  </button>
                  <div className="flex gap-2">
                    {NOTE_COLORS.map(c => (
                        <button key={c} onClick={() => setEditingNote({...editingNote, color: c})} className={`w-5 h-5 rounded-full border ${editingNote.color === c ? 'border-white scale-110' : 'border-white/10'}`} style={{ backgroundColor: c === 'transparent' ? 'transparent' : c }} />
                    ))}
                  </div>
                  <button onClick={handleSaveNote} className="px-5 py-2 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-full font-semibold text-xs transition-all">
                      {t.save}
                  </button>
              </header>

              <div className="flex-1 overflow-y-auto p-8 scrollbar-hide flex flex-col bg-[var(--bg-main)]">
                  <input 
                      value={editingNote.title}
                      onChange={e => setEditingNote({...editingNote, title: e.target.value})}
                      placeholder={t.notesPlaceholderTitle}
                      className="w-full bg-transparent border-none text-3xl font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-30 focus:outline-none mb-6"
                  />
                  <textarea 
                      value={editingNote.content}
                      onChange={e => setEditingNote({...editingNote, content: e.target.value})}
                      placeholder={t.notesPlaceholderContent}
                      className="w-full flex-1 bg-transparent border-none text-base leading-loose text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-30 focus:outline-none resize-none font-normal h-full pb-32"
                  />
              </div>

              <footer className="p-6 border-t border-[var(--border-glass)] flex justify-between items-center gap-4 shrink-0 pb-12">
                  <div className="flex items-center gap-3 flex-1 overflow-hidden">
                      <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2 border border-[var(--border-glass)]">
                          <Calendar size={14} className="text-[var(--text-secondary)]"/>
                          <input type="date" value={editingNote.linkedDate || ''} onChange={e => setEditingNote({...editingNote, linkedDate: e.target.value})} className="bg-transparent border-none text-[11px] text-[var(--text-primary)] font-medium focus:outline-none" />
                      </div>
                  </div>
                  <button onClick={() => handleDeleteNote(editingNote.id)} className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center active:scale-90">
                      <Trash2 size={18} />
                  </button>
              </footer>
          </div>
      )}
    </div>
  );
};

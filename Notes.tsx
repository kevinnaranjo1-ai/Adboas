import { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, Trash2, Edit, Save, Download, FileText, 
  BookOpen, Calendar, ChevronRight, Loader2, AlertCircle, CheckCircle2, Folder, 
  Trash, ArrowLeft, ChevronLeft
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  collection, query, where, orderBy, getDocs, addDoc, 
  updateDoc, deleteDoc, doc, serverTimestamp, Timestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

interface UserNote {
  id: string;
  userId: string;
  title: string;
  category: string;
  content: string;
  createdAt: any;
  updatedAt: any;
}

const CATEGORIES = [
  'Devocional',
  'Esboço de Sermão',
  'Estudo Bíblico',
  'Notas de Culto',
  'Pedidos de Oração',
  'Reflexão Pessoal',
  'Outros'
];

export default function Notes() {
  const [user] = useAuthState(auth);
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<UserNote | null>(null);
  
  // Editor State
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Devocional');
  const [editContent, setEditContent] = useState('');

  // Dialog & Safeguard States
  const [noteToDeleteId, setNoteToDeleteId] = useState<string | null>(null);
  const [pendingSwitchTarget, setPendingSwitchTarget] = useState<UserNote | 'NEW_NOTE' | 'BACK_TO_LIST' | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  const hasChanges = selectedNote && (
    editTitle.trim() !== (selectedNote.title || '').trim() ||
    editCategory !== (selectedNote.category || 'Devocional') ||
    editContent !== (selectedNote.content || '')
  );

  // Sincronizar os campos de escrita com a nota selecionada de forma imediata
  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title || '');
      setEditCategory(selectedNote.category || 'Devocional');
      setEditContent(selectedNote.content || '');
    } else {
      setEditTitle('');
      setEditCategory('Devocional');
      setEditContent('');
    }
  }, [selectedNote]);
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotes();
    }
  }, [user]);

  const fetchNotes = async () => {
    if (!user) return;
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const q = query(
        collection(db, 'user_notes'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const loadedNotes: UserNote[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        loadedNotes.push({
          id: docSnap.id,
          userId: data.userId,
          title: data.title || '',
          category: data.category || 'Outros',
          content: data.content || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });
      
      // Sort in-memory by updatedAt descending
      loadedNotes.sort((a, b) => {
        const getMs = (val: any) => {
          if (!val) return 0;
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (typeof val.getTime === 'function') return val.getTime();
          if (val.seconds) return val.seconds * 1000;
          return new Date(val).getTime() || 0;
        };
        return getMs(b.updatedAt) - getMs(a.updatedAt);
      });

      setNotes(loadedNotes);
      
      // Select the first note by default if available and none selected yet
      if (loadedNotes.length > 0 && !selectedNote) {
        setSelectedNote(loadedNotes[0]);
      }
    } catch (err) {
      console.error('Erro ao buscar notas:', err);
      setErrorMessage('Não foi possível carregar suas anotações.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!user) return;
    setActionLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const newNoteData = {
        userId: user.uid,
        title: 'Nova Anotação',
        category: 'Devocional',
        content: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'user_notes'), newNoteData);
      const createdNote: UserNote = {
        id: docRef.id,
        ...newNoteData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      setNotes(prev => [createdNote, ...prev]);
      setSelectedNote(createdNote);
      setMobileView('editor');

      setSuccessMessage('Nova anotação criada com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Erro ao criar nota:', err);
      setErrorMessage('Não foi possível criar uma nova anotação.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!user || !selectedNote) return;
    if (!editTitle.trim()) {
      setErrorMessage('O título da anotação não pode ficar vazio.');
      return;
    }
    
    setActionLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const noteRef = doc(db, 'user_notes', selectedNote.id);
      const updateData = {
        title: editTitle.trim(),
        category: editCategory,
        content: editContent,
        updatedAt: serverTimestamp()
      };

      await updateDoc(noteRef, updateData);

      // Update local state
      const updatedNote: UserNote = {
        ...selectedNote,
        title: editTitle.trim(),
        category: editCategory,
        content: editContent,
        updatedAt: new Date()
      };

      setNotes(prev => prev.map(n => n.id === selectedNote.id ? updatedNote : n));
      setSelectedNote(updatedNote);

      setSuccessMessage('Anotação salva com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Erro ao salvar nota:', err);
      setErrorMessage('Não foi possível salvar as alterações.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!user) return;

    setActionLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      await deleteDoc(doc(db, 'user_notes', noteId));
      
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(notes.length > 1 ? notes.find(n => n.id !== noteId) || null : null);
        setMobileView('list');
      }
      setSuccessMessage('Anotação excluída com sucesso.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Erro ao excluir nota:', err);
      setErrorMessage('Não foi possível excluir esta anotação.');
    } finally {
      setActionLoading(false);
    }
  };

  // Export Note as PDF using jsPDF
  const downloadAsPDF = (note: UserNote) => {
    try {
      const docPdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Branding Header
      docPdf.setFillColor(30, 41, 59); // deep navy
      docPdf.rect(0, 0, 210, 35, 'F');
      
      docPdf.setTextColor(255, 255, 255);
      docPdf.setFont('Helvetica', 'bold');
      docPdf.setFontSize(16);
      docPdf.text('Minhas Anotações de Fé', 15, 14);
      
      docPdf.setFont('Helvetica', 'normal');
      docPdf.setFontSize(9);
      docPdf.setTextColor(200, 200, 200);
      docPdf.text('AD Assembleia de Deus - Tenda da Promessa', 15, 21);

      // Gold line separator
      docPdf.setDrawColor(180, 83, 9); // gold
      docPdf.setLineWidth(1.5);
      docPdf.line(0, 35, 210, 35);

      // Note content metadata
      docPdf.setTextColor(30, 41, 59);
      docPdf.setFont('Helvetica', 'bold');
      docPdf.setFontSize(20);
      
      const splitTitle = docPdf.splitTextToSize(note.title, 180);
      docPdf.text(splitTitle, 15, 52);

      const titleLines = splitTitle.length;
      let yOffset = 52 + (titleLines * 7);

      // Line separator
      docPdf.setDrawColor(240, 240, 240);
      docPdf.setLineWidth(0.5);
      docPdf.line(15, yOffset, 195, yOffset);

      yOffset += 8;

      // Category and date
      docPdf.setFont('Helvetica', 'oblique');
      docPdf.setFontSize(9);
      docPdf.setTextColor(110, 110, 110);
      docPdf.text(`Categoria: ${note.category}`, 15, yOffset);
      
      let formattedDate = 'Recentemente';
      if (note.updatedAt) {
        const dateObj = note.updatedAt instanceof Timestamp 
          ? note.updatedAt.toDate() 
          : new Date(note.updatedAt);
        formattedDate = dateObj.toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      }
      docPdf.text(`Última atualização: ${formattedDate}`, 120, yOffset);

      yOffset += 12;

      // Content
      docPdf.setFont('Helvetica', 'normal');
      docPdf.setFontSize(11);
      docPdf.setTextColor(51, 65, 85); // gray-700
      
      const splitContent = docPdf.splitTextToSize(note.content, 180);
      
      // Page size is 297mm height, leave margin at the bottom (20mm)
      const pageHeightLimit = 277; 
      
      for (let i = 0; i < splitContent.length; i++) {
        if (yOffset > pageHeightLimit) {
          docPdf.addPage();
          
          // Header of new page
          docPdf.setFillColor(30, 41, 59);
          docPdf.rect(0, 0, 210, 15, 'F');
          
          docPdf.setFillColor(180, 83, 9);
          docPdf.rect(0, 15, 210, 1, 'F');

          docPdf.setFont('Helvetica', 'normal');
          docPdf.setFontSize(8);
          docPdf.setTextColor(200, 200, 200);
          docPdf.text(`${note.title} - Página ${docPdf.getNumberOfPages()}`, 15, 9);

          yOffset = 28;
          docPdf.setFont('Helvetica', 'normal');
          docPdf.setFontSize(11);
          docPdf.setTextColor(51, 65, 85);
        }
        docPdf.text(splitContent[i], 15, yOffset);
        yOffset += 6.5; // line height
      }

      // Save PDF
      const fileName = `${note.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_anotacao.pdf`;
      docPdf.save(fileName);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      setErrorMessage('Erro ao gerar arquivo PDF. Tente novamente.');
    }
  };

  // Filter notes based on category & search terms
  const filteredNotes = notes.filter(note => {
    const matchesSearch = 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      note.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getFriendlyDate = (timestamp: any) => {
    if (!timestamp) return 'Recentemente';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6 md:space-y-0">
      
      {/* Sidebar: Notes List */}
      <div className={`w-full md:w-80 lg:w-96 flex-col bg-white rounded-2xl border border-church-gold/10 shadow-sm overflow-hidden shrink-0 h-full ${mobileView === 'list' ? 'flex' : 'hidden md:flex'}`}>
        {/* Header and Add Action */}
        <div className="p-4 border-b border-church-gold/5 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold text-church-navy">Minhas Anotações</h2>
            <p className="text-[10px] uppercase font-extrabold text-church-gold tracking-wider">Espaço de fé e estudos</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (hasChanges) {
                setPendingSwitchTarget('NEW_NOTE');
              } else {
                handleCreateNote();
              }
            }}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-church-gold hover:bg-church-gold/90 transition-colors text-church-navy text-xs font-black rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>Nova</span>
          </button>
        </div>

        {/* Status Messages */}
        {successMessage && (
          <div className="mx-4 mt-3 rounded-lg bg-green-50 border border-green-200 p-2.5 flex items-center gap-2 text-green-800 text-xs font-medium">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span className="truncate">{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mx-4 mt-3 rounded-lg bg-red-50 border border-red-200 p-2.5 flex items-center gap-2 text-red-800 text-xs font-medium">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}

        {/* Clean Filter Controls */}
        <div className="p-4 space-y-3 border-b border-church-gold/5 shrink-0 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-church-navy/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar anotações..."
              className="w-full rounded-lg border border-church-gold/15 bg-church-cream/10 py-1.5 pl-8 pr-3 text-xs text-church-navy outline-none focus:border-church-gold"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-church-gold shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-church-gold/15 bg-white px-2 py-1.5 text-[11px] font-medium text-church-navy outline-none focus:border-church-gold cursor-pointer"
            >
              <option value="all">Todas as categorias</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Note List Scrollable Area */}
        <div className="flex-1 overflow-y-auto divide-y divide-church-gold/5 bg-white">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center text-church-navy/50 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-church-gold" />
              <span className="text-xs font-medium">Buscando caderno...</span>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="p-8 text-center text-church-navy/40">
              <Folder className="h-8 w-8 mx-auto stroke-[1.5] text-church-navy/20 mb-2" />
              <p className="text-xs font-semibold">Nenhuma anotação encontrada</p>
              <p className="text-[10px] px-4 mt-1">Crie sua primeira nota clicando no botão "Nova" acima!</p>
            </div>
          ) : (
            filteredNotes.map(note => {
              const isActive = selectedNote?.id === note.id;
              return (
                <div
                  key={note.id}
                  onClick={() => {
                    if (hasChanges) {
                      setPendingSwitchTarget(note);
                    } else {
                      setSelectedNote(note);
                      setMobileView('editor');
                    }
                  }}
                  className={`p-4 transition-colors cursor-pointer text-left relative flex flex-col gap-1.5 ${
                    isActive 
                      ? 'bg-church-gold/5 border-l-4 border-church-gold' 
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-church-cream/60 border border-church-gold/10 text-church-gold">
                      {note.category}
                    </span>
                    <span className="text-[9px] text-church-navy/50 font-medium">
                      {getFriendlyDate(note.updatedAt)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    <h3 className="font-serif text-[13px] font-bold text-church-navy truncate leading-tight flex-1">
                      {note.title || 'Sem título'}
                    </h3>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNoteToDeleteId(note.id);
                      }}
                      className="text-red-500 hover:bg-red-50 p-1.5 rounded-md opacity-60 hover:opacity-100 transition-all shrink-0 cursor-pointer"
                      title="Excluir anotação"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="text-[11px] text-church-navy/60 line-clamp-2 leading-relaxed">
                    {note.content ? note.content : <em className="text-church-navy/30">Sem conteúdo...</em>}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Editor & Viewer Area */}
      <div className={`flex-1 flex-col bg-white rounded-2xl border border-church-gold/10 shadow-sm overflow-hidden h-full ${mobileView === 'editor' ? 'flex' : 'hidden md:flex'}`}>
        {selectedNote ? (
          /* Unified Direct Notebook Editor */
          <div className="flex flex-col h-full bg-white">
            <div className="p-4 bg-slate-50 border-b border-church-gold/10 flex flex-wrap justify-between items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (hasChanges) {
                      setPendingSwitchTarget('BACK_TO_LIST');
                    } else {
                      setMobileView('list');
                    }
                  }}
                  className="md:hidden flex items-center gap-1 px-2.5 py-1.5 border border-church-gold/20 text-church-navy hover:bg-church-gold/5 text-xs font-bold rounded-lg transition-colors cursor-pointer bg-white mr-1 shadow-sm"
                  title="Voltar para a lista de anotações"
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-church-gold" />
                  <span>Voltar</span>
                </button>
                <div className={`h-2.5 w-2.5 rounded-full ${hasChanges ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                <span className="text-[10px] text-church-navy/60 font-serif font-black tracking-wider uppercase">
                  {hasChanges ? '⚠️ Alterações Pendentes (Clique em Salvar)' : '✓ Sincronizado com a nuvem'}
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedNote) {
                      setEditTitle(selectedNote.title || '');
                      setEditCategory(selectedNote.category || 'Devocional');
                      setEditContent(selectedNote.content || '');
                      setSuccessMessage('Alterações descartadas.');
                      setTimeout(() => setSuccessMessage(null), 2500);
                    }
                  }}
                  className="px-2.5 py-1.5 hover:bg-slate-100 text-church-navy/70 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-church-gold/10"
                  title="Restaurar valores anteriores salvos"
                >
                  Descartar
                </button>

                <button
                  type="button"
                  onClick={() => downloadAsPDF(selectedNote)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-church-gold/20 text-church-navy hover:bg-church-gold/5 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  title="Baixar em formato PDF"
                >
                  <Download className="h-3.5 w-3.5 text-church-gold" />
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNoteToDeleteId(selectedNote.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:bg-red-50 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-red-200"
                  title="Excluir anotação permanentemente"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Excluir</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-church-navy hover:bg-church-navy/90 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 border border-church-gold/10"
                >
                  <Save className="h-4 w-4 text-church-gold" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-church-navy/50 mb-1.5">
                    Título da nota
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Tema, passagem bíblica ou estudo..."
                    maxLength={80}
                    className="w-full text-base font-serif font-bold text-church-navy border-b border-church-gold/15 pb-2 outline-none focus:border-church-gold focus:ring-0"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-church-navy/50 mb-1.5">
                    Categoria
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full text-xs font-bold rounded-lg border border-church-gold/10 px-2 py-1.5 bg-white outline-none focus:border-church-gold cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-grow flex flex-col min-h-[300px]">
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-church-navy/50 mb-1.5">
                  Conteúdo do estudo ou reflexão de fé
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Inicie a redação aqui, adicione observações bíblicas, o que tocou seu coração e notas pastorais..."
                  className="w-full flex-1 p-4 rounded-xl border border-church-gold/10 focus:border-church-gold outline-none resize-none leading-relaxed text-sm bg-church-cream/5 text-church-navy h-full min-h-[250px]"
                />
              </div>
            </div>
          </div>
        ) : (
          /* Empty Panel (No selected notes at all) */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-church-navy/40">
            <BookOpen className="h-14 w-14 stroke-[1.2] text-church-navy/20 mb-3" />
            <h3 className="font-serif text-lg font-bold text-church-navy">Meu Caderno Devocional</h3>
            <p className="text-xs text-church-navy/60 max-w-sm mt-1 mb-4 leading-relaxed">
              Registre estudos pregações, devocionais matutinas, versos favoritos, reflexões do dia a dia ou rascunhos para lição da Escola Dominical.
            </p>
            <button
              type="button"
              onClick={handleCreateNote}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-church-navy hover:bg-church-navy/90 text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4 text-church-gold" />
              <span>Criar Primeira Anotação</span>
            </button>
          </div>
        )}
      </div>

      {/* Modern custom safe delete confirmation modal */}
      <DeleteConfirmationModal
        isOpen={!!noteToDeleteId}
        onClose={() => setNoteToDeleteId(null)}
        onConfirm={async () => {
          if (noteToDeleteId) {
            await handleDeleteNote(noteToDeleteId);
          }
        }}
        title="Excluir Anotação"
        message="Tem certeza de que deseja excluir esta anotação permanentemente de seu caderno devocional? Esta ação é irreversível."
        confirmText="Excluir"
        cancelText="Cancelar"
      />

      {/* Warn user before changing notes or creating a new one if they have unsaved changes */}
      <AnimatePresence>
        {pendingSwitchTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setPendingSwitchTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="relative max-w-sm w-full bg-white rounded-3xl overflow-hidden border border-church-gold/10 shadow-2xl p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-church-navy">Alterações não salvas!</h3>
                  <p className="text-xs text-church-navy/60 mt-2 leading-relaxed">
                    Você editou a anotação ativa. Deseja salvar as alterações em nuvem antes de prosseguir?
                  </p>
                </div>
                <div className="flex gap-2 w-full mt-3 flex-col sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setPendingSwitchTarget(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-church-navy py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingSwitchTarget === 'NEW_NOTE') {
                        handleCreateNote();
                      } else if (pendingSwitchTarget === 'BACK_TO_LIST') {
                        setMobileView('list');
                      } else {
                        setSelectedNote(pendingSwitchTarget);
                        setMobileView('editor');
                      }
                      setPendingSwitchTarget(null);
                    }}
                    className="flex-1 border border-church-gold/20 hover:bg-church-gold/5 text-church-navy py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleSaveNote();
                      if (pendingSwitchTarget === 'NEW_NOTE') {
                        await handleCreateNote();
                      } else if (pendingSwitchTarget === 'BACK_TO_LIST') {
                        setMobileView('list');
                      } else {
                        setSelectedNote(pendingSwitchTarget);
                        setMobileView('editor');
                      }
                      setPendingSwitchTarget(null);
                    }}
                    className="flex-1 bg-church-navy hover:bg-church-navy/90 text-white py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow cursor-pointer border border-church-gold/10"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

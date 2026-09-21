import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Book, BookOpen, Search, Copy, Share2, 
  Bookmark, ChevronRight, ChevronLeft, Type, Info, Check, 
  Loader2, AlertCircle, Heart, Star, List, CalendarDays 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DailyDevotionalPlan from '../components/DailyDevotionalPlan';

interface BookMeta {
  id: number;
  name: string;
  chapters: number;
  testament: 'AT' | 'NT';
  category: string;
}

const BIBLE_BOOKS: BookMeta[] = [
  // Antigo Testamento
  { id: 1, name: 'Gênesis', chapters: 50, testament: 'AT', category: 'Pentateuco' },
  { id: 2, name: 'Êxodo', chapters: 40, testament: 'AT', category: 'Pentateuco' },
  { id: 3, name: 'Levítico', chapters: 27, testament: 'AT', category: 'Pentateuco' },
  { id: 4, name: 'Números', chapters: 36, testament: 'AT', category: 'Pentateuco' },
  { id: 5, name: 'Deuteronômio', chapters: 34, testament: 'AT', category: 'Pentateuco' },
  { id: 6, name: 'Josué', chapters: 24, testament: 'AT', category: 'Históricos' },
  { id: 7, name: 'Juízes', chapters: 21, testament: 'AT', category: 'Históricos' },
  { id: 8, name: 'Rute', chapters: 4, testament: 'AT', category: 'Históricos' },
  { id: 9, name: '1 Samuel', chapters: 31, testament: 'AT', category: 'Históricos' },
  { id: 10, name: '2 Samuel', chapters: 24, testament: 'AT', category: 'Históricos' },
  { id: 11, name: '1 Reis', chapters: 22, testament: 'AT', category: 'Históricos' },
  { id: 12, name: '2 Reis', chapters: 25, testament: 'AT', category: 'Históricos' },
  { id: 13, name: '1 Crônicas', chapters: 29, testament: 'AT', category: 'Históricos' },
  { id: 14, name: '2 Crônicas', chapters: 36, testament: 'AT', category: 'Históricos' },
  { id: 15, name: 'Esdras', chapters: 10, testament: 'AT', category: 'Históricos' },
  { id: 16, name: 'Neemias', chapters: 13, testament: 'AT', category: 'Históricos' },
  { id: 17, name: 'Ester', chapters: 10, testament: 'AT', category: 'Históricos' },
  { id: 18, name: 'Jó', chapters: 42, testament: 'AT', category: 'Poéticos/Sapienciais' },
  { id: 19, name: 'Salmos', chapters: 150, testament: 'AT', category: 'Poéticos/Sapienciais' },
  { id: 20, name: 'Provérbios', chapters: 31, testament: 'AT', category: 'Poéticos/Sapienciais' },
  { id: 21, name: 'Eclesiastes', chapters: 12, testament: 'AT', category: 'Poéticos/Sapienciais' },
  { id: 22, name: 'Cânticos', chapters: 8, testament: 'AT', category: 'Poéticos/Sapienciais' },
  { id: 23, name: 'Isaías', chapters: 66, testament: 'AT', category: 'Profetas Maiores' },
  { id: 24, name: 'Jeremias', chapters: 52, testament: 'AT', category: 'Profetas Maiores' },
  { id: 25, name: 'Lamentações', chapters: 5, testament: 'AT', category: 'Profetas Maiores' },
  { id: 26, name: 'Ezequiel', chapters: 48, testament: 'AT', category: 'Profetas Maiores' },
  { id: 27, name: 'Daniel', chapters: 12, testament: 'AT', category: 'Profetas Maiores' },
  { id: 28, name: 'Oseias', chapters: 14, testament: 'AT', category: 'Profetas Menores' },
  { id: 29, name: 'Joel', chapters: 3, testament: 'AT', category: 'Profetas Menores' },
  { id: 30, name: 'Amós', chapters: 9, testament: 'AT', category: 'Profetas Menores' },
  { id: 31, name: 'Obadias', chapters: 1, testament: 'AT', category: 'Profetas Menores' },
  { id: 32, name: 'Jonas', chapters: 4, testament: 'AT', category: 'Profetas Menores' },
  { id: 33, name: 'Miqueias', chapters: 7, testament: 'AT', category: 'Profetas Menores' },
  { id: 34, name: 'Naum', chapters: 3, testament: 'AT', category: 'Profetas Menores' },
  { id: 35, name: 'Habacuque', chapters: 3, testament: 'AT', category: 'Profetas Menores' },
  { id: 36, name: 'Sofonias', chapters: 3, testament: 'AT', category: 'Profetas Menores' },
  { id: 37, name: 'Ageu', chapters: 2, testament: 'AT', category: 'Profetas Menores' },
  { id: 38, name: 'Zacarias', chapters: 14, testament: 'AT', category: 'Profetas Menores' },
  { id: 39, name: 'Malaquias', chapters: 4, testament: 'AT', category: 'Profetas Menores' },

  // Novo Testamento
  { id: 40, name: 'Mateus', chapters: 28, testament: 'NT', category: 'Evangelhos' },
  { id: 41, name: 'Marcos', chapters: 16, testament: 'NT', category: 'Evangelhos' },
  { id: 42, name: 'Lucas', chapters: 24, testament: 'NT', category: 'Evangelhos' },
  { id: 43, name: 'João', chapters: 21, testament: 'NT', category: 'Evangelhos' },
  { id: 44, name: 'Atos', chapters: 28, testament: 'NT', category: 'Histórico' },
  { id: 45, name: 'Romanos', chapters: 16, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 46, name: '1 Coríntios', chapters: 16, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 47, name: '2 Coríntios', chapters: 13, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 48, name: 'Gálatas', chapters: 6, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 49, name: 'Efésios', chapters: 6, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 50, name: 'Filipenses', chapters: 4, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 51, name: 'Colossenses', chapters: 4, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 52, name: '1 Tessalonicenses', chapters: 5, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 53, name: '2 Tessalonicenses', chapters: 3, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 54, name: '1 Timóteo', chapters: 6, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 55, name: '2 Timóteo', chapters: 4, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 56, name: 'Tito', chapters: 3, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 57, name: 'Filemom', chapters: 1, testament: 'NT', category: 'Cartas Paulinas' },
  { id: 58, name: 'Hebreus', chapters: 13, testament: 'NT', category: 'Cartas Gerais' },
  { id: 59, name: 'Tiago', chapters: 5, testament: 'NT', category: 'Cartas Gerais' },
  { id: 60, name: '1 Pedro', chapters: 5, testament: 'NT', category: 'Cartas Gerais' },
  { id: 61, name: '2 Pedro', chapters: 3, testament: 'NT', category: 'Cartas Gerais' },
  { id: 62, name: '1 João', chapters: 5, testament: 'NT', category: 'Cartas Gerais' },
  { id: 63, name: '2 João', chapters: 1, testament: 'NT', category: 'Cartas Gerais' },
  { id: 64, name: '3 João', chapters: 1, testament: 'NT', category: 'Cartas Gerais' },
  { id: 65, name: 'Judas', chapters: 1, testament: 'NT', category: 'Cartas Gerais' },
  { id: 66, name: 'Apocalipse', chapters: 22, testament: 'NT', category: 'Profecia' }
];

interface Verse {
  pk: number;
  translation: string;
  book: number;
  chapter: number;
  verse: number;
  text: string;
}

export default function Bible() {
  const location = useLocation();
  const [selectedBook, setSelectedBook] = useState<BookMeta>(BIBLE_BOOKS.find(b => b.name === 'João') || BIBLE_BOOKS[42]); // Default "João"
  const [selectedChapter, setSelectedChapter] = useState<number>(3); // Default chapter 3
  const [translation, setTranslation] = useState<string>('ARA'); // ARA default (João Ferreira de Almeida Revista e Atualizada)
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Customizations
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('lg');
  const [serifFont, setSerifFont] = useState<boolean>(true);
  
  // book list filtering
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [testamentFilter, setTestamentFilter] = useState<'ALL' | 'AT' | 'NT'>('ALL');
  const [viewState, setViewState] = useState<'reading' | 'selector' | 'plan'>('reading');

  // Highlights and bookmarks local persistence
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    const saved = localStorage.getItem('bible_bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [favorites, setFavorites] = useState<{ bookId: number; chapter: number; verse: number; text: string }[]>(() => {
    const saved = localStorage.getItem('bible_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-scroll to top when chapter changes
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('bible_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('bible_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Listen for navigation state changes or search params to deep-link or open plan
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'plan' || params.get('tab') === 'devocional') {
      setViewState('plan');
    } else if (location.state && location.state.viewState) {
      setViewState(location.state.viewState);
    } else if (location.state && location.state.bookId && location.state.chapter) {
      const targetBook = BIBLE_BOOKS.find(b => b.id === location.state.bookId);
      if (targetBook) {
        setSelectedBook(targetBook);
        setSelectedChapter(location.state.chapter);
        setViewState('reading');
      }
    }
  }, [location.state, location.search]);

  const fetchVerses = async (bookId: number, chapter: number, translationCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://bolls.life/get-chapter/${translationCode}/${bookId}/${chapter}/`);
      if (!response.ok) {
        throw new Error('Falha ao buscar os versículos da Bíblia. Tente novamente mais tarde.');
      }
      const data = await response.json();
      setVerses(data);
      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err: any) {
      console.error('Error fetching Bible:', err);
      setError(err.message || 'Ocorreu um erro ao carregar o texto bíblico.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewState === 'reading') {
      fetchVerses(selectedBook.id, selectedChapter, translation);
    }
  }, [selectedBook.id, selectedChapter, translation, viewState]);

  const handleBookSelect = (book: BookMeta) => {
    setSelectedBook(book);
    setSelectedChapter(1);
    setViewState('reading');
  };

  const handleNextChapter = () => {
    if (selectedChapter < selectedBook.chapters) {
      setSelectedChapter(prev => prev + 1);
    } else {
      // Go to next book
      const nextBookIndex = BIBLE_BOOKS.findIndex(b => b.id === selectedBook.id) + 1;
      if (nextBookIndex < BIBLE_BOOKS.length) {
        setSelectedBook(BIBLE_BOOKS[nextBookIndex]);
        setSelectedChapter(1);
      }
    }
  };

  const handlePrevChapter = () => {
    if (selectedChapter > 1) {
      setSelectedChapter(prev => prev - 1);
    } else {
      // Go to previous book
      const prevBookIndex = BIBLE_BOOKS.findIndex(b => b.id === selectedBook.id) - 1;
      if (prevBookIndex >= 0) {
        const prevBook = BIBLE_BOOKS[prevBookIndex];
        setSelectedBook(prevBook);
        setSelectedChapter(prevBook.chapters);
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleBookmark = () => {
    const key = `${selectedBook.id}:${selectedChapter}`;
    if (bookmarks.includes(key)) {
      setBookmarks(prev => prev.filter(b => b !== key));
      showToast('Marcador removido');
    } else {
      setBookmarks(prev => [...prev, key]);
      showToast('Capítulo marcado como leitura atual!');
    }
  };

  const toggleFavorite = (v: Verse) => {
    const isFav = favorites.some(f => f.bookId === v.book && f.chapter === v.chapter && f.verse === v.verse);
    if (isFav) {
      setFavorites(prev => prev.filter(f => !(f.bookId === v.book && f.chapter === v.chapter && f.verse === v.verse)));
      showToast('Versículo removido dos favoritos');
    } else {
      setFavorites(prev => [...prev, { bookId: v.book, chapter: v.chapter, verse: v.verse, text: v.text }]);
      showToast('Versículo favoritado!');
    }
  };

  const copyToClipboard = (v: Verse) => {
    const textToCopy = `"${v.text}" — ${selectedBook.name} ${v.chapter}:${v.verse} (${translation})`;
    navigator.clipboard.writeText(textToCopy)
      .then(() => showToast('Versículo copiado!'))
      .catch(() => showToast('Erro ao copiar versículo'));
  };

  const shareVerse = async (v: Verse) => {
    const textToShare = `"${v.text}" — ${selectedBook.name} ${v.chapter}:${v.verse} (${translation})`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Palavra de Deus',
          text: textToShare,
          url: window.location.href,
        });
      } catch (err) {
        console.log(err);
      }
    } else {
      copyToClipboard(v);
    }
  };

  // Filter books list
  const filteredBooks = BIBLE_BOOKS.filter(book => {
    const matchesSearch = book.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTestament = testamentFilter === 'ALL' || book.testament === testamentFilter;
    return matchesSearch && matchesTestament;
  });

  const fontSizeClasses = {
    sm: 'text-sm sm:text-base',
    md: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl leading-relaxed',
    xl: 'text-xl sm:text-2xl leading-loose font-medium'
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" ref={topRef}>
      {/* Toast feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-church-navy text-white px-5 py-4 text-sm font-black shadow-2xl border border-church-gold/20"
          >
            <Check className="h-4 w-4 text-church-gold shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header / Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-white rounded-3xl border border-church-gold/10 shadow-sm">
        <div className="flex items-center gap-3 text-left">
          <div className="p-3 bg-church-navy/5 text-church-navy rounded-2xl border border-church-gold/15">
            <BookOpen className="h-6 w-6 text-church-navy" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-black text-church-navy flex items-center gap-2">
              Bíblia Sagrada
            </h1>
            <p className="text-xs text-church-navy/50 font-medium">As Sagradas Escrituras em suas mãos</p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Plan Toggle */}
          <button
            onClick={() => setViewState(viewState === 'plan' ? 'reading' : 'plan')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              viewState === 'plan'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300'
            }`}
          >
            <CalendarDays className="h-4 w-4 text-amber-600 font-bold" />
            {viewState === 'plan' ? 'Voltar à Bíblia' : 'Plano de 1 Ano & Devocional'}
          </button>

          {/* View Toggle */}
          <button
            onClick={() => setViewState(viewState === 'reading' ? 'selector' : 'reading')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              viewState === 'selector'
                ? 'bg-church-navy text-church-gold border-church-navy'
                : 'bg-white text-church-navy hover:bg-church-navy/5 border-church-gold/20'
            }`}
          >
            <List className="h-4 w-4" />
            {viewState === 'reading' ? 'Selecionar Livro' : 'Voltar ao Texto'}
          </button>

          {/* Translation Selector */}
          <select
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            className="p-2.5 px-4 rounded-xl border border-church-gold/20 bg-white text-xs font-bold uppercase text-church-navy focus:outline-none focus:ring-1 focus:ring-church-navy"
          >
            <option value="ARA">Almeida Revista e Atualizada (ARA)</option>
            <option value="NAA">Nova Almeida Atualizada (NAA)</option>
            <option value="NVIPT">Nova Versão Internacional (NVI)</option>
            <option value="NVT">Nova Versão Transformadora (NVT)</option>
            <option value="KJA">King James Atualizada (KJA)</option>
          </select>
        </div>
      </div>

      {/* VIEW: 1-YEAR READING PLAN & DEVOTIONAL */}
      {viewState === 'plan' && (
        <DailyDevotionalPlan />
      )}

      {/* VIEW 1: BOOK & CHAPTER SELECTOR */}
      {viewState === 'selector' && (
        <div className="bg-white rounded-3xl border border-church-gold/10 p-6 md:p-8 space-y-6">
          {/* Header instructions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-church-gold/5 pb-4">
            <h3 className="font-serif text-lg font-bold text-church-navy text-left">Escolha um Livro e Capítulo</h3>
            
            {/* Search and Testament filters */}
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
              {/* Search bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-church-navy/30" />
                <input
                  type="text"
                  placeholder="Pesquisar livro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-church-cream/40 border border-church-gold/15 rounded-xl text-sm focus:outline-none focus:border-church-gold"
                />
              </div>

              {/* Testament toggle */}
              <div className="flex gap-1 bg-church-cream/50 p-1 rounded-xl border border-church-gold/10 w-full sm:w-auto">
                {(['ALL', 'AT', 'NT'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTestamentFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                      testamentFilter === filter
                        ? 'bg-church-navy text-church-gold'
                        : 'text-church-navy/60 hover:text-church-navy'
                    }`}
                  >
                    {filter === 'ALL' ? 'Todos' : filter === 'AT' ? 'Antigo' : 'Novo'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Book grid grouped by Testament */}
          <div className="grid gap-6">
            {/* Antigo Testamento Section */}
            {(testamentFilter === 'ALL' || testamentFilter === 'AT') && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-church-gold text-left border-l-2 border-church-gold pl-2">
                  Antigo Testamento ({BIBLE_BOOKS.filter(b => b.testament === 'AT').length} livros)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {filteredBooks
                    .filter(b => b.testament === 'AT')
                    .map((book) => {
                      const isBookActive = selectedBook.id === book.id;
                      return (
                        <button
                          key={book.id}
                          onClick={() => handleBookSelect(book)}
                          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                            isBookActive
                              ? 'bg-church-navy text-church-gold border-church-navy font-bold shadow-sm'
                              : 'bg-church-cream/20 hover:bg-church-cream/50 text-church-navy border-church-gold/10 text-sm'
                          }`}
                        >
                          {book.name}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Novo Testamento Section */}
            {(testamentFilter === 'ALL' || testamentFilter === 'NT') && (
              <div className="space-y-3 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-church-gold text-left border-l-2 border-church-gold pl-2">
                  Novo Testamento ({BIBLE_BOOKS.filter(b => b.testament === 'NT').length} livros)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {filteredBooks
                    .filter(b => b.testament === 'NT')
                    .map((book) => {
                      const isBookActive = selectedBook.id === book.id;
                      return (
                        <button
                          key={book.id}
                          onClick={() => handleBookSelect(book)}
                          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                            isBookActive
                              ? 'bg-church-navy text-church-gold border-church-navy font-bold shadow-sm'
                              : 'bg-church-cream/20 hover:bg-church-cream/50 text-church-navy border-church-gold/10 text-sm'
                          }`}
                        >
                          {book.name}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: ACTIVE READING VIEW */}
      {viewState === 'reading' && (
        <div className="space-y-6">
          {/* Chapter Selector & Utility Toolbar */}
          <div className="bg-white rounded-3xl border border-church-gold/10 p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            {/* Quick Chapter Selector Carousel */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-2 md:pb-0 scrollbar-none w-full md:w-auto justify-center md:justify-start">
              <button
                onClick={handlePrevChapter}
                className="p-2 bg-church-cream hover:bg-church-gold/10 rounded-xl border border-church-gold/15 text-church-navy cursor-pointer disabled:opacity-45"
                title="Capítulo Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-1.5 px-3">
                <span className="font-serif font-bold text-lg text-church-navy">
                  {selectedBook.name}
                </span>

                <select
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(Number(e.target.value))}
                  className="py-1 px-2.5 rounded-lg border border-church-gold/20 bg-church-cream/40 font-bold text-church-navy focus:outline-none focus:ring-1 focus:ring-church-gold text-sm cursor-pointer"
                >
                  {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map((ch) => (
                    <option key={ch} value={ch}>
                      Capítulo {ch}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleNextChapter}
                className="p-2 bg-church-cream hover:bg-church-gold/10 rounded-xl border border-church-gold/15 text-church-navy cursor-pointer"
                title="Próximo Capítulo"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Customizer options (Text size & format) */}
            <div className="flex items-center gap-2 mt-2 md:mt-0">
              {/* Bookmark Toggle */}
              <button
                onClick={toggleBookmark}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  bookmarks.includes(`${selectedBook.id}:${selectedChapter}`)
                    ? 'bg-church-navy text-church-gold border-church-navy'
                    : 'bg-white hover:bg-church-navy/5 text-church-navy/60 border-church-gold/20'
                }`}
                title="Marcar como leitura atual"
              >
                <Bookmark className="h-4.5 w-4.5 font-bold" />
              </button>

              {/* Serif Font Switcher */}
              <button
                onClick={() => setSerifFont(!serifFont)}
                className={`p-2.5 rounded-xl border transition-all text-xs font-bold flex items-center gap-1 balance cursor-pointer ${
                  serifFont
                    ? 'bg-church-navy/5 border-church-navy text-church-navy'
                    : 'bg-white border-church-gold/20 text-church-navy/60'
                }`}
                title="Mudar fonte (Serifada / Sem serifa)"
              >
                <Type className="h-4 w-4" />
                <span className="hidden sm:inline">{serifFont ? 'Fonte Sapiencial' : 'Fonte Moderna'}</span>
              </button>

              {/* Font Sizer buttons */}
              <div className="flex items-center gap-1 bg-church-cream/50 rounded-xl border border-church-gold/10 p-1">
                {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setFontSize(sz)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center cursor-pointer ${
                      fontSize === sz
                        ? 'bg-church-navy text-church-gold'
                        : 'text-church-navy/60 hover:text-church-navy'
                    }`}
                    title={`Letra ${sz.toUpperCase()}`}
                  >
                    {sz === 'sm' ? 'A-' : sz === 'xl' ? 'A+' : sz.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reading Canvas Card */}
          <div className="bg-white rounded-3xl border border-church-gold/10 p-6 md:p-10 shadow-sm relative overflow-hidden">
            {/* Elegant Background Logo Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.015] pointer-events-none">
              <BookOpen className="w-96 h-96 text-church-navy" />
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-church-gold" />
                <p className="text-sm font-semibold text-church-navy/50 uppercase tracking-widest">Buscando as Escrituras Sagradas...</p>
              </div>
            ) : error ? (
              <div className="py-20 text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                <h3 className="font-serif text-xl font-bold text-church-navy">Ocorreu um erro</h3>
                <p className="text-church-navy/60 max-w-md mx-auto">{error}</p>
                <button
                  onClick={() => fetchVerses(selectedBook.id, selectedChapter, translation)}
                  className="px-6 py-2.5 rounded-xl bg-church-navy text-white text-sm font-bold cursor-pointer hover:bg-church-navy/90"
                >
                  Tentar novamente
                </button>
              </div>
            ) : (
              <div className="relative text-left space-y-8 z-10">
                {/* Title and context */}
                <center className="space-y-4 border-b border-church-gold/10 pb-8">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-church-gold">
                    {selectedBook.testament === 'AT' ? 'Antigo Testamento' : 'Novo Testamento'} • {selectedBook.category}
                  </p>
                  <h2 className="font-serif text-4xl font-extrabold text-church-navy">
                    {selectedBook.name} {selectedChapter}
                  </h2>
                  <div className="w-16 h-0.5 bg-church-gold rounded-full" />
                </center>

                {/* Verses Grid */}
                <div 
                  className={`space-y-6 ${serifFont ? 'font-serif' : 'font-sans'} text-church-navy/90`}
                >
                  {verses.map((v) => {
                    const isFav = favorites.some(f => f.bookId === v.book && f.chapter === v.chapter && f.verse === v.verse);
                    return (
                      <div 
                        key={v.pk} 
                        className="group relative md:-mx-4 p-3 md:px-4 rounded-2xl hover:bg-church-cream/40 transition-colors duration-200 flex flex-col sm:flex-row sm:items-start gap-3"
                      >
                        {/* Verse number */}
                        <span className="font-serif font-black text-church-gold text-lg shrink-0 mt-0.5 sm:w-8 text-left sm:text-right">
                          {v.verse}
                        </span>

                        {/* Verse text content */}
                        <p className={`flex-1 ${fontSizeClasses[fontSize]} text-left leading-relaxed`}>
                          {v.text}
                        </p>

                        {/* Quick action overlay (visible on hover) */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 mt-2 sm:mt-0 shrink-0 transition-opacity self-end sm:self-start bg-white/90 sm:bg-transparent p-1 rounded-xl shadow-sm sm:shadow-none border sm:border-0 border-church-gold/5">
                          <button
                            onClick={() => toggleFavorite(v)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isFav 
                                ? 'text-red-500 border-red-200 bg-red-50' 
                                : 'text-church-navy/40 hover:text-church-navy hover:bg-church-navy/5 border-transparent'
                            }`}
                            title={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                          >
                            <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                          </button>
                          
                          <button
                            onClick={() => copyToClipboard(v)}
                            className="p-1.5 rounded-lg text-church-navy/40 hover:text-church-navy hover:bg-church-navy/5 border border-transparent cursor-pointer"
                            title="Copiar versículo para o mural"
                          >
                            <Copy className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => shareVerse(v)}
                            className="p-1.5 rounded-lg text-church-navy/40 hover:text-church-navy hover:bg-church-navy/5 border border-transparent cursor-pointer"
                            title="Compartilhar versículo"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Navigation Buttons inside Reading card */}
                <div className="flex items-center justify-between border-t border-church-gold/10 pt-8 mt-12">
                  <button
                    onClick={handlePrevChapter}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border border-church-gold/15 bg-church-cream/30 text-church-navy text-sm font-bold hover:bg-church-gold/5 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Capítulo Anterior</span>
                  </button>

                  <button
                    onClick={handleNextChapter}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-church-navy text-white text-sm font-bold shadow-md hover:bg-church-navy/95 transition-all cursor-pointer"
                  >
                    <span>Próximo Capítulo</span>
                    <ChevronRight className="h-4 w-4 text-church-gold" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER ADVICE */}
      <div className="p-4 rounded-2xl bg-church-navy/5 border border-church-gold/10 flex items-start gap-3 text-left">
        <Info className="h-5 w-5 text-church-gold shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-church-navy">Lâmpada para os meus pés é tua palavra, e luz para o meu caminho. (Salmo 119:105)</p>
          <p className="text-[10px] text-church-navy/50 leading-relaxed">
            Dica: No modo leitura, passe o cursor ou clique em um versículo para revelas opções rápidas de copiar para a área de transferência, favoritar (salva no navegador) ou compartilhar nas redes sociais.
          </p>
        </div>
      </div>
    </div>
  );
}

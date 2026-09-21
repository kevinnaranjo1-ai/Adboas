import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Plus, Download, FileText, ArrowRight, Trash2, 
  Search, Filter, BookOpenCheck, Calendar, User, Upload, 
  Link, FileUp, Sparkles, RefreshCw, AlertCircle, CheckCircle2,
  X, Compass, Book
} from 'lucide-react';
import { 
  collection, addDoc, getDocs, deleteDoc, doc, 
  query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { createStudyNotification } from '../lib/notifications';
import { jsPDF } from 'jspdf';

interface Study {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  pdfUrl?: string;
  fileBase64?: string;
  fileName?: string;
  authorId: string;
  authorName: string;
  createdAt: any;
}

const CATEGORIES = [
  'EBD - Escola Bíblica',
  'Teologia & Doutrina',
  'Devocional Diário',
  'Família & Lar',
  'Jovens & Adolescentes',
  'Liderança & Obreiros',
  'Sermões / Esboços'
];

export default function Studies({ role }: { role: string | null }) {
  const [user] = useAuthState(auth);
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedStudy, setSelectedStudy] = useState<Study | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Devocional Diário');
  const [formPdfUrl, setFormPdfUrl] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedBase64, setUploadedBase64] = useState<string>('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isPastorAdmin = role && ['admin', 'pastor', 'pastora'].includes(role);

  // Fetch Studies
  const fetchStudies = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const q = query(collection(db, 'studies'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data: Study[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data();
        data.push({
          id: docSnap.id,
          title: item.title || '',
          description: item.description || '',
          content: item.content || '',
          category: item.category || 'Devocional Diário',
          pdfUrl: item.pdfUrl || '',
          fileBase64: item.fileBase64 || '',
          fileName: item.fileName || '',
          authorId: item.authorId || '',
          authorName: item.authorName || 'Pastor',
          createdAt: item.createdAt ? item.createdAt.toDate() : new Date()
        });
      });
      setStudies(data);
    } catch (err) {
      console.error(err);
      setErrorMessage('Não foi possível carregar os estudos e ensinamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudies();
  }, [user]);

  // Handle PDF file upload and base64 conversion
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor, carregue somente arquivos no formato PDF.');
      return;
    }

    if (file.size > 1024 * 1024) { // 1MB Limit for Firestore Document size
      alert('O arquivo selecionado excede o limite de 1MB para armazenamento direto. Reduza o PDF ou utilize o link externo.');
      return;
    }

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit new Study
  const handleCreateStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formTitle.trim()) {
      setErrorMessage('O título do estudo é obrigatório.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        content: formContent.trim(),
        category: formCategory,
        pdfUrl: formPdfUrl.trim(),
        fileBase64: uploadedBase64,
        fileName: uploadedFileName,
        authorId: user.uid,
        authorName: user.displayName || 'Pastor / Administrador',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'studies'), payload);

      // Envia notificação para pastores, admins e membros
      try {
        await createStudyNotification(payload.authorName, payload.title, payload.category);
      } catch (notifyErr) {
        console.warn('Erro ao enviar notificação de estudo:', notifyErr);
      }

      setStudies(prev => [{
        id: docRef.id,
        ...payload,
        createdAt: new Date()
      }, ...prev]);

      // Reset Form fields
      setFormTitle('');
      setFormDescription('');
      setFormContent('');
      setFormCategory('Devocional Diário');
      setFormPdfUrl('');
      setUploadedFileName('');
      setUploadedBase64('');
      setShowAddModal(false);

      setSuccessMessage('Estudo / Ensino publicado com sucesso para os membros!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'studies');
      setErrorMessage('Ocorreu um erro ao publicar o estudo. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Study
  const handleDeleteStudy = async (studyId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'studies', studyId));
      setStudies(prev => prev.filter(st => st.id !== studyId));
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `studies/${studyId}`);
    }
  };

  // Handle PDF Download
  const handleDownloadPDF = (study: Study, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 1. If study has a fileBase64, download that directly
    if (study.fileBase64) {
      const link = document.createElement('a');
      link.href = study.fileBase64;
      link.download = study.fileName || `${study.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // 2. If study has an external PDF link, open it
    if (study.pdfUrl) {
      window.open(study.pdfUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // 3. Dynamic PDF Generation using jsPDF (Fallback)
    try {
      const docPdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Colors & Branding
      const primaryNavyColor = '#1e293b';
      const secondaryGoldColor = '#b45309';

      // Header Banner
      docPdf.setFillColor(30, 41, 59); // deep navy
      docPdf.rect(0, 0, 210, 35, 'F');
      
      docPdf.setTextColor(255, 255, 255);
      docPdf.setFont('serif', 'bold');
      docPdf.setFontSize(15);
      docPdf.text('AD Assembleia de Deus - Tenda da Promessa', 15, 15);
      
      docPdf.setFont('sans-serif', 'normal');
      docPdf.setFontSize(9);
      docPdf.setTextColor(200, 200, 200);
      docPdf.text('Estudos Bíblicos & Ensinos de Fé para Edificação Cristã', 15, 22);

      // Gold line separator
      docPdf.setDrawColor(180, 83, 9);
      docPdf.setLineWidth(1.5);
      docPdf.line(0, 35, 210, 35);

      // Metadata Section
      docPdf.setTextColor(30, 41, 59);
      docPdf.setFont('serif', 'bold');
      docPdf.setFontSize(22);
      
      const splitTitle = docPdf.splitTextToSize(study.title, 180);
      docPdf.text(splitTitle, 15, 52);

      // Line offset based on title height
      const titleLines = splitTitle.length;
      let yOffset = 52 + (titleLines * 8);

      docPdf.setDrawColor(240, 240, 240);
      docPdf.setLineWidth(0.5);
      docPdf.line(15, yOffset, 195, yOffset);

      yOffset += 8;

      docPdf.setFont('sans-serif', 'normal');
      docPdf.setFontSize(9);
      docPdf.setTextColor(110, 110, 110);
      docPdf.text(`Categoria: ${study.category}`, 15, yOffset);
      docPdf.text(`Ministrado por: ${study.authorName}`, 120, yOffset);
      
      const formattedDate = study.createdAt instanceof Date 
        ? study.createdAt.toLocaleDateString('pt-BR') 
        : new Date().toLocaleDateString('pt-BR');
      docPdf.text(`Data: ${formattedDate}`, 172, yOffset);

      yOffset += 12;

      // Description Box
      if (study.description) {
        docPdf.setFillColor(248, 250, 252);
        const descText = docPdf.splitTextToSize(`Resumo: ${study.description}`, 174);
        const descHeight = (descText.length * 5) + 6;
        docPdf.rect(15, yOffset - 4, 180, descHeight, 'F');
        
        docPdf.setTextColor(100, 116, 139);
        docPdf.setFont('sans-serif', 'italic');
        docPdf.setFontSize(9.5);
        docPdf.text(descText, 18, yOffset + 1);
        yOffset += descHeight + 10;
      }

      // Main Content Text
      docPdf.setTextColor(30, 41, 59);
      docPdf.setFont('serif', 'normal');
      docPdf.setFontSize(11);

      const contentToSplit = study.content || 'Nenhum texto adicional escrito. Baixe o documento anexo correspondente para leitura.';
      const splitContent = docPdf.splitTextToSize(contentToSplit, 180);

      // Handle pages intelligently
      splitContent.forEach((line: string, index: number) => {
        if (yOffset > 275) {
          docPdf.addPage();
          // Branded Footer on new page
          docPdf.setFillColor(30, 41, 59);
          docPdf.rect(0, 0, 210, 10, 'F');
          docPdf.setTextColor(255, 255, 255);
          docPdf.setFont('serif', 'normal');
          docPdf.setFontSize(7.5);
          docPdf.text(`Assembleia de Deus Tenda da Promessa | Estudo: ${study.title}`, 15, 6);
          docPdf.setDrawColor(180, 83, 9);
          docPdf.line(0, 10, 210, 10);
          
          yOffset = 25;
        }
        docPdf.setTextColor(30, 41, 59);
        docPdf.setFont('serif', 'normal');
        docPdf.setFontSize(11);
        docPdf.text(line, 15, yOffset);
        yOffset += 6.5;
      });

      // Branded Bottom Footer message
      yOffset += 15;
      if (yOffset <= 275) {
        docPdf.setDrawColor(180, 83, 9);
        docPdf.setLineWidth(0.3);
        docPdf.line(15, yOffset, 195, yOffset);
        yOffset += 6;
        docPdf.setFont('sans-serif', 'italic');
        docPdf.setFontSize(8.5);
        docPdf.setTextColor(120, 120, 120);
        docPdf.text('Assembleia de Deus - Tenda da Promessa. Travessa Verona, 155 - Nações, Fazenda Rio Grande - PR.', 15, yOffset);
      }

      // Download
      docPdf.save(`${study.title.replace(/\s+/g, '_')}_Estudo.pdf`);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar instantaneamente o PDF. Desculpe-nos.');
    }
  };

  // Filters computed
  const filteredStudies = studies.filter(st => {
    const matchesSearch = st.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          st.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          st.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || st.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6" id="pag-estudos-ensinamentos">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl lg:text-3xl font-extrabold text-church-navy">
            Estudos & Ensinos
          </h1>
          <p className="text-sm text-church-navy/60">
            Apostilas, sermões e esboços bíblicos escritos e recomendados por nossa liderança pastoral.
          </p>
        </div>

        {isPastorAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-church-gold hover:bg-church-gold/90 text-church-navy py-3 px-5 text-sm font-black shadow-md transition-all active:scale-95 cursor-pointer"
            id="btn-adicionar-estudo"
          >
            <Plus className="h-4 w-4" />
            <span>Publicar Estudo Bíblico</span>
          </button>
        )}
      </div>

      {successMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-green-50 border border-green-200 p-4 flex items-center gap-3 text-green-800 text-sm font-medium"
        >
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <span>{successMessage}</span>
        </motion.div>
      )}

      {errorMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-center gap-3 text-red-800 text-sm font-medium"
        >
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </motion.div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-church-gold/10 bg-white p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-church-navy/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por título, assunto ou conteúdo de ensino..."
            className="w-full rounded-xl border border-church-gold/15 bg-church-cream/5 py-2 pl-9 pr-4 text-sm text-church-navy outline-none focus:border-church-gold"
          />
        </div>

        <div className="flex w-full md:w-auto items-center gap-3 justify-end">
          <div className="flex items-center gap-1.5 text-xs text-church-navy/60 font-bold">
            <Filter className="h-3.5 w-3.5 text-church-gold" />
            <span>Filtrar Categoria:</span>
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-xl border border-church-gold/15 bg-white px-3 py-2 text-xs font-medium text-church-navy outline-none focus:border-church-gold cursor-pointer"
          >
            <option value="all">Todas as Categorias</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <button
            onClick={fetchStudies}
            className="flex p-2 hover:bg-church-navy/5 rounded-xl text-church-navy/60 transition-colors cursor-pointer"
            title="Recarregar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Studies List Card Grid */}
      {loading ? (
        <div className="p-16 text-center">
          <RefreshCw className="h-10 w-10 animate-spin text-church-gold mx-auto mb-3" />
          <p className="text-xs text-church-navy/50 font-bold uppercase tracking-wider">Buscando ensinos pastorais...</p>
        </div>
      ) : filteredStudies.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-church-gold/10">
          <Book className="h-12 w-12 text-church-gold/60 mx-auto mb-4" />
          <h3 className="font-serif text-lg font-bold text-church-navy mb-1">Nenhum ensino ou apostila disponível</h3>
          <p className="text-xs text-church-navy/60 max-w-sm mx-auto">
            Não encontramos estudos bíblicos correspondentes à pesquisa. Fique ligado, novos devocionais e ensinos EBD serão publicados pelo Pastor em breve!
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudies.map((st) => (
            <motion.div
              key={st.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedStudy(st)}
              className="group relative rounded-2xl border border-church-gold/10 bg-white p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5 cursor-pointer hover:border-church-gold/30"
            >
              {/* Category tag & deletion */}
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-church-cream text-[9px] font-black tracking-widest text-church-navy px-3 py-1 uppercase">
                  {st.category}
                </span>

                {isPastorAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(st.id);
                    }}
                    className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                    title="Excluir estudo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Title & brief */}
              <div className="space-y-1.5">
                <h3 className="font-serif text-base font-bold text-church-navy leading-snug group-hover:text-church-gold transition-colors">
                  {st.title}
                </h3>
                <p className="text-xs text-church-navy/60 line-clamp-3 leading-relaxed">
                  {st.description || 'Clique no botão abaixo para ler o ensinamento bíblico e meditar na Palavra Divina.'}
                </p>
              </div>

              {/* Author & Downloads */}
              <div className="pt-4 border-t border-church-gold/5 flex items-center justify-between mt-auto">
                <div className="text-[10px] text-church-navy/60 space-y-0.5">
                  <div className="flex items-center gap-1 font-bold">
                    <User className="h-3 w-3 text-church-gold" />
                    <span>{st.authorName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {st.createdAt instanceof Date 
                        ? st.createdAt.toLocaleDateString('pt-BR') 
                        : 'Recente'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Read button */}
                  <span className="inline-flex items-center gap-1 rounded-xl bg-church-navy/5 px-3 py-2 text-[10px] font-black tracking-wider uppercase text-church-navy hover:bg-church-navy hover:text-white transition-all">
                    <span>Ler</span>
                    <ArrowRight className="h-3 w-3" />
                  </span>

                  {/* PDF download */}
                  <button
                    onClick={(e) => handleDownloadPDF(st, e)}
                    className="p-2 rounded-xl bg-church-gold/20 text-church-navy hover:bg-church-gold text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
                    title="Baixar PDF do Estudo"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* STUDY READER SLIDE IN / DIALOG */}
      <AnimatePresence>
        {selectedStudy && (
          <div className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStudy(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="relative w-full max-w-2xl bg-white h-full sm:h-[95vh] sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden sm:border border-church-gold/15"
            >
              {/* Header */}
              <div className="bg-church-navy text-white px-6 py-5 shrink-0 flex items-center justify-between border-b border-church-gold/15">
                <div className="space-y-1">
                  <span className="rounded-full bg-church-gold/20 text-[9px] font-black tracking-widest text-church-gold px-2.5 py-0.5 uppercase">
                    {selectedStudy.category}
                  </span>
                  <h3 className="font-serif text-lg font-bold text-white line-clamp-1">
                    {selectedStudy.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedStudy(null)}
                  className="rounded-xl p-2 hover:bg-white/10 text-white cursor-pointer transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Author context bar */}
                <div className="rounded-2xl bg-church-cream/15 p-4 border border-church-gold/5 flex flex-wrap gap-y-2 items-center justify-between text-xs text-church-navy">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-church-navy/10 p-1 font-bold text-[10px]">
                      📖
                    </div>
                    <div>
                      <p className="font-bold">Ministrado por {selectedStudy.authorName}</p>
                      <p className="text-[10px] text-church-navy/60">Assembleia de Deus Tenda da Promessa</p>
                    </div>
                  </div>
                  <div>
                    <span className="font-serif italic text-church-navy/60">
                      Publicado em {selectedStudy.createdAt instanceof Date 
                        ? selectedStudy.createdAt.toLocaleDateString('pt-BR') 
                        : 'Recente'}
                    </span>
                  </div>
                </div>

                {/* Subtitle / summary summary */}
                {selectedStudy.description && (
                  <div className="border-l-4 border-church-gold pl-4 py-1">
                    <p className="text-xs font-bold text-church-navy/55 uppercase tracking-wider mb-0.5">Sumário / Resumo</p>
                    <p className="text-sm font-serif italic text-church-navy/80 leading-relaxed">
                      "{selectedStudy.description}"
                    </p>
                  </div>
                )}

                {/* Detailed Bible Study content */}
                <div className="prose prose-slate max-w-none text-church-navy">
                  <h4 className="text-xs font-black uppercase tracking-wider text-church-gold mb-3">Conteúdo Teológico</h4>
                  <div className="text-sm font-serif leading-relaxed whitespace-pre-wrap text-justify bg-church-cream/5 p-4 rounded-3xl border border-church-gold/10">
                    {selectedStudy.content || 'Este estudo bíblico possui um documento anexo dedicado. Clique no botão de download para baixar o PDF completo.'}
                  </div>
                </div>

                {/* Attachments panel */}
                {(selectedStudy.fileBase64 || selectedStudy.pdfUrl) && (
                  <div className="rounded-2xl border border-church-gold/15 bg-church-cream/20 p-4 space-y-2.5">
                    <p className="text-xs font-bold text-church-navy uppercase tracking-wider">Documento Anexo / PDF do Pastor</p>
                    <div className="flex flex-wrap gap-3">
                      {selectedStudy.fileBase64 && (
                        <button
                          onClick={(e) => handleDownloadPDF(selectedStudy, e)}
                          className="inline-flex items-center gap-2 rounded-xl bg-church-navy text-white px-4 py-2.5 text-xs font-black transition-transform cursor-pointer hover:scale-103 active:scale-97 shadow-sm border border-white/5"
                        >
                          <FileText className="h-4 w-4 text-church-gold" />
                          <span>Baixar Documento PDF</span>
                        </button>
                      )}
                      {selectedStudy.pdfUrl && (
                        <a
                          href={selectedStudy.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-church-navy hover:bg-church-navy/5 text-church-navy px-4 py-2.5 text-xs font-black transition-all cursor-pointer"
                        >
                          <Link className="h-4 w-4 text-church-gold" />
                          <span>Acessar Link Externo</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="bg-church-cream/30 border-t border-church-gold/10 px-6 py-4 shrink-0 flex items-center justify-between">
                <button
                  onClick={() => setSelectedStudy(null)}
                  className="rounded-2xl bg-gray-100 hover:bg-gray-200 py-3 px-5 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
                >
                  Fechar Leitura
                </button>

                <button
                  onClick={(e) => handleDownloadPDF(selectedStudy, e)}
                  className="rounded-2xl bg-church-gold hover:bg-church-gold/90 text-church-navy py-3 px-5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Download className="h-4 w-4" />
                  <span>Baixar Apostila (PDF)</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PUBLISH BIBLE STUDY DIALOG FORM */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Box modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-xl max-h-[90vh] flex flex-col border border-church-gold/10"
            >
              {/* Gold border banner */}
              <div className="bg-church-navy text-white px-6 py-4 border-b border-church-gold/15 shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="rounded-lg bg-church-gold/20 p-1.5 text-church-gold">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold text-white">Publicar Novo Estudo Bíblico</h3>
                    <p className="text-[10px] text-white/60">Disponibilize apostilas e esboços para os irmãos da Tenda da Promessa</p>
                  </div>
                </div>
              </div>

              {/* Form container */}
              <form onSubmit={handleCreateStudy} className="p-6 space-y-4 overflow-y-auto">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-church-navy">
                    Título do Estudo <span className="text-church-gold">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex: O Fruto do Espírito na Prática Cristã"
                    className="w-full rounded-2xl border border-church-gold/15 bg-white p-3 text-sm text-church-navy outline-none focus:border-church-gold"
                    id="input-study-title"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-church-navy">
                      Categoria
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full rounded-2xl border border-church-gold/15 bg-white p-3 text-xs font-medium text-church-navy outline-none focus:border-church-gold cursor-pointer"
                      id="input-study-category"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* External doc link */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-church-navy">
                      Link Externo (Google Drive, opcional)
                    </label>
                    <input
                      type="url"
                      value={formPdfUrl}
                      onChange={(e) => setFormPdfUrl(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full rounded-2xl border border-church-gold/15 bg-white p-3 text-xs text-church-navy outline-none focus:border-church-gold"
                      id="input-study-link"
                    />
                  </div>
                </div>

                {/* Short Brief Outline */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-church-navy">
                    Resumo / Introdução
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Breve descrição ou versículo chave do estudo bíblico..."
                    className="w-full rounded-2xl border border-church-gold/15 bg-white p-3 text-xs text-church-navy outline-none focus:border-church-gold"
                    id="input-study-desc"
                  />
                </div>

                {/* Upload Section */}
                <div className="rounded-2xl border border-dashed border-church-gold/20 p-4 bg-church-cream/10 space-y-3">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-church-navy/60 block">
                    Carregar PDF Oficial (Opcional - Limite 1MB)
                  </span>

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center justify-center gap-2 rounded-xl bg-church-navy hover:bg-church-navy/95 text-white px-4 py-2.5 text-xs font-bold cursor-pointer transition-all active:scale-95">
                      <FileUp className="h-4 w-4 text-church-gold" />
                      <span>Escolher Arquivo PDF</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {uploadedFileName ? (
                      <div className="text-xs text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200 font-medium">
                        ✓ {uploadedFileName}
                      </div>
                    ) : (
                      <span className="text-[10px] text-church-navy/50 font-bold">Nenhum arquivo carregado</span>
                    )}
                  </div>
                </div>

                {/* Detailed content */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-church-navy">
                    Escrever Conteúdo do Estudo (Opcional - Utilizado para Gerar PDF automático)
                  </label>
                  <textarea
                    rows={6}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Inicie a redação do seu devocional, esboço ou ensino bíblico aqui..."
                    className="w-full rounded-2xl border border-church-gold/15 bg-church-cream/5 p-4 text-xs text-church-navy outline-none focus:border-church-gold font-serif whitespace-pre-wrap leading-relaxed"
                    id="input-study-content"
                  />
                </div>

                {/* Form Buttons */}
                <div className="flex gap-3 pt-3 border-t border-church-gold/5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 rounded-2xl bg-gray-100 py-3 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-2 rounded-2xl bg-church-gold hover:bg-church-gold/90 py-3 text-xs font-black uppercase tracking-wider text-church-navy flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                    id="btn-confirm-add-study"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Publicando...</span>
                      </>
                    ) : (
                      <>
                        <BookOpenCheck className="h-3.5 w-3.5" />
                        <span>Confirmar Publicação</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl p-6 border border-church-gold/10 space-y-4 animate-in fade-in zoom-in-95 duration-250 animate-out fade-out zoom-out-95 duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-red-100 p-2.5 text-red-600">
                  <AlertCircle className="h-6 w-6 shrink-0" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-church-navy animate-fade">
                    Confirmar Exclusão
                  </h3>
                  <p className="text-xs text-church-navy/70 leading-relaxed mt-1">
                    Tem certeza que deseja remover permanentemente este estudo bíblico? Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-church-gold/5">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 rounded-2xl bg-gray-100 hover:bg-gray-200 py-3 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteStudy(deleteConfirmId)}
                  className="flex-1 rounded-2xl bg-red-600 hover:bg-red-700 py-3 text-xs font-black uppercase tracking-wider text-white transition-all cursor-pointer shadow-md"
                  id="btn-confirm-delete-study"
                >
                  Excluir Estudo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

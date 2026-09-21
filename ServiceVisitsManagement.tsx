import React, { useState, useMemo } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  collection, query, orderBy, addDoc, deleteDoc, doc, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { 
  ClipboardList, Plus, Search, Calendar, Users, Mic, UserCheck, 
  Heart, Sparkles, Trash2, Edit3, X, Check, MapPin, 
  FileText, ArrowLeft, Filter, AlertTriangle, ChevronRight, Award, Eye,
  Download, FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface VisitaCultoRecord {
  id: string;
  title: string;
  type: 'visita' | 'culto_lar' | 'evangelismo' | 'culto_oficial' | 'outro';
  date: string;
  location: string;
  attendeesCount: number;
  preacher: string;
  director: string;
  hasReconciliations: boolean;
  reconciliationsCount: number;
  reconciliationsDetails?: string;
  hasConversions: boolean;
  conversionsCount: number;
  conversionsDetails?: string;
  notes?: string;
  registeredById: string;
  registeredByName: string;
  createdAt?: any;
}

const TYPE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  visita: { label: 'Visita Pastoral', bg: 'bg-blue-100', text: 'text-blue-800' },
  culto_lar: { label: 'Culto no Lar', bg: 'bg-amber-100', text: 'text-amber-800' },
  evangelismo: { label: 'Evangelismo', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  culto_oficial: { label: 'Culto Oficial', bg: 'bg-purple-100', text: 'text-purple-800' },
  outro: { label: 'Outra Atividade', bg: 'bg-slate-100', text: 'text-slate-800' },
};

interface Props {
  role: string | null;
}

export default function ServiceVisitsManagement({ role }: Props) {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const isAdminOrPastor = role && ['admin', 'pastor', 'pastora'].includes(role);

  // Firestore collection query
  const [snapshot, loading, error] = useCollection(
    query(collection(db, 'visitas_cultos'), orderBy('date', 'desc'))
  );

  const records: VisitaCultoRecord[] = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as VisitaCultoRecord[];
  }, [snapshot]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('todos');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7) // Default to YYYY-MM
  );

  // Form Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'visita' | 'culto_lar' | 'evangelismo' | 'culto_oficial' | 'outro'>('visita');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [attendeesCount, setAttendeesCount] = useState<number>(1);
  const [preacher, setPreacher] = useState('');
  const [director, setDirector] = useState('');
  const [hasReconciliations, setHasReconciliations] = useState(false);
  const [reconciliationsCount, setReconciliationsCount] = useState<number>(0);
  const [reconciliationsDetails, setReconciliationsDetails] = useState('');
  const [hasConversions, setHasConversions] = useState(false);
  const [conversionsCount, setConversionsCount] = useState<number>(0);
  const [conversionsDetails, setConversionsDetails] = useState('');
  const [notes, setNotes] = useState('');

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<VisitaCultoRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Detail Modal state
  const [detailItem, setDetailItem] = useState<VisitaCultoRecord | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Open Form for creating or editing
  const handleOpenForm = (item?: VisitaCultoRecord) => {
    if (item) {
      setEditingId(item.id);
      setTitle(item.title);
      setType(item.type);
      setDate(item.date);
      setLocation(item.location || '');
      setAttendeesCount(item.attendeesCount || 1);
      setPreacher(item.preacher || '');
      setDirector(item.director || '');
      setHasReconciliations(item.hasReconciliations || false);
      setReconciliationsCount(item.reconciliationsCount || 0);
      setReconciliationsDetails(item.reconciliationsDetails || '');
      setHasConversions(item.hasConversions || false);
      setConversionsCount(item.conversionsCount || 0);
      setConversionsDetails(item.conversionsDetails || '');
      setNotes(item.notes || '');
    } else {
      setEditingId(null);
      setTitle('');
      setType('visita');
      setDate(new Date().toISOString().split('T')[0]);
      setLocation('');
      setAttendeesCount(1);
      setPreacher('');
      setDirector('');
      setHasReconciliations(false);
      setReconciliationsCount(0);
      setReconciliationsDetails('');
      setHasConversions(false);
      setConversionsCount(0);
      setConversionsDetails('');
      setNotes('');
    }
    setIsFormOpen(true);
  };

  // Save Record
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!title.trim()) {
      showToast('Por favor, preencha o título do evento/visita.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        type,
        date,
        location: location.trim(),
        attendeesCount: Number(attendeesCount) || 0,
        preacher: preacher.trim(),
        director: director.trim(),
        hasReconciliations,
        reconciliationsCount: hasReconciliations ? Number(reconciliationsCount) || 0 : 0,
        reconciliationsDetails: hasReconciliations ? reconciliationsDetails.trim() : '',
        hasConversions,
        conversionsCount: hasConversions ? Number(conversionsCount) || 0 : 0,
        conversionsDetails: hasConversions ? conversionsDetails.trim() : '',
        notes: notes.trim(),
        registeredById: currentUser.uid,
        registeredByName: currentUser.displayName || 'Líder/Membro',
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'visitas_cultos', editingId), payload);
        showToast('Registro atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'visitas_cultos'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast('Visita/Culto cadastrado com sucesso!');
      }

      setIsFormOpen(false);
    } catch (err) {
      console.error('Error saving visit/cult record:', err);
      handleFirestoreError(err, OperationType.WRITE, 'visitas_cultos');
      showToast('Erro ao salvar registro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Delete
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'visitas_cultos', itemToDelete.id));
      showToast('Registro excluído com sucesso.');
      if (detailItem?.id === itemToDelete.id) {
        setDetailItem(null);
      }
      setItemToDelete(null);
    } catch (err) {
      console.error('Error deleting record:', err);
      handleFirestoreError(err, OperationType.DELETE, `visitas_cultos/${itemToDelete.id}`);
      showToast('Erro ao excluir registro.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const matchesSearch =
        rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.preacher.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.director.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.location.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = selectedType === 'todos' || rec.type === selectedType;

      const matchesMonth =
        selectedMonth === 'todos' || (rec.date && rec.date.startsWith(selectedMonth));

      return matchesSearch && matchesType && matchesMonth;
    });
  }, [records, searchQuery, selectedType, selectedMonth]);

  // Totals for filtered selection
  const totalVisits = filteredRecords.length;
  const totalAttendees = filteredRecords.reduce((s, r) => s + (r.attendeesCount || 0), 0);
  const totalConversions = filteredRecords.reduce((s, r) => s + (r.hasConversions ? r.conversionsCount || 0 : 0), 0);
  const totalReconciliations = filteredRecords.reduce((s, r) => s + (r.hasReconciliations ? r.reconciliationsCount || 0 : 0), 0);

  // Download PDF Report function
  const handleDownloadPDF = () => {
    if (filteredRecords.length === 0) {
      showToast('Nenhum registro encontrado para exportar o PDF.');
      return;
    }

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Header Banner
      doc.setFillColor(15, 23, 42); // church-navy
      doc.rect(0, 0, 210, 28, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE VISITAS E CULTOS NOS LARES', 14, 12);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(217, 180, 89); // church-gold accent

      let monthHeaderLabel = 'Todos os Registros';
      if (selectedMonth !== 'todos') {
        const [y, m] = selectedMonth.split('-');
        const monthNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthName = monthNames[parseInt(m, 10) - 1] || m;
        monthHeaderLabel = `Relatório Mensal - ${monthName} / ${y}`;
      }
      doc.text(monthHeaderLabel, 14, 20);

      // Summary Card in PDF
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 32, 182, 16, 2, 2, 'FD');

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Atividades: ${totalVisits}`, 18, 42);
      doc.text(`Total Presentes: ${totalAttendees}`, 65, 42);
      doc.text(`Conversões: ${totalConversions}`, 115, 42);
      doc.text(`Reconciliações: ${totalReconciliations}`, 155, 42);

      // Table Rows
      const tableRows = filteredRecords.map((item) => {
        const typeLabel = TYPE_LABELS[item.type]?.label || item.type;
        const formattedDate = item.date ? item.date.split('-').reverse().join('/') : '-';

        let decisions = '-';
        const parts = [];
        if (item.hasConversions && item.conversionsCount > 0) {
          parts.push(`${item.conversionsCount} conv.`);
        }
        if (item.hasReconciliations && item.reconciliationsCount > 0) {
          parts.push(`${item.reconciliationsCount} reconc.`);
        }
        if (parts.length > 0) decisions = parts.join(' / ');

        return [
          formattedDate,
          typeLabel,
          `${item.title}${item.location ? '\nLocal: ' + item.location : ''}`,
          item.preacher || '-',
          item.director || '-',
          item.attendeesCount || 0,
          decisions
        ];
      });

      autoTable(doc, {
        startY: 52,
        head: [['Data', 'Tipo', 'Título / Local', 'Pregou', 'Dirigiu', 'Presentes', 'Decisões']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { cellWidth: 18, halign: 'center' },
          1: { cellWidth: 26 },
          2: { cellWidth: 48 },
          3: { cellWidth: 28 },
          4: { cellWidth: 28 },
          5: { cellWidth: 16, halign: 'center' },
          6: { cellWidth: 18, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Relatório emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} - Página ${i} de ${pageCount}`,
          14,
          288
        );
      }

      doc.save(`Relatorio_Visitas_Cultos_${selectedMonth}.pdf`);
      showToast('Relatório em PDF baixado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      showToast('Erro ao gerar o arquivo PDF.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-50 bg-church-navy text-church-gold px-4 py-3 rounded-2xl shadow-xl border border-church-gold/30 font-bold text-xs flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/')}
            className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-church-navy transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Voltar ao Início</span>
          </button>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-church-navy tracking-tight flex items-center gap-2.5">
            <ClipboardList className="h-7 w-7 text-church-gold" />
            <span>Registro de Visitas & Cultos</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre e acompanhe os cultos nos lares, visitas pastorais, evangelismos e decisões.
          </p>
        </div>

        {currentUser && (
          <button
            onClick={() => handleOpenForm()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-church-gold hover:bg-church-gold/90 text-church-navy font-bold py-3 px-5 text-xs shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Cadastrar Novo Registro</span>
          </button>
        )}
      </div>

      {/* Stats Cards Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Total Registros</span>
            <ClipboardList className="h-4 w-4 text-church-navy" />
          </div>
          <p className="text-2xl font-serif font-black text-slate-800">{totalVisits}</p>
          <p className="text-[10px] text-slate-400">Visitas e cultos no total</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Pessoas Presentes</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-2xl font-serif font-black text-blue-600">{totalAttendees}</p>
          <p className="text-[10px] text-slate-400">Soma de participantes</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Conversões</span>
            <Sparkles className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-serif font-black text-emerald-600">{totalConversions}</p>
          <p className="text-[10px] text-slate-400">Novas decisões aceitas</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Reconciliações</span>
            <Heart className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-serif font-black text-rose-500">{totalReconciliations}</p>
          <p className="text-[10px] text-slate-400">Vidas voltadas para Deus</p>
        </div>
      </div>

      {/* Filters & Search & Export */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, pregador, dirigente ou local..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-church-gold/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Month selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700">
            <Calendar className="h-3.5 w-3.5 text-church-gold shrink-0" />
            <input
              type="month"
              value={selectedMonth === 'todos' ? '' : selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || 'todos')}
              className="bg-transparent focus:outline-none cursor-pointer text-xs font-semibold text-slate-800"
            />
            {selectedMonth !== 'todos' && (
              <button
                onClick={() => setSelectedMonth('todos')}
                className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-1 cursor-pointer"
                title="Ver todos os meses"
              >
                Ver Todos
              </button>
            )}
          </div>

          {/* Type selector */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-church-gold/50 font-bold text-slate-700 cursor-pointer"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="visita">Visita Pastoral</option>
              <option value="culto_lar">Culto no Lar</option>
              <option value="evangelismo">Evangelismo</option>
              <option value="culto_oficial">Culto Oficial</option>
              <option value="outro">Outros</option>
            </select>
          </div>

          {/* PDF Download Button */}
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-church-navy bg-amber-100/80 hover:bg-amber-200/80 border border-amber-300/60 rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm shrink-0"
            title="Baixar relatório do mês em PDF"
          >
            <Download className="h-3.5 w-3.5 text-church-navy" />
            <span>Baixar PDF</span>
          </button>
        </div>
      </div>

      {/* Records List */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-church-navy border-t-transparent mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Carregando registros de visitas e cultos...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
          <ClipboardList className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="font-serif text-base font-bold text-slate-800">Nenhum registro encontrado</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery || selectedType !== 'todos'
              ? 'Tente ajustar seus filtros de busca.'
              : 'Nenhum relatório de visita ou culto foi cadastrado ainda. Clique em "Cadastrar Novo Registro" para começar!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecords.map((item) => {
            const typeInfo = TYPE_LABELS[item.type] || TYPE_LABELS.outro;
            const isOwner = currentUser?.uid === item.registeredById;
            const canManage = isOwner || isAdminOrPastor;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all p-4 space-y-3 flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${typeInfo.bg} ${typeInfo.text}`}>
                      {typeInfo.label}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono font-bold flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {item.date ? item.date.split('-').reverse().join('/') : ''}
                    </span>
                  </div>

                  <h3 className="font-serif text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-church-navy transition-colors">
                    {item.title}
                  </h3>

                  {item.location && (
                    <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-church-gold shrink-0" />
                      <span className="truncate">{item.location}</span>
                    </p>
                  )}

                  {/* Preacher & Director */}
                  <div className="bg-slate-50 rounded-xl p-2.5 space-y-1 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Mic className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="font-bold text-slate-500">Pregou:</span>
                      <span className="font-semibold text-slate-800 truncate">{item.preacher || 'Não informado'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <UserCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="font-bold text-slate-500">Dirigiu:</span>
                      <span className="font-semibold text-slate-800 truncate">{item.director || 'Não informado'}</span>
                    </div>
                  </div>

                  {/* Badges for Attendees, Reconciliations & Conversions */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    <div className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 border border-blue-100">
                      <Users className="h-3 w-3" />
                      <span>{item.attendeesCount} Presentes</span>
                    </div>

                    {item.hasConversions && item.conversionsCount > 0 && (
                      <div className="bg-emerald-50 text-emerald-800 font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 border border-emerald-200">
                        <Sparkles className="h-3 w-3 text-emerald-600" />
                        <span>{item.conversionsCount} {item.conversionsCount === 1 ? 'Conversão' : 'Conversões'}</span>
                      </div>
                    )}

                    {item.hasReconciliations && item.reconciliationsCount > 0 && (
                      <div className="bg-rose-50 text-rose-800 font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 border border-rose-200">
                        <Heart className="h-3 w-3 text-rose-600 fill-rose-600" />
                        <span>{item.reconciliationsCount} {item.reconciliationsCount === 1 ? 'Reconciliação' : 'Reconciliações'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 truncate">
                    Por: {item.registeredByName}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDetailItem(item)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-church-navy hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Ver detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {canManage && (
                      <>
                        <button
                          onClick={() => handleOpenForm(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FORM MODAL FOR CREATING / EDITING (COMPACT & NON-FULLSCREEN) */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <h2 className="font-serif text-base font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-church-gold" />
                  <span>{editingId ? 'Editar Registro' : 'Cadastrar Visita / Culto'}</span>
                </h2>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-4 sm:p-5 overflow-y-auto space-y-3 text-xs flex-1">
                  {/* Tipo e Data */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Tipo de Atividade *</label>
                      <select
                        value={type}
                        onChange={(e: any) => setType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-church-gold/50 cursor-pointer text-xs"
                      >
                        <option value="visita">Visita Pastoral</option>
                        <option value="culto_lar">Culto no Lar</option>
                        <option value="evangelismo">Evangelismo</option>
                        <option value="culto_oficial">Culto Oficial</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Data *</label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs"
                      />
                    </div>
                  </div>

                  {/* Título */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Título / Nome do Evento *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Culto de Ação de Graças no Lar do Irmão Marcos"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs"
                    />
                  </div>

                  {/* Local & Quantidade de Presentes */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="font-bold text-slate-700">Local / Endereço / Família</label>
                      <input
                        type="text"
                        placeholder="Ex: Casa da Irmã Ana - Bairro Centro"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Nº Presentes *</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={attendeesCount}
                        onChange={(e) => setAttendeesCount(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs"
                      />
                    </div>
                  </div>

                  {/* Pregador e Dirigente */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 flex items-center gap-1">
                        <Mic className="h-3.5 w-3.5 text-blue-600" />
                        <span>Quem Pregou *</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Pr. João / Pb. Lucas"
                        value={preacher}
                        onChange={(e) => setPreacher(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5 text-amber-600" />
                        <span>Quem Dirigiu *</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Ir. Maria / Diác. Carlos"
                        value={director}
                        onChange={(e) => setDirector(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs"
                      />
                    </div>
                  </div>

                  {/* Decisões e Reconciliações Toggles */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                    {/* Conversões */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Houve Conversões / Decisões?</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setHasConversions(!hasConversions)}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            hasConversions ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                          }`}
                        >
                          <span className="bg-white w-4 h-4 rounded-full shadow-md" />
                        </button>
                      </div>

                      {hasConversions && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-2 pt-1 border-t border-slate-200"
                        >
                          <div className="flex items-center gap-2">
                            <label className="font-bold text-slate-700 shrink-0 text-[11px]">Quantidade:</label>
                            <input
                              type="number"
                              min={1}
                              value={conversionsCount}
                              onChange={(e) => setConversionsCount(parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-0.5 rounded-lg border border-slate-200 bg-white font-bold text-center text-xs"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Nomes dos novos decididos (opcional)"
                            value={conversionsDetails}
                            onChange={(e) => setConversionsDetails(e.target.value)}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs"
                          />
                        </motion.div>
                      )}
                    </div>

                    <hr className="border-slate-200" />

                    {/* Reconciliações */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                          <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                          <span>Houve Reconciliações?</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setHasReconciliations(!hasReconciliations)}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            hasReconciliations ? 'bg-rose-600 justify-end' : 'bg-slate-300 justify-start'
                          }`}
                        >
                          <span className="bg-white w-4 h-4 rounded-full shadow-md" />
                        </button>
                      </div>

                      {hasReconciliations && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-2 pt-1 border-t border-slate-200"
                        >
                          <div className="flex items-center gap-2">
                            <label className="font-bold text-slate-700 shrink-0 text-[11px]">Quantidade:</label>
                            <input
                              type="number"
                              min={1}
                              value={reconciliationsCount}
                              onChange={(e) => setReconciliationsCount(parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-0.5 rounded-lg border border-slate-200 bg-white font-bold text-center text-xs"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Nomes das pessoas reconciliadas (opcional)"
                            value={reconciliationsDetails}
                            onChange={(e) => setReconciliationsDetails(e.target.value)}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs"
                          />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Observações */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Observações / Detalhes</label>
                    <textarea
                      rows={2}
                      placeholder="Descreva detalhes, testemunhos ou pedidos de oração..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs"
                    />
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-church-gold hover:bg-church-gold/90 text-church-navy font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs"
                  >
                    {isSubmitting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-church-navy border-t-transparent" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span>{editingId ? 'Salvar Alterações' : 'Cadastrar Registro'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL MODAL VIEW */}
      <AnimatePresence>
        {detailItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-6 my-8 border border-slate-200 space-y-4"
            >
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${TYPE_LABELS[detailItem.type]?.bg} ${TYPE_LABELS[detailItem.type]?.text}`}>
                    {TYPE_LABELS[detailItem.type]?.label}
                  </span>
                  <h3 className="font-serif text-lg font-bold text-slate-900 mt-1">
                    {detailItem.title}
                  </h3>
                </div>
                <button
                  onClick={() => setDetailItem(null)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Data</span>
                    <span className="font-bold text-slate-800">{detailItem.date?.split('-').reverse().join('/')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Presentes</span>
                    <span className="font-bold text-blue-600">{detailItem.attendeesCount} pessoas</span>
                  </div>
                </div>

                {detailItem.location && (
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Local / Endereço</span>
                    <p className="font-medium text-slate-800">{detailItem.location}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl">
                    <span className="text-[10px] text-blue-600 font-bold block uppercase">Pregou</span>
                    <span className="font-bold text-slate-800">{detailItem.preacher || 'Não informado'}</span>
                  </div>
                  <div className="p-2.5 bg-amber-50/70 border border-amber-100 rounded-xl">
                    <span className="text-[10px] text-amber-700 font-bold block uppercase">Dirigiu</span>
                    <span className="font-bold text-slate-800">{detailItem.director || 'Não informado'}</span>
                  </div>
                </div>

                {detailItem.hasConversions && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
                    <span className="font-bold text-emerald-800 flex items-center gap-1">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <span>{detailItem.conversionsCount} {detailItem.conversionsCount === 1 ? 'Nova Conversão' : 'Novas Conversões'}</span>
                    </span>
                    {detailItem.conversionsDetails && (
                      <p className="text-[11px] text-emerald-700 italic">{detailItem.conversionsDetails}</p>
                    )}
                  </div>
                )}

                {detailItem.hasReconciliations && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-1">
                    <span className="font-bold text-rose-800 flex items-center gap-1">
                      <Heart className="h-4 w-4 text-rose-600 fill-rose-600" />
                      <span>{detailItem.reconciliationsCount} {detailItem.reconciliationsCount === 1 ? 'Reconciliação' : 'Reconciliações'}</span>
                    </span>
                    {detailItem.reconciliationsDetails && (
                      <p className="text-[11px] text-rose-700 italic">{detailItem.reconciliationsDetails}</p>
                    )}
                  </div>
                )}

                {detailItem.notes && (
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Observações</span>
                    <p className="p-3 bg-slate-50 rounded-xl text-slate-700 leading-relaxed whitespace-pre-line">
                      {detailItem.notes}
                    </p>
                  </div>
                )}

                <div className="pt-2 text-[10px] text-slate-400">
                  Registrado por: <strong>{detailItem.registeredByName}</strong>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setDetailItem(null)}
                  className="px-4 py-2 bg-slate-100 font-bold text-slate-700 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer text-xs"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE MODAL */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 border border-slate-200"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <h3 className="font-serif text-lg font-bold text-slate-900">
                  Confirmar Exclusão
                </h3>
                <p className="text-xs text-slate-500">
                  Tem certeza de que deseja excluir o registro <strong className="text-slate-800">"{itemToDelete.title}"</strong>? Esta ação não pode ser desfeita.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isDeleting ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>Excluir</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

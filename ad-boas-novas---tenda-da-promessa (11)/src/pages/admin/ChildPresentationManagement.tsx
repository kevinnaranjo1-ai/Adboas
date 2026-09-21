import React, { useState, useEffect, useMemo } from 'react';
import { Baby, UserPlus, Search, Loader2, Download, Trash2, Calendar, Phone, MapPin, FileText, Filter, X, Award, Edit, Heart, User, CheckCircle2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PresentedChild {
  id: string;
  childName: string;
  birthDate?: string;
  gender?: 'M' | 'F' | 'Outro';
  fatherName?: string;
  motherName?: string;
  cpf?: string;
  presentationDate: string;
  pastorName?: string;
  observations?: string;
  createdAt?: any;
}

export default function ChildPresentationManagement() {
  const [children, setChildren] = useState<PresentedChild[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<PresentedChild | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    childName: '',
    birthDate: '',
    gender: 'M' as 'M' | 'F' | 'Outro',
    fatherName: '',
    motherName: '',
    cpf: '',
    presentationDate: format(new Date(), 'yyyy-MM-dd'),
    pastorName: '',
    observations: ''
  });

  useEffect(() => {
    const q = query(
      collection(db, 'criancas_apresentadas'), 
      orderBy('presentationDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: PresentedChild[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PresentedChild[];
      setChildren(data);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'criancas_apresentadas');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openNewModal = () => {
    setEditingChild(null);
    setFormData({
      childName: '',
      birthDate: '',
      gender: 'M',
      fatherName: '',
      motherName: '',
      cpf: '',
      presentationDate: format(new Date(), 'yyyy-MM-dd'),
      pastorName: 'Pr. Carlos / Pastor Responsável',
      observations: ''
    });
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (child: PresentedChild) => {
    setEditingChild(child);
    setFormData({
      childName: child.childName || '',
      birthDate: child.birthDate || '',
      gender: (child.gender as 'M' | 'F' | 'Outro') || 'M',
      fatherName: child.fatherName || '',
      motherName: child.motherName || '',
      cpf: child.cpf || '',
      presentationDate: child.presentationDate || format(new Date(), 'yyyy-MM-dd'),
      pastorName: child.pastorName || '',
      observations: child.observations || ''
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.childName.trim() || !formData.presentationDate) {
      setError('Por favor, preencha o nome da criança e a data da apresentação.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (editingChild) {
        // Update existing
        await updateDoc(doc(db, 'criancas_apresentadas', editingChild.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new
        await addDoc(collection(db, 'criancas_apresentadas'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      setSubmitting(false);
    } catch (err: any) {
      console.error('Erro ao salvar criança apresentada:', err);
      setError('Erro ao salvar os dados. Tente novamente.');
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, 'criancas_apresentadas', deletingId));
      setDeletingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'criancas_apresentadas');
    }
  };

  // Filtered children list
  const filteredChildren = useMemo(() => {
    return children.filter(c => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchChild = c.childName.toLowerCase().includes(term);
        const matchFather = (c.fatherName || '').toLowerCase().includes(term);
        const matchMother = (c.motherName || '').toLowerCase().includes(term);
        const matchCpf = (c.cpf || '').toLowerCase().includes(term);
        const matchPastor = (c.pastorName || '').toLowerCase().includes(term);
        if (!matchChild && !matchFather && !matchMother && !matchCpf && !matchPastor) return false;
      }
      if (genderFilter && c.gender !== genderFilter) return false;
      if (startDate && c.presentationDate < startDate) return false;
      if (endDate && c.presentationDate > endDate) return false;
      return true;
    });
  }, [children, searchTerm, genderFilter, startDate, endDate]);

  // Statistics
  const stats = useMemo(() => {
    const total = children.length;
    const now = new Date();
    const currentMonth = format(now, 'yyyy-MM');
    const currentYear = format(now, 'yyyy');

    const thisMonth = children.filter(c => c.presentationDate && c.presentationDate.startsWith(currentMonth)).length;
    const thisYear = children.filter(c => c.presentationDate && c.presentationDate.startsWith(currentYear)).length;

    return { total, thisMonth, thisYear };
  }, [children]);

  // Certificate PDF generation for a single child
  const generateCertificatePDF = (child: PresentedChild) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    // Background and Frame Borders
    doc.setFillColor(253, 252, 248); // Cream soft background
    doc.rect(0, 0, width, height, 'F');

    // Outer Decorative Golden Frame
    doc.setDrawColor(197, 160, 89); // Church gold
    doc.setLineWidth(1.5);
    doc.rect(8, 8, width - 16, height - 16);

    // Inner Fine Border Frame
    doc.setDrawColor(26, 54, 93); // Church Navy
    doc.setLineWidth(0.5);
    doc.rect(12, 12, width - 24, height - 24);

    // Header Church Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(26, 54, 93);
    doc.text('ASSEMBLEIA DE DEUS BOAS NOVAS', width / 2, 28, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(197, 160, 89);
    doc.text('TENDA DA PROMESSA', width / 2, 34, { align: 'center' });

    // Main Certificate Title
    doc.setFont('times', 'italic');
    doc.setFontSize(28);
    doc.setTextColor(26, 54, 93);
    doc.text('Certificado de Apresentação de Criança', width / 2, 52, { align: 'center' });

    // Bible Verse Quote
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('"Deixai vir a mim os pequeninos e não os impeçais, porque dos tais é o Reino dos Céus." - Marcos 10:14', width / 2, 62, { align: 'center' });

    // Certificate Body Text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);

    let textY = 78;
    doc.text('Certificamos para os devidos fins que a criança', width / 2, textY, { align: 'center' });

    // Child Name Highlighted
    textY += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(26, 54, 93);
    doc.text(child.childName.toUpperCase(), width / 2, textY, { align: 'center' });

    // Underline for name
    const nameWidth = doc.getTextWidth(child.childName.toUpperCase());
    doc.setDrawColor(197, 160, 89);
    doc.setLineWidth(0.8);
    doc.line((width / 2) - (nameWidth / 2) - 5, textY + 2, (width / 2) + (nameWidth / 2) + 5, textY + 2);

    // Details paragraph
    textY += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);

    const birthStr = child.birthDate ? format(new Date(child.birthDate + 'T00:00:00'), 'dd/MM/yyyy') : '___/___/______';
    const presDateStr = child.presentationDate ? format(new Date(child.presentationDate + 'T00:00:00'), 'dd/MM/yyyy') : '___/___/______';

    doc.text(`Nascido(a) em ${birthStr}, filho(a) de:`, width / 2, textY, { align: 'center' });

    // Parents Name
    textY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(26, 54, 93);
    const fatherStr = child.fatherName ? `Pai: ${child.fatherName}` : '';
    const motherStr = child.motherName ? `Mãe: ${child.motherName}` : '';
    const parentsCombined = [fatherStr, motherStr].filter(Boolean).join('  |  ') || 'Pais não informados';
    doc.text(parentsCombined, width / 2, textY, { align: 'center' });

    if (child.cpf) {
      textY += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`CPF: ${child.cpf}`, width / 2, textY, { align: 'center' });
    }

    textY += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text(`Foi apresentada ao Senhor Deus nesta igreja no dia ${presDateStr},`, width / 2, textY, { align: 'center' });

    textY += 7;
    doc.text('recebendo a oração de bênção de acordo com os ensinamentos da Palavra de Deus.', width / 2, textY, { align: 'center' });

    // Signatures section at bottom
    const sigY = height - 38;

    // Line 1: Pastor
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.line((width / 2) - 50, sigY, (width / 2) + 50, sigY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 54, 93);
    doc.text(child.pastorName || 'Pastor Responsável', width / 2, sigY + 6, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Pastor Responsável', width / 2, sigY + 11, { align: 'center' });

    // Save Certificate PDF
    doc.save(`Certificado_Apresentacao_${child.childName.replace(/\s+/g, '_')}.pdf`);
  };

  // Export List PDF
  const downloadReportPDF = () => {
    const doc = new jsPDF();
    const now = new Date();

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93);
    doc.text('Relatório de Crianças Apresentadas', 105, 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('AD Boas Novas - Tenda da Promessa', 105, 24, { align: 'center' });

    let filterInfo = `Total de Registros: ${filteredChildren.length}`;
    if (startDate || endDate) {
      filterInfo += ` | Período: ${startDate ? format(new Date(startDate + 'T00:00:00'), 'dd/MM/yyyy') : 'Início'} a ${endDate ? format(new Date(endDate + 'T00:00:00'), 'dd/MM/yyyy') : 'Hoje'}`;
    }
    doc.text(filterInfo, 105, 30, { align: 'center' });
    doc.text(`Gerado em: ${format(now, 'dd/MM/yyyy HH:mm')}`, 105, 36, { align: 'center' });

    autoTable(doc, {
      startY: 42,
      head: [['Data Apresentação', 'Nome da Criança', 'Nascimento', 'Gênero', 'Pais', 'CPF']],
      body: filteredChildren.map(c => [
        c.presentationDate ? format(new Date(c.presentationDate + 'T00:00:00'), 'dd/MM/yyyy') : '-',
        c.childName,
        c.birthDate ? format(new Date(c.birthDate + 'T00:00:00'), 'dd/MM/yyyy') : '-',
        c.gender === 'M' ? 'Masculino' : c.gender === 'F' ? 'Feminino' : '-',
        [c.fatherName ? `Pai: ${c.fatherName}` : '', c.motherName ? `Mãe: ${c.motherName}` : ''].filter(Boolean).join('\n') || '-',
        c.cpf || '-'
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [26, 54, 93], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { fontStyle: 'bold', cellWidth: 40 },
        2: { cellWidth: 24 },
        3: { cellWidth: 22 },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 28 }
      }
    });

    const dateSuffix = startDate ? `_${startDate}_a_${endDate || 'hoje'}` : '';
    doc.save(`Relatorio_Criancas_Apresentadas${dateSuffix}.pdf`);
  };

  return (
    <div className="space-y-8 p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-church-navy/10 text-church-navy border border-church-gold/20">
            <Baby className="h-6 w-6 text-church-gold" />
          </div>
          <div>
            <h1 className="font-serif text-3xl font-black text-church-navy">Apresentação de Crianças</h1>
            <p className="text-church-navy/60">Registro de bênção, acompanhamento e emissão de certificados</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={downloadReportPDF}
            className="flex items-center gap-2 rounded-xl border border-church-navy/20 bg-church-navy px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-church-navy/90 active:scale-95"
          >
            <Download className="h-4 w-4 text-church-gold" /> Baixar Relatório PDF
          </button>
          <button 
            onClick={openNewModal}
            className="flex items-center gap-2 rounded-xl bg-church-gold px-6 py-3 text-sm font-bold text-church-navy shadow-md transition-all hover:bg-church-gold/90 active:scale-95"
          >
            <UserPlus className="h-4 w-4" /> Cadastrar Criança
          </button>
        </div>
      </header>

      {/* Cards de Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-church-navy/5 text-church-navy">
            <Baby className="h-6 w-6 text-church-gold" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-church-navy/40">Total Apresentadas</p>
            <p className="text-2xl font-black text-church-navy mt-1">{stats.total}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-church-navy/40">Este Mês</p>
            <p className="text-2xl font-black text-green-700 mt-1">{stats.thisMonth}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-church-navy/40">Este Ano</p>
            <p className="text-2xl font-black text-blue-700 mt-1">{stats.thisYear}</p>
          </div>
        </div>
      </div>

      {/* Painel de Filtros */}
      <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-church-gold/10 pb-3">
          <span className="text-sm font-bold text-church-navy flex items-center gap-2">
            <Filter className="h-4 w-4 text-church-gold" /> Filtros de Busca
          </span>
          {(searchTerm || startDate || endDate || genderFilter) && (
            <button 
              onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setGenderFilter(''); }}
              className="text-xs text-red-600 hover:underline flex items-center gap-1 font-bold"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-church-navy/40" />
            <input 
              type="text"
              placeholder="Buscar por criança, pai, mãe, CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-church-gold/20 bg-white pl-10 pr-4 py-2.5 text-sm font-medium text-church-navy placeholder:text-church-navy/30 focus:outline-none focus:ring-2 focus:ring-church-gold/30"
            />
          </div>

          <div>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full rounded-xl border border-church-gold/20 bg-white px-3 py-2.5 text-sm font-bold text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/30"
            >
              <option value="">Todos os Sexos</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-church-navy/60 whitespace-nowrap">De:</label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-church-gold/20 px-3 py-2 text-sm font-bold text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/30"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-church-navy/60 whitespace-nowrap">Até:</label>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-church-gold/20 px-3 py-2 text-sm font-bold text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/30"
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-church-gold" />
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-church-gold/10 overflow-hidden shadow-sm">
          {filteredChildren.length === 0 ? (
            <div className="p-12 text-center">
              <Baby className="mx-auto h-12 w-12 text-church-navy/20" />
              <p className="mt-4 font-bold text-church-navy/60">Nenhuma criança encontrada.</p>
              <p className="text-xs text-church-navy/40 mt-1">Tente ajustar a busca ou cadastrar uma nova criança apresentada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-church-navy text-white text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Dia Apresentação</th>
                    <th className="px-6 py-4">Nome da Criança</th>
                    <th className="px-6 py-4">Nascimento</th>
                    <th className="px-6 py-4">Sexo</th>
                    <th className="px-6 py-4">Pais</th>
                    <th className="px-6 py-4">CPF</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-church-gold/10 text-sm text-church-navy">
                  {filteredChildren.map(c => (
                    <tr key={c.id} className="hover:bg-church-navy/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-church-navy">
                        {c.presentationDate ? format(new Date(c.presentationDate + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4 font-bold text-church-navy">
                        <div className="flex items-center gap-2">
                          <span>{c.childName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-church-navy/70 font-medium">
                        {c.birthDate ? format(new Date(c.birthDate + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {c.gender === 'M' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                            Masculino
                          </span>
                        ) : c.gender === 'F' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-100 text-pink-800">
                            Feminino
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                            Outro
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-church-navy/80 max-w-xs">
                        {c.fatherName && <p><span className="font-bold text-church-navy">Pai:</span> {c.fatherName}</p>}
                        {c.motherName && <p><span className="font-bold text-church-navy">Mãe:</span> {c.motherName}</p>}
                        {!c.fatherName && !c.motherName && <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-church-navy/70">
                        {c.cpf || '-'}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => generateCertificatePDF(c)}
                            className="inline-flex items-center gap-1 rounded-xl bg-church-gold/20 px-3 py-1.5 text-xs font-bold text-church-navy hover:bg-church-gold/40 transition-colors"
                            title="Gerar Certificado em PDF"
                          >
                            <Award className="h-3.5 w-3.5 text-church-navy" /> Certificado
                          </button>
                          <button
                            onClick={() => openEditModal(c)}
                            className="inline-flex items-center gap-1 rounded-xl bg-church-navy/10 px-2.5 py-1.5 text-xs font-bold text-church-navy hover:bg-church-navy/20 transition-colors"
                            title="Editar"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingId(c.id)}
                            className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Cadastro / Edição */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-church-navy/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-church-gold/20 space-y-6 my-8"
            >
              <div className="flex items-center justify-between border-b border-church-gold/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-church-navy/10 text-church-navy">
                    <Baby className="h-5 w-5 text-church-gold" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-serif text-church-navy">
                      {editingChild ? 'Editar Cadastro da Criança' : 'Cadastrar Criança Apresentada'}
                    </h2>
                    <p className="text-xs text-church-navy/60">Preencha os dados para registro e certificado</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl p-2 text-church-navy/40 hover:bg-church-navy/5 hover:text-church-navy transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Dados da Criança */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Nome da Criança *</label>
                  <input 
                    required 
                    placeholder="Ex: Samuel Silva Santos" 
                    className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-medium text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                    value={formData.childName} 
                    onChange={(e) => setFormData({...formData, childName: e.target.value})} 
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Data de Nascimento</label>
                    <input 
                      type="date" 
                      className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-bold text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                      value={formData.birthDate} 
                      onChange={(e) => setFormData({...formData, birthDate: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Sexo / Gênero</label>
                    <select 
                      className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-bold text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40 bg-white"
                      value={formData.gender}
                      onChange={(e) => setFormData({...formData, gender: e.target.value as 'M' | 'F' | 'Outro'})}
                    >
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>

                {/* Pais */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Nome do Pai</label>
                    <input 
                      placeholder="Ex: José Santos" 
                      className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-medium text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                      value={formData.fatherName} 
                      onChange={(e) => setFormData({...formData, fatherName: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Nome da Mãe</label>
                    <input 
                      placeholder="Ex: Maria Silva Santos" 
                      className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-medium text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                      value={formData.motherName} 
                      onChange={(e) => setFormData({...formData, motherName: e.target.value})} 
                    />
                  </div>
                </div>

                {/* CPF e Dia da Apresentação */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-church-navy uppercase tracking-wider">CPF (Criança ou Responsável)</label>
                    <input 
                      placeholder="000.000.000-00" 
                      className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-medium text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                      value={formData.cpf} 
                      onChange={(e) => setFormData({...formData, cpf: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Dia da Apresentação *</label>
                    <input 
                      required 
                      type="date" 
                      className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-bold text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                      value={formData.presentationDate} 
                      onChange={(e) => setFormData({...formData, presentationDate: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Pastor Responsavel */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Pastor / Officiante Responsável</label>
                  <input 
                    placeholder="Ex: Pr. Carlos / Pastora Maria" 
                    className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-medium text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                    value={formData.pastorName} 
                    onChange={(e) => setFormData({...formData, pastorName: e.target.value})} 
                  />
                </div>

                {/* Observacoes */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Observações</label>
                  <textarea 
                    rows={2} 
                    placeholder="Anotações adicionais..." 
                    className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-medium text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                    value={formData.observations} 
                    onChange={(e) => setFormData({...formData, observations: e.target.value})} 
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="flex-1 rounded-xl border border-church-navy/10 px-4 py-3 text-sm font-bold text-church-navy hover:bg-church-navy/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-church-navy px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-church-navy/90 transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Dados'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirm Delete */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-church-navy/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="w-full max-w-sm bg-white rounded-3xl p-6 text-center space-y-4 shadow-2xl border border-church-gold/20"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-church-navy">Excluir Registro?</h2>
                <p className="text-xs text-church-navy/60 mt-1">Esta ação removerá permanentemente a criança apresentada da base de dados.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-2.5 font-bold text-xs text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 font-bold text-xs text-white hover:bg-red-700 transition-colors shadow-md"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

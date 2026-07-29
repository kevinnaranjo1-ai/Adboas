import React, { useState, useEffect, useMemo } from 'react';
import { Users, UserPlus, Search, Loader2, Download, Trash2, Calendar, Phone, MapPin, FileText, Filter, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Visitor {
  id: string;
  name: string;
  phone: string;
  date: string;
  address?: string;
  observations?: string;
  createdAt: any;
}

export default function VisitorManagement() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    observations: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'visitantes'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Visitor[];
      setVisitors(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'visitantes');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'visitantes'), {
        ...formData,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setFormData({ name: '', phone: '', address: '', date: format(new Date(), 'yyyy-MM-dd'), observations: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'visitantes');
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      setError(null);
      await deleteDoc(doc(db, 'visitantes', deletingId));
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
      setError('Erro ao excluir visitante. Tente novamente.');
      handleFirestoreError(error, OperationType.DELETE, `visitantes/${deletingId}`);
    }
  };

  // Filter visitors
  const filteredVisitors = useMemo(() => {
    return visitors.filter(v => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = v.name.toLowerCase().includes(term);
        const matchPhone = (v.phone || '').toLowerCase().includes(term);
        const matchAddress = (v.address || '').toLowerCase().includes(term);
        const matchObs = (v.observations || '').toLowerCase().includes(term);
        if (!matchName && !matchPhone && !matchAddress && !matchObs) return false;
      }
      if (startDate && v.date < startDate) return false;
      if (endDate && v.date > endDate) return false;
      return true;
    });
  }, [visitors, searchTerm, startDate, endDate]);

  // Statistics
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonthStr = format(now, 'yyyy-MM');
    const total = visitors.length;
    const thisMonth = visitors.filter(v => v.date && v.date.startsWith(currentMonthStr)).length;
    return { total, thisMonth };
  }, [visitors]);

  const downloadPDF = () => {
    const doc = new jsPDF();
    const now = new Date();

    // Header Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93); // church-navy
    doc.text('Relatório de Visitantes', 105, 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('AD Boas Novas - Tenda da Promessa', 105, 25, { align: 'center' });

    let filterText = `Total de registros: ${filteredVisitors.length}`;
    if (startDate || endDate) {
      filterText += ` | Período: ${startDate ? format(new Date(startDate + 'T00:00:00'), 'dd/MM/yyyy') : 'Início'} a ${endDate ? format(new Date(endDate + 'T00:00:00'), 'dd/MM/yyyy') : 'Hoje'}`;
    }
    doc.text(filterText, 105, 31, { align: 'center' });
    doc.text(`Gerado em: ${format(now, 'dd/MM/yyyy HH:mm')}`, 105, 37, { align: 'center' });

    autoTable(doc, {
      startY: 44,
      head: [['Data', 'Nome do Visitante', 'Telefone / WhatsApp', 'Endereço', 'Observações']],
      body: filteredVisitors.map(v => [
        v.date ? format(new Date(v.date + 'T00:00:00'), 'dd/MM/yyyy') : '-',
        v.name,
        v.phone || '-',
        v.address || '-',
        v.observations || '-'
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [26, 54, 93], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { fontStyle: 'bold', cellWidth: 45 },
        2: { cellWidth: 35 },
        3: { cellWidth: 40 },
        4: { cellWidth: 'auto' }
      }
    });

    const dateSuffix = startDate ? `_${startDate}_a_${endDate || 'hoje'}` : '';
    doc.save(`Relatorio_Visitantes${dateSuffix}.pdf`);
  };

  return (
    <div className="space-y-8 p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-black text-church-navy">Gestão de Visitantes</h1>
          <p className="text-church-navy/60">Acompanhamento e registro de visitas na igreja</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={downloadPDF}
            className="flex items-center gap-2 rounded-xl border border-church-navy/20 bg-church-navy px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-church-navy/90 active:scale-95"
          >
            <Download className="h-4 w-4 text-church-gold" /> Exportar PDF
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-church-gold px-6 py-3 text-sm font-bold text-church-navy shadow-md transition-all hover:bg-church-gold/90 active:scale-95"
          >
            <UserPlus className="h-4 w-4" /> Cadastrar Visitante
          </button>
        </div>
      </header>

      {/* Cards de Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-church-navy/5 text-church-navy">
            <Users className="h-6 w-6 text-church-gold" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-church-navy/40">Total de Visitantes</p>
            <p className="text-2xl font-black text-church-navy mt-1">{stats.total}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-church-navy/40">Visitantes Este Mês</p>
            <p className="text-2xl font-black text-green-700 mt-1">{stats.thisMonth}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <Filter className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-church-navy/40">Exibidos pelo Filtro</p>
            <p className="text-2xl font-black text-blue-700 mt-1">{filteredVisitors.length}</p>
          </div>
        </div>
      </div>

      {/* Seção de Filtros */}
      <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-church-gold/10 pb-3">
          <span className="text-sm font-bold text-church-navy flex items-center gap-2">
            <Filter className="h-4 w-4 text-church-gold" /> Filtros e Busca
          </span>
          {(searchTerm || startDate || endDate) && (
            <button 
              onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
              className="text-xs text-red-600 hover:underline flex items-center gap-1 font-bold"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-church-navy/40" />
            <input 
              type="text"
              placeholder="Buscar por nome, telefone, endereço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-church-gold/20 bg-white pl-10 pr-4 py-2.5 text-sm font-medium text-church-navy placeholder:text-church-navy/30 focus:outline-none focus:ring-2 focus:ring-church-gold/30"
            />
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

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-bold">
          {error}
        </div>
      )}

      {/* Tabela Formatada e Espaçosa */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-church-gold" />
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-church-gold/10 overflow-hidden shadow-sm">
          {filteredVisitors.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="mx-auto h-12 w-12 text-church-navy/20" />
              <p className="mt-4 font-bold text-church-navy/60">Nenhum visitante encontrado.</p>
              <p className="text-xs text-church-navy/40 mt-1">Tente ajustar a busca ou cadastrar um novo visitante.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-church-navy text-white text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Visitante</th>
                    <th className="px-6 py-4">Telefone</th>
                    <th className="px-6 py-4">Endereço</th>
                    <th className="px-6 py-4">Observações</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-church-gold/10 text-sm text-church-navy">
                  {filteredVisitors.map(v => (
                    <tr key={v.id} className="hover:bg-church-navy/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-church-navy/70">
                        {v.date ? format(new Date(v.date + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4 font-bold text-church-navy">
                        {v.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-church-navy/80 font-medium">
                        {v.phone ? (
                          <a 
                            href={`https://wa.me/55${v.phone.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-green-700 hover:underline font-semibold"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {v.phone}
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-church-navy/80 max-w-xs truncate">
                        {v.address ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-church-navy/40 shrink-0" />
                            {v.address}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-church-navy/80 max-w-sm truncate">
                        {v.observations || '-'}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button 
                          onClick={() => handleDelete(v.id)} 
                          className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                          title="Excluir Visitante"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Cadastro */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-church-navy/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-church-gold/20 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-church-gold/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-church-navy/10 text-church-navy">
                    <UserPlus className="h-5 w-5 text-church-gold" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-serif text-church-navy">Cadastrar Visitante</h2>
                    <p className="text-xs text-church-navy/60">Preencha as informações do visitante</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl p-2 text-church-navy/40 hover:bg-church-navy/5 hover:text-church-navy transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Nome Completo *</label>
                  <input 
                    required 
                    placeholder="Ex: João da Silva" 
                    className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-medium text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Telefone / WhatsApp *</label>
                    <input 
                      required 
                      placeholder="(11) 99999-9999" 
                      className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-medium text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                      value={formData.phone} 
                      onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Data da Visita *</label>
                    <input 
                      required 
                      type="date" 
                      className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-bold text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                      value={formData.date} 
                      onChange={(e) => setFormData({...formData, date: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Endereço</label>
                  <input 
                    placeholder="Rua, Número, Bairro" 
                    className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-medium text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                    value={formData.address} 
                    onChange={(e) => setFormData({...formData, address: e.target.value})} 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-church-navy uppercase tracking-wider">Observações / Motivo da Visita</label>
                  <textarea 
                    rows={3} 
                    placeholder="Ex: Veio acompanhado da família, pediu oração..." 
                    className="w-full rounded-xl border border-church-gold/30 px-4 py-3 text-sm font-medium text-church-navy focus:outline-none focus:ring-2 focus:ring-church-gold/40" 
                    value={formData.observations} 
                    onChange={(e) => setFormData({...formData, observations: e.target.value})} 
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="flex-1 rounded-xl border border-church-navy/10 px-4 py-3 text-sm font-bold text-church-navy hover:bg-church-navy/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 rounded-xl bg-church-navy px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-church-navy/90 transition-colors"
                  >
                    Salvar Visitante
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão */}
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
                <h2 className="text-lg font-bold text-church-navy">Excluir Visitante?</h2>
                <p className="text-xs text-church-navy/60 mt-1">Esta ação removerá o registro do visitante permanentemente.</p>
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


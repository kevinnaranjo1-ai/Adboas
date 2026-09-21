import React, { useState, useEffect } from 'react';
import { 
  DollarSign, ArrowUpRight, ArrowDownLeft, Plus, 
  Search, Calendar, Filter, X, Loader2, 
  Users, CreditCard, Wallet, FileText, Download, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, serverTimestamp, Timestamp, deleteDoc, doc
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  personName?: string;
  paymentMethod: 'pix' | 'dinheiro' | 'outros';
  description?: string;
  date: string;
  createdAt: Timestamp;
}

interface FinanceManagementProps {
  role: string | null;
}

export default function FinanceManagement({ role }: FinanceManagementProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  
  // Date and filter states
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [customPreviousBalance, setCustomPreviousBalance] = useState<string>('');
  const [isManualBalance, setIsManualBalance] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    personName: '',
    paymentMethod: 'pix' as 'pix' | 'dinheiro',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const [transactionToDeleteId, setTransactionToDeleteId] = useState<string | null>(null);

  const isAdminOnly = role === 'admin' || role === 'pastor' || role === 'pastora' || auth.currentUser?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com';

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'transactions'), {
        ...formData,
        type: modalType,
        amount: parseFloat(formData.amount),
        createdAt: serverTimestamp()
      });
      setModalOpen(false);
      setFormData({
        category: '',
        amount: '',
        personName: '',
        paymentMethod: 'pix',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    }
  };

  // Calculate Saldo Anterior (Previous Balance) from records prior to filterStartDate
  const calculatedPreviousBalance = React.useMemo(() => {
    if (!filterStartDate) return 0;
    return transactions
      .filter(t => t.date < filterStartDate)
      .reduce((acc, t) => {
        return t.type === 'income' ? acc + t.amount : acc - t.amount;
      }, 0);
  }, [transactions, filterStartDate]);

  const effectivePreviousBalance = isManualBalance && customPreviousBalance !== ''
    ? (parseFloat(customPreviousBalance) || 0)
    : calculatedPreviousBalance;

  // Filtered transactions for the selected period
  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(t => {
      if (filterStartDate && t.date < filterStartDate) return false;
      if (filterEndDate && t.date > filterEndDate) return false;
      if (filterCategory && t.category !== filterCategory) return false;
      if (filterSearch) {
        const term = filterSearch.toLowerCase();
        const matchPerson = (t.personName || '').toLowerCase().includes(term);
        const matchCategory = (t.category || '').toLowerCase().includes(term);
        const matchDesc = (t.description || '').toLowerCase().includes(term);
        if (!matchPerson && !matchCategory && !matchDesc) return false;
      }
      return true;
    });
  }, [transactions, filterStartDate, filterEndDate, filterCategory, filterSearch]);

  // Period totals
  const periodTotals = React.useMemo(() => {
    return filteredTransactions.reduce((acc, curr) => {
      if (curr.type === 'income') acc.income += curr.amount;
      else acc.expense += curr.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTransactions]);

  const periodBalance = periodTotals.income - periodTotals.expense;
  const finalBalance = effectivePreviousBalance + periodBalance;

  // Preset quick filter handlers
  const handlePresetThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setFilterStartDate(format(start, 'yyyy-MM-dd'));
    setFilterEndDate(format(end, 'yyyy-MM-dd'));
  };

  const handlePresetLastMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    setFilterStartDate(format(start, 'yyyy-MM-dd'));
    setFilterEndDate(format(end, 'yyyy-MM-dd'));
  };

  const handleClearFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterCategory('');
    setFilterSearch('');
    setCustomPreviousBalance('');
    setIsManualBalance(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(26, 54, 93); // church-navy
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório Financeiro', 105, 18, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('AD Boas Novas - Tenda da Promessa', 105, 25, { align: 'center' });
    
    // Period text
    let periodText = 'Período: Geral (Todas as transações)';
    if (filterStartDate && filterEndDate) {
      periodText = `Período: ${format(new Date(filterStartDate + 'T00:00:00'), 'dd/MM/yyyy')} a ${format(new Date(filterEndDate + 'T00:00:00'), 'dd/MM/yyyy')}`;
    } else if (filterStartDate) {
      periodText = `Período: A partir de ${format(new Date(filterStartDate + 'T00:00:00'), 'dd/MM/yyyy')}`;
    } else if (filterEndDate) {
      periodText = `Período: Até ${format(new Date(filterEndDate + 'T00:00:00'), 'dd/MM/yyyy')}`;
    }
    doc.text(periodText, 105, 31, { align: 'center' });
    doc.text(`Gerado em: ${format(now, 'dd/MM/yyyy HH:mm')}`, 105, 37, { align: 'center' });

    // Summary Box / Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93);
    doc.text('Resumo Financeiro do Período', 14, 47);

    const summaryRows = [
      ['Saldo Anterior:', effectivePreviousBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
      ['(+) Total de Entradas no Período:', periodTotals.income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
      ['(-) Total de Saídas no Período:', periodTotals.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
      ['(=) Resultado do Período:', periodBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
      ['(=) Saldo Final em Caixa:', finalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]
    ];

    autoTable(doc, {
      startY: 52,
      head: [['Indicador', 'Valor']],
      body: summaryRows,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [26, 54, 93], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 120 },
        1: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.row.index === 0) {
            data.cell.styles.textColor = [100, 116, 139]; // slate-500
          } else if (data.row.index === 1) {
            data.cell.styles.textColor = [22, 163, 74]; // green-600
          } else if (data.row.index === 2) {
            data.cell.styles.textColor = [217, 119, 6]; // amber-600
          } else if (data.row.index === 4) {
            data.cell.styles.fillColor = [241, 245, 249]; // slate-100
            data.cell.styles.textColor = [26, 54, 93];
          }
        }
      }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 8;

    // Resumo por Categorias
    const categoryTotals: Record<string, { income: number, expense: number }> = {};
    filteredTransactions.forEach(t => {
      if (!categoryTotals[t.category]) categoryTotals[t.category] = { income: 0, expense: 0 };
      if (t.type === 'income') categoryTotals[t.category].income += t.amount;
      else categoryTotals[t.category].expense += t.amount;
    });

    const categoryData = Object.entries(categoryTotals).map(([cat, vals]) => [
      cat,
      vals.income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      vals.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);

    if (categoryData.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 54, 93);
      doc.text('Totais por Categoria (Período)', 14, currentY);

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Categoria', 'Soma Entradas', 'Soma Saídas']],
        body: categoryData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [26, 54, 93], textColor: [255, 255, 255] },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' }
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Detalhamento das Transações
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93);
    doc.text(`Transações do Período (${filteredTransactions.length} registros)`, 14, currentY);

    const tableData = filteredTransactions.map(t => [
      format(new Date(t.date + 'T00:00:00'), 'dd/MM/yyyy'),
      t.personName || 'Caixa Geral',
      t.category,
      t.paymentMethod.toUpperCase(),
      t.type === 'income' ? `+ ${t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : `- ${t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [['Data', 'Pessoa / Referência', 'Categoria', 'Método', 'Valor']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [26, 54, 93], textColor: [255, 255, 255] },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const val = String(data.cell.text[0] || '');
          if (val.startsWith('+')) data.cell.styles.textColor = [22, 163, 74];
          else data.cell.styles.textColor = [217, 119, 6];
        }
      }
    });

    const fileNameDate = filterStartDate ? `_${filterStartDate}_a_${filterEndDate || 'hoje'}` : `_${format(now, 'yyyy_MM_dd')}`;
    doc.save(`Relatorio_Financeiro${fileNameDate}.pdf`);
  };

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-black text-church-navy">Gestão Financeira</h1>
          <p className="text-church-navy/60">Controle de dízimos, ofertas e despesas com relatórios em PDF</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 rounded-xl border border-church-navy/20 bg-church-navy px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-church-navy/90 active:scale-95"
          >
            <Download className="h-4 w-4 text-church-gold" /> Baixar PDF Filtrado
          </button>
          <button 
            onClick={() => { setModalType('income'); setModalOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Entrada
          </button>
          <button 
            onClick={() => { setModalType('expense'); setModalOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Saída
          </button>
        </div>
      </header>

      {/* Painel de Filtros e Saldo Anterior */}
      <section className="rounded-3xl border border-church-gold/20 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-church-gold/10 pb-4">
          <div className="flex items-center gap-2 text-church-navy font-bold text-base">
            <Filter className="h-5 w-5 text-church-gold" />
            <span>Filtros do Relatório Financeiro</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="text-church-navy/60">Atalhos de Período:</span>
            <button 
              type="button" 
              onClick={handlePresetThisMonth}
              className="rounded-lg bg-church-navy/5 px-3 py-1.5 text-church-navy hover:bg-church-navy/10 transition-colors"
            >
              Este Mês
            </button>
            <button 
              type="button" 
              onClick={handlePresetLastMonth}
              className="rounded-lg bg-church-navy/5 px-3 py-1.5 text-church-navy hover:bg-church-navy/10 transition-colors"
            >
              Mês Anterior
            </button>
            {(filterStartDate || filterEndDate || filterCategory || filterSearch || isManualBalance) && (
              <button 
                type="button" 
                onClick={handleClearFilters}
                className="rounded-lg bg-red-50 text-red-600 px-3 py-1.5 hover:bg-red-100 transition-colors flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" /> Limpar Filtros
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-church-navy/60 tracking-wider flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Data Inicial
            </label>
            <input 
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full rounded-xl border border-church-gold/20 px-3 py-2 text-sm font-bold text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-church-navy/60 tracking-wider flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Data Final
            </label>
            <input 
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full rounded-xl border border-church-gold/20 px-3 py-2 text-sm font-bold text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-church-navy/60 tracking-wider">Categoria</label>
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full rounded-xl border border-church-gold/20 px-3 py-2 text-sm font-bold text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none appearance-none bg-white"
            >
              <option value="">Todas as Categorias</option>
              <option value="Dízimo">Dízimo</option>
              <option value="Oferta">Oferta</option>
              <option value="Doação">Doação</option>
              <option value="Evento">Evento</option>
              <option value="Água/Luz">Água / Luz</option>
              <option value="Aluguel">Aluguel</option>
              <option value="Manutenção">Manutenção</option>
              <option value="Missões">Missões</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-church-navy/60 tracking-wider flex items-center gap-1">
              <Search className="h-3.5 w-3.5" /> Buscar
            </label>
            <input 
              type="text"
              placeholder="Pessoa, ref ou descrição..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full rounded-xl border border-church-gold/20 px-3 py-2 text-sm font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
            />
          </div>
        </div>

        {/* Campo de Ajuste do Saldo Anterior */}
        <div className="pt-2 border-t border-church-gold/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox"
              id="toggleManualBalance"
              checked={isManualBalance}
              onChange={(e) => setIsManualBalance(e.target.checked)}
              className="h-4 w-4 rounded border-church-gold/30 text-church-navy focus:ring-church-gold cursor-pointer"
            />
            <label htmlFor="toggleManualBalance" className="text-xs font-bold text-church-navy cursor-pointer">
              Informar Saldo Anterior manualmente (Substituir cálculo automático)
            </label>
          </div>

          {isManualBalance ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-church-navy/60">R$ Saldo Anterior:</span>
              <input 
                type="number"
                step="0.01"
                placeholder="0.00"
                value={customPreviousBalance}
                onChange={(e) => setCustomPreviousBalance(e.target.value)}
                className="w-36 rounded-lg border border-church-gold/30 px-3 py-1 text-sm font-bold text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
              />
            </div>
          ) : (
            <div className="text-xs text-church-navy/60">
              <span className="font-bold text-church-navy">Saldo Anterior Calculado:</span>{' '}
              {filterStartDate ? (
                <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                  {calculatedPreviousBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  <span className="text-[10px] text-blue-500 font-normal ml-1">(acumulado antes de {format(new Date(filterStartDate + 'T00:00:00'), 'dd/MM/yyyy')})</span>
                </span>
              ) : (
                <span className="italic">Defina uma "Data Inicial" para calcular o saldo acumulado anterior</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Cards de Resumo do Período */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Wallet className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-church-navy/40">Saldo Anterior</p>
          <p className="text-2xl font-black text-church-navy mt-1">
            {effectivePreviousBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600">
            <ArrowUpRight className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-church-navy/40">Entradas (Período)</p>
          <p className="text-2xl font-black text-green-600 mt-1">
            {periodTotals.income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <ArrowDownLeft className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-church-navy/40">Saídas (Período)</p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {periodTotals.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        <div className="rounded-3xl border border-church-navy/5 bg-church-navy p-6 shadow-xl text-white">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-church-gold">
            <DollarSign className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/40">Saldo Final Acumulado</p>
          <p className="text-2xl font-black text-white mt-1">
            {finalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      {/* Tabela de Transações Filtradas */}
      <section className="rounded-3xl border border-church-gold/10 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-church-gold/5 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold text-church-navy">Transações do Período</h2>
            <p className="text-xs text-church-navy/50">
              Exibindo {filteredTransactions.length} de {transactions.length} registros no total
            </p>
          </div>
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 rounded-xl bg-church-navy/5 px-4 py-2 text-xs font-bold text-church-navy hover:bg-church-navy/10 transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-church-gold" /> Baixar PDF
          </button>
        </div>
        
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-church-gold" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-church-navy/10" />
            <p className="mt-4 text-church-navy/40">Nenhuma transação encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-church-navy/5 text-[10px] font-bold uppercase tracking-widest text-church-navy/40">
                  <th className="px-8 py-4">Data</th>
                  <th className="px-8 py-4">Descrição / Pessoa</th>
                  <th className="px-8 py-4">Categoria</th>
                  <th className="px-8 py-4">Método</th>
                  <th className="px-8 py-4 text-right">Valor</th>
                  {isAdminOnly && <th className="px-8 py-4 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-church-gold/5">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-church-navy/5 transition-colors">
                    <td className="px-8 py-4">
                      <p className="font-bold text-church-navy">{format(new Date(tx.date + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                    </td>
                    <td className="px-8 py-4">
                      <p className="font-bold text-church-navy">{tx.personName || 'Caixa Geral'}</p>
                      {tx.description && <p className="text-xs text-church-navy/40">{tx.description}</p>}
                    </td>
                    <td className="px-8 py-4">
                      <span className="rounded-full bg-church-navy/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-church-navy/60">
                        {tx.category}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-church-navy/60">
                        {tx.paymentMethod === 'pix' ? <CreditCard className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
                        <span className="uppercase">{tx.paymentMethod}</span>
                      </div>
                    </td>
                    <td className={`px-8 py-4 text-right font-black ${tx.type === 'income' ? 'text-green-600' : 'text-amber-600'}`}>
                      {tx.type === 'income' ? '+' : '-'} {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    {isAdminOnly && (
                      <td className="px-8 py-4 text-center">
                        <button
                          onClick={() => {
                            if (!isAdminOnly) {
                              alert("Apenas administradores podem excluir registros do financeiro.");
                              return;
                            }
                            setTransactionToDeleteId(tx.id);
                          }}
                          className="p-2 rounded-full hover:bg-red-50 text-red-500 transition-colors"
                          title="Excluir Registro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal de Transação */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-church-navy/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
            >
              <div className={`${modalType === 'income' ? 'bg-green-600' : 'bg-amber-600'} p-6 flex items-center justify-between shrink-0`}>
                <h2 className="font-serif text-xl font-bold text-white">
                  {modalType === 'income' ? 'Registrar Entrada' : 'Registrar Saída'}
                </h2>
                <button onClick={() => setModalOpen(false)} className="text-white/60 hover:text-white">
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 overflow-y-auto">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-church-navy/60 tracking-widest">Valor (R$)</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 text-xl font-bold text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-church-navy/60 tracking-widest">Data</label>
                    <input 
                      required
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-bold text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-church-navy/60 tracking-widest">Categoria</label>
                  <select 
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-bold text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none appearance-none"
                  >
                    <option value="">Selecione uma categoria</option>
                    {modalType === 'income' ? (
                      <>
                        <option value="Dízimo">Dízimo</option>
                        <option value="Oferta">Oferta</option>
                        <option value="Doação">Doação</option>
                        <option value="Evento">Evento</option>
                        <option value="Outros">Outros</option>
                      </>
                    ) : (
                      <>
                        <option value="Água/Luz">Água / Luz</option>
                        <option value="Aluguel">Aluguel</option>
                        <option value="Manutenção">Manutenção</option>
                        <option value="Missões">Missões</option>
                        <option value="Outros">Outros</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-church-navy/60 tracking-widest">Nome da Pessoa / Fornecedor</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-church-navy/20" />
                    <input 
                      type="text"
                      placeholder="Ex: João Silva ou Supermercado"
                      value={formData.personName}
                      onChange={(e) => setFormData({...formData, personName: e.target.value})}
                      className="w-full rounded-xl border border-church-gold/20 pl-11 pr-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-church-navy/60 tracking-widest">Método de Pgto</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, paymentMethod: 'pix'})}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-4 transition-all ${
                        formData.paymentMethod === 'pix' 
                          ? 'border-church-navy bg-church-navy text-white' 
                          : 'border-church-gold/20 bg-transparent text-church-navy/60 hover:bg-church-navy/5'
                      }`}
                    >
                      <CreditCard className="h-4 w-4" />
                      <span className="text-sm font-bold">PIX</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, paymentMethod: 'dinheiro'})}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-4 transition-all ${
                        formData.paymentMethod === 'dinheiro' 
                          ? 'border-church-navy bg-church-navy text-white' 
                          : 'border-church-gold/20 bg-transparent text-church-navy/60 hover:bg-church-navy/5'
                      }`}
                    >
                      <Wallet className="h-4 w-4" />
                      <span className="text-sm font-bold">Dinheiro</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-church-navy/60 tracking-widest">Observações (Opcional)</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none resize-none h-24"
                  />
                </div>

                <button 
                  type="submit"
                  className={`w-full rounded-2xl py-4 font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-95 ${
                    modalType === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  Salvar Registro
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={transactionToDeleteId !== null}
        onClose={() => setTransactionToDeleteId(null)}
        onConfirm={async () => {
          if (transactionToDeleteId) {
            await handleDeleteTransaction(transactionToDeleteId);
          }
        }}
        title="Excluir Transação"
        message="Tem certeza que deseja excluir esta transação? Os dados do fluxo de caixa e relatórios serão atualizados imediatamente."
      />
    </div>
  );
}

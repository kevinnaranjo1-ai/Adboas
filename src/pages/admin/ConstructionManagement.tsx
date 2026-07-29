import React, { useState, useEffect, useMemo } from 'react';
import { 
  Hammer, ShoppingCart, BarChart3, Package, Plus, 
  Trash2, Edit2, Search, Filter, Loader2, 
  CheckCircle2, AlertCircle, TrendingDown, TrendingUp,
  DollarSign, HardHat, Calendar, Layers, Download
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, deleteDoc, updateDoc, doc, 
  serverTimestamp, Timestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthState } from 'react-firebase-hooks/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';

interface ConstructionItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  category: string;
  date: string;
}

interface Asset {
  id: string;
  name: string;
  quantity: number;
  condition: string;
  location: string;
  lastInventoryDate: string;
}

interface ConstructionPageProps {
  role?: string | null;
}

export default function ConstructionManagement({ role }: ConstructionPageProps) {
  const [user] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<'purchases' | 'balance' | 'inventory'>('purchases');
  const [purchases, setPurchases] = useState<ConstructionItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'purchase' | 'asset'>('purchase');
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'purchase' | 'asset' } | null>(null);

  const isPastorAdmin = useMemo(() => {
    return (role && ['admin', 'pastor', 'pastora'].includes(role)) || 
           user?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com';
  }, [role, user]);

  const [purchaseForm, setPurchaseForm] = useState({
    name: '',
    quantity: 1,
    unit: 'un',
    unitPrice: 0,
    category: 'Material de Construção',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const [assetForm, setAssetForm] = useState({
    name: '',
    quantity: 0,
    condition: 'Novo',
    location: 'Templo Sede',
    lastInventoryDate: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    const qPurchases = query(collection(db, 'construction_items'), orderBy('date', 'desc'));
    const unsubscribePurchases = onSnapshot(qPurchases, (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ConstructionItem[]);
    });

    const qAssets = query(collection(db, 'assets'), orderBy('name', 'asc'));
    const unsubscribeAssets = onSnapshot(qAssets, (snapshot) => {
      setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Asset[]);
      setLoading(false);
    });

    return () => {
      unsubscribePurchases();
      unsubscribeAssets();
    };
  }, []);

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPastorAdmin) return;
    try {
      const totalPrice = purchaseForm.quantity * purchaseForm.unitPrice;
      await addDoc(collection(db, 'construction_items'), {
        ...purchaseForm,
        totalPrice,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setPurchaseForm({
        name: '',
        quantity: 1,
        unit: 'un',
        unitPrice: 0,
        category: 'Material de Construção',
        date: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'construction_items');
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPastorAdmin) return;
    try {
      await addDoc(collection(db, 'assets'), {
        ...assetForm,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setAssetForm({
        name: '',
        quantity: 0,
        condition: 'Novo',
        location: 'Templo Sede',
        lastInventoryDate: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assets');
    }
  };

  const handleDeleteItem = async (id: string, type: 'purchase' | 'asset') => {
    if (!isPastorAdmin) return;
    try {
      await deleteDoc(doc(db, type === 'purchase' ? 'construction_items' : 'assets', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${type}/${id}`);
    }
  };

  const totalInvestment = purchases.reduce((acc, curr) => acc + curr.totalPrice, 0);
  const purchasesByCategory = purchases.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.totalPrice;
    return acc;
  }, {} as Record<string, number>);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // church-navy
    doc.text('Relatório de Construção e Compras', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, 28, { align: 'center' });

    // Summary Section
    doc.setFontSize(16);
    doc.setTextColor(184, 150, 87); // church-gold
    doc.text('Resumo Financeiro', 14, 45);

    autoTable(doc, {
      startY: 50,
      head: [['Descrição', 'Valor']],
      body: [
        ['Investimento Total', `R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(totalInvestment)}`],
        ['Materiais de Construção', `R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(purchasesByCategory['Material de Construção'] || 0)}`],
        ['Mão de Obra', `R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(purchasesByCategory['Mão de Obra'] || 0)}`],
        ['Mobília/Equipamentos', `R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format((purchasesByCategory['Mobília'] || 0) + (purchasesByCategory['Equipamentos'] || 0))}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
    });

    // Purchases Table
    doc.setFontSize(16);
    doc.text('Histórico de Compras', 14, (doc as any).lastAutoTable.finalY + 15);

    const purchaseRows = purchases.map(p => [
      format(new Date(p.date + 'T00:00:00'), 'dd/MM/yyyy'),
      p.name,
      `${p.quantity} ${p.unit}`,
      p.category,
      `R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(p.totalPrice)}`
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Data', 'Item', 'Qtd', 'Categoria', 'Total']],
      body: purchaseRows,
      headStyles: { fillColor: [15, 23, 42] },
    });

    // Inventory Table
    if (assets.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Inventário de Ativos', 14, 20);

      const assetRows = assets.map(a => [
        a.name,
        a.quantity.toString(),
        a.condition,
        a.location
      ]);

      autoTable(doc, {
        startY: 25,
        head: [['Ativo', 'Qtd', 'Estado', 'Localização']],
        body: assetRows,
        headStyles: { fillColor: [15, 23, 42] },
      });
    }

    doc.save(`Relatorio_Obra_Igreja_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
        <div>
          <h1 className="font-serif text-3xl font-black text-church-navy">Construção & Compras</h1>
          <p className="text-church-navy/60">Gestão de reformas, materiais e patrimônio</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 rounded-xl border border-church-navy/10 bg-white px-6 py-4 text-sm font-bold text-church-navy shadow-sm transition-all hover:bg-church-navy/5 active:scale-95"
          >
            <Download className="h-4 w-4" /> Baixar PDF
          </button>
          {isPastorAdmin && (
            <button 
              onClick={() => {
                setModalMode(activeTab === 'inventory' ? 'asset' : 'purchase');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-church-navy px-6 py-4 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="h-4 w-4" /> {activeTab === 'inventory' ? 'Novo Ativo' : 'Nova Compra'}
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button 
          onClick={() => setActiveTab('purchases')}
          className={`flex items-center gap-2 whitespace-nowrap rounded-2xl px-6 py-3 text-sm font-bold transition-all ${activeTab === 'purchases' ? 'bg-church-navy text-white shadow-md' : 'bg-white text-church-navy/60 hover:bg-church-navy/5'}`}
        >
          <ShoppingCart className="h-4 w-4" /> Compras e Materiais
        </button>
        <button 
          onClick={() => setActiveTab('balance')}
          className={`flex items-center gap-2 whitespace-nowrap rounded-2xl px-6 py-3 text-sm font-bold transition-all ${activeTab === 'balance' ? 'bg-church-navy text-white shadow-md' : 'bg-white text-church-navy/60 hover:bg-church-navy/5'}`}
        >
          <BarChart3 className="h-4 w-4" /> Balanço da Obra
        </button>
        <button 
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 whitespace-nowrap rounded-2xl px-6 py-3 text-sm font-bold transition-all ${activeTab === 'inventory' ? 'bg-church-navy text-white shadow-md' : 'bg-white text-church-navy/60 hover:bg-church-navy/5'}`}
        >
          <Package className="h-4 w-4" /> Inventário de Ativos
        </button>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-church-gold" />
          </div>
        ) : activeTab === 'purchases' ? (
          <div className="rounded-3xl border border-church-gold/10 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-church-gold/5 px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="font-serif text-xl font-bold text-church-navy">Registro de Compras</h2>
              <div className="flex items-center gap-2 px-4 py-2 bg-church-navy/5 rounded-xl border border-church-gold/10">
                <Search className="h-4 w-4 text-church-navy/40" />
                <input 
                  type="text" 
                  placeholder="Buscar materiais..." 
                  className="bg-transparent border-none text-sm font-medium text-church-navy focus:ring-0 outline-none w-48"
                />
              </div>
            </div>
            {purchases.length === 0 ? (
              <div className="p-20 text-center text-church-navy/20">
                <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-10" />
                <p className="font-bold">Nenhuma compra registrada.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-church-navy/5 text-[10px] font-bold uppercase tracking-widest text-church-navy/40">
                      <th className="px-8 py-4">Data</th>
                      <th className="px-8 py-4">Item</th>
                      <th className="px-8 py-4">Qtd / Un</th>
                      <th className="px-8 py-4">Categoria</th>
                      <th className="px-8 py-4 text-right">Total</th>
                      {isPastorAdmin && <th className="px-8 py-4"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-church-gold/5">
                    {purchases.map(item => (
                      <tr key={item.id} className="hover:bg-church-navy/5 transition-colors">
                        <td className="px-8 py-4 text-sm font-bold text-church-navy">
                          {format(new Date(item.date + 'T00:00:00'), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-8 py-4">
                          <p className="font-bold text-church-navy">{item.name}</p>
                          <p className="text-[10px] text-church-navy/40">Unit: R$ {item.unitPrice.toFixed(2)}</p>
                        </td>
                        <td className="px-8 py-4 text-sm font-medium text-church-navy/60">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-8 py-4">
                          <span className="rounded-full bg-church-navy/5 px-3 py-1 text-[10px] font-bold uppercase text-church-navy/60">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-right font-black text-church-navy">
                          R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(item.totalPrice)}
                        </td>
                        {isPastorAdmin && (
                          <td className="px-8 py-4 text-right">
                            <button 
                              onClick={() => setItemToDelete({ id: item.id, type: 'purchase' })}
                              className="text-red-400 hover:text-red-600 transition-colors p-2"
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
          </div>
        ) : activeTab === 'balance' ? (
          <div className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-3xl border border-church-gold/10 bg-white p-8 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-church-navy/5 text-church-navy">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-church-navy/40">Investimento Total</p>
                <p className="text-3xl font-black text-church-navy">
                  R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(totalInvestment)}
                </p>
              </div>
              <div className="rounded-3xl border border-church-gold/10 bg-white p-8 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-church-gold/10 text-church-gold">
                  <HardHat className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-church-navy/40">Materiais</p>
                <p className="text-3xl font-black text-church-navy">
                  R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(purchasesByCategory['Material de Construção'] || 0)}
                </p>
              </div>
              <div className="rounded-3xl border border-church-gold/10 bg-white p-8 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Hammer className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-church-navy/40">Mão de Obra</p>
                <p className="text-3xl font-black text-church-navy">
                  R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(purchasesByCategory['Mão de Obra'] || 0)}
                </p>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-3xl border border-church-gold/10 bg-white p-8 shadow-sm">
                <h3 className="font-serif text-xl font-bold text-church-navy mb-6">Investimento por Categoria</h3>
                <div className="space-y-4">
                  {(Object.entries(purchasesByCategory) as [string, number][]).map(([cat, val]) => {
                    const percentage = totalInvestment > 0 ? (val / totalInvestment) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-2">
                        <div className="flex justify-between text-sm font-bold text-church-navy">
                          <span>{cat}</span>
                          <span>{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-church-navy/5 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            className="h-full bg-church-gold"
                          />
                        </div>
                        <p className="text-right text-[10px] font-bold text-church-navy/40">
                          R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(val)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-3xl border border-church-gold/10 bg-white p-8 shadow-sm">
                <h3 className="font-serif text-xl font-bold text-church-navy mb-6">Resumo de Ativos</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 rounded-2xl bg-church-navy/5 border border-church-gold/10">
                    <p className="text-[10px] font-bold uppercase text-church-navy/40">Total de Cadeiras</p>
                    <p className="text-4xl font-black text-church-navy">
                      {assets.filter(a => a.name.toLowerCase().includes('cadeira')).reduce((acc, c) => acc + c.quantity, 0)}
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl bg-church-navy/5 border border-church-gold/10">
                    <p className="text-[10px] font-bold uppercase text-church-navy/40">Total de Ativos</p>
                    <p className="text-4xl font-black text-church-navy">{assets.length}</p>
                  </div>
                </div>
                <div className="mt-8 flex items-center gap-4 p-4 rounded-xl bg-church-gold/5 border border-church-gold/20">
                  <AlertCircle className="h-5 w-5 text-church-gold shrink-0" />
                  <p className="text-xs text-church-navy/70 leading-relaxed font-medium">
                    O balanço da obra é gerado automaticamente com base nos registros de compras e serviços lançados no sistema.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {assets.length === 0 ? (
              <div className="col-span-full p-20 text-center text-church-navy/20 bg-white rounded-3xl border border-church-gold/10">
                <Package className="h-16 w-16 mx-auto mb-4 opacity-10" />
                <p className="font-bold">Nenhum ativo registrado.</p>
              </div>
            ) : (
              assets.map(asset => (
                <div key={asset.id} className="group relative rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-xl bg-church-navy/5 flex items-center justify-center text-church-navy">
                      <Package className="h-6 w-6" />
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                      asset.condition === 'Novo' ? 'bg-green-50 text-green-600' :
                      asset.condition === 'Bom' ? 'bg-blue-50 text-blue-600' :
                      asset.condition === 'Regular' ? 'bg-amber-50 text-amber-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {asset.condition}
                    </span>
                  </div>
                  <h4 className="font-bold text-church-navy">{asset.name}</h4>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-church-navy/30">Quantidade</p>
                      <p className="text-2xl font-black text-church-navy">{asset.quantity}</p>
                    </div>
                    {isPastorAdmin && (
                      <button 
                        onClick={() => setItemToDelete({ id: asset.id, type: 'asset' })}
                        className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-church-navy/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
            >
              <div className="bg-church-navy p-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    {modalMode === 'purchase' ? <ShoppingCart className="h-5 w-5 text-church-gold" /> : <Package className="h-5 w-5 text-church-gold" />}
                  </div>
                  <h2 className="font-serif text-xl font-bold text-white">
                    {modalMode === 'purchase' ? 'Novo Registro de Compra' : 'Novo Registro de Ativo'}
                  </h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white transition-colors">
                  <Layers className="h-6 w-6" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto">
                {modalMode === 'purchase' ? (
                  <form onSubmit={handleAddPurchase} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Descrição do Item</label>
                      <input 
                        required
                        type="text"
                        placeholder="Ex: Cimento CP-II"
                        value={purchaseForm.name}
                        onChange={e => setPurchaseForm({...purchaseForm, name: e.target.value})}
                        className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                      />
                    </div>
                    
                    <div className="grid gap-6 sm:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Quantidade</label>
                        <input 
                          required
                          type="number"
                          value={purchaseForm.quantity}
                          onChange={e => setPurchaseForm({...purchaseForm, quantity: Number(e.target.value)})}
                          className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Unidade</label>
                        <input 
                          required
                          type="text"
                          placeholder="Ex: sacos, un, kg"
                          value={purchaseForm.unit}
                          onChange={e => setPurchaseForm({...purchaseForm, unit: e.target.value})}
                          className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Preço Unitário</label>
                        <input 
                          required
                          type="number"
                          step="0.01"
                          placeholder="R$ 0,00"
                          value={purchaseForm.unitPrice}
                          onChange={e => setPurchaseForm({...purchaseForm, unitPrice: Number(e.target.value)})}
                          className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Categoria</label>
                        <select 
                          value={purchaseForm.category}
                          onChange={e => setPurchaseForm({...purchaseForm, category: e.target.value})}
                          className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none appearance-none bg-white"
                        >
                          <option value="Material de Construção">Material de Construção</option>
                          <option value="Mão de Obra">Mão de Obra</option>
                          <option value="Mobília">Mobília</option>
                          <option value="Equipamentos">Equipamentos</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Data da Compra</label>
                        <input 
                          required
                          type="date"
                          value={purchaseForm.date}
                          onChange={e => setPurchaseForm({...purchaseForm, date: e.target.value})}
                          className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between border-t border-church-gold/10">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-church-navy/40">Total Calculado</p>
                        <p className="text-2xl font-black text-church-navy">
                          R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(purchaseForm.quantity * purchaseForm.unitPrice)}
                        </p>
                      </div>
                      <button 
                        type="submit"
                        className="rounded-2xl bg-church-navy px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-church-navy/90 active:scale-95"
                      >
                        Confirmar Compra
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleAddAsset} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Nome do Ativo / Patrimônio</label>
                      <input 
                        required
                        type="text"
                        placeholder="Ex: Cadeiras de Auditório"
                        value={assetForm.name}
                        onChange={e => setAssetForm({...assetForm, name: e.target.value})}
                        className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                      />
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Quantidade</label>
                        <input 
                          required
                          type="number"
                          value={assetForm.quantity}
                          onChange={e => setAssetForm({...assetForm, quantity: Number(e.target.value)})}
                          className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Estado de Conservação</label>
                        <select 
                          value={assetForm.condition}
                          onChange={e => setAssetForm({...assetForm, condition: e.target.value})}
                          className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none appearance-none bg-white"
                        >
                          <option value="Novo">Novo</option>
                          <option value="Bom">Bom</option>
                          <option value="Regular">Regular</option>
                          <option value="Precisa de Manutenção">Precisa de Manutenção</option>
                          <option value="Danificado">Danificado</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Localização</label>
                      <input 
                        required
                        type="text"
                        placeholder="Ex: Templo Sede"
                        value={assetForm.location}
                        onChange={e => setAssetForm({...assetForm, location: e.target.value})}
                        className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full rounded-2xl bg-church-navy py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-church-navy/90 active:scale-95"
                    >
                      Registrar Ativo
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={itemToDelete !== null}
        onClose={() => setItemToDelete(null)}
        onConfirm={async () => {
          if (itemToDelete) {
            await handleDeleteItem(itemToDelete.id, itemToDelete.type);
          }
        }}
        title={itemToDelete?.type === 'purchase' ? "Excluir Registro de Compra" : "Excluir Patrimônio"}
        message={itemToDelete?.type === 'purchase' 
          ? "Tem certeza de que deseja excluir este registro de compra? O fluxo financeiro da obra será recalculado." 
          : "Tem certeza de que deseja excluir este patrimônio? As informações do inventário serão removidas."}
      />
    </div>
  );
}

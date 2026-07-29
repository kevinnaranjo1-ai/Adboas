import { useState } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileText, Search, Filter, Calendar, 
  Users, TrendingUp, Download, Eye, AlertCircle,
  UserPlus, Shield, UserMinus, ChevronRight, List, CheckCircle2,
  Trash2, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReportDetailModal from '../components/ReportDetailModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

interface AdminViewProps {
  role?: string | null;
}

export default function AdminView({ role }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'reports' | 'users'>('reports');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [reportToDeleteId, setReportToDeleteId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);

  const [digestMonth, setDigestMonth] = useState(new Date().getMonth() + 1);
  const [digestYear, setDigestYear] = useState(new Date().getFullYear());
  const [generatingDigest, setGeneratingDigest] = useState(false);
  const [forcingUpdate, setForcingUpdate] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const handleForceUpdate = async () => {
    setForcingUpdate(true);
    setUpdateSuccess(false);
    try {
      await setDoc(doc(db, 'settings', 'force_update'), {
        updatedAt: serverTimestamp(),
        triggeredBy: user?.displayName || user?.email || 'admin'
      });
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 4000);
    } catch (error) {
      console.error('Erro ao forçar atualização:', error);
      alert('Erro ao enviar sinal de atualização: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setForcingUpdate(false);
    }
  };

  const getMonthName = (m: number) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[m - 1] || '';
  };

  const [user] = useAuthState(auth);
  const isAdminOnly = role === 'admin' || role === 'pastor' || role === 'pastora' || user?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com';

  // Queries
  const reportsQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
  const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));

  const [reportsValue, reportsLoading, reportsError] = useCollection(reportsQuery);
  const [usersValue, usersLoading, usersError] = useCollection(usersQuery);

  const filteredReports = reportsValue?.docs.filter(doc => {
    const data = doc.data();
    const matchesType = filterType === 'all' || data.type === filterType;
    const matchesSearch = data.enviadoByName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         data.departmentName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const filteredUsers = usersValue?.docs.filter(doc => {
    const data = doc.data();
    return data.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           data.email?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totals = {
    conversions: filteredReports?.reduce((acc, doc) => acc + (doc.data().conversions || 0), 0) || 0,
    baptisms: filteredReports?.reduce((acc, doc) => acc + (doc.data().baptisms || 0), 0) || 0,
    servicesCount: filteredReports?.reduce((acc, doc) => acc + (doc.data().servicesCount || 0), 0) || 0,
    visitsCount: filteredReports?.reduce((acc, doc) => acc + (doc.data().visitsCount || 0), 0) || 0,
    peopleVisitedCount: filteredReports?.reduce((acc, doc) => acc + (doc.data().peopleVisitedCount || 0), 0) || 0,
    reconciliations: filteredReports?.reduce((acc, doc) => acc + (doc.data().reconciliations || 0), 0) || 0,
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        role: newRole,
        updatedAt: serverTimestamp()
      });
      alert('Cargo atualizado com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      alert('Erro ao atualizar cargo.');
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      alert('Relatório excluído com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reports/${reportId}`);
      alert('Erro ao excluir relatório.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      alert('Usuário removido com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
      alert('Erro ao remover usuário.');
    }
  };

  const exportSummaryPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Resumo de Relatórios - AD Boas Novas', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 30, { align: 'center' });

    const tableData = filteredReports?.map(rep => {
      const d = rep.data();
      return [
        format(new Date(d.year, d.month - 1), 'MMMM yyyy', { locale: ptBR }),
        d.departmentName,
        d.enviadoByName,
        d.conversions,
        d.reconciliations,
        d.baptisms
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['Mês', 'Depto', 'Líder', 'Conv', 'Reconc', 'Bapt']],
      body: tableData || [],
      theme: 'striped',
      headStyles: { fillColor: [26, 54, 93] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Totais Acumulados:', 20, finalY);
    doc.text(`Salvações: ${totals.conversions} | Reconciliações: ${totals.reconciliations} | Batismos: ${totals.baptisms}`, 20, finalY + 7);
    doc.text(`Cultos realizados: ${totals.servicesCount} | Visitas: ${totals.visitsCount} | Pessoas Visitadas: ${totals.peopleVisitedCount}`, 20, finalY + 14);

    doc.save('Resumo_Geral_Relatorios.pdf');
  };

  const generateMinisterialDigestPDF = () => {
    setGeneratingDigest(true);
    try {
      const monthlyReports = reportsValue?.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(r => r.month === digestMonth && r.year === digestYear && r.status === 'enviado') || [];

      if (monthlyReports.length === 0) {
        alert(`Nenhum relatório ministerial enviado encontrado para o mês de ${getMonthName(digestMonth)} de ${digestYear}. Certifique-se de que os líderes já enviaram e o status está como 'Enviado'.`);
        setGeneratingDigest(false);
        return;
      }

      const doc = new jsPDF();

      // Header Banner
      doc.setFillColor(26, 54, 93); // Navy Blue
      doc.rect(0, 0, 210, 38, 'F');

      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('ASSEMBLEIA DE DEUS - BOAS NOVAS', 105, 16, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(218, 165, 32); // Gold
      const monthName = getMonthName(digestMonth);
      doc.text(`DIGEST CONSOLIDADO DE MINISTÉRIOS — ${monthName.toUpperCase()} / ${digestYear}`, 105, 26, { align: 'center' });

      // Calculate aggregated totals
      let totalConversions = 0;
      let totalReconciliations = 0;
      let totalBaptisms = 0;
      let totalServices = 0;
      let totalVisits = 0;
      let totalPeopleVisited = 0;

      monthlyReports.forEach(rep => {
        totalConversions += rep.conversions || 0;
        totalReconciliations += rep.reconciliations || 0;
        totalBaptisms += rep.baptisms || 0;
        totalServices += rep.servicesCount || 0;
        totalVisits += rep.visitsCount || 0;
        totalPeopleVisited += rep.peopleVisitedCount || 0;
      });

      // Render Executive Summary Box
      doc.setTextColor(26, 54, 93);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('ESTATÍSTICAS GERAIS CONSOLIDADAS', 20, 50);

      const statsData = [
        ['Cultos / Reuniões Realizadas', totalServices],
        ['Visitas de Apoio / Oração', totalVisits],
        ['Total de Pessoas Visitadas', totalPeopleVisited],
        ['Decisões por Cristo (Salvações)', totalConversions],
        ['Reconciliações', totalReconciliations],
        ['Batismos nas Águas', totalBaptisms]
      ];

      autoTable(doc, {
        startY: 54,
        body: statsData,
        theme: 'striped',
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 100, fontStyle: 'bold' },
          1: { cellWidth: 50, halign: 'right', fontStyle: 'bold', textColor: [26, 54, 93] }
        }
      });

      let nextY = (doc as any).lastAutoTable.finalY + 10;

      // Departmental Breakdown Table
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 54, 93);
      doc.text('ATIVIDADES POR DEPARTAMENTO', 20, nextY);

      const deptTableBody = monthlyReports.map(rep => {
        return [
          rep.departmentName || 'Ministério',
          rep.enviadoByName || 'Líder',
          rep.servicesCount || 0,
          rep.visitsCount || 0,
          rep.conversions || 0,
          rep.reconciliations || 0,
          rep.baptisms || 0
        ];
      });

      autoTable(doc, {
        startY: nextY + 4,
        head: [['Departamento', 'Líder / Enviado por', 'Cultos', 'Visitas', 'Salvos', 'Reconc.', 'Batismos']],
        body: deptTableBody,
        theme: 'grid',
        headStyles: { fillColor: [26, 54, 93], textColor: [255, 255, 255] },
        styles: { fontSize: 8.5 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { fontSize: 8 },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center', fontStyle: 'bold', textColor: [34, 139, 34] },
          5: { halign: 'center' },
          6: { halign: 'center' }
        }
      });

      nextY = (doc as any).lastAutoTable.finalY + 12;

      // Narrative Details
      monthlyReports.forEach((rep, index) => {
        if (nextY > 220) {
          doc.addPage();
          nextY = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(218, 165, 32); // Gold
        doc.text(`${index + 1}. DETALHES: ${rep.departmentName ? rep.departmentName.toUpperCase() : ''}`, 20, nextY);
        doc.setDrawColor(218, 165, 32);
        doc.setLineWidth(0.3);
        doc.line(20, nextY + 2, 190, nextY + 2);

        nextY += 8;

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);

        const deptContent = [];
        if (rep.content) {
          deptContent.push(`RELATO DE ATIVIDADES:\n${rep.content}`);
        }
        if (rep.nextMonthProjection) {
          deptContent.push(`PROJEÇÃO / PLANOS PARA O PRÓXIMO MÊS:\n${rep.nextMonthProjection}`);
        }

        const observations = [];
        if (rep.positives) observations.push(`• Pontos Positivos: ${rep.positives}`);
        if (rep.negatives) observations.push(`• Pontos Negativos: ${rep.negatives}`);
        if (rep.difficulties) observations.push(`• Dificuldades Encontradas: ${rep.difficulties}`);
        if (rep.testimonies) observations.push(`• Testemunhos/Bênçãos: ${rep.testimonies}`);
        if (rep.needs) observations.push(`• Necessidades do Departamento: ${rep.needs}`);

        if (observations.length > 0) {
          deptContent.push(`OBSERVAÇÕES E NECESSIDADES:\n${observations.join('\n')}`);
        }

        const detailsText = deptContent.join('\n\n');

        const splitText = doc.splitTextToSize(detailsText, 170);
        doc.text(splitText, 20, nextY);

        nextY += (splitText.length * 4) + 12;
      });

      doc.save(`Consolidado_Ministerial_${monthName}_${digestYear}.pdf`);
    } catch (error: any) {
      alert(`Erro ao gerar PDF consolidado ministerial: ${error.message || error}`);
    } finally {
      setGeneratingDigest(false);
    }
  };

  const getRoleLabel = (r: string) => {
    const labels: Record<string, string> = {
      admin: 'Admin',
      pastor: 'Pastor',
      pastora: 'Pastora',
      leader: 'Líder',
      obreiro: 'Obreiro',
      presbítero: 'Presbítero',
      missionário: 'Missionário',
      missionária: 'Missionária',
      diácono: 'Diácono',
      evangelista: 'Evangelista',
      diaconisa: 'Diaconisa',
      'mídia social': 'Mídia social',
      membro: 'Membro'
    };
    return labels[r] || r.charAt(0).toUpperCase() + r.slice(1);
  };

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-church-gold/10 pb-4">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all rounded-lg ${activeTab === 'reports' ? 'bg-church-navy text-white shadow-md' : 'text-church-navy/60 hover:bg-church-navy/5'}`}
        >
          <FileText className="h-4 w-4" />
          Relatórios
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all rounded-lg ${activeTab === 'users' ? 'bg-church-navy text-white shadow-md' : 'text-church-navy/60 hover:bg-church-navy/5'}`}
        >
          <Users className="h-4 w-4" />
          Membros e Cargos
        </button>
      </div>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-church-navy tracking-tight underline decoration-church-gold/20 decoration-8 underline-offset-4">
            {activeTab === 'reports' ? 'Gestão de Relatórios' : 'Membros da Congregação'}
          </h1>
          <p className="text-church-navy/60">Controle administrativo - AD Boas Novas</p>
        </div>
        {activeTab === 'reports' && (
          <button 
            onClick={exportSummaryPDF}
            className="flex items-center gap-2 rounded-lg bg-white border border-church-gold/20 px-4 py-2 font-semibold text-church-navy shadow-sm hover:bg-church-cream transition-colors"
          >
            <Download className="h-4 w-4" />
            PDF de Resumo
          </button>
        )}
      </header>

      {activeTab === 'reports' ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <div className="bg-white p-6 rounded-2xl border border-church-gold/10 shadow-sm">
              <div className="flex items-center gap-4 text-church-navy/60 mb-2">
                <FileText className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-church-navy/60">Cultos</span>
              </div>
              <div className="text-2xl font-black text-church-navy">{totals.servicesCount}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-church-gold/10 shadow-sm">
              <div className="flex items-center gap-4 text-church-navy/60 mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-church-navy/60">Visitas</span>
              </div>
              <div className="text-2xl font-black text-church-navy">{totals.visitsCount}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-church-gold/10 shadow-sm">
              <div className="flex items-center gap-4 text-church-navy/60 mb-2">
                <Users className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-church-navy/60">Pessoas Vis.</span>
              </div>
              <div className="text-2xl font-black text-church-navy">{totals.peopleVisitedCount}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-church-gold/10 shadow-sm">
              <div className="flex items-center gap-4 text-green-600/60 mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-church-navy/60">Salvações</span>
              </div>
              <div className="text-2xl font-black text-green-600">{totals.conversions}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-church-gold/10 shadow-sm">
              <div className="flex items-center gap-4 text-amber-600/60 mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-church-navy/60">Reconcil.</span>
              </div>
              <div className="text-2xl font-black text-amber-600">{totals.reconciliations}</div>
            </div>
          </div>

          {/* Grid de Ferramentas do Sistema (Digest e Sincronização do App) */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Seção de Relatório Consolidado de Ministérios (Executive Digest) */}
            <div className="bg-gradient-to-br from-church-navy to-church-navy/90 text-white rounded-3xl p-6 shadow-xl border border-church-gold/20 flex flex-col justify-between space-y-6">
              <div className="space-y-2">
                <h3 className="font-serif text-xl font-black text-church-gold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-church-gold animate-pulse" />
                  Digest Consolidado de Ministérios
                </h3>
                <p className="text-xs text-white/70">
                  Gere um único documento PDF com o resumo executivo, relatos de atividades, necessidades e estatísticas de todos os ministérios ou departamentos do mês selecionado.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-end bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/60">Selecionar Mês</label>
                  <select
                    value={digestMonth}
                    onChange={(e) => setDigestMonth(parseInt(e.target.value))}
                    className="w-full bg-church-navy border border-white/20 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-church-gold cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m} className="bg-church-navy">
                        {getMonthName(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/60">Selecionar Ano</label>
                  <select
                    value={digestYear}
                    onChange={(e) => setDigestYear(parseInt(e.target.value))}
                    className="w-full bg-church-navy border border-white/20 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-church-gold cursor-pointer"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y} className="bg-church-navy">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={generateMinisterialDigestPDF}
                  disabled={generatingDigest}
                  className="w-full sm:w-auto px-6 py-2.5 bg-church-gold hover:bg-church-gold/90 disabled:opacity-50 text-church-navy font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-102 active:scale-98 cursor-pointer text-sm whitespace-nowrap"
                >
                  <Download className="h-4 w-4" />
                  {generatingDigest ? 'Gerando...' : 'Exportar Digest'}
                </button>
              </div>
            </div>

            {/* Seção de Atualização Geral do Aplicativo (Live Sync Trigger) */}
            <div className="bg-gradient-to-br from-church-navy to-church-navy/95 text-white rounded-3xl p-6 shadow-xl border border-church-gold/20 flex flex-col justify-between space-y-6">
              <div className="space-y-2">
                <h3 className="font-serif text-xl font-black text-church-gold flex items-center gap-2">
                  <RefreshCw className={`h-5 w-5 text-church-gold ${forcingUpdate ? 'animate-spin' : ''}`} />
                  Sincronização do Aplicativo
                </h3>
                <p className="text-xs text-white/70">
                  Sempre que você subir novas atualizações ou fizer mudanças nos dados e quiser que os membros visualizem as novidades imediatamente, dispare o botão abaixo para recarregar todos os celulares, tablets e computadores conectados na mesma hora.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="flex-1 text-center sm:text-left">
                  {updateSuccess ? (
                    <div className="text-xs font-bold text-emerald-400 flex items-center justify-center sm:justify-start gap-1.5 animate-bounce">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      Sinal enviado! Dispositivos atualizando...
                    </div>
                  ) : (
                    <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold">
                      Status do Sistema: Pronto para Sincronizar
                    </p>
                  )}
                </div>

                <button
                  onClick={handleForceUpdate}
                  disabled={forcingUpdate}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-102 active:scale-98 cursor-pointer text-sm whitespace-nowrap"
                >
                  <RefreshCw className={`h-4 w-4 ${forcingUpdate ? 'animate-spin' : ''}`} />
                  {forcingUpdate ? 'Sincronizando...' : 'Forçar Atualização Geral'}
                </button>
              </div>
            </div>
          </div>

          <section className="bg-white rounded-2xl border border-church-gold/10 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-church-gold/5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-church-cream/50">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-church-navy/30" />
                <input 
                  type="text" 
                  placeholder="Buscar relatórios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-church-gold/20 focus:outline-none focus:ring-2 focus:ring-church-gold/20 text-sm bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-church-navy/40" />
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="text-sm font-medium border-none bg-transparent focus:ring-0 text-church-navy cursor-pointer"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="department">Departamento</option>
                  <option value="pastoral">Pastoral</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-church-navy/5 text-church-navy/60 text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-6 py-4">Data / Mês</th>
                    <th className="px-6 py-4">Departamento / Título</th>
                    <th className="px-6 py-4">Líder</th>
                    <th className="px-6 py-4 text-center">Salvações</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-church-gold/5">
                  <AnimatePresence mode="popLayout">
                    {reportsLoading ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-church-navy/40">Carregando...</td></tr>
                    ) : filteredReports?.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-church-navy/40">Nenhum resultado.</td></tr>
                    ) : (
                      filteredReports?.map((reportDoc) => {
                        const data = reportDoc.data();
                        return (
                          <motion.tr key={reportDoc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-church-cream/30 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-bold text-church-navy">{format(new Date(data.year, data.month - 1), 'MMMM yyyy', { locale: ptBR })}</span>
                            </td>
                            <td className="px-6 py-4 font-medium text-church-navy">{data.departmentName}</td>
                            <td className="px-6 py-4 text-sm text-church-navy/80">{data.enviadoByName}</td>
                            <td className="px-6 py-4 text-center font-bold text-green-600">{data.conversions || 0}</td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button 
                                  onClick={() => setSelectedReport({ id: reportDoc.id, ...data })}
                                  className="p-2 rounded-full hover:bg-church-navy/5 text-church-gold transition-colors"
                                  title="Ver Detalhes"
                                >
                                  <Eye className="h-5 w-5" />
                                </button>
                                {isAdminOnly && (
                                  <button 
                                    onClick={() => {
                                      if (!isAdminOnly) {
                                        alert("Apenas administradores podem excluir relatórios.");
                                        return;
                                      }
                                      setReportToDeleteId(reportDoc.id);
                                    }}
                                    className="p-2 rounded-full hover:bg-red-50 text-red-500 transition-colors"
                                    title="Excluir Relatório"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="bg-white rounded-2xl border border-church-gold/10 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-church-gold/5 bg-church-cream/50">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-church-navy/30" />
              <input 
                type="text" 
                placeholder="Buscar membros por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-church-gold/20 focus:outline-none focus:ring-2 focus:ring-church-gold/20 text-sm bg-white"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-church-navy/5 text-church-navy/60 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Cargo Atual</th>
                  <th className="px-6 py-4">Alterar para</th>
                  {isAdminOnly && <th className="px-6 py-4 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-church-gold/5">
                {usersValue?.docs.map(userDoc => {
                  const userData = userDoc.data();
                  return (
                    <tr key={userDoc.id} className="hover:bg-church-cream/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {userData.photoURL ? (
                             <img src={userData.photoURL} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-church-navy/5 flex items-center justify-center"><Users className="h-4 w-4" /></div>
                          )}
                          <div>
                            <p className="font-bold text-church-navy text-sm">{userData.displayName}</p>
                            <p className="text-xs text-church-navy/40">{userData.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${['pastor', 'pastora', 'admin'].includes(userData.role) ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {getRoleLabel(userData.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={userData.role}
                          onChange={(e) => handleUpdateRole(userDoc.id, e.target.value)}
                          className="text-[10px] font-bold border rounded uppercase bg-white px-2 py-1 focus:outline-none focus:ring-1 focus:ring-church-navy"
                        >
                          <option value="membro">Membro</option>
                          <option value="leader">Líder</option>
                          <option value="obreiro">Obreiro</option>
                          <option value="diácono">Diácono</option>
                          <option value="diaconisa">Diaconisa</option>
                          <option value="mídia social">Mídia social</option>
                          <option value="presbítero">Presbítero</option>
                          <option value="evangelista">Evangelista</option>
                          <option value="missionário">Missionário</option>
                          <option value="missionária">Missionária</option>
                          <option value="pastor">Pastor</option>
                          <option value="pastora">Pastora</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      {isAdminOnly && (
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              if (!isAdminOnly) {
                                alert("Apenas administradores podem remover usuários de membros e cargos.");
                                return;
                              }
                              setUserToDelete({ id: userDoc.id, name: userData.displayName || 'Sem Nome' });
                            }}
                            className="p-2 rounded-full hover:bg-red-50 text-red-500 transition-colors"
                            title="Remover Usuário"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedReport && (
        <ReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}

      <DeleteConfirmationModal
        isOpen={reportToDeleteId !== null}
        onClose={() => setReportToDeleteId(null)}
        onConfirm={async () => {
          if (reportToDeleteId) {
            await handleDeleteReport(reportToDeleteId);
          }
        }}
        title="Excluir Relatório"
        message="Tem certeza que deseja excluir este relatório? Os dados computados e as estatísticas unificadas do ministério serão impactadas."
      />

      <DeleteConfirmationModal
        isOpen={userToDelete !== null}
        onClose={() => setUserToDelete(null)}
        onConfirm={async () => {
          if (userToDelete) {
            await handleDeleteUser(userToDelete.id);
          }
        }}
        title="Remover Usuário"
        message={`Tem certeza que deseja remover o usuário ${userToDelete?.name}? Ele perderá o acesso às áreas restritas da membresia.`}
      />
    </div>
  );
}


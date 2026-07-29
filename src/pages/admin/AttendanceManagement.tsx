import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Check, X, Calendar as CalendarIcon, ClipboardList, 
  Download, Printer, FileText, Search, Loader2, Award, 
  Trash2, Edit, Save, ArrowLeft, RefreshCw, BarChart2,
  BookOpen, Heart, Activity, CheckSquare, Briefcase, Mail, Phone
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  collection, query, orderBy, onSnapshot, getDocs, doc, 
  setDoc, deleteDoc, serverTimestamp, getDoc, updateDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Member {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  birthDate?: string;
  department?: string;
  position?: string;
  conversionDate?: string;
  isBaptized: boolean;
  isSpiritBaptized: boolean;
  isTither: boolean;
  status: 'active' | 'inactive' | 'visitor';
  photoUrl?: string;
}

interface AttendanceRecord {
  id: string; // usually Date_ServiceKey
  date: string; // YYYY-MM-DD
  serviceKey: string; // segunda_ensino, quinta_publico, etc
  serviceName: string;
  presentIds: string[];
  notes?: string;
  updatedAt?: any;
}

const SERVICES = [
  { key: 'segunda_ensino', name: 'Culto de Oração e Ensino (Segunda-feira)' },
  { key: 'quinta_publico', name: 'Culto Público (Quinta-feira)' },
  { key: 'consagracao', name: 'Consagração (Domingo)' },
  { key: 'domingo_ebd', name: 'Escola Bíblica Dominical (EBD)' },
  { key: 'domingo_noite', name: 'Culto de Domingo (Noite)' }
];

interface AttendanceManagementProps {
  role: string | null;
}

export default function AttendanceManagement({ role }: AttendanceManagementProps) {
  // Tabs State: 'attendance' | 'reports' | 'history'
  const [activeTab, setActiveTab] = useState<'attendance' | 'reports' | 'history'>('attendance');

  // Firestore Data State
  const [members, setMembers] = useState<Member[]>([]);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Mark Attendance Form State
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedService, setSelectedService] = useState<string>('segunda_ensino');
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<string>('');
  const [searchMemberQuery, setSearchMemberQuery] = useState<string>('');
  const [savingAttendance, setSavingAttendance] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // History Detail/Edit Modal
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);

  // Member Report Visualizer state
  const [selectedReportMember, setSelectedReportMember] = useState<Member | null>(null);
  const [searchReportQuery, setSearchReportQuery] = useState<string>('');
  
  // Clean checks
  const isAdminOrPastor = useMemo(() => {
    return role && ['admin', 'pastor', 'pastora'].includes(role);
  }, [role]);

  // Load Members
  useEffect(() => {
    const qMembers = query(collection(db, 'members'), orderBy('name', 'asc'));
    const unsubscribeMembers = onSnapshot(qMembers, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Member[];
      setMembers(docs);
      setMembersLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'members');
      setMembersLoading(false);
    });

    // Load Attendance History
    const qHistory = query(collection(db, 'attendance'), orderBy('date', 'desc'));
    const unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceRecord[];
      setHistory(docs);
      setHistoryLoading(false);
    }, (err) => {
      // Don't crash if collection is newly created or missing
      console.log('Frequência collections:', err);
      setHistoryLoading(false);
    });

    return () => {
      unsubscribeMembers();
      unsubscribeHistory();
    };
  }, []);

  // Update selection map when date/service changes or when editing a record
  useEffect(() => {
    // Check if an existing record matches the selected date/service
    const existingRecord = history.find(r => r.date === selectedDate && r.serviceKey === selectedService);
    if (existingRecord) {
      const dict: Record<string, boolean> = {};
      members.forEach(m => {
        dict[m.id] = existingRecord.presentIds.includes(m.id);
      });
      setPresenceMap(dict);
      setNotes(existingRecord.notes || '');
    } else {
      // Initialize everyone as present by default or empty dictionary
      const dict: Record<string, boolean> = {};
      members.forEach(m => {
        dict[m.id] = true; // Assume present by default to make it easy to uncheck absentees
      });
      setPresenceMap(dict);
      setNotes('');
    }
  }, [selectedDate, selectedService, members, history]);

  // Bulk set presence State
  const handleBulkSetPresence = (status: boolean) => {
    const dict: Record<string, boolean> = {};
    members.forEach(m => {
      dict[m.id] = status;
    });
    setPresenceMap(dict);
  };

  // Toggle single member presence
  const togglePresence = (memberId: string) => {
    setPresenceMap(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };

  // Save/Update current attendance record
  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    setSaveSuccess(false);
    try {
      const recordId = `${selectedDate}_${selectedService}`;
      const presentIds = Object.keys(presenceMap).filter(id => presenceMap[id] === true);
      const serviceName = SERVICES.find(s => s.key === selectedService)?.name || selectedService;

      const recordData: AttendanceRecord = {
        id: recordId,
        date: selectedDate,
        serviceKey: selectedService,
        serviceName,
        presentIds,
        notes,
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'attendance', recordId), recordData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `attendance`);
    } finally {
      setSavingAttendance(false);
    }
  };

  // Delete attendance record
  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('Excluir permanentemente este registro de frequência?')) return;
    try {
      await deleteDoc(doc(db, 'attendance', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `attendance/${id}`);
    }
  };

  // Filter members on dynamic search in the Attendance Sheet
  const filteredAttendanceMembers = useMemo(() => {
    return members.filter(m => 
      m.name.toLowerCase().includes(searchMemberQuery.toLowerCase()) && 
      m.status === 'active'
    );
  }, [members, searchMemberQuery]);

  // Compute reports math for members
  const memberReportDetails = useMemo(() => {
    if (!selectedReportMember) return null;
    const memberId = selectedReportMember.id;

    // Filter all history instances where this member was active (by date)
    const totalServices = history.length;
    const presentRecords = history.filter(h => h.presentIds.includes(memberId));
    const presentCount = presentRecords.length;
    const absentCount = totalServices - presentCount;
    const attendancePercentage = totalServices > 0 ? Math.round((presentCount / totalServices) * 100) : 100;

    // Attendance breakdown by service
    const breakdown = SERVICES.map(srv => {
      const srvRecords = history.filter(h => h.serviceKey === srv.key);
      const srvTotal = srvRecords.length;
      const srvPresent = srvRecords.filter(h => h.presentIds.includes(memberId)).length;
      const srvPerc = srvTotal > 0 ? Math.round((srvPresent / srvTotal) * 100) : null;
      return {
        ...srv,
        total: srvTotal,
        present: srvPresent,
        percentage: srvPerc
      };
    });

    // Chronological history formatted
    const chronHistory = history.map(h => ({
      id: h.id,
      date: h.date,
      serviceName: h.serviceName,
      wasPresent: h.presentIds.includes(memberId)
    })).sort((a, b) => b.date.localeCompare(a.date));

    return {
      totalServices,
      presentCount,
      absentCount,
      attendancePercentage,
      breakdown,
      chronHistory
    };
  }, [selectedReportMember, history]);

  // Filter members list for report visualizer
  const filteredReportMembers = useMemo(() => {
    return members.filter(m => 
      m.name.toLowerCase().includes(searchReportQuery.toLowerCase())
    );
  }, [members, searchReportQuery]);

  // Trigger browser print for dynamic beautifully laid out member sheet
  const handlePrintReport = (member: Member, stats: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Favor permitir popups para que o relatório possa ser impresso!');
      return;
    }

    const formattedBirthDate = member.birthDate ? format(parseISO(member.birthDate), 'dd/MM/yyyy') : 'Não informado';
    const formattedConversionDate = member.conversionDate ? format(parseISO(member.conversionDate), 'dd/MM/yyyy') : 'Não informado';

    const serviceBreakdownHtml = stats.breakdown.map((b: any) => `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; color: #1a202c;">
          <span>${b.name}</span>
          <span>${b.percentage !== null ? b.percentage + '%' : 'Nenhum registro'} (${b.present}/${b.total})</span>
        </div>
        <div style="background-color: #edf2f7; border-radius: 4px; height: 10px; width: 100%; margin-top: 4px; overflow: hidden;">
          <div style="background-color: ${b.percentage >= 70 ? '#2f855a' : b.percentage >= 50 ? '#d69e2e' : '#c53030'}; height: 100%; width: ${b.percentage !== null ? b.percentage : 0}%;"></div>
        </div>
      </div>
    `).join('');

    const recentHistoryHtml = stats.chronHistory.slice(0, 20).map((h: any) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 12px; font-size: 13px; color: #4a5568;">${format(parseISO(h.date), 'dd/MM/yyyy')}</td>
        <td style="padding: 8px 12px; font-size: 13px; color: #4a5568;">${h.serviceName}</td>
        <td style="padding: 8px 12px; font-size: 13px; font-weight: bold; color: ${h.wasPresent ? '#2f855a' : '#c53030'};">
          ${h.wasPresent ? '▲ Presente' : '▼ Ausente'}
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório Individual - ${member.name}</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #2d3748; background-color: #fff; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px double #d69e2e; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { font-family: 'Georgia', serif; font-size: 28px; color: #0f172a; margin: 0; }
            .header p { font-size: 12px; text-transform: uppercase; tracking: 2px; color: #718096; margin: 5px 0 0 0; font-weight: bold; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; background-color: #f7fafc; }
            .card-title { font-family: 'Georgia', serif; font-size: 18px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; margin-top: 0; }
            .field { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dotted #e2e8f0; padding-bottom: 4px; }
            .field-label { font-weight: bold; color: #4a5568; font-size: 13px; }
            .field-value { color: #1a202c; font-size: 13px; }
            .stats-metric { text-align: center; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            .stats-metric-value { font-size: 32px; font-weight: 900; color: #2b6cb0; }
            .stats-metric-label { font-size: 11px; text-transform: uppercase; color: #718096; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background-color: #2b6cb0; color: white; padding: 10px 12px; font-size: 12px; text-align: left; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
            .badge-active { background-color: #c6f6d5; color: #22543d; }
            .badge-inactive { background-color: #fed7d7; color: #742a2a; }
            .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #a0aec0; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Assembleia de Deus - Boas Novas</h1>
            <p>Tenda da Promessa • Ficha De Relatório Espiritual & Frequência</p>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
            <div style="font-size: 14px; font-weight: bold;">
              Relatório emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}
            </div>
            <button onclick="window.print()" style="background-color: #2b6cb0; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 6px; cursor: pointer;">
              Imprimir / Salvar como PDF
            </button>
          </div>

          <div class="grid">
            <!-- Dados Cadastrais -->
            <div class="card">
              <h2 class="card-title">Dados Gerais do Membro</h2>
              <div class="field">
                <span class="field-label">Nome Completo:</span>
                <span class="field-value">${member.name}</span>
              </div>
              <div class="field">
                <span class="field-label">Status:</span>
                <span class="field-value">
                  <span class="badge ${member.status === 'active' ? 'badge-active' : 'badge-inactive'}">
                    ${member.status === 'active' ? 'Ativo' : member.status === 'inactive' ? 'Inativo' : 'Visitante'}
                  </span>
                </span>
              </div>
              <div class="field">
                <span class="field-label">Cargo / Função:</span>
                <span class="field-value">${member.position || 'Membro'}</span>
              </div>
              <div class="field">
                <span class="field-label">Departamento:</span>
                <span class="field-value">${member.department || 'Nenhum'}</span>
              </div>
              <div class="field">
                <span class="field-label">Nascimento:</span>
                <span class="field-value">${formattedBirthDate}</span>
              </div>
              <div class="field">
                <span class="field-label">Data de Conversão:</span>
                <span class="field-value">${formattedConversionDate}</span>
              </div>
              <div class="field">
                <span class="field-label">Contato / WhatsApp:</span>
                <span class="field-value">${member.whatsapp || member.phone || 'Não cadastrado'}</span>
              </div>
              <div class="field">
                <span class="field-label">E-mail:</span>
                <span class="field-value">${member.email || 'Não cadastrado'}</span>
              </div>
              <div class="field">
                <span class="field-label">Batizado nas Águas:</span>
                <span class="field-value">${member.isBaptized ? 'Sim' : 'Não'}</span>
              </div>
              <div class="field">
                <span class="field-label">Batizado no Espírito Santo:</span>
                <span class="field-value">${member.isSpiritBaptized ? 'Sim' : 'Não'}</span>
              </div>
              <div class="field">
                <span class="field-label">Dizimista Fiel:</span>
                <span class="field-value">${member.isTither ? 'Sim' : 'Não'}</span>
              </div>
            </div>

            <!-- Resumo de Frequência -->
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <h2 class="card-title">Índice Geral de Frequência</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                  <div class="stats-metric">
                    <div class="stats-metric-value" style="color: #2b6cb0;">${stats.attendancePercentage}%</div>
                    <div class="stats-metric-label">Assiduidade</div>
                  </div>
                  <div class="stats-metric">
                    <div class="stats-metric-value" style="color: #2f855a;">${stats.presentCount}</div>
                    <div class="stats-metric-label">Presenças Totais</div>
                  </div>
                  <div class="stats-metric">
                    <div class="stats-metric-value" style="color: #4a5568;">${stats.totalServices}</div>
                    <div class="stats-metric-label font-bold">Cultos Avaliados</div>
                  </div>
                  <div class="stats-metric">
                    <div class="stats-metric-value" style="color: #c53030;">${stats.absentCount}</div>
                    <div class="stats-metric-label">Faltas Totais</div>
                  </div>
                </div>
              </div>
              
              <div>
                <h2 class="card-title">Frequência por Tipo de Culto</h2>
                ${serviceBreakdownHtml}
              </div>
            </div>
          </div>

          <!-- Chamadas Recentes -->
          <div>
            <h2 class="card-title" style="margin-bottom: 10px;">Frequência Detalhada (Últimos 20 Cultos)</h2>
            <table>
              <thead>
                <tr>
                  <th style="border-top-left-radius: 8px;">Data</th>
                  <th>Tipo de Culto / Reunião</th>
                  <th style="border-top-right-radius: 8px;">Presença</th>
                </tr>
              </thead>
              <tbody>
                ${stats.chronHistory.length === 0 ? `
                  <tr>
                    <td colspan="3" style="text-align: center; padding: 20px; color: #a0aec0;">Nenhum culto registrado no sistema até o momento.</td>
                  </tr>
                ` : recentHistoryHtml}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>Assembleia de Deus Boas Novas - Tenda da Promessa</p>
            <p style="font-size: 9px; margin-top: 5px;">Relatório de Membro Espiritual gerado internamente via Sistema de Gestão.</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Generate and download CSV for spreadsheets of member's details and stats
  const handleDownloadCsv = (member: Member, stats: any) => {
    // CSV Header details
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'RELATORIO INDIVIDUAL DE MEMBRO\n';
    csvContent += `Data de Emissao;${format(new Date(), 'dd/MM/yyyy HH:mm')}\n\n`;
    
    // Member generic profile
    csvContent += 'DADOS DO MEMBRO\n';
    csvContent += `Nome;${member.name}\n`;
    csvContent += `Status;${member.status === 'active' ? 'Ativo' : 'Inativo'}\n`;
    csvContent += `Cargo;${member.position || 'Membro'}\n`;
    csvContent += `Departamento;${member.department || 'Nenhum'}\n`;
    csvContent += `Aniversario;${member.birthDate || 'Nao informado'}\n`;
    csvContent += `Conversao;${member.conversionDate || 'Nao informado'}\n`;
    csvContent += `Contato;${member.whatsapp || member.phone || 'Nao informado'}\n`;
    csvContent += `Email;${member.email || 'Nao informado'}\n`;
    csvContent += `Batizado nas aguas;${member.isBaptized ? 'Sim' : 'Nao'}\n`;
    csvContent += `Batizado Espirito Santo;${member.isSpiritBaptized ? 'Sim' : 'Nao'}\n`;
    csvContent += `Dizimista;${member.isTither ? 'Sim' : 'Nao'}\n\n`;

    // Attendance Overview stats
    csvContent += 'ESTATISTICAS DE PRESENCA\n';
    csvContent += `Assiduidade;${stats.attendancePercentage}%\n`;
    csvContent += `Cultos Avaliados;${stats.totalServices}\n`;
    csvContent += `Presencas;${stats.presentCount}\n`;
    csvContent += `Faltas;${stats.absentCount}\n\n`;

    // Breakdown per service type
    csvContent += 'CATEGORIA DE CULTO;INDICE DE PRESENCA;PRESENCAS;TOTAL CULTOS\n';
    stats.breakdown.forEach((b: any) => {
      csvContent += `"${b.name}";${b.percentage !== null ? b.percentage + '%' : 'N/A'};${b.present};${b.total}\n`;
    });
    csvContent += '\n';

    // Detailed history log
    csvContent += 'HISTORICO DE PRESENCA\n';
    csvContent += 'DATA;CULTO;STATUS\n';
    stats.chronHistory.forEach((h: any) => {
      csvContent += `${h.date};"${h.serviceName}";${h.wasPresent ? 'Presente' : 'Ausente'}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_${member.name.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 p-4 lg:p-8">
      {/* HEADER BAR */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-black text-church-navy flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-church-gold" />
            Controle de Frequência & Relatórios
          </h1>
          <p className="text-church-navy/60">Controle de presença nos cultos e relatórios de acompanhamento de membros</p>
        </div>
      </header>

      {/* DASHBOARD CARD METRICS */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-church-gold/10 bg-white p-5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-church-navy/40">Total Ativos</p>
          <p className="text-2xl font-black text-church-navy mt-1">
            {members.filter(m => m.status === 'active').length}
          </p>
          <div className="text-[10px] text-green-600 font-semibold mt-1">Membros frequentes</div>
        </div>

        <div className="rounded-3xl border border-church-gold/10 bg-white p-5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-church-navy/40">Chamadas Realizadas</p>
          <p className="text-2xl font-black text-church-navy mt-1">
            {history.length}
          </p>
          <div className="text-[10px] text-church-gold font-semibold mt-1">Histórico completo</div>
        </div>

        <div className="rounded-3xl border border-church-gold/10 bg-white p-5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-church-navy/40">Assiduidade Média</p>
          <p className="text-2xl font-black text-church-navy mt-1">
            {history.length > 0 ? (
              Math.round((history.reduce((acc, curr) => acc + curr.presentIds.length, 0) / 
              (history.length * (members.filter(m => m.status === 'active').length || 1))) * 100)
            ) : 0}%
          </p>
          <div className="text-[10px] text-church-navy/40 font-semibold mt-1">Presença geral</div>
        </div>

        <div className="rounded-3xl border border-church-gold/10 bg-white p-5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-church-navy/40">Cultos Segmentados</p>
          <p className="text-2xl font-black text-church-navy mt-1">5</p>
          <div className="text-[10px] text-church-gold font-semibold mt-1">Seg, Qui, Sáb e Dominical</div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex border-b border-church-gold/10">
        <button
          onClick={() => { setActiveTab('attendance'); setSelectedReportMember(null); }}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'attendance'
              ? 'border-church-gold text-church-navy font-black'
              : 'border-transparent text-church-navy/50 hover:text-church-navy hover:border-church-gold/30'
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          Registrar Presença
        </button>
        <button
          onClick={() => { setActiveTab('history'); setSelectedReportMember(null); }}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-church-gold text-church-navy font-black'
              : 'border-transparent text-church-navy/50 hover:text-church-navy hover:border-church-gold/30'
          }`}
        >
          <Activity className="h-4 w-4" />
          Histórico de Chamadas
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'reports'
              ? 'border-church-gold text-church-navy font-black'
              : 'border-transparent text-church-navy/50 hover:text-church-navy hover:border-church-gold/30'
          }`}
        >
          <FileText className="h-4 w-4" />
          Relatórios Individuais
        </button>
      </div>

      {/* TAB CONTENT: ATTENDANCE TRACKING SHET */}
      {activeTab === 'attendance' && (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Header parameters / Form Configuration */}
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-3xl border border-church-gold/10 bg-white p-6 space-y-5">
              <h3 className="font-serif text-lg font-bold text-church-navy">Configurações da Chamada</h3>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-church-navy/50">
                  Data do Culto
                </label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-church-navy/30" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl border border-church-gold/15 bg-white pl-10 pr-3 py-2.5 text-xs font-bold text-church-navy outline-hidden focus:ring-2 focus:ring-church-gold/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-church-navy/50">
                  Tipo de Culto / Reunião
                </label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full rounded-xl border border-church-gold/15 bg-white px-3 py-2.5 text-xs font-bold text-church-navy outline-hidden focus:ring-2 focus:ring-church-gold/20"
                >
                  {SERVICES.map(srv => (
                    <option key={srv.key} value={srv.key}>{srv.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-church-navy/50">
                  Observações / Notas do Culto
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: mensagem pregada, visitantes, ofertas, tema ou eventos ocorridos..."
                  rows={4}
                  className="w-full rounded-xl border border-church-gold/15 bg-white p-3 text-xs text-church-navy outline-hidden focus:ring-2 focus:ring-church-gold/20"
                />
              </div>

              {/* Status Alert */}
              {saveSuccess && (
                <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-xs font-bold text-green-700">
                  Chamada salva com sucesso na nuvem!
                </div>
              )}

              <button
                onClick={handleSaveAttendance}
                disabled={savingAttendance || membersLoading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-church-navy hover:bg-church-navy/95 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {savingAttendance ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando Registro...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvar Lista de Presença
                  </>
                )}
              </button>
            </div>

            {/* Quick Metrics of selection */}
            <div className="rounded-3xl bg-church-navy text-white p-6 space-y-4">
              <h4 className="font-serif text-md font-bold text-church-gold">Parciais Gerais</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[9px] text-white/50 block">Presentes</span>
                  <span className="text-xl font-bold">
                    {Object.values(presenceMap).filter(v => v === true).length}
                  </span>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[9px] text-white/50 block">Ausentes</span>
                  <span className="text-xl font-bold">
                    {members.filter(m => m.status === 'active').length - Object.values(presenceMap).filter(v => v === true).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Members Checklist Grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-3xl border border-church-gold/10 bg-white p-6 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-church-gold/5 pb-4">
                <h3 className="font-serif text-lg font-bold text-church-navy flex items-center gap-2">
                  <Users className="h-5 w-5 text-church-gold" />
                  Membros Ativos para Chamada
                </h3>
                
                {/* Bulk toggles */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkSetPresence(true)}
                    className="px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-[10px] font-bold text-green-700 transition-colors cursor-pointer"
                  >
                    Marcar Todos Presentes
                  </button>
                  <button
                    onClick={() => handleBulkSetPresence(false)}
                    className="px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-[10px] font-bold text-gray-700 transition-colors cursor-pointer"
                  >
                    Marcar Todos Ausentes
                  </button>
                </div>
              </div>

              {/* Instant Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-church-navy/30" />
                <input
                  type="text"
                  placeholder="Buscar membro pelo nome..."
                  value={searchMemberQuery}
                  onChange={(e) => setSearchMemberQuery(e.target.value)}
                  className="w-full rounded-xl border border-church-gold/10 bg-white pl-9 pr-4 py-2 text-xs text-church-navy outline-hidden focus:ring-2 focus:ring-church-gold/20"
                />
              </div>

              {/* Members check list */}
              {membersLoading ? (
                <div className="flex py-12 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-church-gold" />
                </div>
              ) : filteredAttendanceMembers.length === 0 ? (
                <div className="text-center py-12 text-xs text-church-navy/40">
                  Nenhum membro ativo encontrado com o termo informado.
                </div>
              ) : (
                <div className="divide-y divide-church-gold/5 max-h-[500px] overflow-y-auto pr-2">
                  {filteredAttendanceMembers.map(member => {
                    const isPresent = presenceMap[member.id] ?? true;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between py-3 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg border border-church-gold/10 bg-church-cream/40 flex items-center justify-center overflow-hidden shrink-0">
                            {member.photoUrl ? (
                              <img src={member.photoUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Users className="h-4.5 w-4.5 text-church-navy/30" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-church-navy group-hover:text-church-gold transition-colors">
                              {member.name}
                            </p>
                            <p className="text-[9px] text-church-navy/40 uppercase tracking-wide font-black">
                              {member.position || 'Membro'} • {member.department || 'Geral'}
                            </p>
                          </div>
                        </div>

                        {/* Side-by-side clear Presente / Ausente Selectors */}
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPresenceMap(prev => ({ ...prev, [member.id]: true }))}
                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                              isPresent
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            Presente
                          </button>
                          <button
                            type="button"
                            onClick={() => setPresenceMap(prev => ({ ...prev, [member.id]: false }))}
                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                              !isPresent
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            Ausente
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: HISTORY LIST */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-church-gold/10 bg-white p-6">
            <h3 className="font-serif text-lg font-bold text-church-navy border-b border-church-gold/5 pb-4 mb-4">
              Histórico de Chamadas Realizadas
            </h3>

            {historyLoading ? (
              <div className="flex py-12 justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-church-gold" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-xs text-church-navy/40">
                Ainda não foram registradas chamadas de cultos no sistema.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-church-gold/10 text-church-navy/40 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 font-black">Data</th>
                      <th className="py-3 px-4 font-black">Culto / Atividade</th>
                      <th className="py-3 px-4 font-black">Presenças</th>
                      <th className="py-3 px-4 font-black text-center">Aproveitamento</th>
                      <th className="py-3 px-4 font-black">Notas / Obs</th>
                      <th className="py-3 px-4 font-black text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-church-gold/5">
                    {history.map(item => {
                      const totalActive = members.filter(m => m.status === 'active').length || 1;
                      const count = item.presentIds?.length || 0;
                      const percentage = Math.round((count / totalActive) * 100);

                      return (
                        <tr key={item.id} className="hover:bg-church-cream/25 text-xs text-church-navy">
                          <td className="py-3.5 px-4 font-bold">
                            {format(parseISO(item.date), 'dd/MM/yyyy')}
                          </td>
                          <td className="py-3.5 px-4 font-black text-church-navy">
                            {item.serviceName}
                          </td>
                          <td className="py-3.5 px-4 font-bold">
                            {count} de {totalActive} membros
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-block py-0.5 px-2 rounded-full font-bold text-[10px] ${
                              percentage >= 70 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {percentage}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 max-w-xs truncate text-church-navy/60">
                            {item.notes || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedDate(item.date);
                                  setSelectedService(item.serviceKey);
                                  setNotes(item.notes || '');
                                  setActiveTab('attendance');
                                }}
                                className="p-1 rounded bg-church-navy/5 hover:bg-church-navy/10 text-church-navy transition-colors cursor-pointer"
                                title="Carregar na Ficha para Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(item.id)}
                                className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-500 transition-colors cursor-pointer"
                                title="Excluir Registro"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: REPORT SYSTEM */}
      {activeTab === 'reports' && (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Members List Selector */}
          <div className="lg:col-span-1 rounded-3xl border border-church-gold/10 bg-white p-6 space-y-4">
            <h3 className="font-serif text-lg font-bold text-church-navy border-b border-church-gold/5 pb-2">
              Selecione o Membro
            </h3>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-church-navy/30" />
              <input
                type="text"
                placeholder="Pesquisar por nome..."
                value={searchReportQuery}
                onChange={(e) => setSearchReportQuery(e.target.value)}
                className="w-full rounded-xl border border-church-gold/10 bg-white pl-9 pr-4 py-2 text-xs text-church-navy outline-hidden focus:ring-2 focus:ring-church-gold/20"
              />
            </div>

            {membersLoading ? (
              <div className="flex py-12 justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
                {filteredReportMembers.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedReportMember(m)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      selectedReportMember?.id === m.id
                        ? 'bg-church-gold/15 text-church-navy font-bold ring-1 ring-church-gold/30'
                        : 'hover:bg-church-cream/30 text-church-navy'
                    }`}
                  >
                    <div className="h-8 w-8 rounded-lg border border-church-gold/10 bg-church-cream/60 flex items-center justify-center overflow-hidden shrink-0">
                      {m.photoUrl ? (
                        <img src={m.photoUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Users className="h-3.5 w-3.5 text-church-navy/30" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold leading-tight">{m.name}</p>
                      <p className="text-[9px] text-church-navy/40 uppercase tracking-wider font-extrabold">
                        {m.position || 'Membro'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Report Viewer detail sheet */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedReportMember ? (
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center rounded-3xl border border-dashed border-church-gold/20 bg-white p-8 text-center text-church-navy/50">
                <FileText className="h-12 w-12 text-church-gold/40 mb-3" />
                <h4 className="font-serif text-lg font-bold">Nenhum Membro Selecionado</h4>
                <p className="text-xs max-w-sm mt-1">Consulte o painel à esquerda para selecionar um membro e carregar sua ficha de faturamento espiritual de presença e status completa.</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-church-gold/10 p-6 sm:p-8 space-y-6 shadow-sm"
              >
                {/* Visual Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-church-gold/10 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl border-2 border-church-gold/20 bg-church-cream flex items-center justify-center overflow-hidden shrink-0">
                      {selectedReportMember.photoUrl ? (
                        <img src={selectedReportMember.photoUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Users className="h-8 w-8 text-church-navy/50" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-serif text-2xl font-black text-church-navy">
                        {selectedReportMember.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="rounded-md bg-church-navy text-[9px] font-bold uppercase tracking-wider py-0.5 px-2 text-white">
                          {selectedReportMember.position || 'Membro'}
                        </span>
                        {selectedReportMember.department && (
                          <span className="rounded-md bg-church-gold/15 text-[9px] font-bold uppercase tracking-wider py-0.5 px-2 text-church-navy">
                            {selectedReportMember.department}
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          selectedReportMember.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {selectedReportMember.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePrintReport(selectedReportMember, memberReportDetails)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-church-gold text-church-navy hover:bg-church-gold/90 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir / PDF
                    </button>
                    <button
                      onClick={() => handleDownloadCsv(selectedReportMember, memberReportDetails)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-church-navy text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      Baixar (CSV)
                    </button>
                  </div>
                </div>

                {/* Grid stats overview details */}
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                  <div className="p-4 bg-church-cream/30 rounded-2xl border border-church-gold/5 text-center">
                    <p className="text-[10px] text-church-navy/40 font-bold uppercase tracking-wider">Frequência</p>
                    <p className="text-2xl font-black text-church-navy mt-1">
                      {memberReportDetails?.attendancePercentage}%
                    </p>
                  </div>
                  <div className="p-4 bg-church-cream/30 rounded-2xl border border-church-gold/5 text-center">
                    <p className="text-[10px] text-church-navy/40 font-bold uppercase tracking-wider">Presenças</p>
                    <p className="text-2xl font-black text-green-600 mt-1">
                      {memberReportDetails?.presentCount}
                    </p>
                  </div>
                  <div className="p-4 bg-church-cream/30 rounded-2xl border border-church-gold/5 text-center">
                    <p className="text-[10px] text-church-navy/40 font-bold uppercase tracking-wider">Faltas</p>
                    <p className="text-2xl font-black text-red-500 mt-1">
                      {memberReportDetails?.absentCount}
                    </p>
                  </div>
                  <div className="p-4 bg-church-cream/30 rounded-2xl border border-church-gold/5 text-center">
                    <p className="text-[10px] text-church-navy/40 font-bold uppercase tracking-wider">Avaliados</p>
                    <p className="text-2xl font-black text-church-navy mt-1">
                      {memberReportDetails?.totalServices}
                    </p>
                  </div>
                </div>

                {/* Service type comparison bar */}
                <div className="space-y-4">
                  <h4 className="font-serif text-md font-bold text-church-navy flex items-center gap-2 border-b border-church-gold/5 pb-2">
                    <BarChart2 className="h-4.5 w-4.5 text-church-gold" />
                    Frequência por Tipo de Culto
                  </h4>
                  <div className="space-y-3">
                    {memberReportDetails?.breakdown.map(b => (
                      <div key={b.key} className="space-y-1">
                        <div className="flex justify-between items-center text-xs text-church-navy font-bold">
                          <span>{b.name}</span>
                          <span className="text-church-navy/60">
                            {b.percentage !== null ? `${b.percentage}%` : 'N/A'} ({b.present}/{b.total})
                          </span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              b.percentage === null
                                ? 'bg-transparent'
                                : b.percentage >= 75
                                ? 'bg-green-500'
                                : b.percentage >= 50
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${b.percentage !== null ? b.percentage : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subdetails Info */}
                <div className="grid gap-6 sm:grid-cols-2 border-t border-church-gold/5 pt-5 text-xs text-church-navy">
                  <div className="space-y-3">
                    <h5 className="font-bold text-sm text-church-navy border-b border-church-gold/5 pb-1">Outras Informações</h5>
                    <div className="flex justify-between">
                      <span className="text-church-navy/50">Nascimento</span>
                      <span className="font-bold">
                        {selectedReportMember.birthDate ? format(parseISO(selectedReportMember.birthDate), 'dd/MM/yyyy') : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-church-navy/50">Data de Conversão</span>
                      <span className="font-bold">
                        {selectedReportMember.conversionDate ? format(parseISO(selectedReportMember.conversionDate), 'dd/MM/yyyy') : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-church-navy/50">Contato</span>
                      <span className="font-bold">{selectedReportMember.whatsapp || selectedReportMember.phone || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-church-navy/50">E-mail</span>
                      <span className="font-bold truncate max-w-[180px]">{selectedReportMember.email || '—'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-bold text-sm text-church-navy border-b border-church-gold/5 pb-1">Espiritual / Sacramentos</h5>
                    <div className="flex items-center justify-between">
                      <span className="text-church-navy/50">Batizado nas Águas</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold uppercase text-[9px] ${
                        selectedReportMember.isBaptized ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {selectedReportMember.isBaptized ? 'Batizado' : 'Não'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-church-navy/50">Batismo Espírito Santo</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold uppercase text-[9px] ${
                        selectedReportMember.isSpiritBaptized ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {selectedReportMember.isSpiritBaptized ? 'Sim' : 'Não'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-church-navy/50">Dizimista Fiel</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold uppercase text-[9px] ${
                        selectedReportMember.isTither ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {selectedReportMember.isTither ? 'Sim' : 'Não'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chronology logs */}
                <div className="border-t border-church-gold/5 pt-5">
                  <h4 className="font-serif text-md font-bold text-church-navy mb-3">Histórico de Sessões Recentes</h4>
                  <div className="divide-y divide-church-gold/5 max-h-[220px] overflow-y-auto pr-2">
                    {memberReportDetails?.chronHistory.length === 0 ? (
                      <div className="text-center py-4 text-xs text-church-navy/40">Nenhum evento registrado</div>
                    ) : (
                      memberReportDetails?.chronHistory.map(entry => (
                        <div key={entry.id} className="flex justify-between items-center py-2 text-xs">
                          <span className="text-church-navy/40">{format(parseISO(entry.date), 'dd/MM/yyyy')}</span>
                          <span className="font-bold text-church-navy truncate max-w-sm ml-2 mr-auto">{entry.serviceName}</span>
                          <span className={`font-bold ${entry.wasPresent ? 'text-green-600' : 'text-red-500'}`}>
                            {entry.wasPresent ? '▲ Presente' : '▼ Ausente'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

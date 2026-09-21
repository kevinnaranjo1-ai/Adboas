import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, Clock, MapPin, Plus, CheckCircle2, 
  RefreshCw, Share2, Users, User, Shield, AlertCircle, Trash2, 
  ChevronRight, Sparkles, X, Loader2, Music, Video, Heart, BookOpen, 
  Hand, Filter, Check, MessageSquare
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthState } from 'react-firebase-hooks/auth';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

export interface ScheduleSlot {
  id: string;
  roleName: string; // e.g., "Dirigente", "Teclado", "Sonoplastia", "Recepção 1"
  assignedMemberId?: string;
  assignedMemberName: string;
  assignedMemberPhoto?: string;
  assignedMemberEmail?: string;
  status: 'pending' | 'confirmed' | 'swap_requested';
  swapReason?: string;
  swapRequestedAt?: string;
  confirmedAt?: string;
}

export interface Schedule {
  id: string;
  title: string;
  ministry: string; // "Louvor", "Mídia", "Recepção", "Infantil", "EBD", "Portaria", "Diaconato"
  serviceType: string; // "Culto de Domingo", "Culto de Ensino", "Culto de Jovens", "EBD"
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: string;
  notes?: string;
  slots: ScheduleSlot[];
  createdById: string;
  createdByName: string;
  createdAt: any;
}

interface SchedulesPageProps {
  role?: string | null;
}

const MINISTRIES = [
  { id: 'todos', label: 'Todos os Ministérios', icon: Users, color: 'bg-church-navy text-white' },
  { id: 'Louvor', label: 'Louvor & Adoração', icon: Music, color: 'bg-amber-500 text-white' },
  { id: 'Mídia', label: 'Mídia & Transmissão', icon: Video, color: 'bg-blue-600 text-white' },
  { id: 'Recepção', label: 'Recepção & Acolhimento', icon: Heart, color: 'bg-rose-500 text-white' },
  { id: 'Infantil', label: 'Ministério Infantil', icon: Sparkles, color: 'bg-purple-600 text-white' },
  { id: 'EBD', label: 'Escola Dominical (EBD)', icon: BookOpen, color: 'bg-emerald-600 text-white' },
  { id: 'Diaconato', label: 'Diaconato & Portaria', icon: Shield, color: 'bg-indigo-600 text-white' }
];

const DEFAULT_TEMPLATES: Record<string, { roleName: string }[]> = {
  Louvor: [
    { roleName: 'Dirigente do Louvor' },
    { roleName: 'Ministração / Vocal' },
    { roleName: 'Vocal Apoio' },
    { roleName: 'Teclado' },
    { roleName: 'Violão' },
    { roleName: 'Bateria' },
    { roleName: 'Baixo Elétrico' }
  ],
  Mídia: [
    { roleName: 'Operador de Som (Sonoplastia)' },
    { roleName: 'Projeção & Datashow' },
    { roleName: 'Câmera Transmissão' },
    { roleName: 'Mídia Social & Fotos' }
  ],
  Recepção: [
    { roleName: 'Boas-Vindas Entrada Principal' },
    { roleName: 'Recepção Templo' },
    { roleName: 'Apoio Ofertas e Dizimos' }
  ],
  Infantil: [
    { roleName: 'Professora Crianças (Maternal)' },
    { roleName: 'Professora Crianças (Juniores)' },
    { roleName: 'Auxiliar Infantil' }
  ],
  EBD: [
    { roleName: 'Professor Classe Adultos' },
    { roleName: 'Professor Classe Jovens' },
    { roleName: 'Secretaria EBD' }
  ],
  Diaconato: [
    { roleName: 'Portaria & Estacionamento' },
    { roleName: 'Diácono de Serviço' },
    { roleName: 'Organização do Templo' }
  ]
};

export default function SchedulesPage({ role }: SchedulesPageProps) {
  const [user] = useAuthState(auth);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [membersList, setMembersList] = useState<{ id: string; name: string; email?: string; photoUrl?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMinistry, setSelectedMinistry] = useState<string>('todos');
  const [filterMode, setFilterMode] = useState<'todas' | 'minhas' | 'trocas'>('todas');
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduleToDeleteId, setScheduleToDeleteId] = useState<string | null>(null);
  
  // Swap request modal
  const [swapModalState, setSwapModalState] = useState<{ scheduleId: string; slotId: string; roleName: string } | null>(null);
  const [swapReasonInput, setSwapReasonInput] = useState('');

  // Form state for creating schedule
  const [formTitle, setFormTitle] = useState('');
  const [formMinistry, setFormMinistry] = useState('Louvor');
  const [formServiceType, setFormServiceType] = useState('Culto de Domingo');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formTime, setFormTime] = useState('19:00');
  const [formLocation, setFormLocation] = useState('Templo Principal - AD Boas Novas');
  const [formNotes, setFormNotes] = useState('');
  const [formSlots, setFormSlots] = useState<{ id: string; roleName: string; assignedMemberId: string; assignedMemberName: string }[]>([
    { id: '1', roleName: 'Dirigente', assignedMemberId: '', assignedMemberName: '' },
    { id: '2', roleName: 'Pregação / Palavra', assignedMemberId: '', assignedMemberName: '' }
  ]);

  const isAdminOrLeader = useMemo(() => {
    return (role && ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'secretária', 'tesoureira', 'porteiro zelador', 'apoio', 'mídia social'].includes(role.toLowerCase())) ||
           user?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com';
  }, [role, user]);

  // Fetch schedules
  useEffect(() => {
    const q = query(collection(db, 'schedules'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Schedule[];
      setSchedules(data);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'schedules');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch members list for dropdown autocomplete
  useEffect(() => {
    const qMembers = query(collection(db, 'members'));
    const unsubscribeMembers = onSnapshot(qMembers, (snapshot) => {
      const list = snapshot.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.name || 'Membro',
          email: d.email || '',
          photoUrl: d.photoUrl || d.photoURL || ''
        };
      });
      setMembersList(list);
    });

    return () => unsubscribeMembers();
  }, []);

  // Filtered schedules logic
  const filteredSchedules = useMemo(() => {
    return schedules.filter(sch => {
      // Ministry filter
      if (selectedMinistry !== 'todos' && sch.ministry !== selectedMinistry) {
        return false;
      }
      
      // Filter mode
      if (filterMode === 'minhas') {
        const isUserInSchedule = sch.slots.some(slot => 
          (slot.assignedMemberEmail && slot.assignedMemberEmail.toLowerCase() === user?.email?.toLowerCase()) ||
          (user?.displayName && slot.assignedMemberName.toLowerCase().includes(user.displayName.toLowerCase()))
        );
        if (!isUserInSchedule) return false;
      } else if (filterMode === 'trocas') {
        const hasSwapReq = sch.slots.some(slot => slot.status === 'swap_requested');
        if (!hasSwapReq) return false;
      }

      return true;
    });
  }, [schedules, selectedMinistry, filterMode, user]);

  // User's next upcoming schedule slots
  const myUpcomingSlots = useMemo(() => {
    if (!user) return [];
    const myEmail = user.email?.toLowerCase();
    const myName = user.displayName?.toLowerCase();

    const results: { schedule: Schedule; slot: ScheduleSlot }[] = [];

    schedules.forEach(sch => {
      sch.slots.forEach(slot => {
        const matchEmail = slot.assignedMemberEmail && slot.assignedMemberEmail.toLowerCase() === myEmail;
        const matchName = myName && slot.assignedMemberName.toLowerCase().includes(myName);
        if (matchEmail || matchName) {
          results.push({ schedule: sch, slot });
        }
      });
    });

    return results;
  }, [schedules, user]);

  // Action: Confirm Presence
  const handleConfirmPresence = async (scheduleId: string, slotId: string) => {
    try {
      const scheduleRef = doc(db, 'schedules', scheduleId);
      const targetSchedule = schedules.find(s => s.id === scheduleId);
      if (!targetSchedule) return;

      const updatedSlots = targetSchedule.slots.map(s => {
        if (s.id === slotId) {
          return {
            ...s,
            status: 'confirmed' as const,
            confirmedAt: new Date().toISOString(),
            swapReason: ''
          };
        }
        return s;
      });

      await updateDoc(scheduleRef, {
        slots: updatedSlots,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schedules/${scheduleId}`);
    }
  };

  // Action: Open Swap Modal
  const handleOpenSwapModal = (scheduleId: string, slotId: string, roleName: string) => {
    setSwapModalState({ scheduleId, slotId, roleName });
    setSwapReasonInput('');
  };

  // Action: Submit Swap Request
  const handleSubmitSwapRequest = async () => {
    if (!swapModalState) return;
    try {
      const { scheduleId, slotId } = swapModalState;
      const scheduleRef = doc(db, 'schedules', scheduleId);
      const targetSchedule = schedules.find(s => s.id === scheduleId);
      if (!targetSchedule) return;

      const updatedSlots = targetSchedule.slots.map(s => {
        if (s.id === slotId) {
          return {
            ...s,
            status: 'swap_requested' as const,
            swapReason: swapReasonInput || 'Solicitou substituição para este dia',
            swapRequestedAt: new Date().toISOString()
          };
        }
        return s;
      });

      await updateDoc(scheduleRef, {
        slots: updatedSlots,
        updatedAt: serverTimestamp()
      });

      setSwapModalState(null);
      setSwapReasonInput('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schedules/${swapModalState.scheduleId}`);
    }
  };

  // Action: Take Over Swap Slot (Cubro esta vaga)
  const handleTakeOverSlot = async (scheduleId: string, slotId: string) => {
    if (!user) return;
    try {
      const scheduleRef = doc(db, 'schedules', scheduleId);
      const targetSchedule = schedules.find(s => s.id === scheduleId);
      if (!targetSchedule) return;

      const updatedSlots = targetSchedule.slots.map(s => {
        if (s.id === slotId) {
          return {
            ...s,
            assignedMemberName: user.displayName || user.email?.split('@')[0] || 'Voluntário',
            assignedMemberEmail: user.email || '',
            assignedMemberPhoto: user.photoURL || '',
            status: 'confirmed' as const,
            confirmedAt: new Date().toISOString(),
            swapReason: ''
          };
        }
        return s;
      });

      await updateDoc(scheduleRef, {
        slots: updatedSlots,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schedules/${scheduleId}`);
    }
  };

  // Action: Delete Schedule
  const handleDeleteSchedule = async () => {
    if (!scheduleToDeleteId) return;
    try {
      await deleteDoc(doc(db, 'schedules', scheduleToDeleteId));
      setScheduleToDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schedules/${scheduleToDeleteId}`);
    }
  };

  // Pre-fill Template Slots in Form
  const handleApplyTemplate = () => {
    const template = DEFAULT_TEMPLATES[formMinistry];
    if (template) {
      setFormSlots(template.map((t, idx) => ({
        id: String(idx + 1),
        roleName: t.roleName,
        assignedMemberId: '',
        assignedMemberName: ''
      })));
    }
  };

  // Form Slot Operations
  const handleAddFormSlot = () => {
    setFormSlots(prev => [
      ...prev,
      { id: String(Date.now()), roleName: '', assignedMemberId: '', assignedMemberName: '' }
    ]);
  };

  const handleRemoveFormSlot = (id: string) => {
    setFormSlots(prev => prev.filter(s => s.id !== id));
  };

  // Action: Create Schedule
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const slotsPayload: ScheduleSlot[] = formSlots
        .filter(s => s.roleName.trim())
        .map(s => {
          const matchedMember = membersList.find(m => m.id === s.assignedMemberId);
          return {
            id: s.id || Math.random().toString(36).substring(2, 9),
            roleName: s.roleName,
            assignedMemberId: s.assignedMemberId || '',
            assignedMemberName: s.assignedMemberName || matchedMember?.name || 'Vago',
            assignedMemberEmail: matchedMember?.email || '',
            assignedMemberPhoto: matchedMember?.photoUrl || '',
            status: 'pending' as const
          };
        });

      await addDoc(collection(db, 'schedules'), {
        title: formTitle,
        ministry: formMinistry,
        serviceType: formServiceType,
        date: formDate,
        time: formTime,
        location: formLocation || 'AD Boas Novas',
        notes: formNotes,
        slots: slotsPayload,
        createdById: user?.uid || '',
        createdByName: user?.displayName || 'Líder',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setIsCreateModalOpen(false);
      // Reset form
      setFormTitle('');
      setFormNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'schedules');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Share Schedule via WhatsApp
  const handleShareWhatsApp = (schedule: Schedule) => {
    let dateStr = schedule.date;
    try {
      dateStr = format(parseISO(schedule.date), "EEEE, d 'de' MMMM", { locale: ptBR });
      dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    } catch {}

    let text = `📢 *ESCALA DE ${schedule.ministry.toUpperCase()} - AD BOAS NOVAS*\n`;
    text += `🗓️ *Culto:* ${schedule.title} (${schedule.serviceType})\n`;
    text += `📅 *Data:* ${dateStr} às ${schedule.time}\n`;
    text += `📍 *Local:* ${schedule.location}\n`;
    if (schedule.notes) text += `💡 *Orientações:* ${schedule.notes}\n`;
    text += `\n*ESCALADOS:*\n`;

    schedule.slots.forEach(slot => {
      const statusSymbol = slot.status === 'confirmed' ? '✅' : slot.status === 'swap_requested' ? '🔄 (Solicitou Troca)' : '⏳';
      text += `• *${slot.roleName}:* ${slot.assignedMemberName} ${statusSymbol}\n`;
    });

    text += `\n📲 *Acesse o App da Igreja para confirmar ou ver sua escala:* ${window.location.origin}/admin/agenda`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1e33] via-church-navy to-[#102d4a] p-6 sm:p-8 text-white shadow-xl border border-church-gold/30">
        <div className="absolute -right-12 -top-12 h-60 w-60 rounded-full bg-church-gold/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-church-gold/20 border border-church-gold/40 px-3 py-1 text-xs font-bold text-amber-200">
              <CalendarIcon className="h-3.5 w-3.5 text-church-gold" />
              <span>Organização & Voluntários</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Escala de Servidores & Ministérios
            </h1>
            <p className="text-xs sm:text-sm text-white/80 max-w-xl font-medium leading-relaxed">
              Consulte sua escala nos cultos, confirme sua presença com 1 clique ou solicite troca de voluntário facilmente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdminOrLeader && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-church-gold to-amber-500 px-5 py-3 text-xs font-bold text-church-navy shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
                <span>Nova Escala</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* User's Upcoming Duty Banner (Highlight) */}
      {myUpcomingSlots.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-church-gold/40 p-4 sm:p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-church-navy">
              <Sparkles className="h-5 w-5 text-church-gold animate-bounce" />
              <h2 className="font-serif text-base font-bold">Você tem escalas agendadas!</h2>
            </div>
            <span className="text-xs font-semibold text-church-navy/60 bg-white/80 px-2.5 py-1 rounded-full border border-church-gold/20">
              {myUpcomingSlots.length} {myUpcomingSlots.length === 1 ? 'função' : 'funções'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myUpcomingSlots.map(({ schedule, slot }) => {
              let formattedDate = schedule.date;
              try {
                formattedDate = format(parseISO(schedule.date), "EEEE, d 'de' MMMM", { locale: ptBR });
                formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
              } catch {}

              return (
                <div key={`${schedule.id}-${slot.id}`} className="bg-white rounded-2xl p-3.5 border border-church-gold/25 shadow-sm space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        {schedule.ministry}
                      </span>
                      <h3 className="font-serif text-sm font-bold text-church-navy mt-1 leading-snug">
                        {schedule.title}
                      </h3>
                      <p className="text-xs text-church-navy/70 font-medium">
                        Função: <span className="font-bold text-church-navy">{slot.roleName}</span>
                      </p>
                    </div>

                    {/* Status Badge */}
                    {slot.status === 'confirmed' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-1 text-[10.5px] font-bold text-emerald-800 shrink-0">
                        <Check className="h-3 w-3 stroke-[3]" /> Confirmado
                      </span>
                    ) : slot.status === 'swap_requested' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-1 text-[10.5px] font-bold text-amber-800 shrink-0">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Troca Pedida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-300 px-2.5 py-1 text-[10.5px] font-bold text-blue-800 shrink-0">
                        <Clock className="h-3 w-3" /> Aguardando
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-church-navy/70 pt-1 border-t border-gray-100 font-medium">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3.5 w-3.5 text-church-gold" />
                      {formattedDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-church-gold" />
                      {schedule.time}
                    </span>
                  </div>

                  {/* Actions for member */}
                  <div className="flex items-center gap-2 pt-1">
                    {slot.status !== 'confirmed' && (
                      <button
                        onClick={() => handleConfirmPresence(schedule.id, slot.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Confirmar Presença</span>
                      </button>
                    )}

                    {slot.status !== 'swap_requested' && (
                      <button
                        onClick={() => handleOpenSwapModal(schedule.id, slot.id, slot.roleName)}
                        className="rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Pedir Troca</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Filter Tabs & Quick Mode Toggle */}
      <div className="space-y-3">
        {/* Ministry Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {MINISTRIES.map(m => {
            const Icon = m.icon;
            const isSelected = selectedMinistry === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMinistry(m.id)}
                className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? `${m.color} border-transparent shadow-md scale-105`
                    : 'bg-white text-church-navy border-church-navy/10 hover:bg-church-cream'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Secondary Filter Buttons */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-church-gold/15">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-church-navy/10">
            <button
              onClick={() => setFilterMode('todas')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterMode === 'todas' ? 'bg-church-navy text-white' : 'text-church-navy/70 hover:text-church-navy'
              }`}
            >
              Todas as Escalas
            </button>
            <button
              onClick={() => setFilterMode('minhas')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterMode === 'minhas' ? 'bg-church-navy text-white' : 'text-church-navy/70 hover:text-church-navy'
              }`}
            >
              Minhas Escalas
            </button>
            <button
              onClick={() => setFilterMode('trocas')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterMode === 'trocas' ? 'bg-amber-600 text-white' : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              <RefreshCw className="h-3 w-3" />
              <span>Trocas Pendentes</span>
            </button>
          </div>

          <span className="text-xs text-church-navy/60 font-semibold">
            Mostrando {filteredSchedules.length} escalas
          </span>
        </div>
      </div>

      {/* Main Schedules List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-church-gold" />
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-church-navy/10 p-6 space-y-3">
          <CalendarIcon className="h-12 w-12 text-church-navy/30 mx-auto" />
          <h3 className="font-serif text-base font-bold text-church-navy">
            Nenhuma escala encontrada
          </h3>
          <p className="text-xs text-church-navy/60 max-w-sm mx-auto font-medium">
            {filterMode === 'minhas' 
              ? 'Você não possui escalas agendadas neste filtro.' 
              : filterMode === 'trocas' 
              ? 'Não há solicitações de trocas pendentes no momento.'
              : 'Nenhuma escala foi cadastrada para este ministério ainda.'}
          </p>
          {isAdminOrLeader && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-church-navy px-4 py-2 text-xs font-bold text-white hover:bg-church-navy/90 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Criar Primeira Escala</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSchedules.map((schedule) => {
            let formattedDate = schedule.date;
            try {
              formattedDate = format(parseISO(schedule.date), "EEEE, d 'de' MMMM", { locale: ptBR });
              formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
            } catch {}

            const confirmedCount = schedule.slots.filter(s => s.status === 'confirmed').length;
            const swapCount = schedule.slots.filter(s => s.status === 'swap_requested').length;
            const totalSlots = schedule.slots.length;

            return (
              <motion.div
                key={schedule.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-3xl border border-church-gold/25 bg-white p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-church-gold/15 pb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-church-navy bg-church-gold/20 border border-church-gold/40 px-2.5 py-0.5 rounded-md">
                          {schedule.ministry}
                        </span>
                        <span className="text-[10px] font-bold text-church-navy/60 bg-gray-100 px-2 py-0.5 rounded-md">
                          {schedule.serviceType}
                        </span>
                      </div>

                      <h3 className="font-serif text-base font-bold text-church-navy mt-1.5 leading-snug">
                        {schedule.title}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-church-navy/70 mt-1 font-medium">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3.5 w-3.5 text-church-gold" />
                          {formattedDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-church-gold" />
                          {schedule.time}
                        </span>
                      </div>
                    </div>

                    {/* Options / Delete for Admin */}
                    {isAdminOrLeader && (
                      <button
                        onClick={() => setScheduleToDeleteId(schedule.id)}
                        className="text-church-navy/30 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                        title="Excluir escala"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Summary Bar */}
                  <div className="flex items-center justify-between text-[11px] font-semibold bg-church-cream/50 p-2 rounded-xl border border-church-gold/10">
                    <span className="text-church-navy/70">
                      Confirmações: <strong className="text-church-navy">{confirmedCount}/{totalSlots}</strong>
                    </span>
                    {swapCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-md">
                        <RefreshCw className="h-3 w-3 animate-spin" /> {swapCount} troca pendente
                      </span>
                    )}
                  </div>

                  {/* Slots List */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-church-navy/50">
                      Equipe Escalada ({totalSlots})
                    </h4>

                    <div className="space-y-1.5">
                      {schedule.slots.map((slot) => {
                        const isMe = user && (
                          (slot.assignedMemberEmail && slot.assignedMemberEmail.toLowerCase() === user.email?.toLowerCase()) ||
                          (user.displayName && slot.assignedMemberName.toLowerCase().includes(user.displayName.toLowerCase()))
                        );

                        return (
                          <div 
                            key={slot.id}
                            className={`p-2.5 rounded-2xl border text-xs transition-all flex items-center justify-between gap-2 ${
                              isMe
                                ? 'bg-amber-50/80 border-church-gold/50 shadow-xs'
                                : slot.status === 'swap_requested'
                                ? 'bg-rose-50/60 border-rose-200'
                                : 'bg-gray-50/70 border-gray-200/80'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-church-navy/10 text-church-navy flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-church-gold/20">
                                {slot.assignedMemberPhoto ? (
                                  <img src={slot.assignedMemberPhoto} alt={slot.assignedMemberName} className="h-full w-full object-cover" />
                                ) : (
                                  <span>{slot.assignedMemberName.slice(0, 2).toUpperCase()}</span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <span className="block text-[10px] font-bold text-church-navy/50 uppercase leading-tight truncate">
                                  {slot.roleName}
                                </span>
                                <span className="block text-xs font-bold text-church-navy leading-tight truncate">
                                  {slot.assignedMemberName}
                                  {isMe && <span className="text-[9.5px] text-amber-700 font-extrabold ml-1">(Você)</span>}
                                </span>
                                {slot.swapReason && (
                                  <span className="block text-[9.5px] text-rose-700 font-medium truncate italic mt-0.5">
                                    Motivo: "{slot.swapReason}"
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Status & Quick Action Button */}
                            <div className="shrink-0 flex items-center gap-1">
                              {/* If swap requested & not me: offer "Assumir Vaga" */}
                              {slot.status === 'swap_requested' && !isMe && (
                                <button
                                  onClick={() => handleTakeOverSlot(schedule.id, slot.id)}
                                  className="rounded-xl bg-amber-500 hover:bg-amber-600 text-church-navy font-bold text-[10.5px] px-2.5 py-1 transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1"
                                  title="Substituir e assumir este posto"
                                >
                                  <Hand className="h-3 w-3" />
                                  <span>Assumir</span>
                                </button>
                              )}

                              {/* If me & pending: Confirm or Swap */}
                              {isMe && slot.status !== 'confirmed' && (
                                <button
                                  onClick={() => handleConfirmPresence(schedule.id, slot.id)}
                                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] px-2.5 py-1 transition-all shadow-xs cursor-pointer"
                                >
                                  Confirmar
                                </button>
                              )}

                              {/* Status Icon */}
                              {slot.status === 'confirmed' ? (
                                <span className="p-1 text-emerald-600" title="Presença Confirmada">
                                  <CheckCircle2 className="h-4 w-4" />
                                </span>
                              ) : slot.status === 'swap_requested' ? (
                                <span className="p-1 text-rose-600 animate-pulse" title="Solicitou Troca">
                                  <RefreshCw className="h-4 w-4" />
                                </span>
                              ) : (
                                <span className="p-1 text-gray-400" title="Aguardando Confirmação">
                                  <Clock className="h-4 w-4" />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {schedule.notes && (
                    <div className="p-2.5 rounded-2xl bg-amber-50/60 border border-amber-200/60 text-xs text-amber-900 space-y-0.5">
                      <span className="font-bold text-[10px] uppercase tracking-wider block text-amber-800">
                        Orientações:
                      </span>
                      <p className="leading-snug text-[11px]">{schedule.notes}</p>
                    </div>
                  )}
                </div>

                {/* Footer Share Button */}
                <div className="pt-3 border-t border-church-gold/15 mt-2">
                  <button
                    onClick={() => handleShareWhatsApp(schedule)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300/80 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Compartilhar no WhatsApp</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal: Swap Request Reason */}
      <AnimatePresence>
        {swapModalState && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-church-navy/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-church-gold/30 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2 text-church-navy">
                  <RefreshCw className="h-5 w-5 text-amber-600" />
                  <h3 className="font-serif text-lg font-bold">Solicitar Troca de Escala</h3>
                </div>
                <button
                  onClick={() => setSwapModalState(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-church-navy/70 leading-relaxed font-medium">
                Você está solicitando substituição para a função de <strong className="text-church-navy">{swapModalState.roleName}</strong>. Outros irmãos do ministério poderão ver seu pedido e assumir a vaga.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-church-navy block">
                  Motivo ou Observação (Opcional)
                </label>
                <textarea
                  value={swapReasonInput}
                  onChange={(e) => setSwapReasonInput(e.target.value)}
                  placeholder="Ex: Terei compromisso de trabalho / viagem neste horário..."
                  rows={3}
                  className="w-full rounded-2xl border border-church-navy/20 p-3 text-xs focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSwapModalState(null)}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-bold text-church-navy hover:bg-gray-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmitSwapRequest}
                  className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Confirmar Pedido de Troca
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Create New Schedule */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-church-navy/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-church-gold/30 space-y-5 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2 text-church-navy">
                  <CalendarIcon className="h-5 w-5 text-church-gold" />
                  <h3 className="font-serif text-xl font-bold">Criar Nova Escala</h3>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSchedule} className="space-y-4">
                {/* Ministry & Culto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-church-navy block mb-1">
                      Ministério / Departamento
                    </label>
                    <select
                      value={formMinistry}
                      onChange={(e) => setFormMinistry(e.target.value)}
                      className="w-full rounded-2xl border border-church-navy/20 p-2.5 text-xs focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold font-bold bg-white"
                    >
                      {MINISTRIES.filter(m => m.id !== 'todos').map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-church-navy block mb-1">
                      Tipo de Culto / Evento
                    </label>
                    <select
                      value={formServiceType}
                      onChange={(e) => setFormServiceType(e.target.value)}
                      className="w-full rounded-2xl border border-church-navy/20 p-2.5 text-xs focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold font-bold bg-white"
                    >
                      <option value="Culto de Domingo">Culto de Celebração - Domingo</option>
                      <option value="Culto de Ensino">Culto de Ensino - Quarta</option>
                      <option value="Culto de Jovens">Culto de Jovens - Sábado</option>
                      <option value="Escola Dominical">Escola Dominical (EBD)</option>
                      <option value="Culto Especial">Culto / Congresso Especial</option>
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-xs font-bold text-church-navy block mb-1">
                    Título da Escala
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex: Escala de Louvor e Mídia - Domingo Noite"
                    className="w-full rounded-2xl border border-church-navy/20 p-2.5 text-xs focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold"
                  />
                </div>

                {/* Date & Time & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-church-navy block mb-1">
                      Data
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full rounded-2xl border border-church-navy/20 p-2.5 text-xs focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-church-navy block mb-1">
                      Horário
                    </label>
                    <input
                      type="time"
                      required
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full rounded-2xl border border-church-navy/20 p-2.5 text-xs focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-church-navy block mb-1">
                      Local
                    </label>
                    <input
                      type="text"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="Templo Principal"
                      className="w-full rounded-2xl border border-church-navy/20 p-2.5 text-xs focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-bold text-church-navy block mb-1">
                    Orientações para a Equipe (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Ex: Chegar com 30 minutos de antecedência para ensaio..."
                    className="w-full rounded-2xl border border-church-navy/20 p-2.5 text-xs focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold"
                  />
                </div>

                {/* Slots / Team Builder Header */}
                <div className="pt-3 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-church-navy">Voluntários Escalados</h4>
                      <p className="text-[11px] text-church-navy/60">Defina as funções e atribua os membros da igreja</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleApplyTemplate}
                        className="rounded-xl border border-church-gold/40 bg-amber-50 text-amber-800 px-3 py-1.5 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1"
                        title="Preencher com funções padrão do ministério"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                        <span>Preencher Modelo</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAddFormSlot}
                        className="rounded-xl bg-church-navy text-white px-3 py-1.5 text-xs font-bold hover:bg-church-navy/90 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Função</span>
                      </button>
                    </div>
                  </div>

                  {/* Slots Inputs */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {formSlots.map((slot, index) => (
                      <div key={slot.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200">
                        <span className="text-[10px] font-bold text-church-navy/40 w-5 text-center">{index + 1}</span>
                        
                        <input
                          type="text"
                          required
                          placeholder="Função (Ex: Teclado)"
                          value={slot.roleName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormSlots(prev => prev.map(s => s.id === slot.id ? { ...s, roleName: val } : s));
                          }}
                          className="w-1/2 rounded-xl border border-gray-300 p-2 text-xs focus:border-church-gold focus:outline-none"
                        />

                        {/* Select Member */}
                        <select
                          value={slot.assignedMemberId}
                          onChange={(e) => {
                            const memberId = e.target.value;
                            const matched = membersList.find(m => m.id === memberId);
                            setFormSlots(prev => prev.map(s => s.id === slot.id ? { 
                              ...s, 
                              assignedMemberId: memberId,
                              assignedMemberName: matched ? matched.name : 'Vago'
                            } : s));
                          }}
                          className="w-1/2 rounded-xl border border-gray-300 p-2 text-xs focus:border-church-gold focus:outline-none bg-white"
                        >
                          <option value="">-- Selecionar Membro --</option>
                          {membersList.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>

                        {formSlots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFormSlot(slot.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-bold text-church-navy hover:bg-gray-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-church-gold to-amber-500 text-church-navy px-6 py-2.5 text-xs font-bold shadow-md hover:brightness-110 transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Salvar e Publicar Escala</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!scheduleToDeleteId}
        title="Excluir Escala"
        message="Tem certeza que deseja remover esta escala? Esta ação não poderá ser desfeita."
        onConfirm={handleDeleteSchedule}
        onClose={() => setScheduleToDeleteId(null)}
      />
    </div>
  );
}

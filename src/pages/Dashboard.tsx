import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Clock, CheckCircle2, ChevronRight, AlertCircle, Plus, Eye, IdCard, Users, Cake, Gift, MessageCircle, Camera, Calendar, MapPin, Sparkles, Mic, User, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useState, useMemo } from 'react';
import ReportDetailModal from '../components/ReportDetailModal';
import MemberIDCardModal from '../components/MemberIDCardModal';
import VerseOfTheDay from '../components/VerseOfTheDay';
import ChurchAddressMap from '../components/ChurchAddressMap';
import PixContributionCard from '../components/PixContributionCard';

import AnnouncementBanner from '../components/AnnouncementBanner';

const getRoleLabel = (r: string | null) => {
  if (!r) return '';
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

interface DashboardProps {
  role: string | null;
}

export default function Dashboard({ role }: DashboardProps) {
  const user = auth.currentUser;
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isIDCardOpen, setIsIDCardOpen] = useState(false);
  const [userMemberPhoto, setUserMemberPhoto] = useState<string | null>(null);

  const isAdmin = role && ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social'].includes(role);
  
  const reportsQuery = user ? query(
    collection(db, 'reports'),
    where('enviadoById', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(5)
  ) : null;

  const [reportsValue, loading, error] = useCollection(reportsQuery);

  const memberQuery = user?.email ? query(
    collection(db, 'members'),
    where('email', '==', user.email),
    limit(1)
  ) : null;

  const [memberSnap, memberLoading] = useCollection(memberQuery);
  const loggedInMember = (memberSnap && !memberSnap.empty) 
    ? { id: memberSnap.docs[0].id, ...memberSnap.docs[0].data() } as any
    : (user ? {
        id: user.uid,
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'Membro'),
        email: user.email || '',
        role: role || 'membro',
        position: role && role !== 'membro' ? getRoleLabel(role) : 'Membro',
        status: 'active',
        isBaptized: true,
        isSpiritBaptized: false,
        isTither: true,
        photoUrl: user.photoURL || userMemberPhoto || null
      } : null);

  // Query events collection for monthly events
  const [eventsSnap, eventsLoading, eventsError] = useCollection(
    user ? query(collection(db, 'events'), orderBy('date', 'asc')) : null
  );

  const getEventDate = (evtDate: any): Date | null => {
    if (!evtDate) return null;
    if (evtDate.toDate && typeof evtDate.toDate === 'function') {
      return evtDate.toDate();
    }
    if (evtDate.seconds) {
      return new Date(evtDate.seconds * 1000);
    }
    if (evtDate instanceof Date) return evtDate;
    const parsed = new Date(evtDate);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const upcomingEvents = useMemo(() => {
    if (!eventsSnap) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return eventsSnap.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter((evt: any) => {
        const d = getEventDate(evt.date);
        if (!d) return false;
        return d >= today;
      })
      .sort((a: any, b: any) => {
        const dA = getEventDate(a.date)?.getTime() || 0;
        const dB = getEventDate(b.date)?.getTime() || 0;
        return dA - dB;
      })
      .slice(0, 4); // Mostra os próximos 4 eventos a acontecer
  }, [eventsSnap]);

  // Query all members to calculate birthdays in-memory
  const [allMembersSnap, allMembersLoading, allMembersError] = useCollection(
    user ? collection(db, 'members') : null
  );

  // Help calculate birthdays of the month
  const getBirthdaysThisMonth = (docs: any[]): any[] => {
    const result: any[] = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0); // ignore timezone shifts
    const currentMonth = today.getMonth(); // 0-indexed
    
    docs.forEach((doc) => {
      const data = doc.data();
      const birthDateStr = data.birthDate;
      if (!birthDateStr) return;
      
      const parts = birthDateStr.split('-');
      if (parts.length < 3) return;
      
      const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
      const birthDay = parseInt(parts[2], 10);
      
      if (birthMonth === currentMonth) {
        const isTodayBday = today.getDate() === birthDay;
        result.push({
          id: doc.id,
          name: data.name,
          whatsapp: data.whatsapp || data.phone || '',
          birthDate: birthDateStr,
          position: data.position || 'Membro',
          photoUrl: data.photoUrl || '',
          birthDay,
          isToday: isTodayBday
        });
      }
    });
    
    // Sort by day of the month
    return result.sort((a, b) => a.birthDay - b.birthDay);
  };

  const birthdaysThisMonth = allMembersSnap ? getBirthdaysThisMonth(allMembersSnap.docs) : [];

  const memberShowcaseList = allMembersSnap
    ? allMembersSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as any))
        .filter((m) => m.name && m.id !== loggedInMember?.id)
        .sort((a, b) => {
          if (a.photoUrl && !b.photoUrl) return -1;
          if (!a.photoUrl && b.photoUrl) return 1;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 6)
    : [];

  const getWeekdayNameThisYear = (birthDateStr: string): string => {
    const parts = birthDateStr.split('-');
    if (parts.length < 3) return '';
    const today = new Date();
    const currentYear = today.getFullYear();
    const birthMonth = parseInt(parts[1], 10) - 1;
    const birthDay = parseInt(parts[2], 10);
    const bdayThisYear = new Date(currentYear, birthMonth, birthDay);
    
    const weekdays = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado'
    ];
    return weekdays[bdayThisYear.getDay()];
  };

  const getFormattedDay = (dateStr: string): string => {
    const parts = dateStr.split('-');
    if (parts.length < 3) return '';
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const day = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10) - 1;
    return `${day} de ${monthNames[month]}`;
  };

  const getWhatsAppLink = (name: string, phone: string, isTodayBday: boolean) => {
    const cleanedPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanedPhone.length === 11 ? `55${cleanedPhone}` : cleanedPhone;
    
    const message = isTodayBday
      ? `Olá, ${name.split(' ')[0]}! A paz do Senhor. Nós da AD Boas Novas queremos lhe parabenizar pelo seu aniversário hoje! Que Deus continue te abençoando imensamente, derramando graça e saúde sobre sua vida. Parabéns! 🎉🙌`
      : `Olá, ${name.split(' ')[0]}! A paz do Senhor. Nós da AD Boas Novas queremos lhe parabenizar pelo seu aniversário neste mês! Que as ricas bênçãos do Senhor estejam sobre você hoje e sempre. Parabéns! 🎈🎊`;
      
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  };

  const getGreetingName = () => {
    // If we have a matched loggedInMember with a non-empty name, use that!
    if (loggedInMember?.name) {
      return loggedInMember.name.split(' ')[0];
    }
    
    // Otherwise, check user.displayName
    const dName = user?.displayName;
    if (dName && !dName.includes('@')) {
      return dName.split(' ')[0];
    }
    
    // If displayName contains @ or is absent, clean up the email
    if (user?.email) {
      const part = user.email.split('@')[0];
      const cleaned = part.replace(/[0-9._-]+/g, ' ').trim();
      if (cleaned) {
        return cleaned.split(' ')[0].charAt(0).toUpperCase() + cleaned.split(' ')[0].slice(1);
      }
    }
    
    return 'Membro';
  };

  const stats = isAdmin ? [
    { label: 'Relatórios este ano', value: reportsValue?.docs.length || 0, icon: FileText, color: 'text-blue-600' },
    { label: 'Status', value: getRoleLabel(role), icon: CheckCircle2, color: 'text-green-600' },
  ] : [
    { label: 'Status de Membro', value: 'Ativo', icon: CheckCircle2, color: 'text-green-600' },
  ];

  return (
    <div className="space-y-8">
      <AnnouncementBanner />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <header>
          <h1 className="font-serif text-3xl font-bold text-church-navy">Bem-vindo, {getGreetingName()}</h1>
          <p className="text-church-navy/60">
            {isAdmin ? 'Controle de relatórios mensais - AD Boas Novas' : 'Portal do Membro - AD Boas Novas'}
          </p>
        </header>
      </div>

      {/* Devocional do Dia */}
      <VerseOfTheDay />

      {/* Card Compacto: Próximos Eventos */}
      <section className="rounded-2xl border border-church-gold/20 bg-white shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-church-gold/15 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-church-navy text-church-gold shadow-sm">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-church-navy leading-tight">
                Próximos Eventos
              </h2>
              <p className="text-[11px] text-church-navy/60 font-medium">
                Programação a acontecer na igreja
              </p>
            </div>
          </div>

          <Link
            to="/admin/agenda"
            className="inline-flex items-center gap-1 text-xs font-bold text-church-navy hover:text-church-gold transition-colors"
          >
            <span>Ver Agenda Completa</span>
            <ChevronRight className="h-3.5 w-3.5 text-church-gold" />
          </Link>
        </div>

        {eventsLoading ? (
          <div className="py-4 text-center text-church-navy/40 text-xs font-medium">
            Carregando eventos...
          </div>
        ) : eventsError ? (
          <div className="py-2 text-center text-red-500 text-xs font-medium">
            Erro ao carregar eventos.
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="py-4 text-center text-church-navy/50 text-xs font-medium">
            Nenhum evento futuro agendado no momento.
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {upcomingEvents.map((event: any) => {
              const evtDate = getEventDate(event.date);
              const dayNumber = evtDate ? format(evtDate, 'dd') : '--';
              const weekday = evtDate ? format(evtDate, 'EEE', { locale: ptBR }).toUpperCase() : '';
              const monthName = evtDate ? format(evtDate, 'MMM', { locale: ptBR }).toUpperCase() : '';
              const isTodayEvent = evtDate ? isToday(evtDate) : false;

              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-3 rounded-xl p-2.5 border transition-all ${
                    isTodayEvent
                      ? 'border-church-gold bg-church-gold/10 shadow-sm'
                      : 'border-church-gold/10 bg-church-cream/10 hover:border-church-gold/30 hover:bg-white'
                  }`}
                >
                  <div className={`flex flex-col items-center justify-center min-w-[42px] h-[44px] rounded-lg px-1.5 text-center shrink-0 ${
                    isTodayEvent
                      ? 'bg-church-navy text-white'
                      : 'bg-church-navy/5 text-church-navy border border-church-gold/20'
                  }`}>
                    <span className="text-[8px] font-black tracking-widest text-church-gold uppercase leading-none">
                      {weekday}
                    </span>
                    <span className="text-base font-black leading-tight mt-0.5">
                      {dayNumber}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-bold text-church-navy/60 uppercase">
                        {monthName} • {event.time || '19:00'}
                      </span>
                      {isTodayEvent && (
                        <span className="rounded bg-church-gold px-1.5 py-0.2 text-[8px] font-black text-church-navy">
                          HOJE
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-bold text-church-navy truncate leading-tight mt-0.5">
                      {event.title}
                    </h3>
                    {event.preacher && (
                      <p className="text-[10px] text-church-navy/60 truncate mt-0.5">
                        Preletor: {event.preacher}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl border border-church-gold/10 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className={`rounded-lg bg-current/5 p-3 ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-church-navy/60">{stat.label}</p>
                <p className="text-2xl font-bold text-church-navy">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}

        {isAdmin && (
          <Link
            to="/novo-relatorio"
            className="group relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-xl bg-church-navy p-6 shadow-sm transition-all hover:bg-church-navy/90 hover:shadow-md"
          >
            <div className="rounded-full bg-white/10 p-2 text-church-gold">
              <Plus className="h-6 w-6" />
            </div>
            <p className="font-semibold text-white">Novo Relatório</p>
            <div className="absolute -bottom-2 -right-2 h-16 w-16 opacity-10 transition-transform group-hover:scale-110">
              <FileText className="h-full w-full text-white" />
            </div>
          </Link>
        )}
      </div>

      {loggedInMember && (
        <section className="rounded-3xl border border-church-gold/10 bg-white shadow-sm overflow-hidden p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-12 rounded-xl border border-church-gold/15 bg-church-navy/5 overflow-hidden flex items-center justify-center text-church-navy shrink-0">
              {userMemberPhoto || loggedInMember.photoUrl ? (
                <img src={userMemberPhoto || loggedInMember.photoUrl} alt="Sua Foto" className="h-full w-full object-cover" />
              ) : (
                <Users className="h-6 w-6 text-church-navy/40" />
              )}
            </div>
            <div>
              <div className="inline-block bg-church-gold/10 text-church-gold font-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-church-gold/25">
                CREDENCIAL DIGITAL
              </div>
              <h3 className="font-serif text-lg font-black text-church-navy mt-1">Sua Carteira de Membro</h3>
              <p className="text-xs text-church-navy/60">Visualize, imprima e faça o upload de sua foto oficial de membro.</p>
            </div>
          </div>
          
          <button
            onClick={() => setIsIDCardOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-church-navy px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 whitespace-nowrap border border-church-gold/10"
          >
            <IdCard className="h-4 w-4 text-church-gold" /> Abrir Credencial
          </button>
        </section>
      )}

      {/* Galeria de Cultos Widget Banner */}
      <section className="rounded-3xl border border-church-gold/10 bg-white shadow-sm overflow-hidden p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-church-gold/10 flex items-center justify-center text-church-gold shrink-0">
            <Camera className="h-7 w-7" />
          </div>
          <div>
            <div className="inline-block bg-church-navy/10 text-church-navy font-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-church-navy/15">
              MURAL DA IGREJA
            </div>
            <h3 className="font-serif text-lg font-black text-church-navy mt-1">Galeria de Fotos dos Cultos</h3>
            <p className="text-xs text-church-navy/60">Registre e relembre momentos abençoados de adoração e testemunhos de milagres.</p>
          </div>
        </div>
        
        <Link
          to="/galeria"
          className="flex items-center justify-center gap-2 rounded-2xl bg-church-gold hover:bg-church-gold/90 px-6 py-3.5 text-sm font-bold text-church-navy shadow-md transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
        >
          <Camera className="h-4.5 w-4.5" /> Acessar Galeria de Fotos
        </Link>
      </section>

      {/* Bloco de Anotações Pessoais Banner */}
      <section className="rounded-3xl border border-church-gold/10 bg-white shadow-sm overflow-hidden p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-church-navy/5 flex items-center justify-center text-church-navy shrink-0">
            <FileText className="h-7 w-7 text-church-gold" />
          </div>
          <div>
            <div className="inline-block bg-church-cream/60 text-church-navy/60 font-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-church-gold/15">
              CADERNO DEVOCIONAL
            </div>
            <h3 className="font-serif text-lg font-black text-church-navy mt-1">Minhas Anotações e Estudos</h3>
            <p className="text-xs text-church-navy/60">Escreva estudos bíblicos, anote sermões ministeriais e salve momentos de reflexão espiritual em PDF.</p>
          </div>
        </div>
        
        <Link
          to="/anotacoes"
          className="flex items-center justify-center gap-2 rounded-2xl bg-church-navy hover:bg-church-navy/90 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95 whitespace-nowrap border border-church-gold/10"
        >
          <FileText className="h-4.5 w-4.5 text-church-gold" /> Abrir Meu Caderno
        </Link>
      </section>

      {/* Guia Comercial & Empreendimentos Banner */}
      <section className="rounded-3xl border border-church-gold/20 bg-gradient-to-br from-church-navy via-slate-900 to-church-navy shadow-lg overflow-hidden p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-church-gold/20 border border-church-gold/30 flex items-center justify-center text-church-gold shrink-0">
            <Store className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <div className="inline-block bg-church-gold/20 text-church-gold font-bold text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-church-gold/40">
              GUIA DE EMPREENDIMENTOS DA IGREJA
            </div>
            <h3 className="font-serif text-xl font-bold text-white">Negócios, Lojas & Serviços dos Irmãos</h3>
            <p className="text-xs text-slate-300">Ofereça seus serviços, produtos e trabalho, e apoie os empreendedores da nossa comunidade!</p>
          </div>
        </div>
        
        <Link
          to="/empreendimentos"
          className="flex items-center justify-center gap-2 rounded-2xl bg-church-gold hover:bg-church-gold/90 px-6 py-3.5 text-sm font-bold text-church-navy shadow-md transition-transform hover:scale-105 active:scale-95 whitespace-nowrap shrink-0"
        >
          <Store className="h-4.5 w-4.5" /> Acessar Guia de Serviços
        </Link>
      </section>

      {/* Seção Conhecer Outros Membros */}
      <section className="rounded-3xl border border-church-gold/10 bg-white shadow-sm overflow-hidden p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-church-gold/10 p-3 text-church-gold shrink-0">
              <Users className="h-6 w-6 text-church-navy" />
            </div>
            <div>
              <div className="inline-block bg-church-gold/10 text-church-gold font-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-church-gold/25">
                COMUNHÃO E INTEGRAÇÃO
              </div>
              <h2 className="font-serif text-xl font-black text-church-navy mt-1">Conhecer Outros Membros</h2>
              <p className="text-xs text-church-navy/60">Conheça os irmãos que fazem parte da AD Boas Novas</p>
            </div>
          </div>
          <Link
            to="/admin/membros"
            className="flex items-center justify-center gap-2 rounded-2xl bg-church-navy hover:bg-church-navy/90 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95 whitespace-nowrap border border-church-gold/10"
          >
            <Users className="h-4 w-4 text-church-gold" /> Ver Todos os Membros
          </Link>
        </div>

        {allMembersLoading ? (
          <div className="py-8 text-center text-church-navy/40 text-sm">Carregando membros...</div>
        ) : memberShowcaseList.length === 0 ? (
          <div className="py-8 text-center text-church-navy/40 text-sm">Nenhum outro membro cadastrado ainda.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {memberShowcaseList.map((m) => (
              <Link
                key={m.id}
                to="/admin/membros"
                className="group flex flex-col items-center text-center p-4 rounded-2xl border border-church-gold/5 bg-church-cream/5 hover:bg-church-cream/15 transition-all hover:-translate-y-1"
              >
                <div className="relative h-14 w-14 rounded-full border border-church-gold/15 bg-church-navy/5 overflow-hidden flex items-center justify-center text-church-navy mb-2.5 transition-transform group-hover:scale-105">
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-serif font-black text-base text-church-navy/40">
                      {m.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-church-navy text-xs line-clamp-1 w-full" title={m.name}>
                  {m.name.split(' ')[0]} {m.name.split(' ')[1] || ''}
                </h4>
                <span className="inline-block mt-1.5 rounded bg-church-gold/10 px-2 py-0.5 text-[8px] font-bold text-church-navy/80 uppercase tracking-wide">
                  {m.position || 'Membro'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>


      {/* Widget de Aniversariantes do Mês */}
      <section className="rounded-2xl border border-church-gold/10 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-church-gold/5 bg-church-navy/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-church-gold/20 p-1.5 text-church-gold">
              <Cake className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-church-navy">Aniversariantes do Mês</h2>
              <p className="text-xs text-church-navy/60">Aniversários da congregação no mês atual</p>
            </div>
          </div>
          <span className="rounded-full bg-church-navy/10 px-3 py-1 text-xs font-bold text-church-navy">
            {birthdaysThisMonth.length} {birthdaysThisMonth.length === 1 ? 'aniversariante' : 'aniversariantes'}
          </span>
        </div>

        <div className="divide-y divide-church-gold/5">
          {allMembersLoading ? (
            <div className="p-8 text-center text-church-navy/40">Carregando aniversariantes...</div>
          ) : allMembersError ? (
            <div className="flex items-center gap-2 p-8 text-red-500 justify-center">
              <AlertCircle className="h-5 w-5" />
              <span>Erro ao carregar aniversariantes: {allMembersError.message}</span>
            </div>
          ) : birthdaysThisMonth.length === 0 ? (
            <div className="p-8 text-center text-church-navy/40 flex flex-col items-center gap-2">
              <Gift className="h-8 w-8 text-church-navy/15" />
              <p className="text-sm">Nenhum aniversariante no mês atual.</p>
            </div>
          ) : (
            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
              {birthdaysThisMonth.map((member) => (
                <motion.div
                  key={member.id}
                  whileHover={{ y: -2 }}
                  className={`relative flex flex-col justify-between rounded-xl p-4 border transition-all ${
                    member.isToday 
                      ? 'border-church-gold/35 bg-gradient-to-br from-church-gold/5 to-transparent shadow-md shadow-church-gold/5' 
                      : 'border-church-gold/10 bg-church-cream/5 hover:bg-church-cream/15'
                  }`}
                >
                  {member.isToday && (
                    <div className="absolute top-3 right-3 flex h-5 items-center gap-1 rounded-full bg-church-gold px-2 text-[10px] font-extrabold uppercase tracking-wider text-church-navy animate-pulse">
                      Hoje! 🎉
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3">
                    <div className={`h-11 w-11 rounded-full border flex items-center justify-center overflow-hidden shrink-0 ${
                      member.isToday ? 'border-church-gold/52 ring-2 ring-church-gold/22 bg-church-navy/5' : 'border-church-gold/15 bg-church-navy/5'
                    }`}>
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt={member.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-serif font-black text-sm text-church-navy/50">
                          {member.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                        </span>
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-church-navy truncate text-sm" title={member.name}>
                        {member.name}
                      </h4>
                      <p className="text-xs text-church-navy/60 font-medium font-mono">
                        {getFormattedDay(member.birthDate)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="inline-block rounded bg-church-navy/5 px-1.5 py-0.5 text-[9px] font-bold text-church-navy/70 uppercase tracking-wide">
                          {member.position}
                        </span>
                        <span className="text-[10px] text-church-navy/40 font-medium">
                          • {getWeekdayNameThisYear(member.birthDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {member.whatsapp && (
                    <div className="mt-4 pt-3 border-t border-church-gold/5 flex justify-end">
                      <a
                        href={getWhatsAppLink(member.name, member.whatsapp, member.isToday)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-transform hover:scale-105 active:scale-95 ${
                          member.isToday
                            ? 'bg-church-gold text-church-navy hover:bg-church-gold/90'
                            : 'bg-church-navy/5 text-church-navy hover:bg-church-navy/10'
                        }`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Parabenizar</span>
                      </a>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {isAdmin && (
        <section className="rounded-2xl border border-church-gold/10 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-church-gold/5 bg-church-navy/5 px-6 py-4">
            <h2 className="font-serif text-lg font-bold text-church-navy">Seus Relatórios Recentes</h2>
          </div>

          <div className="divide-y divide-church-gold/5">
            {loading ? (
              <div className="p-12 text-center text-church-navy/40">Carregando relatórios...</div>
            ) : error ? (
              <div className="flex items-center gap-2 p-12 text-red-500 justify-center">
                <AlertCircle className="h-5 w-5" />
                <span>Erro ao carregar relatórios: {error.message}</span>
              </div>
            ) : reportsValue?.empty ? (
              <div className="p-12 text-center space-y-4">
                <div className="flex justify-center">
                  <FileText className="h-12 w-12 text-church-navy/10" />
                </div>
                <p className="text-church-navy/40">Nenhum relatório enviado ainda.</p>
                <Link
                  to="/novo-relatorio"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-church-gold hover:underline"
                >
                  Enviar o primeiro agora <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              reportsValue?.docs.map((doc) => {
                const data = doc.data();
                return (
                  <div key={doc.id} className="flex items-center justify-between p-6 hover:bg-church-cream/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="rounded-full bg-church-navy/5 p-2 text-church-navy">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-church-navy">
                          Relatório {data.type === 'pastoral' ? 'Pastoral' : 'de Departamento'}
                        </h3>
                        <p className="text-sm text-church-navy/60">
                          {format(new Date(data.year, data.month - 1), 'MMMM yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 uppercase">
                        {data.status || 'Enviado'}
                      </span>
                      <button 
                        onClick={() => setSelectedReport({ id: doc.id, ...data })}
                        className="text-church-navy/40 hover:text-church-navy p-2 rounded-full hover:bg-church-navy/5 transition-colors"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Dízimos e Ofertas via PIX (Comprimido na parte inferior) */}
      <PixContributionCard />

      {/* Como chegar e mapa */}
      <ChurchAddressMap />

      {selectedReport && (
        <ReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}

      {isIDCardOpen && loggedInMember && (
        <MemberIDCardModal 
          member={{ ...loggedInMember, photoUrl: userMemberPhoto || loggedInMember.photoUrl }}
          onClose={() => setIsIDCardOpen(false)}
          canUploadPhoto={true}
          onPhotoUpdated={(memberId, newPhoto) => {
            setUserMemberPhoto(newPhoto);
          }}
        />
      )}
    </div>
  );
}

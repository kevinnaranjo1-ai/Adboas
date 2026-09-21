import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Clock, MapPin, XCircle, Trash2, Loader2, Info, Share2, BellRing, User, Mic } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isToday, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthState } from 'react-firebase-hooks/auth';
import BirthdayPicker from '../../components/BirthdayPicker';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import { scheduleLocalEventReminders, scheduleSingleEventReminder, createEventNotification } from '../../lib/notifications';

interface Event {
  id: string;
  title: string;
  date: Timestamp | Date;
  time: string;
  location: string;
  category: string;
  description?: string;
  preacher?: string;
  worshipLeader?: string;
  createdAt: any;
}

interface CalendarPageProps {
  role?: string | null;
}

export default function CalendarPage({ role }: CalendarPageProps) {
  const [user] = useAuthState(auth);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventToDeleteId, setEventToDeleteId] = useState<string | null>(null);
  
  const isPastorAdmin = useMemo(() => {
    return (role && ['admin', 'pastor', 'pastora'].includes(role)) || 
           user?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com';
  }, [role, user]);

  const [formData, setFormData] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '19:00',
    location: '',
    category: 'Cultos',
    description: '',
    preacher: '',
    worshipLeader: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];
      setEvents(eventsData);
      setLoading(false);
      scheduleLocalEventReminders(eventsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPastorAdmin) return;
    
    try {
      // Create a Date object from the form input strings
      const [year, month, day] = formData.date.split('-').map(Number);
      const eventDate = new Date(year, month - 1, day);
      
      await addDoc(collection(db, 'events'), {
        ...formData,
        date: Timestamp.fromDate(eventDate),
        createdAt: serverTimestamp()
      });

      // Enviar notificação para a igreja
      const formattedDateStr = format(eventDate, "dd 'de' MMMM", { locale: ptBR });
      createEventNotification(formData.title, formattedDateStr, formData.time, formData.location).catch(err => {
        console.warn('Erro ao enviar notificação do evento:', err);
      });
      
      setIsModalOpen(false);
      setFormData({
        title: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '19:00',
        location: '',
        category: 'Cultos',
        description: '',
        preacher: '',
        worshipLeader: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'events');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!isPastorAdmin) return;
    
    try {
      await deleteDoc(doc(db, 'events', id));
      setEventToDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
    }
  };

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const filteredEvents = events.filter(event => {
    const eventDate = event.date instanceof Timestamp ? event.date.toDate() : new Date(event.date);
    if (!selectedDate) return true;
    return isSameDay(eventDate, selectedDate);
  });

  const allFilteredEvents = events.filter(event => {
    const eventDate = event.date instanceof Timestamp ? event.date.toDate() : new Date(event.date);
    return isSameMonth(eventDate, currentMonth);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
        <div>
          <h1 className="font-serif text-3xl font-black text-church-navy">Agenda da Igreja</h1>
          <p className="text-church-navy/60">Cultos, eventos e reuniões da membresia</p>
        </div>
        {(isPastorAdmin || user?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-church-navy px-6 py-4 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Novo Evento
          </button>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Lado do Calendário (Mini) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold capitalize text-church-navy">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-church-navy/5 text-church-navy/40 transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-church-navy/5 text-church-navy/40 transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, index) => (
                <div key={index} className="text-[10px] font-bold text-church-navy/40 py-2">{d}</div>
              ))}
              {days.map((day, i) => {
                const hasEvent = events.some(e => {
                  const ed = e.date instanceof Timestamp ? e.date.toDate() : new Date(e.date);
                  return isSameDay(ed, day);
                });
                
                return (
                  <div 
                    key={i} 
                    onClick={() => setSelectedDate(day)}
                    className={`aspect-square relative flex items-center justify-center rounded-xl text-sm font-medium transition-all cursor-pointer group
                      ${!isSameDay(day, currentMonth) && format(day, 'M') !== format(currentMonth, 'M') ? 'opacity-20' : ''}
                      ${selectedDate && isSameDay(day, selectedDate) ? 'bg-church-navy text-white shadow-md scale-105' : 'text-church-navy/80 hover:bg-church-gold/5'}
                      ${isToday(day) && !(selectedDate && isSameDay(day, selectedDate)) ? 'ring-2 ring-church-gold ring-offset-2' : ''}
                    `}
                  >
                    {format(day, 'd')}
                    {hasEvent && (
                      <div className={`absolute bottom-1 h-1 w-1 rounded-full ${selectedDate && isSameDay(day, selectedDate) ? 'bg-white' : 'bg-church-gold'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate(null)}
                className="mt-6 w-full py-3 rounded-xl border border-church-gold/20 text-xs font-bold text-church-navy/60 hover:bg-church-navy/5 transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="h-3 w-3" /> Ver Todos do Mês
              </button>
            )}
          </div>

          <div className="rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-church-navy/40">Legenda</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-church-gold" />
                <span className="text-xs font-medium text-church-navy/70">Dias com Eventos</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full ring-1 ring-church-gold ring-offset-1" />
                <span className="text-xs font-medium text-church-navy/70">Hoje</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Eventos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-church-gold/10 bg-white p-8 shadow-sm min-h-[500px]">
            <h2 className="mb-8 font-serif text-2xl font-bold text-church-navy">
              {selectedDate ? `Eventos de ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}` : 'Eventos do Mês'}
            </h2>
            
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-church-gold" />
              </div>
            ) : (selectedDate ? filteredEvents : allFilteredEvents).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-church-navy/5 flex items-center justify-center text-church-navy/20">
                  <CalendarIcon className="h-8 w-8" />
                </div>
                <p className="text-church-navy/40 font-medium">Nenhum evento programado para este período.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {(selectedDate ? filteredEvents : allFilteredEvents).map((event) => {
                    const eventDate = event.date instanceof Timestamp ? event.date.toDate() : new Date(event.date);
                    return (
                      <motion.div 
                        key={event.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group flex gap-6 p-6 rounded-2xl border border-church-gold/5 bg-white hover:border-church-gold/20 hover:shadow-sm transition-all"
                      >
                        <div className="text-center min-w-[60px]">
                          <p className={`text-[10px] font-black uppercase ${isToday(eventDate) ? 'text-church-gold' : 'text-church-navy/30'}`}>
                            {format(eventDate, 'MMM', { locale: ptBR })}
                          </p>
                          <p className={`text-3xl font-black ${isToday(eventDate) ? 'text-church-gold' : 'text-church-navy'}`}>
                            {format(eventDate, 'dd')}
                          </p>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-widest text-church-gold mb-1 block">
                                {event.category}
                              </span>
                              <h4 className="font-bold text-lg text-church-navy">{event.title}</h4>
                            </div>
                            {isPastorAdmin && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEventToDeleteId(event.id);
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-church-navy/60">
                            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-church-gold/50" /> {event.time}h</span>
                            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-church-gold/50" /> {event.location}</span>
                            {event.preacher && (
                              <span className="flex items-center gap-1.5 font-medium text-church-navy/80"><User className="h-4 w-4 text-church-gold/80" /> Pregador(a): {event.preacher}</span>
                            )}
                            {event.worshipLeader && (
                              <span className="flex items-center gap-1.5 font-medium text-church-navy/80"><Mic className="h-4 w-4 text-church-gold/80" /> Direção: {event.worshipLeader}</span>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-sm text-church-navy/50 line-clamp-2 mt-2">{event.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-church-navy/5 mt-3">
                            <button
                              onClick={() => {
                                const evDateStr = format(eventDate, 'dd/MM/yyyy');
                                scheduleSingleEventReminder(event.title, evDateStr, event.time || '19:00', event.category);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-all active:scale-95 border border-amber-200 cursor-pointer"
                              title="Agendar alerta no celular ou computador"
                            >
                              <BellRing className="h-3.5 w-3.5 text-amber-600" /> Alerta Push
                            </button>
                            <button
                              onClick={() => {
                                const evDateStr = format(eventDate, 'dd/MM/yyyy');
                                const text = `*${event.title}* 📅✨\n\n*Categoria:* ${event.category}\n*Data:* ${evDateStr} às ${event.time}h\n*Local:* ${event.location || 'AD Boas Novas'}${event.preacher ? '\n*Pregador(a):* ' + event.preacher : ''}${event.worshipLeader ? '\n*Direção:* ' + event.worshipLeader : ''}\n${event.description ? '\n' + event.description + '\n' : ''}\nParticipe conosco! 🙏`;
                                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all active:scale-95 border border-emerald-200 cursor-pointer"
                              title="Compartilhar evento no WhatsApp"
                            >
                              <Share2 className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Novo Evento */}
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
                    <CalendarIcon className="h-5 w-5 text-church-gold" />
                  </div>
                  <h2 className="font-serif text-xl font-bold text-white">Novo Evento</h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white transition-colors">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleAddEvent} className="p-8 space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Título do Evento</label>
                  <input 
                    required
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                    placeholder="Ex: Culto de Jovens"
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Data</label>
                    <input 
                      required
                      type="date"
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Horário</label>
                    <input 
                      required
                      type="time"
                      value={formData.time}
                      onChange={e => setFormData({ ...formData, time: e.target.value })}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Local</label>
                  <input 
                    required
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                    placeholder="Ex: Templo Sede"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Categoria</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none appearance-none bg-white"
                  >
                    <option value="Cultos">Cultos</option>
                    <option value="Reuniões">Reuniões</option>
                    <option value="Congressos">Congressos</option>
                    <option value="Social">Social</option>
                  </select>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Pregador / Pregadora (Opcional)</label>
                    <input 
                      type="text"
                      value={formData.preacher || ''}
                      onChange={e => setFormData({ ...formData, preacher: e.target.value })}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                      placeholder="Ex: Pr. João Silva"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Direção do Culto (Opcional)</label>
                    <input 
                      type="text"
                      value={formData.worshipLeader || ''}
                      onChange={e => setFormData({ ...formData, worshipLeader: e.target.value })}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none"
                      placeholder="Ex: Pb. Carlos Santos"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Descrição (Opcional)</label>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full h-24 rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none resize-none"
                    placeholder="Detalhes sobre o evento..."
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-church-navy text-white font-black uppercase tracking-widest shadow-xl transition-all hover:bg-church-navy/90 active:scale-95"
                >
                  Confirmar Evento
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <DeleteConfirmationModal
        isOpen={eventToDeleteId !== null}
        onClose={() => setEventToDeleteId(null)}
        onConfirm={async () => {
          if (eventToDeleteId) {
            await handleDeleteEvent(eventToDeleteId);
          }
        }}
        title="Excluir Evento"
        message="Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita."
      />
    </div>
  );
}


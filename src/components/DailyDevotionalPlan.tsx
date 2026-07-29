import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  CheckCircle2, 
  Circle, 
  Flame, 
  Share2, 
  Copy, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Calendar, 
  ArrowRight,
  BookmarkCheck,
  MessageSquareHeart,
  CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { 
  getDailyPlanForDay, 
  getCurrentDayOfYear, 
  DailyPlan 
} from '../data/readingPlanData';

export default function DailyDevotionalPlan() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  // Dia atual do ano (1-365)
  const todayNum = getCurrentDayOfYear();
  const [selectedDayNum, setSelectedDayNum] = useState<number>(todayNum);
  
  // Dados do dia selecionado
  const [plan, setPlan] = useState<DailyPlan>(() => getDailyPlanForDay(todayNum));

  // Estado de progresso local e persistente
  // Array de IDs de dias concluídos do plano de 1 ano (ex: [1, 2, 3, ...])
  const [completedDays, setCompletedDays] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('bible_plan_completed_days');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Leitura das 3 porções individuais do dia selecionado: ot, nt, psalm
  const [readPortions, setReadPortions] = useState<{ ot: boolean; nt: boolean; psalm: boolean }>(() => {
    try {
      const saved = localStorage.getItem(`bible_plan_day_${selectedDayNum}`);
      return saved ? JSON.parse(saved) : { ot: false, nt: false, psalm: false };
    } catch {
      return { ot: false, nt: false, psalm: false };
    }
  });

  // Conclusão do devocional do dia
  const [devotionalDone, setDevotionalDone] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`devotional_done_day_${selectedDayNum}`) === 'true';
    } catch {
      return false;
    }
  });

  // Contador de dias em sequência (streak)
  const [streak, setStreak] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('bible_reading_streak');
      return saved ? parseInt(saved, 10) : completedDays.length;
    } catch {
      return completedDays.length;
    }
  });

  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Atualiza o plano quando o dia selecionado muda
  useEffect(() => {
    setPlan(getDailyPlanForDay(selectedDayNum));
    
    // Carrega progresso específico deste dia
    try {
      const savedPortions = localStorage.getItem(`bible_plan_day_${selectedDayNum}`);
      if (savedPortions) {
        setReadPortions(JSON.parse(savedPortions));
      } else {
        const isDayFullyDone = completedDays.includes(selectedDayNum);
        setReadPortions({ ot: isDayFullyDone, nt: isDayFullyDone, psalm: isDayFullyDone });
      }

      const savedDevo = localStorage.getItem(`devotional_done_day_${selectedDayNum}`);
      setDevotionalDone(savedDevo === 'true');
    } catch {
      // fallback silencioso
    }
  }, [selectedDayNum, completedDays]);

  // Carrega progresso do Firestore se o usuário estiver autenticado
  useEffect(() => {
    if (!user) return;
    const fetchCloudProgress = async () => {
      try {
        const docRef = doc(db, 'user_reading_progress', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data.completedDays)) {
            setCompletedDays(data.completedDays);
            localStorage.setItem('bible_plan_completed_days', JSON.stringify(data.completedDays));
          }
          if (typeof data.streak === 'number') {
            setStreak(data.streak);
            localStorage.setItem('bible_reading_streak', data.streak.toString());
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar progresso da leitura bíblica do servidor:', err);
      }
    };
    fetchCloudProgress();
  }, [user]);

  // Salva no LocalStorage e no Firestore
  const syncProgressToCloud = async (newCompletedDays: number[], newStreak: number) => {
    localStorage.setItem('bible_plan_completed_days', JSON.stringify(newCompletedDays));
    localStorage.setItem('bible_reading_streak', newStreak.toString());

    if (!user) return;
    try {
      const docRef = doc(db, 'user_reading_progress', user.uid);
      await setDoc(docRef, {
        userId: user.uid,
        userName: user.displayName || user.email || 'Membro',
        completedDays: newCompletedDays,
        completedCount: newCompletedDays.length,
        streak: newStreak,
        lastUpdated: new Date()
      }, { merge: true });
    } catch (err) {
      console.warn('Erro ao sincronizar progresso com a nuvem:', err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Alterna porção de leitura individual
  const togglePortion = (key: 'ot' | 'nt' | 'psalm') => {
    const nextPortions = { ...readPortions, [key]: !readPortions[key] };
    setReadPortions(nextPortions);
    localStorage.setItem(`bible_plan_day_${selectedDayNum}`, JSON.stringify(nextPortions));

    // Se todas as 3 porções forem marcadas, conclui o dia automaticamente
    const isAllDone = nextPortions.ot && nextPortions.nt && nextPortions.psalm;
    if (isAllDone && !completedDays.includes(selectedDayNum)) {
      markDayComplete(true);
    } else if (!isAllDone && completedDays.includes(selectedDayNum)) {
      const updatedDays = completedDays.filter(d => d !== selectedDayNum);
      setCompletedDays(updatedDays);
      syncProgressToCloud(updatedDays, Math.max(0, streak - 1));
    }
  };

  // Marcar dia como totalmente concluído
  const markDayComplete = (isAuto: boolean = false) => {
    const allPortions = { ot: true, nt: true, psalm: true };
    setReadPortions(allPortions);
    localStorage.setItem(`bible_plan_day_${selectedDayNum}`, JSON.stringify(allPortions));

    let updatedDays = completedDays;
    let newStreak = streak;

    if (!completedDays.includes(selectedDayNum)) {
      updatedDays = [...completedDays, selectedDayNum].sort((a, b) => a - b);
      setCompletedDays(updatedDays);

      // incrementa a sequência de dias
      newStreak = streak + 1;
      setStreak(newStreak);
      syncProgressToCloud(updatedDays, newStreak);

      showToast(isAuto ? '🎉 Excelente! Leitura diária do plano concluída!' : '🎉 Dia marcado como concluído no plano!');
    } else {
      showToast('Dia já estava marcado como concluído.');
    }
  };

  // Alternar conclusão do devocional
  const toggleDevotional = () => {
    const nextState = !devotionalDone;
    setDevotionalDone(nextState);
    localStorage.setItem(`devotional_done_day_${selectedDayNum}`, nextState.toString());
    showToast(nextState ? '🙏 Devocional do dia concluído com sucesso!' : 'Devocional desmarcado.');
  };

  // Copiar devocional para compartilhar no WhatsApp
  const handleCopyDevotional = async () => {
    try {
      const shareMsg = `*Devocional do Dia — AD Boas Novas* 📖✨\n\n*${plan.devotionalTitle}*\n_"${plan.verseText}"_\n— *${plan.verseRef}*\n\n*Reflexão Pastoral:*\n${plan.pastoralReflection}\n\n*Oração:* ${plan.prayerPoint}\n\n_Acompanhe pelo App da Igreja_`;
      await navigator.clipboard.writeText(shareMsg);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
      showToast('Devocional copiado para compartilhar!');
    } catch (err) {
      console.error(err);
    }
  };

  // Navega para a leitura da Bíblia no capítulo exato
  const goToBibleReading = (bookId: number, startChapter: number) => {
    navigate('/biblia', {
      state: {
        bookId,
        chapter: startChapter
      }
    });
  };

  // Cálculo da Porcentagem Geral do Plano de 1 Ano
  const progressPercent = Math.min(100, Math.round((completedDays.length / 365) * 100));
  const isSelectedDayDone = completedDays.includes(selectedDayNum);
  const totalReadingsToday = (readPortions.ot ? 1 : 0) + (readPortions.nt ? 1 : 0) + (readPortions.psalm ? 1 : 0);

  return (
    <div className="space-y-6 text-left">
      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-church-navy text-white px-5 py-3.5 text-xs font-bold shadow-2xl border border-church-gold/30"
          >
            <Sparkles className="h-4 w-4 text-church-gold shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER PRINCIPAL */}
      <div className="bg-gradient-to-br from-church-navy via-slate-900 to-church-navy p-6 sm:p-8 rounded-3xl text-white border border-church-gold/20 shadow-xl relative overflow-hidden">
        {/* Background Decorative Element */}
        <div className="absolute right-0 top-0 opacity-10 text-church-gold pointer-events-none p-4">
          <BookOpen className="w-64 h-64 -mr-10 -mt-10" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-church-gold opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-church-gold"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-church-gold font-serif">
                Leitura Diária & Edificação Espiritual
              </span>
              <span className="bg-church-gold/20 text-church-gold border border-church-gold/30 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full">
                Plano de 1 Ano
              </span>
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
              <span>Plano de Leitura & Devocional</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Mantenha o hábito diário de ouvir a Deus. Acompanhe a reflexão pastoral e cumpra o plano para ler toda a Bíblia Sagrada em 365 dias!
            </p>
          </div>

          {/* Streak Badge */}
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl shrink-0">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Flame className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="text-lg font-black text-white leading-none">
                {streak} {streak === 1 ? 'Dia' : 'Dias'}
              </div>
              <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider mt-1">
                Sequência de Leitura
              </div>
            </div>
          </div>
        </div>

        {/* PROGRESS BAR DO PLANO DE 1 ANO */}
        <div className="mt-6 pt-6 border-t border-white/10 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between text-xs font-bold">
            <span className="text-amber-300 flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              <span>Progresso do Plano Anual (365 Dias)</span>
            </span>
            <span className="text-white font-mono bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
              {completedDays.length} de 365 dias ({progressPercent}%)
            </span>
          </div>

          {/* Barra Visual */}
          <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(1, progressPercent)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 shadow-md"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Comece hoje mesmo • Seu progresso fica salvo permanentemente</span>
            <span className="text-church-gold font-bold">{365 - completedDays.length} dias restantes</span>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO ENTRE DIAS (ANTERIOR / HOJE / PRÓXIMO) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-church-gold/15 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDayNum(prev => Math.max(1, prev - 1))}
            disabled={selectedDayNum <= 1}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 cursor-pointer transition-all flex items-center gap-1 text-xs font-bold"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Dia Anterior</span>
          </button>

          <button
            onClick={() => setSelectedDayNum(todayNum)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedDayNum === todayNum
                ? 'bg-church-navy text-church-gold border-church-navy shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Ir para Hoje (Dia {todayNum})</span>
          </button>

          <button
            onClick={() => setSelectedDayNum(prev => Math.min(365, prev + 1))}
            disabled={selectedDayNum >= 365}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 cursor-pointer transition-all flex items-center gap-1 text-xs font-bold"
          >
            <span>Próximo Dia</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-500">Exibindo:</span>
          <span className="bg-amber-100 text-amber-900 border border-amber-300/60 font-serif font-black px-3 py-1 rounded-xl">
            Dia {selectedDayNum} de 365
          </span>
          {isSelectedDayDone && (
            <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Concluído</span>
            </span>
          )}
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL: 2 CARDS LADO A LADO OU EMPILHADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* COLUNA 1: PLANO DE LEITURA DAS 3 PASSAGENS DE HOJE */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-church-gold/15 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-500/10 text-amber-800 rounded-2xl border border-amber-300/40">
                  <BookOpen className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold text-slate-900">
                    Leitura Bíblica do Dia {selectedDayNum}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Sua meta de leitura diária ({totalReadingsToday}/3 porções concluídas)
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                {totalReadingsToday === 3 ? '3/3 Pronto!' : `${totalReadingsToday}/3 Faltam`}
              </span>
            </div>

            {/* 3 CARDS DE PASSAGENS */}
            <div className="space-y-3">

              {/* Porção 1: Antigo Testamento */}
              <div className={`p-4 rounded-2xl border transition-all ${
                readPortions.ot
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-slate-50 border-slate-200 hover:border-amber-300'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => togglePortion('ot')}
                    className="flex items-center gap-3 cursor-pointer text-left flex-1"
                  >
                    <div className="shrink-0 mt-0.5">
                      {readPortions.ot ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Circle className="h-6 w-6 text-slate-400 hover:text-amber-500" />
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Antigo Testamento
                      </span>
                      <h4 className="font-serif font-bold text-slate-900 text-sm sm:text-base">
                        {plan.ot.bookName} • {plan.ot.chapters}
                      </h4>
                    </div>
                  </button>

                  <button
                    onClick={() => goToBibleReading(plan.ot.bookId, plan.ot.startChapter)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-church-navy hover:text-church-gold bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <span>Ler no App</span>
                    <ArrowRight className="h-3 w-3 text-church-gold" />
                  </button>
                </div>
              </div>

              {/* Porção 2: Novo Testamento */}
              <div className={`p-4 rounded-2xl border transition-all ${
                readPortions.nt
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-slate-50 border-slate-200 hover:border-amber-300'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => togglePortion('nt')}
                    className="flex items-center gap-3 cursor-pointer text-left flex-1"
                  >
                    <div className="shrink-0 mt-0.5">
                      {readPortions.nt ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Circle className="h-6 w-6 text-slate-400 hover:text-amber-500" />
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Novo Testamento
                      </span>
                      <h4 className="font-serif font-bold text-slate-900 text-sm sm:text-base">
                        {plan.nt.bookName} • {plan.nt.chapters}
                      </h4>
                    </div>
                  </button>

                  <button
                    onClick={() => goToBibleReading(plan.nt.bookId, plan.nt.startChapter)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-church-navy hover:text-church-gold bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <span>Ler no App</span>
                    <ArrowRight className="h-3 w-3 text-church-gold" />
                  </button>
                </div>
              </div>

              {/* Porção 3: Salmos ou Provérbios */}
              <div className={`p-4 rounded-2xl border transition-all ${
                readPortions.psalm
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-slate-50 border-slate-200 hover:border-amber-300'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => togglePortion('psalm')}
                    className="flex items-center gap-3 cursor-pointer text-left flex-1"
                  >
                    <div className="shrink-0 mt-0.5">
                      {readPortions.psalm ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Circle className="h-6 w-6 text-slate-400 hover:text-amber-500" />
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Sabedoria & Poesia
                      </span>
                      <h4 className="font-serif font-bold text-slate-900 text-sm sm:text-base">
                        {plan.psalmOrProv.bookName} • {plan.psalmOrProv.chapters}
                      </h4>
                    </div>
                  </button>

                  <button
                    onClick={() => goToBibleReading(plan.psalmOrProv.bookId, plan.psalmOrProv.startChapter)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-church-navy hover:text-church-gold bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <span>Ler no App</span>
                    <ArrowRight className="h-3 w-3 text-church-gold" />
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* BOTÃO CONCLUIR PLANO DE HOJE */}
          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => markDayComplete(false)}
              className={`w-full py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                isSelectedDayDone
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-church-gold text-church-navy hover:bg-church-gold/90'
              }`}
            >
              {isSelectedDayDone ? (
                <>
                  <BookmarkCheck className="h-4 w-4" />
                  <span>Dia {selectedDayNum} Concluído no Plano!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Concluir Leitura Bíblica do Dia {selectedDayNum}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* COLUNA 2: DEVOCIONAL & REFLEXÃO PASTORAL DO DIA */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-church-gold/15 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-church-navy text-church-gold rounded-2xl border border-church-navy">
                  <MessageSquareHeart className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold text-slate-900">
                    Devocional & Reflexão Pastoral
                  </h2>
                  <p className="text-xs text-slate-500">
                    Mensagem de fé para fortalecer seu dia
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyDevotional}
                  className="p-2 rounded-xl text-slate-500 hover:text-church-navy hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
                  title="Compartilhar devocional no WhatsApp"
                >
                  {copiedText ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* CARD DO DEVOCIONAL */}
            <div className="bg-gradient-to-br from-amber-500/5 via-slate-50 to-amber-500/10 p-5 rounded-2xl border border-amber-200/60 space-y-4">
              
              {/* Título & Categoria */}
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full inline-block">
                  {plan.devotionalCategory}
                </span>
                <h3 className="font-serif text-xl font-bold text-church-navy">
                  {plan.devotionalTitle}
                </h3>
              </div>

              {/* Versículo Chave */}
              <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-xs space-y-1.5">
                <p className="font-serif text-sm sm:text-base font-semibold italic text-church-navy leading-relaxed">
                  "{plan.verseText}"
                </p>
                <p className="text-xs font-mono font-bold text-amber-700 text-right">
                  — {plan.verseRef}
                </p>
              </div>

              {/* Reflexão Pastoral */}
              <div className="space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
                <p className="font-medium">
                  {plan.pastoralReflection}
                </p>
              </div>

              {/* Ponto de Oração */}
              <div className="p-3.5 bg-church-navy/5 rounded-xl border border-church-navy/10 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-church-navy flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-church-gold" />
                  <span>Oração do Dia</span>
                </span>
                <p className="text-xs italic font-medium text-church-navy">
                  "{plan.prayerPoint}"
                </p>
              </div>

              <div className="text-[10px] text-slate-400 italic text-right font-serif">
                Pr. Presidente & Liderança AD Boas Novas
              </div>
            </div>
          </div>

          {/* BOTÃO CONCLUIR DEVOCIONAL */}
          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={toggleDevotional}
              className={`w-full py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                devotionalDone
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-church-navy text-white hover:bg-church-navy/90'
              }`}
            >
              {devotionalDone ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <span>Devocional do Dia Concluído!</span>
                </>
              ) : (
                <>
                  <MessageSquareHeart className="h-4 w-4 text-church-gold" />
                  <span>Marcar Devocional como Lido Hoje</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

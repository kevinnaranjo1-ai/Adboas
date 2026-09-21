import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  BookOpen, 
  Flame, 
  Share2, 
  Check, 
  ArrowRight, 
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  getCurrentDayOfYear, 
  getDailyPlanForDay 
} from '../data/readingPlanData';

export default function VerseOfTheDay() {
  const navigate = useNavigate();
  const todayNum = getCurrentDayOfYear();
  const plan = getDailyPlanForDay(todayNum);

  const [copied, setCopied] = useState(false);
  const [streak, setStreak] = useState<number>(0);
  const [isTodayDone, setIsTodayDone] = useState<boolean>(false);

  useEffect(() => {
    try {
      const savedCompleted = localStorage.getItem('bible_plan_completed_days');
      if (savedCompleted) {
        const completedArr = JSON.parse(savedCompleted);
        if (Array.isArray(completedArr)) {
          setIsTodayDone(completedArr.includes(todayNum));
        }
      }

      const savedStreak = localStorage.getItem('bible_reading_streak');
      if (savedStreak) {
        setStreak(parseInt(savedStreak, 10) || 0);
      }
    } catch {
      // Fallback
    }
  }, [todayNum]);

  const handleCopyVerse = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const textToCopy = `"${plan.verseText}" — ${plan.verseRef}\n(Devocional AD Boas Novas: ${plan.devotionalTitle})`;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Erro ao copiar versículo:', err);
    }
  };

  const handleOpenFullPlan = () => {
    navigate('/biblia?tab=plan', {
      state: { viewState: 'plan' }
    });
  };

  return (
    <section className="bg-gradient-to-br from-church-navy via-slate-900 to-church-navy rounded-3xl p-5 sm:p-6 text-white border border-church-gold/20 shadow-lg relative overflow-hidden text-left">
      {/* Decorative background icon */}
      <div className="absolute right-0 top-0 opacity-5 text-church-gold pointer-events-none p-2">
        <BookOpen className="w-48 h-48 -mr-8 -mt-8" />
      </div>

      <div className="relative z-10 space-y-4">
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-church-gold/15 text-church-gold border border-church-gold/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-church-gold font-serif">
              Devocional & Versículo do Dia
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {isTodayDone && (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Leitura Concluída</span>
              </span>
            )}

            <span className="bg-white/10 text-slate-200 border border-white/15 px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] flex items-center gap-1">
              <Calendar className="h-3 w-3 text-church-gold" />
              <span>Dia {todayNum}/365</span>
            </span>

            {streak > 0 && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold text-[11px] flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                <span>{streak} {streak === 1 ? 'dia' : 'dias'}</span>
              </span>
            )}
          </div>
        </div>

        {/* Middle Content */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          
          {/* Versículo Principal */}
          <div className="md:col-span-8 space-y-2">
            <blockquote className="font-serif text-base sm:text-lg font-bold italic text-amber-100 leading-snug">
              "{plan.verseText}"
            </blockquote>
            <p className="text-xs font-mono font-bold text-church-gold">
              — {plan.verseRef}
            </p>
          </div>

          {/* Resumo do Devocional & Leituras */}
          <div className="md:col-span-4 bg-white/5 border border-white/10 p-3.5 rounded-2xl space-y-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                Tema de Hoje:
              </span>
              <h4 className="font-serif text-sm font-bold text-white line-clamp-1">
                {plan.devotionalTitle}
              </h4>
            </div>

            <div className="pt-2 border-t border-white/10 text-[11px] text-slate-300 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Passagens de Hoje (Plano 1 Ano):
              </span>
              <div className="font-medium truncate text-slate-200">
                • {plan.ot.bookName} {plan.ot.chapters}
              </div>
              <div className="font-medium truncate text-slate-200">
                • {plan.nt.bookName} {plan.nt.chapters}
              </div>
              <div className="font-medium truncate text-slate-200">
                • {plan.psalmOrProv.bookName} {plan.psalmOrProv.chapters}
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
          <button
            onClick={handleCopyVerse}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copiado!</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5 text-church-gold" />
                <span>Copiar / Compartilhar</span>
              </>
            )}
          </button>

          <button
            onClick={handleOpenFullPlan}
            className="inline-flex items-center gap-2 bg-church-gold hover:bg-church-gold/90 text-church-navy px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Ver Plano Completo & Devocional</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

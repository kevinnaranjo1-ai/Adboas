import { useState, FormEvent } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Save, Send, Loader2, ChevronLeft, Info, ThumbsUp, ThumbsDown, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { createReportNotification } from '../lib/notifications';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function ReportForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;

  const [formData, setFormData] = useState({
    type: 'department',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    departmentName: '',
    content: '',
    conversions: 0,
    reconciliations: 0,
    baptisms: 0,
    servicesCount: 0,
    visitsCount: 0,
    peopleVisitedCount: 0,
    nextMonthProjection: '',
    positives: '',
    negatives: '',
    difficulties: '',
    testimonies: '',
    needs: '',
  });

  const handleSubmit = async (e: FormEvent, status: 'draft' | 'enviado') => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const reportData = {
        ...formData,
        enviadoById: user.uid,
        enviadoByName: user.displayName,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'reports'), reportData);
      
      if (status === 'enviado') {
        await createReportNotification(
          user.uid,
          user.displayName || 'Líder',
          docRef.id,
          formData.departmentName || 'Pastoral',
          formData.type
        );
      }

      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reports');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <button 
        onClick={() => navigate('/')} 
        className="mb-6 flex items-center gap-2 text-sm font-medium text-church-navy/60 hover:text-church-navy transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar ao Início
      </button>

      <header className="mb-10">
        <h1 className="font-serif text-3xl font-bold text-church-navy tracking-tight">Novo Relatório Mensal</h1>
        <p className="text-church-navy/60 mt-1">Preencha os campos abaixo com as atividades e métricas do mês.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <form id="report-form" onSubmit={(e) => handleSubmit(e, 'enviado')} className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-church-gold/10 p-8 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-church-navy uppercase tracking-wider">Tipo de Relatório</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full rounded-lg border border-church-gold/20 bg-church-cream/30 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-church-gold/20"
                  >
                    <option value="department">Departamento</option>
                    <option value="pastoral">Pastoral</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-church-navy uppercase tracking-wider">Mês de Referência</label>
                  <select 
                    value={formData.month}
                    onChange={(e) => setFormData({...formData, month: parseInt(e.target.value)})}
                    className="w-full rounded-lg border border-church-gold/20 bg-church-cream/30 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-church-gold/20"
                  >
                    {MONTHS.map((month, i) => (
                      <option key={month} value={i + 1}>{month}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-church-navy uppercase tracking-wider">
                  {formData.type === 'pastoral' ? 'Título / Assunto' : 'Nome do Departamento'}
                </label>
                <input 
                  type="text"
                  required
                  placeholder={formData.type === 'pastoral' ? 'Ex: Relatório Pastoral Mensal' : 'Ex: Departamento Infantil, Jovens...'}
                  value={formData.departmentName}
                  onChange={(e) => setFormData({...formData, departmentName: e.target.value})}
                  className="w-full rounded-lg border border-church-gold/20 bg-church-cream/30 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-church-gold/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-church-navy uppercase tracking-wider">Detalhes e Atividades</label>
                <textarea 
                  required
                  rows={6}
                  placeholder="Descreva as atividades, reuniões, cultos e observações importantes..."
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  className="w-full rounded-lg border border-church-gold/20 bg-church-cream/30 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-church-gold/20 resize-none font-sans font-medium leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-church-navy uppercase tracking-wider">Projeção para o Próximo Mês</label>
                <textarea 
                  rows={4}
                  placeholder="Quais são os planos e objetivos para o próximo mês?"
                  value={formData.nextMonthProjection}
                  onChange={(e) => setFormData({...formData, nextMonthProjection: e.target.value})}
                  className="w-full rounded-lg border border-church-gold/20 bg-church-cream/30 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-church-gold/20 resize-none font-sans font-medium leading-relaxed"
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-church-navy uppercase tracking-wider flex items-center gap-1.5">
                    <ThumbsUp className="h-4 w-4 text-green-600" />
                    3 Pontos Positivos
                  </label>
                  <textarea 
                    rows={3}
                    placeholder="Ex: Excelente participação, boa integração..."
                    value={formData.positives}
                    onChange={(e) => setFormData({...formData, positives: e.target.value})}
                    className="w-full rounded-lg border border-church-gold/20 bg-church-cream/30 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-church-gold/20 resize-none font-sans font-medium leading-relaxed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-church-navy uppercase tracking-wider flex items-center gap-1.5">
                    <ThumbsDown className="h-4 w-4 text-red-600" />
                    3 Pontos Negativos
                  </label>
                  <textarea 
                    rows={3}
                    placeholder="Ex: Falta de material, problemas de som..."
                    value={formData.negatives}
                    onChange={(e) => setFormData({...formData, negatives: e.target.value})}
                    className="w-full rounded-lg border border-church-gold/20 bg-church-cream/30 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-church-gold/20 resize-none font-sans font-medium leading-relaxed"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-church-navy uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Dificuldades Encontradas
                </label>
                <textarea 
                  rows={2}
                  placeholder="Quais dificuldades foram enfrentadas no ministério neste mês?"
                  value={formData.difficulties}
                  onChange={(e) => setFormData({...formData, difficulties: e.target.value})}
                  className="w-full rounded-lg border border-church-gold/20 bg-church-cream/30 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-church-gold/20 resize-none font-sans font-medium leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-church-navy uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-church-gold" />
                  Testemunhos e Bênçãos
                </label>
                <textarea 
                  rows={2}
                  placeholder="Mencione respostas de orações, milagres e testemunhos do departamento..."
                  value={formData.testimonies}
                  onChange={(e) => setFormData({...formData, testimonies: e.target.value})}
                  className="w-full rounded-lg border border-church-gold/20 bg-church-cream/30 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-church-gold/20 resize-none font-sans font-medium leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-church-navy uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4 text-blue-500" />
                  Necessidades do Departamento/Ministério
                </label>
                <textarea 
                  rows={2}
                  placeholder="Quais materiais ou suporte o departamento necessita atualmente?"
                  value={formData.needs}
                  onChange={(e) => setFormData({...formData, needs: e.target.value})}
                  className="w-full rounded-lg border border-church-gold/20 bg-church-cream/30 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-church-gold/20 resize-none font-sans font-medium leading-relaxed"
                />
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-church-gold/10 p-8 space-y-6">
              <h3 className="font-serif text-lg font-bold text-church-navy">Métricas e Resultados</h3>
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-church-navy/60 uppercase">Nº de Cultos</label>
                  <input 
                    type="number"
                    min="0"
                    value={formData.servicesCount}
                    onChange={(e) => setFormData({...formData, servicesCount: parseInt(e.target.value) || 0})}
                    className="w-full rounded-lg border border-church-gold/20 px-4 py-3 text-center text-xl font-bold text-church-navy"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-church-navy/60 uppercase">Nº de Visitas</label>
                  <input 
                    type="number"
                    min="0"
                    value={formData.visitsCount}
                    onChange={(e) => setFormData({...formData, visitsCount: parseInt(e.target.value) || 0})}
                    className="w-full rounded-lg border border-church-gold/20 px-4 py-3 text-center text-xl font-bold text-church-navy"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-church-navy/60 uppercase">Pessoas Visitadas</label>
                  <input 
                    type="number"
                    min="0"
                    value={formData.peopleVisitedCount}
                    onChange={(e) => setFormData({...formData, peopleVisitedCount: parseInt(e.target.value) || 0})}
                    className="w-full rounded-lg border border-church-gold/20 px-4 py-3 text-center text-xl font-bold text-church-navy"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-church-navy/60 uppercase">Conversões</label>
                  <input 
                    type="number"
                    min="0"
                    value={formData.conversions}
                    onChange={(e) => setFormData({...formData, conversions: parseInt(e.target.value) || 0})}
                    className="w-full rounded-lg border border-church-gold/20 px-4 py-3 text-center text-xl font-bold text-green-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-church-navy/60 uppercase">Reconciliações</label>
                  <input 
                    type="number"
                    min="0"
                    value={formData.reconciliations}
                    onChange={(e) => setFormData({...formData, reconciliations: parseInt(e.target.value) || 0})}
                    className="w-full rounded-lg border border-church-gold/20 px-4 py-3 text-center text-xl font-bold text-amber-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-church-navy/60 uppercase">Batismos</label>
                  <input 
                    type="number"
                    min="0"
                    value={formData.baptisms}
                    onChange={(e) => setFormData({...formData, baptisms: parseInt(e.target.value) || 0})}
                    className="w-full rounded-lg border border-church-gold/20 px-4 py-3 text-center text-xl font-bold text-blue-600"
                  />
                </div>
              </div>
            </section>
          </form>
        </div>

        <aside className="space-y-6">
          <div className="sticky top-24 space-y-6">
            <div className="bg-church-navy rounded-2xl p-6 text-white shadow-lg space-y-6">
              <h3 className="font-serif text-xl font-semibold border-b border-white/10 pb-4">Concluir Envio</h3>
              <p className="text-sm text-white/70">
                Certifique-se de que todos os dados estão corretos antes de enviar. Relatórios enviados não podem ser editados sem permissão pastoral.
              </p>
              
              <div className="space-y-3 pt-4">
                <button
                  type="submit"
                  form="report-form"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-church-gold px-4 py-3 font-bold text-church-navy shadow-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  Enviar Relatório
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, 'draft')}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 font-semibold text-white/90 transition-all hover:bg-white/20"
                >
                  <Save className="h-5 w-5" />
                  Salvar Rascunho
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-church-gold/10 shadow-sm">
              <div className="flex items-start gap-4 text-church-navy/60">
                <Info className="h-5 w-5 mt-1 shrink-0 text-church-gold" />
                <div className="text-sm space-y-2">
                  <p className="font-bold text-church-navy">Dica Pastoral</p>
                  <p>Seja específico nos detalhes. Mencione bênçãos alcançadas e desafios encontrados no ministério.</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

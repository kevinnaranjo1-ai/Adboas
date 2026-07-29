import { motion, AnimatePresence } from 'motion/react';
import { X, Download, FileText, Calendar, User, Users, TrendingUp, Church, ThumbsUp, ThumbsDown, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportDetailModalProps {
  report: any;
  onClose: () => void;
}

export default function ReportDetailModal({ report, onClose }: ReportDetailModalProps) {
  const generatePDF = () => {
    const doc = new jsPDF();
    const date = report.createdAt?.toDate ? format(report.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A';
    const monthYear = format(new Date(report.year, report.month - 1), 'MMMM yyyy', { locale: ptBR });

    // Header
    doc.setFontSize(22);
    doc.setTextColor(26, 54, 93); // church-navy
    doc.text('AD Boas Novas - Tenda da Promessa', 105, 20, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(212, 175, 55); // church-gold
    doc.text(`Relatório ${report.type === 'pastoral' ? 'Pastoral' : 'de Departamento'}`, 105, 30, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Referente a: ${monthYear}`, 105, 38, { align: 'center' });

    doc.setDrawColor(212, 175, 55);
    doc.line(20, 45, 190, 45);

    // Basic Info
    autoTable(doc, {
      startY: 50,
      head: [['Campo', 'Informação']],
      body: [
        ['Departamento/Assunto', report.departmentName],
        ['Responsável', report.enviadoByName],
        ['Data de Envio', date],
        ['Tipo', report.type === 'pastoral' ? 'Pastoral' : 'Departamento'],
        ['Número de Cultos', report.servicesCount || 0],
        ['Número de Visitas', report.visitsCount || 0],
        ['Pessoas Visitadas', report.peopleVisitedCount || 0],
      ],
      theme: 'striped',
      headStyles: { fillColor: [26, 54, 93] },
    });

    // Metrics
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Métrica', 'Valor']],
      body: [
        ['Conversões/Almas', report.conversions || 0],
        ['Reconciliações', report.reconciliations || 0],
        ['Batismos', report.baptisms || 0],
      ],
      theme: 'grid',
      headStyles: { fillColor: [212, 175, 55], textColor: [26, 54, 93] },
    });

    // Projections
    if (report.nextMonthProjection) {
      const projectionY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.setTextColor(26, 54, 93);
      doc.text('Projeção para o Próximo Mês:', 20, projectionY);
      
      doc.setFontSize(11);
      doc.setTextColor(50);
      const splitProjection = doc.splitTextToSize(report.nextMonthProjection, 170);
      doc.text(splitProjection, 20, projectionY + 10);
      (doc as any).lastAutoTable.finalY = projectionY + 10 + (splitProjection.length * 5);
    }

    // Observations
    const observations: any[] = [];
    if (report.positives) observations.push(['Pontos Positivos', report.positives]);
    if (report.negatives) observations.push(['Pontos Negativos', report.negatives]);
    if (report.difficulties) observations.push(['Dificuldades Encontradas', report.difficulties]);
    if (report.testimonies) observations.push(['Testemunhos e Bênçãos', report.testimonies]);
    if (report.needs) observations.push(['Necessidades do Departamento', report.needs]);

    if (observations.length > 0) {
      const nextY2 = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 54, 93);
      doc.text('Avaliação e Observações:', 20, nextY2);

      autoTable(doc, {
        startY: nextY2 + 4,
        head: [['Aspecto', 'Relato / Observação']],
        body: observations,
        theme: 'grid',
        headStyles: { fillColor: [26, 54, 93], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold', textColor: [26, 54, 93] },
          1: { cellWidth: 'auto' }
        }
      });
      (doc as any).lastAutoTable.finalY = (doc as any).lastAutoTable.finalY;
    }

    // Content
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(26, 54, 93);
    doc.text('Detalhes e Atividades:', 20, finalY);
    
    doc.setFontSize(11);
    doc.setTextColor(50);
    const splitContent = doc.splitTextToSize(report.content, 170);
    doc.text(splitContent, 20, finalY + 10);

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(`AD Boas Novas - Tenda da Promessa | Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 285, { align: 'center' });
    }

    doc.save(`Relatorio_${report.departmentName}_${report.month}_${report.year}.pdf`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-church-navy/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex h-16 items-center justify-between border-b border-church-gold/10 bg-church-navy px-6 text-white">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-church-gold" />
              <h2 className="font-serif text-xl font-bold">Detalhes do Relatório</h2>
            </div>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="max-h-[80vh] overflow-y-auto p-8">
            <div className="grid gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-8">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-church-navy">
                    <Church className="h-5 w-5 text-church-gold" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">Conteúdo do Relatório</h3>
                  </div>
                  <div className="rounded-xl bg-church-cream/50 p-6 text-church-navy leading-relaxed whitespace-pre-wrap">
                    {report.content}
                  </div>
                </section>

                {report.nextMonthProjection && (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-church-navy">
                      <TrendingUp className="h-5 w-5 text-church-gold" />
                      <h3 className="text-sm font-bold uppercase tracking-wider">Projeção para Próximo Mês</h3>
                    </div>
                    <div className="rounded-xl bg-church-gold/5 border border-church-gold/10 p-6 text-church-navy leading-relaxed whitespace-pre-wrap">
                      {report.nextMonthProjection}
                    </div>
                  </section>
                )}

                {/* Avaliação e Observações */}
                {(report.positives || report.negatives || report.difficulties || report.testimonies || report.needs) && (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-church-navy border-b border-church-gold/10 pb-2">
                      <FileText className="h-5 w-5 text-church-gold" />
                      <h3 className="text-sm font-bold uppercase tracking-wider">Avaliação e Observações</h3>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                      {report.positives && (
                        <div className="rounded-xl border border-church-gold/10 p-5 bg-white space-y-2">
                          <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider flex items-center gap-1.5">
                            <ThumbsUp className="h-4 w-4" />
                            3 Pontos Positivos
                          </span>
                          <p className="text-sm text-church-navy font-semibold italic whitespace-pre-wrap leading-relaxed">{report.positives}</p>
                        </div>
                      )}
                      {report.negatives && (
                        <div className="rounded-xl border border-church-gold/10 p-5 bg-white space-y-2">
                          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                            <ThumbsDown className="h-4 w-4" />
                            3 Pontos Negativos
                          </span>
                          <p className="text-sm text-church-navy font-semibold italic whitespace-pre-wrap leading-relaxed">{report.negatives}</p>
                        </div>
                      )}
                    </div>

                    {report.difficulties && (
                      <div className="rounded-xl border border-church-gold/10 p-5 bg-white space-y-2">
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4" />
                          Dificuldades Encontradas
                        </span>
                        <p className="text-sm text-church-navy font-semibold whitespace-pre-wrap leading-relaxed">{report.difficulties}</p>
                      </div>
                    )}

                    {report.testimonies && (
                      <div className="rounded-xl border border-church-gold/10 p-5 bg-white space-y-2">
                        <span className="text-[10px] font-bold text-church-gold uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4" />
                          Testemunhos e Bênçãos
                        </span>
                        <p className="text-sm text-church-navy font-semibold whitespace-pre-wrap leading-relaxed">{report.testimonies}</p>
                      </div>
                    )}

                    {report.needs && (
                      <div className="rounded-xl border border-church-gold/10 p-5 bg-white space-y-2">
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                          <HelpCircle className="h-4 w-4" />
                          Necessidades do Departamento/Ministério
                        </span>
                        <p className="text-sm text-church-navy font-semibold whitespace-pre-wrap leading-relaxed">{report.needs}</p>
                      </div>
                    )}
                  </section>
                )}

                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-church-gold/10 p-4 text-center">
                    <p className="text-[10px] font-bold text-church-navy/60 uppercase">Cultos</p>
                    <p className="text-xl font-black text-church-navy">{report.servicesCount || 0}</p>
                  </div>
                  <div className="rounded-xl border border-church-gold/10 p-4 text-center">
                    <p className="text-[10px] font-bold text-church-navy/60 uppercase">Visitas</p>
                    <p className="text-xl font-black text-church-navy">{report.visitsCount || 0}</p>
                  </div>
                  <div className="rounded-xl border border-church-gold/10 p-4 text-center">
                    <p className="text-[10px] font-bold text-church-navy/60 uppercase">Pessoas Visit.</p>
                    <p className="text-xl font-black text-church-navy">{report.peopleVisitedCount || 0}</p>
                  </div>
                  <div className="rounded-xl border border-church-gold/10 p-4 text-center">
                    <p className="text-[10px] font-bold text-green-600/60 uppercase">Conversões</p>
                    <p className="text-xl font-black text-green-600">{report.conversions || 0}</p>
                  </div>
                  <div className="rounded-xl border border-church-gold/10 p-4 text-center">
                    <p className="text-[10px] font-bold text-amber-600/60 uppercase">Reconcil.</p>
                    <p className="text-xl font-black text-amber-600">{report.reconciliations || 0}</p>
                  </div>
                  <div className="rounded-xl border border-church-gold/10 p-4 text-center">
                    <p className="text-[10px] font-bold text-blue-600/60 uppercase">Batismos</p>
                    <p className="text-xl font-black text-blue-600">{report.baptisms || 0}</p>
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <div className="rounded-2xl bg-church-navy p-6 text-white">
                  <h4 className="font-serif text-lg font-bold mb-4 border-b border-white/10 pb-2">Informações</h4>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <User className="h-4 w-4 text-church-gold mt-1" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-white/40">Responsável</p>
                        <p className="text-sm font-medium">{report.enviadoByName}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 text-church-gold mt-1" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-white/40">Referência</p>
                        <p className="text-sm font-medium">
                          {format(new Date(report.year, report.month - 1), 'MMMM yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={generatePDF}
                    className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-church-gold px-4 py-3 font-bold text-church-navy shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <Download className="h-5 w-5" />
                    Baixar PDF
                  </button>
                </div>

                <div className="rounded-2xl border border-church-gold/10 p-6 bg-church-cream/30">
                  <p className="text-xs text-church-navy/60 italic">
                    Este relatório foi enviado em {report.createdAt?.toDate ? format(report.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : '...'}.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

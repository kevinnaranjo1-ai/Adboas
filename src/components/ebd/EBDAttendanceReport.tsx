import { useState, useEffect, useMemo, Fragment } from 'react';
import { collection, query, where, addDoc, deleteDoc, doc, serverTimestamp, limit, orderBy, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useCollection } from 'react-firebase-hooks/firestore';
import { CheckCircle2, Save, FileDown, Users, BookOpen, UserPlus, DollarSign, History, Trash2, XCircle, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, AlertCircle, Sparkles, HelpCircle, MessageSquare } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import DeleteConfirmationModal from '../DeleteConfirmationModal';
import { motion, AnimatePresence } from 'motion/react';

interface EBDAttendanceReportProps {
  classes: any[];
  isEBDAdmin: boolean | null;
}

export default function EBDAttendanceReport({ classes, isEBDAdmin }: EBDAttendanceReportProps) {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [reportData, setReportData] = useState({
    bibles: 0,
    magazines: 0,
    visitors: 0,
    offering: 0,
    positives: '',
    negatives: '',
    difficulties: '',
    testimonies: '',
    needs: ''
  });
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingReport, setDeletingReport] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [consolidating, setConsolidating] = useState(false);
  const [consolidateMonth, setConsolidateMonth] = useState(new Date().getMonth() + 1);
  const [consolidateYear, setConsolidateYear] = useState(new Date().getFullYear());

  const getMonthName = (m: number) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[m - 1] || '';
  };

  const handleConsolidateEBD = async () => {
    setConsolidating(true);
    try {
      const monthStr = String(consolidateMonth).padStart(2, '0');
      const start = `${consolidateYear}-${monthStr}-01`;
      const end = `${consolidateYear}-${monthStr}-31`;
      
      const reportsQuery = query(
        collection(db, 'ebd_attendance'),
        where('date', '>=', start),
        where('date', '<=', end)
      );
      const querySnapshot = await getDocs(reportsQuery);
      
      if (querySnapshot.empty) {
        alert(`Nenhum relatório da EBD encontrado para o mês de ${getMonthName(consolidateMonth)} de ${consolidateYear}.`);
        setConsolidating(false);
        return;
      }
      
      const monthlyReports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      monthlyReports.sort((a, b) => a.date.localeCompare(b.date) || a.className.localeCompare(b.className));
      
      const doc = new jsPDF();
      
      // Header Banner
      doc.setFillColor(26, 54, 93); // Navy Blue
      doc.rect(0, 0, 210, 38, 'F');
      
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('ESCOLA BÍBLICA DOMINICAL - AD BOAS NOVAS', 105, 16, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(218, 165, 32); // Gold
      const monthName = getMonthName(consolidateMonth);
      doc.text(`RELATÓRIO MENSAL CONSOLIDADO (EXECUTIVE DIGEST) — ${monthName.toUpperCase()} / ${consolidateYear}`, 105, 26, { align: 'center' });
      
      // Calculate Stats
      let totalBibles = 0;
      let totalMagazines = 0;
      let totalVisitors = 0;
      let totalOffering = 0;
      let totalPresent = 0;
      let totalLessons = monthlyReports.length;
      
      const classSummary: Record<string, {
        lessons: number;
        presentSum: number;
        visitorsSum: number;
        biblesSum: number;
        magazinesSum: number;
        offeringSum: number;
      }> = {};
      
      monthlyReports.forEach(rep => {
        totalBibles += rep.bibles || 0;
        totalMagazines += rep.magazines || 0;
        totalVisitors += rep.visitors || 0;
        totalOffering += rep.offering || 0;
        totalPresent += rep.totalPresent || 0;
        
        const cName = rep.className || 'Classe';
        if (!classSummary[cName]) {
          classSummary[cName] = {
            lessons: 0,
            presentSum: 0,
            visitorsSum: 0,
            biblesSum: 0,
            magazinesSum: 0,
            offeringSum: 0
          };
        }
        classSummary[cName].lessons += 1;
        classSummary[cName].presentSum += rep.totalPresent || 0;
        classSummary[cName].visitorsSum += rep.visitors || 0;
        classSummary[cName].biblesSum += rep.bibles || 0;
        classSummary[cName].magazinesSum += rep.magazines || 0;
        classSummary[cName].offeringSum += rep.offering || 0;
      });
      
      // Summary Box
      doc.setTextColor(26, 54, 93);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('RESUMO EXECUTIVO DO MÊS', 20, 50);
      
      const totalsData = [
        ['Aulas Registradas', totalLessons],
        ['Alunos Presentes (Acumulado)', totalPresent],
        ['Bíblias Trazidas', totalBibles],
        ['Revistas Trazidas', totalMagazines],
        ['Visitantes Recebidos', totalVisitors],
        ['Total em Ofertas das Classes', `R$ ${totalOffering.toFixed(2)}`]
      ];
      
      autoTable(doc, {
        startY: 54,
        body: totalsData,
        theme: 'striped',
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 100, fontStyle: 'bold' },
          1: { cellWidth: 50, halign: 'right', fontStyle: 'bold', textColor: [26, 54, 93] }
        }
      });
      
      let nextY = (doc as any).lastAutoTable.finalY + 10;
      
      // Class Table
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 54, 93);
      doc.text('MÉDIAS E TOTAIS POR CLASSE', 20, nextY);
      
      const classTableBody = Object.entries(classSummary).map(([cName, s]) => {
        const avgPresent = (s.presentSum / s.lessons).toFixed(1);
        return [
          cName,
          s.lessons,
          avgPresent,
          s.visitorsSum,
          s.biblesSum,
          s.magazinesSum,
          `R$ ${s.offeringSum.toFixed(2)}`
        ];
      });
      
      autoTable(doc, {
        startY: nextY + 4,
        head: [['Classe', 'Aulas dadas', 'Média Presentes', 'Visitantes', 'Bíblias', 'Revistas', 'Total Oferta']],
        body: classTableBody,
        theme: 'grid',
        headStyles: { fillColor: [26, 54, 93], textColor: [255, 255, 255] },
        styles: { fontSize: 8.5 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'center' },
          2: { halign: 'center', fontStyle: 'bold', textColor: [34, 139, 34] },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'right', fontStyle: 'bold' }
        }
      });
      
      nextY = (doc as any).lastAutoTable.finalY + 12;
      
      if (nextY > 215) {
        doc.addPage();
        nextY = 20;
      }
      
      // Pedagogical Feedback / Observations
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 54, 93);
      doc.text('REGISTROS PEDAGÓGICOS E OBSERVAÇÕES DAS CLASSES', 20, nextY);
      
      let commentRows: any[] = [];
      monthlyReports.forEach(rep => {
        if (rep.positives || rep.negatives || rep.difficulties || rep.testimonies || rep.needs) {
          const formattedDate = rep.date ? new Date(rep.date + 'T12:00:00').toLocaleDateString('pt-BR') : '';
          const header = `${rep.className}\n(${formattedDate})`;
          const contentParts = [];
          if (rep.positives) contentParts.push(`• Pontos Positivos: ${rep.positives}`);
          if (rep.negatives) contentParts.push(`• Pontos Negativos: ${rep.negatives}`);
          if (rep.difficulties) contentParts.push(`• Dificuldades: ${rep.difficulties}`);
          if (rep.testimonies) contentParts.push(`• Bênçãos/Testemunhos: ${rep.testimonies}`);
          if (rep.needs) contentParts.push(`• Necessidades da Classe: ${rep.needs}`);
          
          commentRows.push([header, contentParts.join('\n\n')]);
        }
      });
      
      if (commentRows.length === 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120, 120, 120);
        doc.text('Nenhuma observação ou registro pedagógico cadastrado para as classes neste mês.', 20, nextY + 6);
      } else {
        autoTable(doc, {
          startY: nextY + 4,
          head: [['Classe / Data', 'Registros e Necessidades']],
          body: commentRows,
          theme: 'striped',
          headStyles: { fillColor: [218, 165, 32], textColor: [26, 54, 93], fontStyle: 'bold' },
          styles: { fontSize: 8, overflow: 'linebreak' },
          columnStyles: {
            0: { cellWidth: 50, fontStyle: 'bold', textColor: [26, 54, 93] },
            1: { cellWidth: 'auto' }
          }
        });
      }
      
      doc.save(`Consolidado_EBD_${monthName}_${consolidateYear}.pdf`);
    } catch (error: any) {
      alert(`Erro ao gerar PDF consolidado: ${error.message || error}`);
    } finally {
      setConsolidating(false);
    }
  };

  // Fetch students for selected class
  const [studentsSnapshot, loadingStudents] = useCollection(
    selectedClassId ? query(collection(db, 'ebd_students'), where('classId', '==', selectedClassId)) : null
  );

  const [reportsSnapshot, loadingReports] = useCollection(
    query(collection(db, 'ebd_attendance'), orderBy('createdAt', 'desc'), limit(10))
  );

  const reports = useMemo(() => {
    return reportsSnapshot ? reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)) : [];
  }, [reportsSnapshot]);

  const students = useMemo(() => {
    return studentsSnapshot ? [...studentsSnapshot.docs].sort((a, b) => a.data().name.localeCompare(b.data().name)) : [];
  }, [studentsSnapshot]);

  useEffect(() => {
    if (studentsSnapshot) {
      const initialAttendance: Record<string, boolean> = {};
      students.forEach(s => {
        initialAttendance[s.id] = false;
      });
      setAttendance(initialAttendance);
    }
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [studentsSnapshot, students]);

  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [selectedClassId, selectedDate]);

  const toggleAttendance = (studentId: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  const handleSaveReport = async () => {
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!selectedClassId || !selectedDate) {
      setErrorMsg('Por favor, selecione uma classe e uma data.');
      return;
    }

    if (isEBDAdmin !== true) {
      setErrorMsg('Você não tem permissão para salvar relatórios.');
      return;
    }

    setSaving(true);
    try {
      const presentStudentIds = Object.keys(attendance).filter(id => attendance[id]);
      const absentStudents = students
        .filter(s => !attendance[s.id])
        .map(s => ({ id: s.id, name: s.data().name }));
      
      await addDoc(collection(db, 'ebd_attendance'), {
        classId: selectedClassId,
        className: classes.find(c => c.id === selectedClassId)?.name || 'Classe Desconhecida',
        date: selectedDate,
        presentStudents: presentStudentIds,
        absentStudents: absentStudents,
        totalPresent: presentStudentIds.length,
        totalAbsent: absentStudents.length,
        ...reportData,
        createdAt: serverTimestamp()
      });

      setSuccessMsg('Relatório de frequência salvo com sucesso!');
      // Reset form partially
      setAttendance({});
      setReportData({
        bibles: 0,
        magazines: 0,
        visitors: 0,
        offering: 0,
        positives: '',
        negatives: '',
        difficulties: '',
        testimonies: '',
        needs: ''
      });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'ebd_attendance');
      setErrorMsg(`Erro ao salvar relatório: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteReport = async () => {
    if (!deletingReport || isEBDAdmin !== true) return;
    try {
      await deleteDoc(doc(db, 'ebd_attendance', deletingReport));
      setDeletingReport(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `ebd_attendance/${deletingReport}`);
      alert('Erro ao excluir relatório.');
    }
  };

  const generatePDF = () => {
    const data = {
      classId: selectedClassId,
      className: classes.find(c => c.id === selectedClassId)?.name,
      date: selectedDate,
      bibles: reportData.bibles,
      magazines: reportData.magazines,
      visitors: reportData.visitors,
      offering: reportData.offering,
      totalPresent: Object.values(attendance).filter(v => v).length
    };

    if (!data.classId) return;

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório Escola Bíblica Dominical', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Classe: ${data.className}`, 20, 25);
    doc.text(`Data: ${data.date}`, 20, 32);

    const stats = [
      ['Bíblias', data.bibles],
      ['Revistas', data.magazines],
      ['Visitantes', data.visitors],
      ['Oferta (R$)', data.offering.toFixed(2)],
      ['Total Presentes', data.totalPresent],
      ['Total Ausentes', students.length - data.totalPresent]
    ];

    autoTable(doc, {
      startY: 40,
      head: [['Indicador', 'Quantidade']],
      body: stats,
      theme: 'striped',
      headStyles: { fillColor: [26, 54, 93] }
    });

    const studentsData = students.map(d => [
      d.data().name,
      attendance[d.id] ? 'Presente' : 'Ausente'
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Nome do Aluno', 'Status']],
      body: studentsData,
      theme: 'grid',
      headStyles: { fillColor: [212, 175, 55] }
    });

    const observations: any[] = [];
    if (reportData.positives) observations.push(['Pontos Positivos', reportData.positives]);
    if (reportData.negatives) observations.push(['Pontos Negativos', reportData.negatives]);
    if (reportData.difficulties) observations.push(['Dificuldades Encontradas', reportData.difficulties]);
    if (reportData.testimonies) observations.push(['Testemunhos e Bênçãos', reportData.testimonies]);
    if (reportData.needs) observations.push(['Necessidades da Classe', reportData.needs]);

    if (observations.length > 0) {
      const nextY2 = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 54, 93);
      doc.text('Relatório Pedagógico e Observações:', 20, nextY2);

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
    }

    doc.save(`ebd_relatorio_${data.className}_${data.date}.pdf`);
  };

  const generateReportPDF = async (report: any) => {
    try {
      const studentsQuery = query(collection(db, 'ebd_students'), where('classId', '==', report.classId));
      const studentsSnap = await getDocs(studentsQuery);
      const studentMap: Record<string, string> = {};
      studentsSnap.docs.forEach(d => {
        studentMap[d.id] = d.data().name;
      });

      const doc = new jsPDF();
      
      doc.setFillColor(26, 54, 93);
      doc.rect(0, 0, 210, 35, 'F');
      
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('ESCOLA BÍBLICA DOMINICAL', 105, 15, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Relatório Oficial de Frequência e Oferta', 105, 22, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(212, 175, 55);
      doc.setFont('helvetica', 'bold');
      doc.text('Assembleia de Deus Boas Novas', 105, 29, { align: 'center' });

      doc.setTextColor(26, 54, 93);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Informações Gerais:', 20, 48);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Classe: ${report.className || 'Classe Desconhecida'}`, 20, 56);
      
      const formattedDate = report.date ? new Date(report.date + 'T12:00:00').toLocaleDateString('pt-BR') : '-';
      doc.text(`Data do Domingo: ${formattedDate}`, 20, 62);

      const stats = [
        ['Bíblias Presentes', report.bibles || 0],
        ['Revistas Presentes', report.magazines || 0],
        ['Visitantes', report.visitors || 0],
        ['Total Presentes', report.totalPresent || 0],
        ['Total Ausentes', report.totalAbsent || 0],
        ['Oferta da Classe', `R$ ${(report.offering || 0).toFixed(2)}`]
      ];

      autoTable(doc, {
        startY: 68,
        head: [['Indicador', 'Quantidade / Valor']],
        body: stats,
        theme: 'striped',
        headStyles: { fillColor: [26, 54, 93], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: {
          1: { halign: 'right', fontStyle: 'bold' }
        }
      });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 54, 93);
      const nextY = (doc as any).lastAutoTable.finalY + 12;
      doc.text('Lista de Alunos e Frequência:', 20, nextY);

      const tableData: any[] = [];
      const presentIds = report.presentStudents || [];
      presentIds.forEach((id: string) => {
        const name = studentMap[id] || 'Aluno Desconhecido';
        tableData.push([name, 'Presente']);
      });

      const absentList = report.absentStudents || [];
      absentList.forEach((s: any) => {
        tableData.push([s.name || 'Aluno Desconhecido', 'Ausente']);
      });

      tableData.sort((a, b) => a[0].localeCompare(b[0]));

      autoTable(doc, {
        startY: nextY + 4,
        head: [['Nome do Aluno', 'Frequência']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [212, 175, 55], textColor: [26, 54, 93], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            if (data.cell.raw === 'Presente') {
              data.cell.styles.textColor = [22, 101, 52];
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.raw === 'Ausente') {
              data.cell.styles.textColor = [153, 27, 27];
            }
          }
        }
      });

      const observations: any[] = [];
      if (report.positives) observations.push(['Pontos Positivos', report.positives]);
      if (report.negatives) observations.push(['Pontos Negativos', report.negatives]);
      if (report.difficulties) observations.push(['Dificuldades Encontradas', report.difficulties]);
      if (report.testimonies) observations.push(['Testemunhos e Bênçãos', report.testimonies]);
      if (report.needs) observations.push(['Necessidades da Classe', report.needs]);

      if (observations.length > 0) {
        const nextY2 = (doc as any).lastAutoTable.finalY + 12;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 54, 93);
        doc.text('Relatório Pedagógico e Observações:', 20, nextY2);

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
      }

      const fileName = `ebd_relatorio_${(report.className || 'classe').replace(/\s+/g, '_')}_${report.date}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar o PDF do relatório recente.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="grid sm:grid-cols-2 gap-6 bg-church-cream/30 p-6 rounded-3xl border border-church-gold/10">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Selecione a Classe</label>
          <select 
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full rounded-xl border border-church-gold/20 p-3 bg-white outline-none focus:ring-2 focus:ring-church-gold/20 font-semibold text-church-navy appearance-none"
          >
            <option value="">Escolha uma classe...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Data do Domingo</label>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-xl border border-church-gold/20 p-3 bg-white outline-none focus:ring-2 focus:ring-church-gold/20 font-bold text-church-navy"
          />
        </div>
      </div>

      {selectedClassId ? (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-serif text-xl font-black text-church-navy flex items-center gap-2">
              <Users className="h-5 w-5 text-church-gold" />
              Chamada de Presença
            </h3>
            <div className="bg-white rounded-3xl border border-church-gold/10 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-church-navy/5 text-church-navy text-xs font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Nome do Aluno</th>
                    <th className="px-6 py-4 text-center w-32">Presença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-church-gold/10">
                  {loadingStudents ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-12 text-center text-church-navy/40 font-bold">
                        Carregando alunos...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-12 text-center text-church-navy/40 font-bold">
                        Nenhum aluno cadastrado nesta classe.
                      </td>
                    </tr>
                  ) : (
                    students.map(student => (
                      <tr key={student.id} className="hover:bg-church-cream/20 transition-colors">
                        <td className="px-6 py-4 font-semibold text-church-navy">{student.data().name}</td>
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={attendance[student.id] || false}
                            onChange={() => toggleAttendance(student.id)}
                            className="h-5 w-5 rounded border-church-gold/30 text-church-navy focus:ring-church-gold cursor-pointer"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Avaliação e Relatório de Aula */}
            <div className="space-y-4 pt-4" id="report-form-pedagogico">
              <h3 className="font-serif text-xl font-black text-church-navy flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-church-gold" />
                Relatório de Aula e Observações
              </h3>
              <div className="bg-white p-6 rounded-3xl border border-church-gold/10 shadow-sm space-y-6">
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60 flex items-center gap-1.5">
                      <ThumbsUp className="h-4 w-4 text-green-600" />
                      3 Pontos Positivos
                    </label>
                    <textarea
                      placeholder="Ex: Excelente participação dos alunos, interação dinâmica, boa retenção da lição..."
                      rows={3}
                      value={reportData.positives}
                      onChange={(e) => setReportData(prev => ({ ...prev, positives: e.target.value }))}
                      className="w-full rounded-xl border border-church-gold/20 p-3 bg-white outline-none focus:ring-2 focus:ring-church-gold/20 text-sm font-semibold text-church-navy placeholder:font-normal placeholder:text-church-navy/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60 flex items-center gap-1.5">
                      <ThumbsDown className="h-4 w-4 text-red-600" />
                      3 Pontos Negativos
                    </label>
                    <textarea
                      placeholder="Ex: Alguns alunos sem revista, barulho externo que tirou a concentração..."
                      rows={3}
                      value={reportData.negatives}
                      onChange={(e) => setReportData(prev => ({ ...prev, negatives: e.target.value }))}
                      className="w-full rounded-xl border border-church-gold/20 p-3 bg-white outline-none focus:ring-2 focus:ring-church-gold/20 text-sm font-semibold text-church-navy placeholder:font-normal placeholder:text-church-navy/30"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Dificuldades Encontradas
                  </label>
                  <textarea
                    placeholder="Quais dificuldades a classe ou os professores enfrentaram neste domingo?"
                    rows={2}
                    value={reportData.difficulties}
                    onChange={(e) => setReportData(prev => ({ ...prev, difficulties: e.target.value }))}
                    className="w-full rounded-xl border border-church-gold/20 p-3 bg-white outline-none focus:ring-2 focus:ring-church-gold/20 text-sm font-semibold text-church-navy placeholder:font-normal placeholder:text-church-navy/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-church-gold" />
                    Testemunhos e Bênçãos
                  </label>
                  <textarea
                    placeholder="Compartilhe respostas de orações, testemunhos dos alunos ou bênçãos ocorridas na classe..."
                    rows={2}
                    value={reportData.testimonies}
                    onChange={(e) => setReportData(prev => ({ ...prev, testimonies: e.target.value }))}
                    className="w-full rounded-xl border border-church-gold/20 p-3 bg-white outline-none focus:ring-2 focus:ring-church-gold/20 text-sm font-semibold text-church-navy placeholder:font-normal placeholder:text-church-navy/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60 flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-blue-500" />
                    Necessidades da Classe
                  </label>
                  <textarea
                    placeholder="Quais materiais de apoio, quadros, giz ou reformas a classe necessita no momento?"
                    rows={2}
                    value={reportData.needs}
                    onChange={(e) => setReportData(prev => ({ ...prev, needs: e.target.value }))}
                    className="w-full rounded-xl border border-church-gold/20 p-3 bg-white outline-none focus:ring-2 focus:ring-church-gold/20 text-sm font-semibold text-church-navy placeholder:font-normal placeholder:text-church-navy/30"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="font-serif text-xl font-black text-church-navy flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-church-gold" />
              Dados Gerais e Oferta
            </h3>
            <div className="bg-white p-6 rounded-3xl border border-church-gold/10 space-y-5 shadow-sm">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-church-navy/60">Bíblias Presentes</label>
                <div className="relative">
                  <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-church-navy/30" />
                  <input 
                    type="number" 
                    value={reportData.bibles}
                    onChange={(e) => setReportData(prev => ({ ...prev, bibles: parseInt(e.target.value) || 0 }))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-church-gold/20 outline-none focus:ring-2 focus:ring-church-gold/20 font-bold text-church-navy"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-church-navy/60">Revistas Presentes</label>
                <div className="relative">
                  <FileDown className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-church-navy/30" />
                  <input 
                    type="number" 
                    value={reportData.magazines}
                    onChange={(e) => setReportData(prev => ({ ...prev, magazines: parseInt(e.target.value) || 0 }))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-church-gold/20 outline-none focus:ring-2 focus:ring-church-gold/20 font-bold text-church-navy"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-church-navy/60">Visitantes</label>
                <div className="relative">
                  <UserPlus className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-church-navy/30" />
                  <input 
                    type="number" 
                    value={reportData.visitors}
                    onChange={(e) => setReportData(prev => ({ ...prev, visitors: parseInt(e.target.value) || 0 }))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-church-gold/20 outline-none focus:ring-2 focus:ring-church-gold/20 font-bold text-church-navy"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-church-navy/60">Oferta de Aula (R$)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-church-navy/30" />
                  <input 
                    type="number" 
                    step="0.01"
                    value={reportData.offering}
                    onChange={(e) => setReportData(prev => ({ ...prev, offering: parseFloat(e.target.value) || 0 }))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-church-gold/20 outline-none focus:ring-2 focus:ring-church-gold/20 font-bold text-church-navy"
                  />
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                {successMsg && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs font-bold rounded-xl leading-relaxed text-center">
                    ✓ {successMsg}
                  </div>
                )}
                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-xl leading-relaxed text-center">
                    {errorMsg}
                  </div>
                )}
                <button 
                  onClick={handleSaveReport}
                  disabled={saving || isEBDAdmin !== true}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-church-navy py-3.5 font-bold text-white hover:bg-church-navy/95 disabled:opacity-50 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Save className="h-5 w-5 text-church-gold" /> {saving ? 'Salvando...' : 'Salvar Relatório'}
                </button>
                {isEBDAdmin !== true && (
                  <p className="text-[9px] text-center text-red-500 font-bold uppercase tracking-widest bg-red-50 p-2 rounded-lg">
                    Apenas administradores, pastores e líderes podem salvar relatórios.
                  </p>
                )}
                <button 
                  onClick={generatePDF}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-church-gold text-church-gold py-3 font-bold hover:bg-church-gold/5 transition-all active:scale-95 cursor-pointer"
                >
                  <FileDown className="h-5 w-5" /> Baixar PDF (Chamada)
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-church-gold/20">
          <Users className="h-10 w-10 text-church-gold/30 mx-auto mb-2" />
          <p className="text-sm font-bold text-church-navy/50">Por favor, selecione uma classe acima para realizar a chamada dominical.</p>
        </div>
      )}

      {/* Seção de Relatório Consolidado Mensal (Executive Digest) */}
      <div className="bg-gradient-to-br from-church-navy to-church-navy/90 text-white rounded-3xl p-6 shadow-xl border border-church-gold/20 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-serif text-xl font-black text-church-gold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-church-gold animate-pulse" />
              Consolidado Mensal EBD (Executive Digest)
            </h3>
            <p className="text-xs text-white/70 max-w-xl">
              Gere um único documento PDF com o resumo consolidado de todas as classes da EBD do mês selecionado para reuniões administrativas ou prestação de contas pastoral.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex-1 w-full space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/60">Selecionar Mês</label>
            <select
              value={consolidateMonth}
              onChange={(e) => setConsolidateMonth(parseInt(e.target.value))}
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
              value={consolidateYear}
              onChange={(e) => setConsolidateYear(parseInt(e.target.value))}
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
            onClick={handleConsolidateEBD}
            disabled={consolidating}
            className="w-full sm:w-auto px-6 py-2 bg-church-gold hover:bg-church-gold/90 disabled:opacity-50 text-church-navy font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-102 active:scale-98 cursor-pointer text-sm whitespace-nowrap"
          >
            <FileDown className="h-4 w-4" />
            {consolidating ? 'Gerando...' : 'Exportar Digest Consolidado'}
          </button>
        </div>
      </div>

      {/* Histórico Recente de Relatórios */}
      <div className="space-y-4 pt-8 border-t border-church-gold/10">
        <h3 className="font-serif text-xl font-black text-church-navy flex items-center gap-2">
          <History className="h-5 w-5 text-church-gold" />
          Relatórios Recentes (Últimos 10)
        </h3>
        <div className="hidden md:block bg-white rounded-3xl border border-church-gold/10 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-church-navy/5 text-church-navy text-xs font-black uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Classe</th>
                  <th className="px-6 py-4 text-center">Presenças</th>
                  <th className="px-6 py-4 text-center">Ausências</th>
                  <th className="px-6 py-4 text-right">Oferta</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-church-gold/10">
                {loadingReports ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-church-navy/40 font-bold">
                      Carregando relatórios...
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-church-navy/40 font-bold">
                      Nenhum relatório salvo ainda.
                    </td>
                  </tr>
                ) : (
                  reports.map(report => (
                    <Fragment key={report.id}>
                      <tr className="hover:bg-church-cream/20 transition-colors text-sm">
                        <td className="px-6 py-4 whitespace-nowrap text-church-navy font-semibold">
                          {report.date ? new Date(report.date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="px-6 py-4 font-semibold text-church-navy">{report.className}</td>
                        <td className="px-6 py-4 text-center font-black text-green-600">{report.totalPresent}</td>
                        <td className="px-6 py-4 text-center font-black text-red-600">{report.totalAbsent || 0}</td>
                        <td className="px-6 py-4 text-right font-mono text-church-navy font-bold">R$ {report.offering?.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setExpandedReportId(expandedReportId === report.id ? null : report.id)}
                              className="p-2 text-church-navy hover:bg-church-navy/5 rounded-lg transition-all active:scale-90 cursor-pointer"
                              title="Ver Observações"
                            >
                              {expandedReportId === report.id ? (
                                <ChevronUp className="h-4.5 w-4.5 text-church-gold" />
                              ) : (
                                <ChevronDown className="h-4.5 w-4.5 text-church-gold" />
                              )}
                            </button>
                            <button
                              onClick={() => generateReportPDF(report)}
                              className="p-2 text-church-navy hover:bg-church-navy/5 rounded-lg transition-all active:scale-90 cursor-pointer"
                              title="Baixar PDF"
                            >
                              <FileDown className="h-4.5 w-4.5 text-church-gold" />
                            </button>
                            {isEBDAdmin === true && (
                              <button 
                                onClick={() => {
                                  setDeletingReport(report.id);
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90 cursor-pointer"
                                title="Excluir Relatório"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedReportId === report.id && (
                        <tr className="bg-church-cream/10">
                          <td colSpan={6} className="px-6 py-5 border-t border-church-gold/10">
                            <div className="grid md:grid-cols-2 gap-4 text-xs">
                              <div className="space-y-3">
                                <div>
                                  <span className="font-bold text-church-navy/40 uppercase tracking-widest block text-[9px] mb-1">Pontos Positivos</span>
                                  <p className="text-church-navy bg-white p-3 rounded-xl border border-church-gold/5 min-h-[40px] italic font-medium leading-relaxed">
                                    {report.positives || 'Nenhum ponto positivo registrado.'}
                                  </p>
                                </div>
                                <div>
                                  <span className="font-bold text-church-navy/40 uppercase tracking-widest block text-[9px] mb-1">Pontos Negativos</span>
                                  <p className="text-church-navy bg-white p-3 rounded-xl border border-church-gold/5 min-h-[40px] italic font-medium leading-relaxed">
                                    {report.negatives || 'Nenhum ponto negativo registrado.'}
                                  </p>
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <span className="font-bold text-church-navy/40 uppercase tracking-widest block text-[9px] mb-1">Dificuldades Encontradas</span>
                                  <p className="text-church-navy bg-white p-3 rounded-xl border border-church-gold/5 min-h-[40px] font-medium leading-relaxed">
                                    {report.difficulties || 'Nenhuma dificuldade registrada.'}
                                  </p>
                                </div>
                                <div>
                                  <span className="font-bold text-church-navy/40 uppercase tracking-widest block text-[9px] mb-1">Testemunhos e Bênçãos</span>
                                  <p className="text-church-navy bg-white p-3 rounded-xl border border-church-gold/5 min-h-[40px] font-medium leading-relaxed">
                                    {report.testimonies || 'Nenhum testemunho registrado.'}
                                  </p>
                                </div>
                                <div>
                                  <span className="font-bold text-church-navy/40 uppercase tracking-widest block text-[9px] mb-1">Necessidades da Classe</span>
                                  <p className="text-church-navy bg-white p-3 rounded-xl border border-church-gold/5 min-h-[40px] font-medium leading-relaxed">
                                    {report.needs || 'Nenhuma necessidade registrada.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile View of Reports */}
        <div className="block md:hidden space-y-4">
          {loadingReports ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-church-gold/10 text-church-navy/40 font-bold">
              Carregando relatórios...
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-church-gold/10 text-church-navy/40 font-bold">
              Nenhum relatório salvo ainda.
            </div>
          ) : (
            reports.map(report => (
              <div key={report.id} className="bg-white rounded-3xl border border-church-gold/10 p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-church-gold">
                      {report.date ? new Date(report.date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                    </span>
                    <h4 className="font-bold text-church-navy text-base mt-0.5">{report.className}</h4>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExpandedReportId(expandedReportId === report.id ? null : report.id)}
                      className="p-2 text-church-navy hover:bg-church-navy/5 rounded-xl transition-all active:scale-90 cursor-pointer"
                      title="Ver Observações"
                    >
                      {expandedReportId === report.id ? (
                        <ChevronUp className="h-4.5 w-4.5 text-church-gold" />
                      ) : (
                        <ChevronDown className="h-4.5 w-4.5 text-church-gold" />
                      )}
                    </button>
                    <button
                      onClick={() => generateReportPDF(report)}
                      className="p-2 text-church-navy hover:bg-church-navy/5 rounded-xl transition-all active:scale-90 cursor-pointer"
                      title="Baixar PDF"
                    >
                      <FileDown className="h-4.5 w-4.5 text-church-gold" />
                    </button>
                    {isEBDAdmin === true && (
                      <button 
                        onClick={() => setDeletingReport(report.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90 cursor-pointer"
                        title="Excluir Relatório"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    )}
                  </div>
                </div>

                {expandedReportId === report.id && (
                  <div className="border-t border-church-gold/5 pt-3 space-y-3 text-xs text-left">
                    <div>
                      <span className="font-bold text-church-navy/40 uppercase tracking-widest block text-[8px] mb-0.5">Pontos Positivos</span>
                      <p className="text-church-navy bg-church-cream/10 p-2.5 rounded-lg italic font-medium leading-relaxed">
                        {report.positives || 'Nenhum ponto positivo registrado.'}
                      </p>
                    </div>
                    <div>
                      <span className="font-bold text-church-navy/40 uppercase tracking-widest block text-[8px] mb-0.5">Pontos Negativos</span>
                      <p className="text-church-navy bg-church-cream/10 p-2.5 rounded-lg italic font-medium leading-relaxed">
                        {report.negatives || 'Nenhum ponto negativo registrado.'}
                      </p>
                    </div>
                    <div>
                      <span className="font-bold text-church-navy/40 uppercase tracking-widest block text-[8px] mb-0.5">Dificuldades</span>
                      <p className="text-church-navy bg-church-cream/10 p-2.5 rounded-lg font-medium leading-relaxed">
                        {report.difficulties || 'Nenhuma dificuldade registrada.'}
                      </p>
                    </div>
                    <div>
                      <span className="font-bold text-church-navy/40 uppercase tracking-widest block text-[8px] mb-0.5">Testemunhos e Bênçãos</span>
                      <p className="text-church-navy bg-church-cream/10 p-2.5 rounded-lg font-medium leading-relaxed">
                        {report.testimonies || 'Nenhum testemunho registrado.'}
                      </p>
                    </div>
                    <div>
                      <span className="font-bold text-church-navy/40 uppercase tracking-widest block text-[8px] mb-0.5">Necessidades</span>
                      <p className="text-church-navy bg-church-cream/10 p-2.5 rounded-lg font-medium leading-relaxed">
                        {report.needs || 'Nenhuma necessidade registrada.'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 border-t border-church-gold/5 pt-3 text-center">
                  <div className="bg-green-50/50 rounded-xl p-2">
                    <span className="text-[9px] uppercase font-black tracking-wider text-green-700">Presentes</span>
                    <p className="font-black text-green-600 text-base mt-0.5">{report.totalPresent}</p>
                  </div>
                  <div className="bg-red-50/50 rounded-xl p-2">
                    <span className="text-[9px] uppercase font-black tracking-wider text-red-700">Ausentes</span>
                    <p className="font-black text-red-600 text-base mt-0.5">{report.totalAbsent || 0}</p>
                  </div>
                  <div className="bg-church-cream/40 rounded-xl p-2">
                    <span className="text-[9px] uppercase font-black tracking-wider text-church-navy/60">Oferta</span>
                    <p className="font-bold text-church-navy text-xs mt-1 font-mono">R$ {report.offering?.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={deletingReport !== null}
        onClose={() => setDeletingReport(null)}
        onConfirm={confirmDeleteReport}
        title="Excluir Relatório"
        message="Tem certeza que deseja excluir permanentemente este relatório de frequência dominical? Esta ação não pode ser desfeita."
      />
    </div>
  );
}

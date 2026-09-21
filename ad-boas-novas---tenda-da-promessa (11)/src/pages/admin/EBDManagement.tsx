import { useState, useMemo } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BookOpen, Users, Calendar, FileText } from 'lucide-react';
import EBDClassList from '../../components/ebd/EBDClassList';
import EBDStudentList from '../../components/ebd/EBDStudentList';
import EBDAttendanceReport from '../../components/ebd/EBDAttendanceReport';
import EBDMaterials from '../../components/ebd/EBDMaterials';

export default function EBDManagement({ role }: { role: string | null }) {
  const [activeTab, setActiveTab] = useState<'classes' | 'attendance' | 'materials'>('classes');
  const [selectedClass, setSelectedClass] = useState<{ id: string, name: string } | null>(null);

  const isEBDAdmin = useMemo(() => {
    return !!(
      role &&
      [
        'admin', 'pastor', 'pastora', 'leader', 'líder', 'lider',
        'obreiro', 'presbítero', 'missionário', 'missionária',
        'diácono', 'evangelista', 'diaconisa', 'mídia social'
      ].includes(
        role.toLowerCase()
      )
    );
  }, [role]);

  const [classesSnapshot, loading] = useCollection(
    query(collection(db, 'ebd_classes'))
  );

  const classes = useMemo(() => {
    return (
      classesSnapshot?.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => a.name.localeCompare(b.name)) || []
    );
  }, [classesSnapshot]);

  return (
    <div className="space-y-8 p-4 lg:p-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
        <div>
          <h1 className="font-serif text-3xl font-black text-church-navy leading-tight">
            Escola Bíblica Dominical
          </h1>
          <p className="text-church-navy/60">Controle de Classes, Alunos, Presença, Ofertas e Materiais de Estudo</p>
        </div>
      </header>

      {/* Navegação de Abas */}
      <div className="flex flex-wrap gap-2 border-b border-church-gold/10 pb-4 px-2">
        <button
          onClick={() => {
            setActiveTab('classes');
            setSelectedClass(null);
          }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all rounded-xl cursor-pointer ${
            activeTab === 'classes'
              ? 'bg-church-navy text-white shadow-md shadow-church-navy/10 scale-102'
              : 'text-church-navy/60 hover:bg-church-navy/5'
          }`}
        >
          <Users className="h-4 w-4 text-church-gold" />
          Classes e Alunos
        </button>
        <button
          onClick={() => {
            setActiveTab('attendance');
            setSelectedClass(null);
          }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all rounded-xl cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-church-navy text-white shadow-md shadow-church-navy/10 scale-102'
              : 'text-church-navy/60 hover:bg-church-navy/5'
          }`}
        >
          <Calendar className="h-4 w-4 text-church-gold" />
          Relatório Dominical
        </button>
        <button
          onClick={() => {
            setActiveTab('materials');
            setSelectedClass(null);
          }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all rounded-xl cursor-pointer ${
            activeTab === 'materials'
              ? 'bg-church-navy text-white shadow-md shadow-church-navy/10 scale-102'
              : 'text-church-navy/60 hover:bg-church-navy/5'
          }`}
        >
          <FileText className="h-4 w-4 text-church-gold" />
          Materiais de Estudo
        </button>
      </div>

      {/* Conteúdo Ativo */}
      <div className="px-2">
        {activeTab === 'classes' && (
          !selectedClass ? (
            <EBDClassList
              classes={classes}
              loading={loading}
              isEBDAdmin={isEBDAdmin}
              onSelectClass={(id, name) => setSelectedClass({ id, name })}
            />
          ) : (
            <EBDStudentList
              classId={selectedClass.id}
              className={selectedClass.name}
              onBack={() => setSelectedClass(null)}
              isEBDAdmin={isEBDAdmin}
            />
          )
        )}

        {activeTab === 'attendance' && (
          <EBDAttendanceReport classes={classes} isEBDAdmin={isEBDAdmin} />
        )}

        {activeTab === 'materials' && (
          <EBDMaterials isEBDAdmin={isEBDAdmin} />
        )}
      </div>
    </div>
  );
}

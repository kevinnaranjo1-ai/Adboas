import React, { useState, useEffect, useMemo } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, 
  serverTimestamp, addDoc, deleteDoc, getDoc, limit 
} from 'firebase/firestore';
import { 
  Brain, Trophy, Award, Flame, Sparkles, CheckCircle2, XCircle, 
  BookOpen, HelpCircle, Plus, Trash2, Edit3, RotateCcw, 
  Check, Medal, ArrowRight, Eye, Clock, Share2, Layers, 
  ChevronRight, Star, RefreshCw, BookmarkCheck, Play, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  verseRef?: string;
}

interface MemoryVerse {
  reference: string;
  text: string;
}

interface Quiz {
  id: string;
  title: string;
  theme: string;
  weekLabel: string;
  sermonDate?: string;
  memoryVerse?: MemoryVerse;
  questions: Question[];
  pointsPerQuestion: number;
  isActive: boolean;
  createdById: string;
  createdByName: string;
  createdAt?: any;
}

interface QuizResponse {
  id: string;
  quizId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  userRole?: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeTakenSeconds: number;
  answers: number[];
  completedAt?: any;
}

interface LeaderboardEntry {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  userRole?: string;
  totalScore: number;
  quizzesCompleted: number;
  totalCorrect: number;
  currentStreak: number;
  lastQuizCompletedAt?: any;
  memorizedVersesCount?: number;
}

interface BibleQuizPageProps {
  role: string | null;
}

// Preset Quiz Templates for Leadership Quick Creation
const PRESET_QUIZZES = [
  {
    id: "preset_1",
    title: "Sermão de Domingo: A Fé que Vence o Medo",
    theme: "Sermão & Mensagem Pastoral",
    weekLabel: "Semana Atual",
    memoryVerse: {
      reference: "Isaías 41:10",
      text: "Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus; eu te fortaleço, e te ajudo, e te sustento com a destra da minha justiça."
    },
    questions: [
      {
        id: "q1",
        question: "Segundo Hebreus 11:1, qual é a definição bíblica de Fé?",
        options: [
          "Apenas um sentimento passageiro no coração",
          "O firme fundamento das coisas que se esperam e a prova das coisas que não se vêem",
          "A certeza de que nunca passaremos por lutas",
          "A repetição contínua de orações prontas"
        ],
        correctAnswer: 1,
        explanation: "Hebreus 11:1 nos ensina que a fé é a substância da nossa esperança e a convicção do invisível.",
        verseRef: "Hebreus 11:1"
      },
      {
        id: "q2",
        question: "Qual discípulo pediu para andar sobre as águas ao ver Jesus?",
        options: ["João", "Tiago", "Pedro", "Tomé"],
        correctAnswer: 2,
        explanation: "Pedro pediu para ir até Jesus sobre as águas e andou enquanto manteve os olhos fixos em Cristo (Mateus 14:28-29).",
        verseRef: "Mateus 14:28-29"
      },
      {
        id: "q3",
        question: "De acordo com Romanos 10:17, como vem a fé?",
        options: [
          "Pelo ouvir a Palavra de Deus",
          "Pelo tempo de conversão",
          "Pela frequência no templo",
          "Pelas obras de caridade"
        ],
        correctAnswer: 0,
        explanation: "A fé é alimentada e gerada em nosso coração quando ouvimos a Palavra de Deus proclamada.",
        verseRef: "Romanos 10:17"
      },
      {
        id: "q4",
        question: "Qual rei da Bíblia orou no templo e teve sua vida acrescentada em 15 anos por causa de sua oração sincera?",
        options: ["Davi", "Ezequias", "Salomão", "Josias"],
        correctAnswer: 1,
        explanation: "O rei Ezequias orou fervorosamente e o Senhor acrescentou 15 anos à sua vida (2 Reis 20:5-6).",
        verseRef: "2 Reis 20:5-6"
      }
    ]
  },
  {
    id: "preset_2",
    title: "O Fruto do Espírito & Vida Cristã",
    theme: "Doutrina & Caminhada Cristã",
    weekLabel: "Estudo da Palavra",
    memoryVerse: {
      reference: "Gálatas 5:22-23",
      text: "Mas o fruto do Espírito é: amor, gozo, paz, longanimidade, benignidade, bondade, fé, mansidão, temperança."
    },
    questions: [
      {
        id: "q1",
        question: "Em Gálatas 5:22, quantos frutos do Espírito Santo são explicitamente listados?",
        options: ["7 virtudes", "9 virtudes no fruto", "12 virtudes", "5 virtudes"],
        correctAnswer: 1,
        explanation: "É um único Fruto com 9 manifestações espirituais (Amor, alegria, paz, paciência, amabilidade, bondade, fidelidade, mansidão e domínio próprio).",
        verseRef: "Gálatas 5:22-23"
      },
      {
        id: "q2",
        question: "Qual é o maior mandamento ensinado por Jesus em Mateus 22:37?",
        options: [
          "Amarás o teu próximo como a ti mesmo",
          "Amarás o Senhor teu Deus de todo o teu coração, de toda a tua alma e de todo o teu entendimento",
          "Guardar todos os sábados",
          "Dar o dízimo de tudo"
        ],
        correctAnswer: 1,
        explanation: "Jesus declarou que este é o primeiro e grande mandamento.",
        verseRef: "Mateus 22:37"
      },
      {
        id: "q3",
        question: "Quem foi o apóstolo conhecido como o 'Apóstolo do Amor' que escreveu três cartas e o Apocalipse?",
        options: ["Paulo", "Pedro", "João", "Barnabé"],
        correctAnswer: 2,
        explanation: "João enfatizou profundamente o amor de Deus em seu Evangelho, Epístolas e Apocalipse.",
        verseRef: "1 João 4:7-8"
      }
    ]
  },
  {
    id: "preset_3",
    title: "Parábolas de Jesus & Ensinamentos",
    theme: "Evangelhos",
    weekLabel: "Mestres da Bíblia",
    memoryVerse: {
      reference: "Salmos 119:105",
      text: "Lâmpada para os meus pés é tua palavra, e luz para o meu caminho."
    },
    questions: [
      {
        id: "q1",
        question: "Na Parábola do Semeador, o que representa a semente lançada?",
        options: [
          "As riquezas deste mundo",
          "A Palavra de Deus",
          "As boas obras dos fiéis",
          "Os templos da igreja"
        ],
        correctAnswer: 1,
        explanation: "Em Lucas 8:11, Jesus diz expressamente: 'A semente é a palavra de Deus'.",
        verseRef: "Lucas 8:11"
      },
      {
        id: "q2",
        question: "Na parábola do Filho Pródigo, como o pai recebeu seu filho que retornou arrependido?",
        options: [
          "Com raiva e punição de trabalhos forçados",
          "Exigindo que pagasse tudo o que gastou",
          "Com compaixão, abraços, vestes novas e uma grande festa",
          "Pedindo que ficasse na senzala por 30 dias"
        ],
        correctAnswer: 2,
        explanation: "O pai correu ao encontro do filho, demonstrou compaixão e celebrou seu retorno com júbilo (Lucas 15:20-24).",
        verseRef: "Lucas 15:20-24"
      },
      {
        id: "q3",
        question: "Qual das sementes Jesus comparou com o Reino dos Céus por ser pequena mas crescer até virar árvore?",
        options: ["Semente de trigo", "Semente de mostarda", "Semente de gergelim", "Semente de cevada"],
        correctAnswer: 1,
        explanation: "Jesus usou o grão de mostarda para ilustrar o crescimento extraordinário do Reino dos Céus (Mateus 13:31-32).",
        verseRef: "Mateus 13:31-32"
      }
    ]
  }
];

export default function BibleQuizPage({ role }: BibleQuizPageProps) {
  const [user] = useAuthState(auth);
  
  // Leadership privileges check
  const isLeaderOrAdmin = useMemo(() => {
    if (!role) return false;
    const r = role.toLowerCase();
    return ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'secretária', 'tesoureira', 'mídia social'].includes(r) ||
      user?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com';
  }, [role, user]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'quiz' | 'memorize' | 'ranking' | 'archive'>('quiz');

  // Firestore Collections State
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [userResponses, setUserResponses] = useState<Record<string, QuizResponse>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);

  // Active Quiz State (Taking Quiz)
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [quizTimer, setQuizTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [userScoreResult, setUserScoreResult] = useState<{ score: number; total: number; correct: number } | null>(null);

  // Verse Memorization Practice State
  const [memorizationMaskLevel, setMemorizationMaskLevel] = useState<0 | 25 | 50 | 100>(0);
  const [isVerseRevealed, setIsVerseRevealed] = useState(true);
  const [memorizedThisWeek, setMemorizedThisWeek] = useState(false);
  const [scrambledWords, setScrambledWords] = useState<string[]>([]);
  const [userArrangedWords, setUserArrangedWords] = useState<string[]>([]);
  const [memorizeTabMode, setMemorizeTabMode] = useState<'read' | 'fill' | 'scramble'>('read');

  // Creator Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizTheme, setNewQuizTheme] = useState('');
  const [newQuizWeek, setNewQuizWeek] = useState('Semana Atual');
  const [newMemoryRef, setNewMemoryRef] = useState('');
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newQuestions, setNewQuestions] = useState<Question[]>([
    {
      id: '1',
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: '',
      verseRef: ''
    }
  ]);
  const [savingQuiz, setSavingQuiz] = useState(false);

  // Fetch Quizzes from Firestore
  useEffect(() => {
    const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: Quiz[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quiz[];

      setQuizzes(docs);
      setLoadingQuizzes(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'quizzes');
      setLoadingQuizzes(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch User Responses from Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'quiz_responses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const respMap: Record<string, QuizResponse> = {};
      snapshot.docs.forEach(d => {
        const data = d.data() as QuizResponse;
        if (data.userId === user.uid) {
          respMap[data.quizId] = { id: d.id, ...data };
        }
      });
      setUserResponses(respMap);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'quiz_responses');
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch Leaderboard from Firestore
  useEffect(() => {
    const q = query(collection(db, 'quiz_leaderboard'), orderBy('totalScore', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries: LeaderboardEntry[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as LeaderboardEntry[];
      setLeaderboard(entries);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'quiz_leaderboard');
    });

    return () => unsubscribe();
  }, []);

  // Determine Current Featured Quiz
  const currentFeaturedQuiz = useMemo(() => {
    if (quizzes.length === 0) return null;
    const active = quizzes.find(q => q.isActive);
    return active || quizzes[0];
  }, [quizzes]);

  // Timer Effect when taking quiz
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && !isQuizCompleted) {
      interval = setInterval(() => {
        setQuizTimer(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, isQuizCompleted]);

  // Start Taking A Quiz
  const handleStartQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setCurrentQuestionIndex(0);
    setSelectedAnswers(new Array(quiz.questions.length).fill(-1));
    setIsAnswerSubmitted(false);
    setQuizTimer(0);
    setIsTimerRunning(true);
    setIsQuizCompleted(false);
    setUserScoreResult(null);
  };

  // Select Option for Question
  const handleSelectOption = (optionIndex: number) => {
    if (isAnswerSubmitted) return;
    const updated = [...selectedAnswers];
    updated[currentQuestionIndex] = optionIndex;
    setSelectedAnswers(updated);
  };

  // Submit Answer for current question
  const handleSubmitQuestionAnswer = () => {
    if (selectedAnswers[currentQuestionIndex] === -1) return;
    setIsAnswerSubmitted(true);
  };

  // Advance to Next Question or Complete Quiz
  const handleNextQuestion = async () => {
    if (!activeQuiz) return;

    if (currentQuestionIndex < activeQuiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setIsAnswerSubmitted(false);
    } else {
      // Quiz Finished! Calculate Score
      setIsTimerRunning(false);
      setIsQuizCompleted(true);

      let correctCount = 0;
      activeQuiz.questions.forEach((q, idx) => {
        if (selectedAnswers[idx] === q.correctAnswer) {
          correctCount++;
        }
      });

      const pointsPerQ = activeQuiz.pointsPerQuestion || 10;
      const calculatedScore = correctCount * pointsPerQ;

      setUserScoreResult({
        score: calculatedScore,
        total: activeQuiz.questions.length,
        correct: correctCount
      });

      // Save to Firestore
      if (user) {
        try {
          const quizId = activeQuiz.id || `quiz_${Date.now()}`;
          const respId = `${quizId}_${user.uid}`;
          const responseData = {
            quizId: quizId,
            userId: user.uid,
            userName: user.displayName || user.email?.split('@')[0] || 'Membro',
            userPhoto: user.photoURL || '',
            userRole: role || 'membro',
            score: calculatedScore,
            totalQuestions: activeQuiz.questions.length,
            correctAnswers: correctCount,
            timeTakenSeconds: quizTimer,
            answers: selectedAnswers,
            completedAt: serverTimestamp()
          };

          await setDoc(doc(db, 'quiz_responses', respId), responseData, { merge: true });

          // Update Leaderboard
          const leaderboardRef = doc(db, 'quiz_leaderboard', user.uid);
          const lbDoc = await getDoc(leaderboardRef);

          if (lbDoc.exists()) {
            const existingLb = lbDoc.data() as LeaderboardEntry;
            await updateDoc(leaderboardRef, {
              userName: user.displayName || user.email?.split('@')[0] || 'Membro',
              userPhoto: user.photoURL || '',
              userRole: role || 'membro',
              totalScore: (existingLb.totalScore || 0) + calculatedScore,
              quizzesCompleted: (existingLb.quizzesCompleted || 0) + 1,
              totalCorrect: (existingLb.totalCorrect || 0) + correctCount,
              currentStreak: (existingLb.currentStreak || 0) + 1,
              lastQuizCompletedAt: serverTimestamp()
            });
          } else {
            await setDoc(leaderboardRef, {
              userId: user.uid,
              userName: user.displayName || user.email?.split('@')[0] || 'Membro',
              userPhoto: user.photoURL || '',
              userRole: role || 'membro',
              totalScore: calculatedScore,
              quizzesCompleted: 1,
              totalCorrect: correctCount,
              currentStreak: 1,
              lastQuizCompletedAt: serverTimestamp()
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'quiz_responses/leaderboard');
        }
      }
    }
  };

  // Preset Template Loader for Modal
  const handleLoadPreset = (preset: typeof PRESET_QUIZZES[0]) => {
    setNewQuizTitle(preset.title);
    setNewQuizTheme(preset.theme);
    setNewQuizWeek(preset.weekLabel);
    setNewMemoryRef(preset.memoryVerse.reference);
    setNewMemoryText(preset.memoryVerse.text);
    setNewQuestions(preset.questions);
  };

  // Add empty question in creator modal
  const handleAddQuestionField = () => {
    setNewQuestions(prev => [
      ...prev,
      {
        id: String(Date.now()),
        question: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        explanation: '',
        verseRef: ''
      }
    ]);
  };

  // Save new Quiz to Firestore
  const handleSaveQuiz = async () => {
    if (!newQuizTitle.trim() || newQuestions.length === 0) return;
    setSavingQuiz(true);

    try {
      const quizPayload = {
        title: newQuizTitle.trim(),
        theme: newQuizTheme.trim() || 'Geral',
        weekLabel: newQuizWeek.trim() || 'Semana Atual',
        sermonDate: new Date().toISOString(),
        memoryVerse: {
          reference: newMemoryRef.trim() || 'Salmos 119:105',
          text: newMemoryText.trim() || 'Lâmpada para os meus pés é tua palavra e luz para o meu caminho.'
        },
        questions: newQuestions,
        pointsPerQuestion: 10,
        isActive: true,
        createdById: user?.uid || 'system',
        createdByName: user?.displayName || 'Liderança',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'quizzes'), quizPayload);

      setIsCreateModalOpen(false);
      setNewQuizTitle('');
      setNewQuizTheme('');
      setNewMemoryRef('');
      setNewMemoryText('');
      setNewQuestions([
        {
          id: '1',
          question: '',
          options: ['', '', '', ''],
          correctAnswer: 0,
          explanation: '',
          verseRef: ''
        }
      ]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'quizzes');
    } finally {
      setSavingQuiz(false);
    }
  };

  // Setup Scramble Mode for Verse Memorization
  useEffect(() => {
    const verseText = currentFeaturedQuiz?.memoryVerse?.text || PRESET_QUIZZES[0].memoryVerse.text;
    if (verseText) {
      const words = verseText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").split(/\s+/);
      const shuffled = [...words].sort(() => Math.random() - 0.5);
      setScrambledWords(shuffled);
      setUserArrangedWords([]);
    }
  }, [currentFeaturedQuiz]);

  // Handle word pick in scramble mode
  const handlePickWordScramble = (word: string, index: number) => {
    setUserArrangedWords(prev => [...prev, word]);
    setScrambledWords(prev => prev.filter((_, i) => i !== index));
  };

  // Reset Scramble Mode
  const handleResetScramble = () => {
    const verseText = currentFeaturedQuiz?.memoryVerse?.text || PRESET_QUIZZES[0].memoryVerse.text;
    if (verseText) {
      const words = verseText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").split(/\s+/);
      const shuffled = [...words].sort(() => Math.random() - 0.5);
      setScrambledWords(shuffled);
      setUserArrangedWords([]);
    }
  };

  // Handle Mark Verse as Memorized (+50 points bonus)
  const handleMarkVerseMemorized = async () => {
    if (!user || memorizedThisWeek) return;
    setMemorizedThisWeek(true);

    try {
      const lbRef = doc(db, 'quiz_leaderboard', user.uid);
      const lbDoc = await getDoc(lbRef);

      if (lbDoc.exists()) {
        const currentData = lbDoc.data() as LeaderboardEntry;
        await updateDoc(lbRef, {
          totalScore: (currentData.totalScore || 0) + 50,
          memorizedVersesCount: (currentData.memorizedVersesCount || 0) + 1
        });
      } else {
        await setDoc(lbRef, {
          userId: user.uid,
          userName: user.displayName || user.email?.split('@')[0] || 'Membro',
          userPhoto: user.photoURL || '',
          userRole: role || 'membro',
          totalScore: 50,
          quizzesCompleted: 0,
          totalCorrect: 0,
          currentStreak: 1,
          memorizedVersesCount: 1,
          lastQuizCompletedAt: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'quiz_leaderboard/memorize');
    }
  };

  // Helper function to render masked verse
  const renderMaskedVerse = (text: string, maskPercent: number) => {
    if (maskPercent === 0) return text;
    const words = text.split(' ');
    return words.map((w, idx) => {
      // mask deterministic based on index and percent
      const shouldMask = (idx % (100 / maskPercent)) < 1;
      if (shouldMask) {
        return <span key={idx} className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-300 mx-0.5">_____</span>;
      }
      return w + ' ';
    });
  };

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-4 px-3 sm:px-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-church-navy via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl mb-6">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-church-gold/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -ml-32 -mb-20 h-48 w-96 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-church-gold/20 border border-church-gold/40 px-3 py-1 text-xs font-black tracking-wider text-amber-300 uppercase mb-3">
              <Brain className="h-4 w-4 text-church-gold animate-pulse" />
              Quiz Bíblico da Semana & Memorização
            </div>
            <h1 className="font-serif text-2xl sm:text-4xl font-black text-white leading-tight">
              Aprenda, Memorize & Desafie sua Fé!
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Perguntas interativas semanais sobre as pregações e a Bíblia Sagrada. Ganhe pontos, suba no ranking da congregação e guarde a Palavra no coração.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isLeaderOrAdmin && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-church-gold hover:bg-amber-400 text-church-navy font-bold px-4 py-2.5 text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Criar / Gerenciar Quiz
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-8 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <button
            onClick={() => { setActiveTab('quiz'); setActiveQuiz(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'quiz'
                ? 'bg-white text-church-navy shadow-md'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <Sparkles className="h-4 w-4 text-church-gold" />
            Quiz da Semana
          </button>

          <button
            onClick={() => setActiveTab('memorize')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'memorize'
                ? 'bg-white text-church-navy shadow-md'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <BookOpen className="h-4 w-4 text-indigo-400" />
            Versículo da Semana
          </button>

          <button
            onClick={() => setActiveTab('ranking')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'ranking'
                ? 'bg-white text-church-navy shadow-md'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            Ranking da Igreja
          </button>

          <button
            onClick={() => setActiveTab('archive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'archive'
                ? 'bg-white text-church-navy shadow-md'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <Layers className="h-4 w-4 text-blue-400" />
            Quizzes Anteriores
          </button>
        </div>
      </div>

      {/* Main Content Areas */}
      {/* TAB 1: QUIZ DA SEMANA */}
      {activeTab === 'quiz' && (
        <div>
          {!activeQuiz ? (
            /* Quiz Selection / Highlight Card */
            <div>
              {currentFeaturedQuiz ? (
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 mb-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full w-fit mb-3">
                        <Flame className="h-4 w-4 text-amber-500 fill-amber-500" />
                        {currentFeaturedQuiz.weekLabel} • {currentFeaturedQuiz.theme}
                      </div>

                      <h2 className="font-serif text-2xl sm:text-3xl font-black text-church-navy">
                        {currentFeaturedQuiz.title}
                      </h2>

                      <p className="text-xs sm:text-sm text-slate-600 mt-2 flex items-center gap-4">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <HelpCircle className="h-4 w-4 text-church-navy" />
                          {currentFeaturedQuiz.questions.length} Perguntas
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-emerald-600">
                          <Award className="h-4 w-4 text-emerald-500" />
                          Até {currentFeaturedQuiz.questions.length * (currentFeaturedQuiz.pointsPerQuestion || 10)} Pontos
                        </span>
                      </p>

                      {userResponses[currentFeaturedQuiz.id] && (
                        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-emerald-900">Você já completou este Quiz!</p>
                            <p className="text-[11px] text-emerald-700">
                              Sua pontuação: <span className="font-black">{userResponses[currentFeaturedQuiz.id].score} pontos</span> ({userResponses[currentFeaturedQuiz.id].correctAnswers} acertos de {userResponses[currentFeaturedQuiz.id].totalQuestions}).
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="w-full md:w-auto flex flex-col gap-2">
                      <button
                        onClick={() => handleStartQuiz(currentFeaturedQuiz)}
                        className="w-full md:w-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-church-navy to-indigo-900 hover:from-slate-900 hover:to-indigo-950 text-white font-bold px-8 py-4 text-sm shadow-lg shadow-indigo-950/20 active:scale-95 transition-all cursor-pointer"
                      >
                        <Play className="h-5 w-5 fill-white" />
                        {userResponses[currentFeaturedQuiz.id] ? 'Refazer Quiz para Treino' : 'Iniciar Quiz da Semana'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Fallback Default Preset if no quiz created yet */
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 mb-8 text-center">
                  <Brain className="h-12 w-12 text-church-gold mx-auto mb-3" />
                  <h3 className="font-serif text-xl font-bold text-church-navy">Quiz Demonstrativo Pronto</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
                    Ainda não há um quiz semanal customizado cadastrado pela liderança, mas você pode jogar nosso Quiz de Treino sobre a Palavra!
                  </p>
                  <button
                    onClick={() => handleStartQuiz(PRESET_QUIZZES[0] as Quiz)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-church-navy text-white font-bold px-6 py-3 text-sm shadow-md cursor-pointer hover:bg-slate-800"
                  >
                    <Play className="h-4 w-4 fill-white" />
                    Iniciar Quiz de Treino
                  </button>
                </div>
              )}

              {/* Instructions & Features Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Responda Semanalmente</h4>
                    <p className="text-xs text-slate-500 mt-1">3 a 5 perguntas rápidas formuladas a partir dos sermões de domingo e lições bíblicas.</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Acumule Pontos no Ranking</h4>
                    <p className="text-xs text-slate-500 mt-1">Sua agilidade e precisão geram pontos e mantêm sua sequência semanal ativa.</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Aprenda com Explicações</h4>
                    <p className="text-xs text-slate-500 mt-1">Cada resposta traz a explicação bíblica acompanhada do texto e versículo chave.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE QUIZ TAKER COMPONENT */
            <div className="max-w-3xl mx-auto">
              {!isQuizCompleted ? (
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-200">
                  {/* Top Bar info */}
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
                    <button
                      onClick={() => setActiveQuiz(null)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                    >
                      ← Sair do Quiz
                    </button>

                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(quizTimer)}
                      </span>

                      <span className="text-xs font-black text-church-navy bg-slate-100 px-3 py-1 rounded-full">
                        Questão {currentQuestionIndex + 1} de {activeQuiz.questions.length}
                      </span>
                    </div>
                  </div>

                  {/* Question Progress Bar */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-6">
                    <div 
                      className="bg-church-gold h-full transition-all duration-300"
                      style={{ width: `${((currentQuestionIndex + 1) / activeQuiz.questions.length) * 100}%` }}
                    />
                  </div>

                  {/* Question Title */}
                  <h3 className="font-serif text-lg sm:text-xl font-bold text-church-navy mb-6">
                    {activeQuiz.questions[currentQuestionIndex].question}
                  </h3>

                  {/* Options List */}
                  <div className="space-y-3 mb-6">
                    {activeQuiz.questions[currentQuestionIndex].options.map((optionText, optIdx) => {
                      const isSelected = selectedAnswers[currentQuestionIndex] === optIdx;
                      const isCorrect = activeQuiz.questions[currentQuestionIndex].correctAnswer === optIdx;

                      let btnStyle = "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800";
                      if (isAnswerSubmitted) {
                        if (isCorrect) {
                          btnStyle = "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold";
                        } else if (isSelected && !isCorrect) {
                          btnStyle = "border-rose-500 bg-rose-50 text-rose-900 font-bold";
                        } else {
                          btnStyle = "border-slate-200 bg-slate-50 text-slate-400 opacity-60";
                        }
                      } else if (isSelected) {
                        btnStyle = "border-church-navy bg-indigo-50/50 text-church-navy font-bold ring-2 ring-church-navy/20";
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={isAnswerSubmitted}
                          onClick={() => handleSelectOption(optIdx)}
                          className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs sm:text-sm cursor-pointer ${btnStyle}`}
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-300 font-bold text-slate-700 text-xs shadow-xs">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            {optionText}
                          </span>

                          {isAnswerSubmitted && isCorrect && (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                          )}
                          {isAnswerSubmitted && isSelected && !isCorrect && (
                            <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation Box after Answer Submission */}
                  {isAnswerSubmitted && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 mb-6 text-xs sm:text-sm"
                    >
                      <p className="font-bold flex items-center gap-2 text-amber-800">
                        <BookOpen className="h-4 w-4" />
                        Explicação Bíblica ({activeQuiz.questions[currentQuestionIndex].verseRef || 'Referência'})
                      </p>
                      <p className="mt-1 leading-relaxed text-amber-900/90">
                        {activeQuiz.questions[currentQuestionIndex].explanation}
                      </p>
                    </motion.div>
                  )}

                  {/* Bottom Action Controls */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    {!isAnswerSubmitted ? (
                      <button
                        onClick={handleSubmitQuestionAnswer}
                        disabled={selectedAnswers[currentQuestionIndex] === -1}
                        className="ml-auto flex items-center gap-2 rounded-2xl bg-church-navy hover:bg-slate-800 disabled:opacity-40 text-white font-bold px-6 py-3 text-xs sm:text-sm transition-all cursor-pointer shadow-md"
                      >
                        Confirmar Resposta
                      </button>
                    ) : (
                      <button
                        onClick={handleNextQuestion}
                        className="ml-auto flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 text-xs sm:text-sm transition-all cursor-pointer shadow-md"
                      >
                        {currentQuestionIndex < activeQuiz.questions.length - 1 ? (
                          <>Próxima Questão <ArrowRight className="h-4 w-4" /></>
                        ) : (
                          <>Finalizar Quiz <Trophy className="h-4 w-4 text-amber-300" /></>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* QUIZ RESULT CELEBRATION SUMMARY */
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-amber-600 mx-auto mb-4 shadow-inner">
                    <Trophy className="h-10 w-10 text-amber-500" />
                  </div>

                  <h2 className="font-serif text-2xl sm:text-3xl font-black text-church-navy">
                    Parabéns pelo Quiz Concluído!
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    Você guardou a Palavra e completou o desafio bíblico da semana.
                  </p>

                  <div className="grid grid-cols-3 gap-3 my-6 max-w-md mx-auto">
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Pontos</span>
                      <span className="text-xl font-black text-amber-600">+{userScoreResult?.score || 0}</span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Acertos</span>
                      <span className="text-xl font-black text-emerald-600">
                        {userScoreResult?.correct} / {userScoreResult?.total}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Tempo</span>
                      <span className="text-xl font-black text-indigo-600">{formatTime(quizTimer)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                    <button
                      onClick={() => setActiveQuiz(null)}
                      className="rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-6 py-3 text-xs sm:text-sm transition-all cursor-pointer"
                    >
                      Voltar ao Painel
                    </button>

                    <button
                      onClick={() => setActiveTab('ranking')}
                      className="rounded-2xl bg-church-navy hover:bg-slate-800 text-white font-bold px-6 py-3 text-xs sm:text-sm transition-all cursor-pointer shadow-md"
                    >
                      Ver Ranking da Igreja
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VERSÍCULO DA SEMANA / MEMORIZAÇÃO */}
      {activeTab === 'memorize' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full uppercase tracking-wider">
                  Memorização Bíblica
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-church-navy mt-2">
                  Versículo da Semana
                </h2>
              </div>

              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-2xl flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                +50 Pontos Bônus
              </span>
            </div>

            {/* Mode Selectors */}
            <div className="flex gap-2 mb-6 border bg-slate-100 p-1 rounded-2xl">
              <button
                onClick={() => setMemorizeTabMode('read')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  memorizeTabMode === 'read' ? 'bg-white text-church-navy shadow-xs' : 'text-slate-600'
                }`}
              >
                1. Leitura Nítida
              </button>
              <button
                onClick={() => setMemorizeTabMode('fill')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  memorizeTabMode === 'fill' ? 'bg-white text-church-navy shadow-xs' : 'text-slate-600'
                }`}
              >
                2. Ocultar Lacunas
              </button>
              <button
                onClick={() => setMemorizeTabMode('scramble')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  memorizeTabMode === 'scramble' ? 'bg-white text-church-navy shadow-xs' : 'text-slate-600'
                }`}
              >
                3. Desafio Ordenar
              </button>
            </div>

            {/* Verse Display Card */}
            {memorizeTabMode === 'read' && (
              <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-950 to-church-navy text-white text-center shadow-inner my-4">
                <BookOpen className="h-8 w-8 text-church-gold mx-auto mb-3" />
                <p className="font-serif text-lg sm:text-xl font-bold leading-relaxed italic text-amber-100">
                  "{currentFeaturedQuiz?.memoryVerse?.text || PRESET_QUIZZES[0].memoryVerse.text}"
                </p>
                <span className="block mt-4 text-xs font-bold uppercase tracking-widest text-church-gold">
                  — {currentFeaturedQuiz?.memoryVerse?.reference || PRESET_QUIZZES[0].memoryVerse.reference}
                </span>
              </div>
            )}

            {memorizeTabMode === 'fill' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-xs font-bold text-slate-500">Nível de Dificuldade:</span>
                  {[25, 50, 100].map((level) => (
                    <button
                      key={level}
                      onClick={() => setMemorizationMaskLevel(level as any)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        memorizationMaskLevel === level 
                          ? 'bg-church-navy text-white' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {level}% Oculto
                    </button>
                  ))}
                </div>

                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 text-center my-4 leading-loose text-base font-medium text-slate-800">
                  {renderMaskedVerse(
                    currentFeaturedQuiz?.memoryVerse?.text || PRESET_QUIZZES[0].memoryVerse.text,
                    memorizationMaskLevel
                  )}
                  <div className="mt-4 text-xs font-bold text-church-navy">
                    — {currentFeaturedQuiz?.memoryVerse?.reference || PRESET_QUIZZES[0].memoryVerse.reference}
                  </div>
                </div>
              </div>
            )}

            {memorizeTabMode === 'scramble' && (
              <div className="space-y-4">
                <p className="text-xs text-center text-slate-500">
                  Clique nas palavras na ordem correta para reconstruir o versículo:
                </p>

                {/* User Arranged Words Box */}
                <div className="min-h-24 p-4 rounded-2xl bg-slate-100 border border-slate-200 flex flex-wrap gap-2 items-center">
                  {userArrangedWords.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">As palavras selecionadas aparecerão aqui...</span>
                  ) : (
                    userArrangedWords.map((w, idx) => (
                      <span key={idx} className="bg-church-navy text-white px-3 py-1.5 rounded-xl text-xs font-bold">
                        {w}
                      </span>
                    ))
                  )}
                </div>

                {/* Scrambled Choices */}
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  {scrambledWords.map((w, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePickWordScramble(w, idx)}
                      className="bg-white border border-slate-300 hover:border-church-gold hover:bg-amber-50 text-slate-800 font-medium px-3 py-1.5 rounded-xl text-xs cursor-pointer active:scale-95 transition-all shadow-xs"
                    >
                      {w}
                    </button>
                  ))}
                </div>

                <div className="flex justify-center pt-2">
                  <button
                    onClick={handleResetScramble}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reiniciar Palavras
                  </button>
                </div>
              </div>
            )}

            {/* Action button */}
            <div className="mt-8 text-center border-t border-slate-100 pt-6">
              <button
                onClick={handleMarkVerseMemorized}
                disabled={memorizedThisWeek}
                className={`inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer ${
                  memorizedThisWeek
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                }`}
              >
                <BookmarkCheck className="h-5 w-5" />
                {memorizedThisWeek ? 'Versículo Concluído e Recompensado (+50 pts)' : 'Marcar como Memorizado nesta Semana'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RANKING DA IGREJA */}
      {activeTab === 'ranking' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
            <div className="text-center mb-8">
              <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full uppercase tracking-wider">
                Comunidade e Conhecimento
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-black text-church-navy mt-2">
                Ranking Amigável da Igreja
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
                Conquiste medalhas e pontos participando semanalmente dos testes bíblicos.
              </p>
            </div>

            {/* PODIUM OF CHAMPIONS (Top 3) */}
            {leaderboard.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8 max-w-lg mx-auto items-end">
                {/* 2nd Place */}
                {leaderboard[1] && (
                  <div className="bg-gradient-to-t from-slate-100 to-white border border-slate-200 rounded-2xl p-3 sm:p-4 text-center shadow-xs">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700 font-black text-xs mx-auto mb-2">
                      2º
                    </div>
                    <div className="h-12 w-12 rounded-full bg-slate-200 border-2 border-slate-300 mx-auto overflow-hidden flex items-center justify-center font-bold text-slate-600 text-xs">
                      {leaderboard[1].userPhoto ? (
                        <img src={leaderboard[1].userPhoto} alt="" className="h-full w-full object-cover" />
                      ) : (
                        leaderboard[1].userName?.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="block font-bold text-xs text-slate-800 truncate mt-2">
                      {leaderboard[1].userName}
                    </span>
                    <span className="block text-[10px] font-black text-amber-600">
                      {leaderboard[1].totalScore} pts
                    </span>
                  </div>
                )}

                {/* 1st Place */}
                {leaderboard[0] && (
                  <div className="bg-gradient-to-t from-amber-50 to-white border-2 border-amber-300 rounded-3xl p-4 sm:p-5 text-center shadow-md relative -top-3">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                      <Medal className="h-3 w-3 fill-slate-900" />
                      Campeão
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-slate-900 font-black text-sm mx-auto mb-2">
                      1º
                    </div>
                    <div className="h-16 w-16 rounded-full bg-amber-100 border-2 border-amber-400 mx-auto overflow-hidden flex items-center justify-center font-bold text-amber-800 text-sm shadow-xs">
                      {leaderboard[0].userPhoto ? (
                        <img src={leaderboard[0].userPhoto} alt="" className="h-full w-full object-cover" />
                      ) : (
                        leaderboard[0].userName?.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="block font-black text-sm text-church-navy truncate mt-2">
                      {leaderboard[0].userName}
                    </span>
                    <span className="block text-xs font-black text-amber-600">
                      {leaderboard[0].totalScore} pts
                    </span>
                  </div>
                )}

                {/* 3rd Place */}
                {leaderboard[2] && (
                  <div className="bg-gradient-to-t from-amber-900/5 to-white border border-amber-200 rounded-2xl p-3 sm:p-4 text-center shadow-xs">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-black text-xs mx-auto mb-2">
                      3º
                    </div>
                    <div className="h-12 w-12 rounded-full bg-amber-100 border-2 border-amber-300 mx-auto overflow-hidden flex items-center justify-center font-bold text-amber-900 text-xs">
                      {leaderboard[2].userPhoto ? (
                        <img src={leaderboard[2].userPhoto} alt="" className="h-full w-full object-cover" />
                      ) : (
                        leaderboard[2].userName?.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="block font-bold text-xs text-slate-800 truncate mt-2">
                      {leaderboard[2].userName}
                    </span>
                    <span className="block text-[10px] font-black text-amber-600">
                      {leaderboard[2].totalScore} pts
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* FULL LEADERBOARD LIST */}
            <div className="divide-y divide-slate-100">
              {leaderboard.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhuma pontuação registrada no ranking ainda. Seja o primeiro a responder!
                </div>
              ) : (
                leaderboard.map((item, index) => {
                  const isCurrentUser = item.userId === user?.uid;
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 transition-all ${
                        isCurrentUser ? 'bg-amber-50/80 border border-amber-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-black text-xs ${
                          index === 0 ? 'bg-amber-400 text-slate-900' :
                          index === 1 ? 'bg-slate-300 text-slate-800' :
                          index === 2 ? 'bg-amber-200 text-amber-900' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {index + 1}º
                        </span>

                        <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-600 text-xs">
                          {item.userPhoto ? (
                            <img src={item.userPhoto} alt="" className="h-full w-full object-cover" />
                          ) : (
                            item.userName?.slice(0, 2).toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="font-bold text-xs sm:text-sm text-slate-900 truncate flex items-center gap-2">
                            {item.userName}
                            {isCurrentUser && (
                              <span className="text-[10px] bg-church-navy text-white px-2 py-0.5 rounded-full font-bold">
                                Você
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>{item.quizzesCompleted || 0} Quizzes</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-amber-600 font-medium">
                              <Flame className="h-3 w-3 fill-amber-500 text-amber-500" />
                              {item.currentStreak || 1} semanas
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm sm:text-base font-black text-church-navy">
                          {item.totalScore}
                        </span>
                        <span className="block text-[10px] text-slate-400 uppercase font-bold">pontos</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ARCHIVE */}
      {activeTab === 'archive' && (
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-church-navy mb-4">
              Arquivo de Quizzes Bíblicos
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Pratique e teste seu conhecimento a qualquer momento jogando quizzes anteriores.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quizzes.length === 0 ? (
                PRESET_QUIZZES.map((preset, idx) => (
                  <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                        {preset.weekLabel}
                      </span>
                      <h4 className="font-bold text-slate-800 text-sm mt-1">{preset.title}</h4>
                      <p className="text-xs text-slate-500">{preset.questions.length} perguntas</p>
                    </div>

                    <button
                      onClick={() => { setActiveQuiz(preset as Quiz); setActiveTab('quiz'); }}
                      className="p-2.5 rounded-xl bg-church-navy text-white hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      <Play className="h-4 w-4 fill-white" />
                    </button>
                  </div>
                ))
              ) : (
                quizzes.map((quiz) => (
                  <div key={quiz.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                        {quiz.weekLabel}
                      </span>
                      <h4 className="font-bold text-slate-800 text-sm mt-1">{quiz.title}</h4>
                      <p className="text-xs text-slate-500">{quiz.questions.length} perguntas • {quiz.theme}</p>
                    </div>

                    <button
                      onClick={() => { setActiveQuiz(quiz); setActiveTab('quiz'); }}
                      className="p-2.5 rounded-xl bg-church-navy text-white hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      <Play className="h-4 w-4 fill-white" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATOR MODAL FOR PASTORS & LEADERS */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto my-8"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h3 className="font-serif text-xl font-bold text-church-navy">Criar Quiz Bíblico da Semana</h3>
                  <p className="text-xs text-slate-500">Cadastre perguntas sobre o sermão de domingo ou temas da Bíblia</p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Preset Quick Load Buttons */}
              <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <span className="block text-xs font-bold text-amber-900 mb-2">⚡ Modelos Sugeridos (Carregar em 1 clique):</span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_QUIZZES.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleLoadPreset(preset)}
                      className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold px-3 py-1.5 rounded-xl text-xs cursor-pointer active:scale-95 transition-all"
                    >
                      {preset.title.slice(0, 30)}...
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Título do Quiz *</label>
                  <input
                    type="text"
                    value={newQuizTitle}
                    onChange={(e) => setNewQuizTitle(e.target.value)}
                    placeholder="Ex: Sermão de Domingo - A Fé que Vence o Medo"
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-church-gold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tema / Categoria</label>
                    <input
                      type="text"
                      value={newQuizTheme}
                      onChange={(e) => setNewQuizTheme(e.target.value)}
                      placeholder="Ex: Mensagem de Domingo"
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Identificador da Semana</label>
                    <input
                      type="text"
                      value={newQuizWeek}
                      onChange={(e) => setNewQuizWeek(e.target.value)}
                      placeholder="Ex: Semana 31 • Agosto"
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                {/* Memory Verse Box */}
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-3">
                  <span className="block text-xs font-bold text-indigo-900">Versículo da Semana para Memorização:</span>
                  <input
                    type="text"
                    value={newMemoryRef}
                    onChange={(e) => setNewMemoryRef(e.target.value)}
                    placeholder="Referência (Ex: Isaías 41:10)"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white"
                  />
                  <textarea
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    placeholder="Texto bíblico completo para os membros memorizarem..."
                    rows={2}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white"
                  />
                </div>

                {/* Questions List Editor */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Perguntas ({newQuestions.length})</span>
                    <button
                      type="button"
                      onClick={handleAddQuestionField}
                      className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar Pergunta
                    </button>
                  </div>

                  {newQuestions.map((qItem, qIdx) => (
                    <div key={qIdx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">Pergunta #{qIdx + 1}</span>
                        {newQuestions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewQuestions(prev => prev.filter((_, i) => i !== qIdx))}
                            className="text-xs text-rose-600 hover:underline cursor-pointer"
                          >
                            Remover
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={qItem.question}
                        onChange={(e) => {
                          const updated = [...newQuestions];
                          updated[qIdx].question = e.target.value;
                          setNewQuestions(updated);
                        }}
                        placeholder="Digite a pergunta aqui..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        {qItem.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct_${qIdx}`}
                              checked={qItem.correctAnswer === optIdx}
                              onChange={() => {
                                const updated = [...newQuestions];
                                updated[qIdx].correctAnswer = optIdx;
                                setNewQuestions(updated);
                              }}
                              className="accent-church-navy"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const updated = [...newQuestions];
                                updated[qIdx].options[optIdx] = e.target.value;
                                setNewQuestions(updated);
                              }}
                              placeholder={`Opção ${String.fromCharCode(65 + optIdx)}`}
                              className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white"
                            />
                          </div>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={qItem.explanation}
                        onChange={(e) => {
                          const updated = [...newQuestions];
                          updated[qIdx].explanation = e.target.value;
                          setNewQuestions(updated);
                        }}
                        placeholder="Explicação bíblica para quando responderem..."
                        className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6 mt-6">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuiz}
                  disabled={savingQuiz || !newQuizTitle.trim()}
                  className="px-6 py-2.5 rounded-xl bg-church-navy hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  {savingQuiz ? 'Publicando...' : 'Publicar Quiz da Semana'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface ReadingItem {
  bookId: number;
  bookName: string;
  chapters: string;
  startChapter: number;
}

export interface DailyPlan {
  day: number;
  dateLabel?: string;
  ot: ReadingItem;
  nt: ReadingItem;
  psalmOrProv: ReadingItem;
  verseText: string;
  verseRef: string;
  verseBookId: number;
  verseChapter: number;
  devotionalTitle: string;
  devotionalCategory: string;
  pastoralReflection: string;
  prayerPoint: string;
}

// Lista de livros do Antigo Testamento em ordem com total de capítulos
const OT_BOOKS = [
  { id: 1, name: 'Gênesis', chapters: 50 },
  { id: 2, name: 'Êxodo', chapters: 40 },
  { id: 3, name: 'Levítico', chapters: 27 },
  { id: 4, name: 'Números', chapters: 36 },
  { id: 5, name: 'Deuteronômio', chapters: 34 },
  { id: 6, name: 'Josué', chapters: 24 },
  { id: 7, name: 'Juízes', chapters: 21 },
  { id: 8, name: 'Rute', chapters: 4 },
  { id: 9, name: '1 Samuel', chapters: 31 },
  { id: 10, name: '2 Samuel', chapters: 24 },
  { id: 11, name: '1 Reis', chapters: 22 },
  { id: 12, name: '2 Reis', chapters: 25 },
  { id: 13, name: '1 Crônicas', chapters: 29 },
  { id: 14, name: '2 Crônicas', chapters: 36 },
  { id: 15, name: 'Esdras', chapters: 10 },
  { id: 16, name: 'Neemias', chapters: 13 },
  { id: 17, name: 'Ester', chapters: 10 },
  { id: 18, name: 'Jó', chapters: 42 },
  { id: 19, name: 'Salmos', chapters: 150 },
  { id: 20, name: 'Provérbios', chapters: 31 },
  { id: 21, name: 'Eclesiastes', chapters: 12 },
  { id: 22, name: 'Cânticos', chapters: 8 },
  { id: 23, name: 'Isaías', chapters: 66 },
  { id: 24, name: 'Jeremias', chapters: 52 },
  { id: 25, name: 'Lamentações', chapters: 5 },
  { id: 26, name: 'Ezequiel', chapters: 48 },
  { id: 27, name: 'Daniel', chapters: 12 },
  { id: 28, name: 'Oseias', chapters: 14 },
  { id: 29, name: 'Joel', chapters: 3 },
  { id: 30, name: 'Amós', chapters: 9 },
  { id: 31, name: 'Obadias', chapters: 1 },
  { id: 32, name: 'Jonas', chapters: 4 },
  { id: 33, name: 'Miqueias', chapters: 7 },
  { id: 34, name: 'Naum', chapters: 3 },
  { id: 35, name: 'Habacuque', chapters: 3 },
  { id: 36, name: 'Sofonias', chapters: 3 },
  { id: 37, name: 'Ageu', chapters: 2 },
  { id: 38, name: 'Zacarias', chapters: 14 },
  { id: 39, name: 'Malaquias', chapters: 4 },
];

const NT_BOOKS = [
  { id: 40, name: 'Mateus', chapters: 28 },
  { id: 41, name: 'Marcos', chapters: 16 },
  { id: 42, name: 'Lucas', chapters: 24 },
  { id: 43, name: 'João', chapters: 21 },
  { id: 44, name: 'Atos', chapters: 28 },
  { id: 45, name: 'Romanos', chapters: 16 },
  { id: 46, name: '1 Coríntios', chapters: 16 },
  { id: 47, name: '2 Coríntios', chapters: 13 },
  { id: 48, name: 'Gálatas', chapters: 6 },
  { id: 49, name: 'Efésios', chapters: 6 },
  { id: 50, name: 'Filipenses', chapters: 4 },
  { id: 51, name: 'Colossenses', chapters: 4 },
  { id: 52, name: '1 Tessalonicenses', chapters: 5 },
  { id: 53, name: '2 Tessalonicenses', chapters: 3 },
  { id: 54, name: '1 Timóteo', chapters: 6 },
  { id: 55, name: '2 Timóteo', chapters: 4 },
  { id: 56, name: 'Tito', chapters: 3 },
  { id: 57, name: 'Filemom', chapters: 1 },
  { id: 58, name: 'Hebreus', chapters: 13 },
  { id: 59, name: 'Tiago', chapters: 5 },
  { id: 60, name: '1 Pedro', chapters: 5 },
  { id: 61, name: '2 Pedro', chapters: 3 },
  { id: 62, name: '1 João', chapters: 5 },
  { id: 63, name: '2 João', chapters: 1 },
  { id: 64, name: '3 João', chapters: 1 },
  { id: 65, name: 'Judas', chapters: 1 },
  { id: 66, name: 'Apocalipse', chapters: 22 },
];

// Temas de devocionais pastoral para cada dia do ano
const DEVOTIONAL_THEMES = [
  {
    title: 'Firmados na Rocha',
    category: 'Fé & Firmeza',
    verseText: 'Todo aquele, pois, que ouve estas minhas palavras e as pratica será comparado a um homem prudente, que edificou a sua casa sobre a rocha.',
    verseRef: 'Mateus 7:24',
    verseBookId: 40,
    verseChapter: 7,
    pastoralReflection: 'Construir a vida sobre os ensinamentos de Cristo garante estabilidade diante das tempestades e incertezas da vida. Praticar a Palavra de Deus diariamente transforma o nosso caráter e blinda nosso lar contra os ataques do inimigo.',
    prayerPoint: 'Senhor Jesus, ajuda-me a não apenas ouvir, mas praticar a tua Palavra hoje. Edifica minha família sobre a tua rocha inabalável.'
  },
  {
    title: 'A Paz que Excede Todo Entendimento',
    category: 'Paz & Confiança',
    verseText: 'E a paz de Deus, que excede todo o entendimento, guardará os seus corações e as suas mentes em Cristo Jesus.',
    verseRef: 'Filipenses 4:7',
    verseBookId: 50,
    verseChapter: 4,
    pastoralReflection: 'Mesmo no meio das aflições ou incertezas, a paz de Cristo guarda nosso coração. Quando entregamos nossas ansiedades em oração e súplica com ações de graças, a graça divina tranquiliza nossa mente.',
    prayerPoint: 'Pai celeste, entrego em tuas mãos todas as minhas preocupações. Enche minha alma com a tua paz sobre-humana e restaura minhas forças.'
  },
  {
    title: 'Graça em Tempo Oportuno',
    category: 'Graça Divina',
    verseText: 'Acheguemo-nos, portanto, confiadamente, junto ao trono da graça, a fim de recebermos misericórdia e acharmos graça para socorro em ocasião oportuna.',
    verseRef: 'Hebreus 4:16',
    verseBookId: 58,
    verseChapter: 4,
    pastoralReflection: 'O véu foi rasgado por Jesus! Não precisamos ter medo nem nos distanciar de Deus quando falhamos. Podemos se aproximar do Pai com ousadia para receber amor, perdão e renovação diária.',
    prayerPoint: 'Obrigado Jesus pelo teu sacrifício perfeito. Corro para os teus braços hoje em busca do teu perdão e da tua direção santificadora.'
  },
  {
    title: 'O Poder da Oração Persistente',
    category: 'Oração & Vida Espiritual',
    verseText: 'Orai sem cessar. Em tudo dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco.',
    verseRef: '1 Tessalonicenses 5:17-18',
    verseBookId: 52,
    verseChapter: 5,
    pastoralReflection: 'A oração contínua é o respirar da alma cristã. Quando mantemos uma conversa viva com Deus ao longo do nosso dia, nossa fé se fortalece e vemos os milagres acontecerem nos bastidores.',
    prayerPoint: 'Senhor, ensina-me a viver em permanente comunhão contigo. Que minha vida seja um altar de adoração e contínua oração.'
  },
  {
    title: 'Novas São as Suas Misericórdias',
    category: 'Esperança & Restauração',
    verseText: 'As misericórdias do Senhor são a causa de não sermos consumidos; porque as suas misericórdias não têm fim. Novas são cada manhã; grande é a tua fidelidade.',
    verseRef: 'Lamentações 3:22-23',
    verseBookId: 25,
    verseChapter: 3,
    pastoralReflection: 'Cada novo amanhecer é um presente e um atestado da misericórdia de Deus para conosco. Seja qual for o erro de ontem, hoje Deus oferece uma folha em branco cheia de graça e novas oportunidades.',
    prayerPoint: 'Deus de amor, obrigado por renovar tuas misericórdias na minha vida nesta manhã. Caminho hoje debaixo da tua fidelidade e compaixão.'
  },
  {
    title: 'Luz para o Nosso Caminho',
    category: 'Palavra de Deus',
    verseText: 'Lâmpada para os meus pés é tua palavra, e luz para o meu caminho.',
    verseRef: 'Salmos 119:105',
    verseBookId: 19,
    verseChapter: 119,
    pastoralReflection: 'A Bíblia Sagrada não é apenas um livro histórico, mas um guia vivo e poderoso para nossas decisões diárias. Ao meditarmos nela, o Espírito Santo clareia os passos que devemos dar no trabalho, na família e no ministério.',
    prayerPoint: 'Espírito Santo, ilumina meu entendimento ao ler as Sagradas Escrituras hoje. Dá-me sabedoria para escolher o caminho certo.'
  },
  {
    title: 'O Amparo Incondicional de Deus',
    category: 'Proteção & Refúgio',
    verseText: 'O Senhor é o meu pastor; nada me faltará. Ele me faz repousar em verdes pastos; guia-me mansamente a águas tranquilas.',
    verseRef: 'Salmos 23:1-2',
    verseBookId: 19,
    verseChapter: 23,
    pastoralReflection: 'Como Bom Pastor, Jesus cuida de cada detalhe da nossa vida com carinho e proteção. Ele sabe quando precisamos descansar e nos conduz com paciência por caminhos seguros.',
    prayerPoint: 'Jesus, meu Bom Pastor, confio na tua provisão e no teu cuidado diário. Descanso em ti sabendo que nada de essencial me faltará.'
  }
];

// Função que calcula a leitura do dia no plano de 1 ano (1 a 365)
export function getDailyPlanForDay(dayNumber: number): DailyPlan {
  // Garante que esteja no intervalo de 1 a 365
  const d = Math.max(1, Math.min(365, dayNumber));

  // Cálculo para Antigo Testamento (~3 capítulos por dia para cobrir ~929 capítulos)
  const otIndex = Math.floor(((d - 1) * 2.5) % 39);
  const otBook = OT_BOOKS[otIndex];
  const otStartChapter = Math.min(otBook.chapters, Math.floor(((d * 3) % otBook.chapters) + 1));
  const otEndChapter = Math.min(otBook.chapters, otStartChapter + 1);
  const otChapterStr = otStartChapter === otEndChapter ? `Cap. ${otStartChapter}` : `Cap. ${otStartChapter} - ${otEndChapter}`;

  // Cálculo para Novo Testamento (~1 capítulo por dia para cobrir ~260 capítulos)
  const ntIndex = Math.floor((d - 1) % 27);
  const ntBook = NT_BOOKS[ntIndex];
  const ntStartChapter = Math.min(ntBook.chapters, Math.floor(((d * 1.5) % ntBook.chapters) + 1));
  const ntChapterStr = `Cap. ${ntStartChapter}`;

  // Cálculo para Salmos / Provérbios
  const isProv = d % 30 === 0;
  const psalmChapter = (d % 150) || 150;
  const provChapter = (d % 31) || 31;
  const psalmOrProvItem: ReadingItem = isProv ? {
    bookId: 20,
    bookName: 'Provérbios',
    chapters: `Cap. ${provChapter}`,
    startChapter: provChapter
  } : {
    bookId: 19,
    bookName: 'Salmos',
    chapters: `Cap. ${psalmChapter}`,
    startChapter: psalmChapter
  };

  // Devocional temático
  const theme = DEVOTIONAL_THEMES[(d - 1) % DEVOTIONAL_THEMES.length];

  return {
    day: d,
    ot: {
      bookId: otBook.id,
      bookName: otBook.name,
      chapters: otChapterStr,
      startChapter: otStartChapter
    },
    nt: {
      bookId: ntBook.id,
      bookName: ntBook.name,
      chapters: ntChapterStr,
      startChapter: ntStartChapter
    },
    psalmOrProv: psalmOrProvItem,
    verseText: theme.verseText,
    verseRef: theme.verseRef,
    verseBookId: theme.verseBookId,
    verseChapter: theme.verseChapter,
    devotionalTitle: theme.title,
    devotionalCategory: theme.category,
    pastoralReflection: theme.pastoralReflection,
    prayerPoint: theme.prayerPoint
  };
}

// Retorna o dia do ano atual (1 a 365)
export function getCurrentDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = (now.getTime() - start.getTime()) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  return Math.max(1, Math.min(365, day));
}

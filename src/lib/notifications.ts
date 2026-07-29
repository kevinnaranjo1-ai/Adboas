import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { db } from './firebase';
import { collection, addDoc, setDoc, doc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Chave VAPID pública para o Firebase (se configurada)
const VAPID_KEY = (import.meta as any).env?.VITE_VAPID_KEY;

// Função para obter a instância do Messaging (apenas se suportado no navegador)
export async function getMessagingInstance() {
  try {
    const supported = await isSupported();
    if (supported) {
      const app = initializeApp(firebaseConfig);
      return getMessaging(app);
    }
  } catch (error) {
    console.warn('FCM não é suportado neste navegador:', error);
  }
  return null;
}

/**
 * Solicita permissão para receber notificações push
 */
export async function requestNotificationPermission(userId: string) {
  if (!('Notification' in window)) {
    console.warn('Este dispositivo não suporta notificações de navegador.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Tenta registrar FCM apenas se uma chave VAPID real foi fornecida no ambiente
      if (VAPID_KEY && VAPID_KEY.length > 20 && VAPID_KEY !== 'BF9N5O-7_gInQv77vHk0o6y18h07gXQkI2F6lG2-H_tH3k3e3_k5Mh_S_vE') {
        const messaging = await getMessagingInstance();
        if (messaging) {
          try {
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (token) {
              await setDoc(doc(db, 'fcm_tokens', token), {
                userId,
                token,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              console.log('Token FCM registrado com sucesso:', token);
              return token;
            }
          } catch (fcmErr) {
            console.log('FCM Push não configurado externamente, operando em modo de notificações locais HTML5.');
          }
        }
      } else {
        console.log('Notificações push nativas do navegador (Web Push Local) ativadas!');
      }
    } else {
      console.warn('Permissão de notificações recusada pelo usuário.');
    }
  } catch (error) {
    console.log('Notificações configuradas em modo nativo local.');
  }
  return null;
}

/**
 * Cria uma notificação no Firestore para alertar líderes e pastores
 */
export async function createReportNotification(
  senderId: string, 
  senderName: string, 
  reportId: string, 
  departmentName: string, 
  reportType: string
) {
  try {
    const title = 'Novo Relatório Mensal';
    const body = `${senderName} enviou o relatório de ${reportType === 'pastoral' ? 'Pastoral' : departmentName}.`;
    
    // Alvo: pastores e administradores
    const targetRoles = ['admin', 'pastor', 'pastora'];
    if (reportType === 'department') {
      // Se for relatório de departamento, o pastor e outros líderes também podem ser incluídos
      targetRoles.push('leader');
    }

    const notificationPayload = {
      title,
      body,
      type: 'new_report',
      senderId,
      senderName,
      reportId,
      roles: targetRoles,
      readBy: [],
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationPayload);
    console.log('Notificação criada com sucesso no banco de dados:', docRef.id);

    // Se o navegador suportar Push nativo do FCM e houver tokens, envia via requisição HTTP
    // (Opcional: Simulamos recepção local no cliente se estiver aberto)
    await sendSystemNotification(title, body, '/admin');

    return docRef.id;
  } catch (error) {
    console.error('Falha ao registrar notificação:', error);
    return null;
  }
}

/**
 * Cria uma notificação no Firestore para alertar administradores e pastores que um novo membro se cadastrou
 */
export async function createNewMemberNotification(
  newMemberName: string,
  newMemberEmail: string,
  method: 'self' | 'admin' = 'self'
) {
  try {
    const title = 'Novo Cadastro de Membro';
    const body = method === 'self'
      ? `${newMemberName} (${newMemberEmail}) se cadastrou no aplicativo.`
      : `Novo membro ${newMemberName} foi cadastrado pelo painel administrativo.`;
    
    // Alvo: pastores e administradores
    const targetRoles = ['admin', 'pastor', 'pastora'];

    const notificationPayload = {
      title,
      body,
      type: 'new_registration',
      roles: targetRoles,
      readBy: [],
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationPayload);
    console.log('Notificação de cadastro criada com sucesso no banco de dados:', docRef.id);

    await sendSystemNotification(title, body, '/admin');

    return docRef.id;
  } catch (error) {
    console.error('Falha ao registrar notificação de cadastro:', error);
    return null;
  }
}

/**
 * Cria uma notificação no Firestore para alertar sobre um novo pedido de oração
 */
export async function createPrayerRequestNotification(
  senderName: string,
  category: string,
  contentSnippet: string
) {
  try {
    const title = 'Novo Pedido de Oração';
    const body = `${senderName} solicitou oração para "${category}": "${contentSnippet.length > 60 ? contentSnippet.substring(0, 60) + '...' : contentSnippet}"`;
    
    // Alvo: pastores, administradores, líderes e membros
    const targetRoles = [
      'admin', 'pastor', 'pastora', 'leader', 'obreiro', 
      'presbítero', 'missionário', 'missionária', 'diácono', 
      'evangelista', 'diaconisa', 'mídia social', 'membro'
    ];

    const notificationPayload = {
      title,
      body,
      type: 'prayer_request',
      roles: targetRoles,
      readBy: [],
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationPayload);
    console.log('Notificação de pedido de oração criada no banco de dados:', docRef.id);

    await sendSystemNotification(title, body, '/oracao');

    return docRef.id;
  } catch (error) {
    console.error('Falha ao registrar notificação de pedido de oração:', error);
    return null;
  }
}

/**
 * Cria uma notificação no Firestore para alertar sobre um novo estudo ou ensino bíblico
 */
export async function createStudyNotification(
  authorName: string,
  studyTitle: string,
  category: string
) {
  try {
    const title = 'Apostila / Estudo Publicado';
    const body = `${authorName} publicou o estudo "${studyTitle}" na categoria "${category}".`;
    
    // Alvo: pastores, administradores, líderes e membros
    const targetRoles = [
      'admin', 'pastor', 'pastora', 'leader', 'obreiro', 
      'presbítero', 'missionário', 'missionária', 'diácono', 
      'evangelista', 'diaconisa', 'mídia social', 'membro'
    ];

    const notificationPayload = {
      title,
      body,
      type: 'study_publish',
      roles: targetRoles,
      readBy: [],
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationPayload);
    console.log('Notificação de estudo criado no banco de dados:', docRef.id);

    await sendSystemNotification(title, body, '/estudos');
 
    return docRef.id;
  } catch (error) {
    console.error('Falha ao registrar notificação de estudo:', error);
    return null;
  }
}
 
/**
 * Cria uma notificação no Firestore para alertar sobre um novo material de EBD
 */
export async function createEBDMaterialNotification(
  materialTitle: string
) {
  try {
    const title = '📚 Novo Material EBD';
    const body = `Um novo material de estudo para a Escola Bíblica foi publicado: "${materialTitle}".`;
    
    // Alvo: pastores, administradores, líderes e membros
    const targetRoles = [
      'admin', 'pastor', 'pastora', 'leader', 'obreiro', 
      'presbítero', 'missionário', 'missionária', 'diácono', 
      'evangelista', 'diaconisa', 'mídia social', 'membro'
    ];
 
    const notificationPayload = {
      title,
      body,
      type: 'ebd_material_publish',
      roles: targetRoles,
      readBy: [],
      createdAt: serverTimestamp()
    };
 
    const docRef = await addDoc(collection(db, 'notifications'), notificationPayload);
    console.log('Notificação de material EBD criada no banco de dados:', docRef.id);
 
    await sendSystemNotification(title, body, '/admin/ebd');
 
    return docRef.id;
  } catch (error) {
    console.error('Falha ao registrar notificação de material EBD:', error);
    return null;
  }
}
 
/**
 * Cria uma notificação no Firestore para alertar sobre um novo evento na agenda
 */
export async function createEventNotification(
  eventTitle: string,
  formattedDate: string,
  eventTime: string,
  location?: string
) {
  try {
    const title = '📅 Novo Evento na Agenda';
    const body = `"${eventTitle}" agendado para ${formattedDate} às ${eventTime}${location ? ` em ${location}` : ''}.`;
    
    // Alvo: todos os papéis de liderança e membros
    const targetRoles = [
      'admin', 'pastor', 'pastora', 'leader', 'obreiro', 
      'presbítero', 'missionário', 'missionária', 'diácono', 
      'evangelista', 'diaconisa', 'mídia social', 'membro'
    ];

    const notificationPayload = {
      title,
      body,
      type: 'event_add',
      roles: targetRoles,
      readBy: [],
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationPayload);
    console.log('Notificação de evento criado no banco de dados:', docRef.id);

    await sendSystemNotification(title, body, '/admin/agenda');

    return docRef.id;
  } catch (error) {
    console.error('Falha ao registrar notificação de evento:', error);
    return null;
  }
}

/**
 * Cria uma notificação no Firestore para alertar sobre um novo link de vídeo publicado
 */
export async function createVideoLinkNotification(
  videoTitle: string,
  platform: string,
  addedBy: string
) {
  try {
    const platformName = platform === 'youtube' ? 'YouTube' :
                         platform === 'facebook' ? 'Facebook' :
                         platform === 'tiktok' ? 'TikTok' :
                         platform === 'instagram' ? 'Instagram' : 'Link';
    const title = '📺 Novo Vídeo Publicado';
    const body = `${addedBy} compartilhou um novo vídeo (${platformName}): "${videoTitle}".`;
    
    const targetRoles = [
      'admin', 'pastor', 'pastora', 'leader', 'obreiro', 
      'presbítero', 'missionário', 'missionária', 'diácono', 
      'evangelista', 'diaconisa', 'mídia social', 'membro'
    ];

    const notificationPayload = {
      title,
      body,
      type: 'video_publish',
      roles: targetRoles,
      readBy: [],
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationPayload);
    console.log('Notificação de vídeo criada no banco de dados:', docRef.id);

    await sendSystemNotification(title, body, '/videos');

    return docRef.id;
  } catch (error) {
    console.error('Falha ao registrar notificação de vídeo:', error);
    return null;
  }
}

export async function createBirthdayNotification(
  birthdayPersonName: string,
  birthdayPersonId: string
) {
  try {
    const title = '🎉 Feliz Aniversário!';
    const body = `Hoje é o aniversário de ${birthdayPersonName}! Clique para parabenizar.`;
    
    const targetRoles = [
      'admin', 'pastor', 'pastora', 'leader', 'obreiro', 
      'presbítero', 'missionário', 'missionária', 'diácono', 
      'evangelista', 'diaconisa', 'mídia social', 'membro'
    ];

    const notificationPayload = {
      title,
      body,
      type: 'birthday',
      targetUserId: birthdayPersonId,
      roles: targetRoles,
      readBy: [],
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationPayload);
    console.log('Notificação de aniversário criada:', docRef.id);

    await sendSystemNotification(title, body, `/admin/membros?highlight=${birthdayPersonId}`);

    return docRef.id;
  } catch (error) {
    console.error('Falha ao registrar notificação de aniversário:', error);
    return null;
  }
}

export interface SegmentedNotificationPayload {
  title: string;
  body: string;
  targetGroup: 'todos' | 'midia' | 'jovens' | 'louvor' | 'infantil' | 'obreiros' | 'casais' | 'mulheres' | string;
  targetGroupLabel?: string;
  targetRoles?: string[];
  category?: 'lembrete' | 'reuniao' | 'urgente' | 'evento' | 'geral' | string;
  targetUrl?: string;
  senderName?: string;
  senderId?: string;
}

/**
 * Cria e envia uma notificação push segmentada para grupos específicos
 */
export async function createSegmentedNotification(payload: SegmentedNotificationPayload) {
  try {
    const {
      title,
      body,
      targetGroup,
      targetGroupLabel = 'Segmentado',
      targetRoles = [],
      category = 'geral',
      targetUrl = '/',
      senderName = 'Liderança',
      senderId = ''
    } = payload;

    const notificationPayload = {
      title,
      body,
      type: 'segmented_push',
      targetGroup,
      targetGroupLabel,
      roles: targetRoles,
      category,
      targetUrl,
      senderName,
      senderId,
      readBy: [],
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationPayload);
    console.log('Notificação push segmentada registrada no banco de dados:', docRef.id);

    // Dispara a notificação sistêmica
    await sendSystemNotification(title, body, targetUrl);

    return docRef.id;
  } catch (error) {
    console.error('Falha ao enviar notificação push segmentada:', error);
    return null;
  }
}

/**
 * Escuta notificações em primeiro plano
 */
export async function listenToForegroundMessages(onMessageReceived: (payload: any) => void) {
  const messaging = await getMessagingInstance();
  if (messaging) {
    return onMessage(messaging, (payload) => {
      console.log('Mensagem FCM recebida em primeiro plano:', payload);
      onMessageReceived(payload);
    });
  }
  return null;
}

/**
 * Dispara uma notificação do sistema usando o Service Worker se disponível (melhor suporte PWA/Móvel)
 */
export async function sendSystemNotification(title: string, body: string, url = '/') {
  if (!('Notification' in window)) {
    console.warn('Este dispositivo não suporta notificações de navegador.');
    return;
  }

  // Se a permissão não foi solicitada, tentar pedir permissão
  if (Notification.permission === 'default') {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    } catch (e) {
      console.error('Erro ao pedir permissão de notificação:', e);
      return;
    }
  }

  if (Notification.permission !== 'granted') {
    console.warn('Permissão de notificações não concedida.');
    return;
  }

  const options = {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    data: { url }
  };

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, options);
        console.log('Notificação sistêmica enviada via ServiceWorker:', title);
        return;
      }
    } catch (err) {
      console.warn('Falha ao disparar notificação via Service Worker, tentando fallback:', err);
    }
  }

  try {
    new Notification(title, options);
    console.log('Notificação sistêmica enviada via fallback direto:', title);
  } catch (err) {
    console.warn('Falha no fallback de notificação (esperado em alguns navegadores/ambientes):', err);
  }
}

/**
 * Agendar notificação push local no navegador para um evento específico
 */
export async function scheduleSingleEventReminder(eventTitle: string, eventDateStr: string, eventTimeStr: string, category: string) {
  if (!('Notification' in window)) {
    alert('Seu navegador não possui suporte a notificações push.');
    return;
  }

  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      alert('⚠️ É necessário permitir notificações para ativar o lembrete.');
      return;
    }
  }
  if (Notification.permission !== 'granted') {
    alert('⚠️ As notificações estão bloqueadas nas configurações do seu navegador.');
    return;
  }

  // Dispara lembrete imediato confirmando o agendamento
  sendSystemNotification(
    '⏰ Lembrete Ativado!',
    `Alerta programado para: "${eventTitle}" (${category}) dia ${eventDateStr} às ${eventTimeStr}h.`,
    '/admin/agenda'
  );

  // Registra no armazenamento local
  try {
    const scheduled = JSON.parse(localStorage.getItem('scheduled_church_events') || '[]');
    scheduled.push({ title: eventTitle, date: eventDateStr, time: eventTimeStr, category, scheduledAt: Date.now() });
    localStorage.setItem('scheduled_church_events', JSON.stringify(scheduled));
    alert(`🔔 Alerta ativado com sucesso!\n\nVocê será lembrado de: ${eventTitle} (${eventDateStr} às ${eventTimeStr}h).`);
  } catch (e) {
    console.warn('Erro ao salvar no storage:', e);
  }
}

/**
 * Verifica eventos de hoje na agenda e agenda alertas push locais automáticos
 */
export function scheduleLocalEventReminders(events: any[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const remindedToday = JSON.parse(sessionStorage.getItem('reminded_events_session') || '[]');

    events.forEach((ev) => {
      let evDateStr = '';
      if (ev.date && typeof ev.date.toDate === 'function') {
        evDateStr = ev.date.toDate().toISOString().split('T')[0];
      } else if (typeof ev.date === 'string') {
        evDateStr = ev.date.split('T')[0];
      } else if (ev.date instanceof Date) {
        evDateStr = ev.date.toISOString().split('T')[0];
      }

      if (evDateStr === todayStr && !remindedToday.includes(ev.id || ev.title)) {
        remindedToday.push(ev.id || ev.title);
        sessionStorage.setItem('reminded_events_session', JSON.stringify(remindedToday));

        // Dispara lembrete sistêmico
        setTimeout(() => {
          sendSystemNotification(
            `🔔 Evento Hoje: ${ev.title}`,
            `Hoje temos ${ev.category || 'Evento'} às ${ev.time || '19:00'}h. Participe!`,
            '/admin/agenda'
          );
        }, 2000);
      }
    });
  } catch (err) {
    console.warn('Erro ao verificar alertas de eventos:', err);
  }
}

/**
 * Verifica aniversariantes de hoje e dispara notificação se ainda não foi disparada
 */
export async function checkAndSendBirthdayNotifications() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const membersSnap = await getDocs(collection(db, 'members'));
    const todayBirthdays: { id: string, name: string }[] = [];

    membersSnap.forEach(doc => {
      const data = doc.data();
      if (data.birthDate) {
        const parts = data.birthDate.split('-');
        if (parts.length === 3) {
          const birthMonth = parseInt(parts[1], 10) - 1;
          const birthDay = parseInt(parts[2], 10);
          const currentMonth = today.getMonth();
          const currentDay = today.getDate();
          if (birthMonth === currentMonth && birthDay === currentDay) {
            todayBirthdays.push({ id: doc.id, name: data.name });
          }
        }
      }
    });

    if (todayBirthdays.length === 0) return;

    const startOfTodayTimestamp = today;
    
    for (const bday of todayBirthdays) {
      const q = query(
        collection(db, 'notifications'),
        where('type', '==', 'birthday'),
        where('targetUserId', '==', bday.id)
      );
      
      const notifSnap = await getDocs(q);
      let alreadySentToday = false;
      
      notifSnap.forEach(notifDoc => {
        const data = notifDoc.data();
        if (data.createdAt) {
          const createdAt = typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date();
          if (createdAt >= startOfTodayTimestamp) {
            alreadySentToday = true;
          }
        } else {
           alreadySentToday = true;
        }
      });
      
      if (!alreadySentToday) {
        await createBirthdayNotification(bday.name, bday.id);
      }
    }
  } catch (err) {
    console.error("Error checking birthdays", err);
  }
}

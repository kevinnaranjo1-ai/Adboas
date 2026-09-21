import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  addDoc
} from 'firebase/firestore';

const DEFAULT_VAPID_PUBLIC_KEY = 
  'BECPa8laam2Gd7V0BCBuSLS1llLKl5BdFuV5VftiQMQ8bBroU3yior4pFOdXdku5mpv6uG44oqqkt6DOzwAkx18';

/**
 * Converte chave pública VAPID base64url para Uint8Array
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Gera um ID seguro para o documento da assinatura no Firestore
 */
function getSafeSubscriptionDocId(endpoint: string): string {
  // Pega os últimos 64 caracteres do endpoint ou cria hash legível
  try {
    const encoded = btoa(endpoint).replace(/[^a-zA-Z0-9]/g, '_');
    return `sub_${encoded.slice(-60)}`;
  } catch {
    return `sub_${endpoint.slice(-50).replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
}

/**
 * Verifica se o navegador/aparelho suporta Push Notifications via Service Worker
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Retorna o status atual de permissão ('granted', 'denied', 'default', 'unsupported')
 */
export function getPushPermissionState(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Obtém a assinatura push ativa no Service Worker atual
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[Push] Erro ao buscar assinatura existente:', err);
    return null;
  }
}

/**
 * Busca a chave pública VAPID do backend ou usa a padrão
 */
export async function getVapidPublicKey(): Promise<string> {
  try {
    const res = await fetch('/api/push/public-key');
    if (res.ok) {
      const data = await res.json();
      if (data?.publicKey) return data.publicKey;
    }
  } catch (err) {
    console.warn('[Push] Usando chave VAPID pública padrão:', err);
  }
  return DEFAULT_VAPID_PUBLIC_KEY;
}

export interface SubscribePushOptions {
  user: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
  };
  role?: string;
  department?: string;
}

/**
 * Inscreve o aparelho do membro para receber notificações push mesmo com app fechado
 */
export async function subscribeToPush(options: SubscribePushOptions): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (!isPushSupported()) {
    return {
      success: false,
      error: 'Seu navegador ou aparelho não suporta notificações em segundo plano.'
    };
  }

  try {
    // 1. Solicita permissão do usuário
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error: permission === 'denied' 
          ? 'As notificações foram bloqueadas nas configurações do seu navegador ou aparelho.'
          : 'A permissão de notificações não foi concedida.'
      };
    }

    // 2. Aguarda o Service Worker estar pronto
    const registration = await navigator.serviceWorker.ready;

    // 3. Obtém ou cria a assinatura push
    const publicKey = await getVapidPublicKey();
    const convertedKey = urlBase64ToUint8Array(publicKey);

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    if (!subscription) {
      return { success: false, error: 'Não foi possível gerar a assinatura push no aparelho.' };
    }

    // 4. Extrai as chaves de criptografia W3C (p256dh e auth)
    const rawP256dh = subscription.getKey('p256dh');
    const rawAuth = subscription.getKey('auth');

    if (!rawP256dh || !rawAuth) {
      return { success: false, error: 'Chaves de criptografia do push ausentes.' };
    }

    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawP256dh))));
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))));

    // 5. Salva a assinatura no Firestore
    const docId = getSafeSubscriptionDocId(subscription.endpoint);
    const userAgent = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

    await setDoc(doc(db, 'push_subscriptions', docId), {
      id: docId,
      userId: options.user.uid,
      userEmail: options.user.email || '',
      userName: options.user.displayName || options.user.email?.split('@')[0] || 'Membro',
      userRole: options.role || 'membro',
      department: options.department || '',
      endpoint: subscription.endpoint,
      keys: {
        p256dh,
        auth
      },
      platform: isIOS ? 'ios' : isAndroid ? 'android' : 'desktop',
      isPWA,
      userAgent,
      active: true,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    console.log('[Push] Aparelho inscrito e registrado no banco de dados com sucesso!');
    return { success: true, subscription };
  } catch (err: any) {
    console.error('[Push] Erro ao inscrever aparelho:', err);
    return { success: false, error: err?.message || 'Erro ao ativar notificações.' };
  }
}

/**
 * Cancela a inscrição push no aparelho e desativa no banco de dados
 */
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    const subscription = await getExistingPushSubscription();
    if (subscription) {
      const docId = getSafeSubscriptionDocId(subscription.endpoint);
      try {
        await deleteDoc(doc(db, 'push_subscriptions', docId));
      } catch (e) {
        console.warn('[Push] Erro ao remover do banco:', e);
      }
      await subscription.unsubscribe();
    }
    console.log('[Push] Inscrição removida com sucesso.');
    return true;
  } catch (err) {
    console.error('[Push] Erro ao cancelar inscrição:', err);
    return false;
  }
}

export interface SendPushPayload {
  title: string;
  body: string;
  url?: string;
  targetGroup?: string;
  targetRoles?: string[];
  category?: string;
  senderName?: string;
  senderId?: string;
  excludeUserId?: string;
}

/**
 * Dispara notificação push para os membros cadastrados mesmo com app fechado
 */
export async function sendPushNotificationToMembers(payload: SendPushPayload): Promise<{
  success: boolean;
  sentCount: number;
  totalSubscribers: number;
}> {
  try {
    const {
      title,
      body,
      url = '/',
      targetGroup = 'todos',
      targetRoles = [],
      category = 'geral',
      senderName = 'Liderança',
      senderId = '',
      excludeUserId
    } = payload;

    // 1. Busca assinaturas ativas no Firestore
    const subsRef = collection(db, 'push_subscriptions');
    const snapshot = await getDocs(subsRef);

    const subscriptions: Array<{
      docId: string;
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userId: string;
      userRole: string;
    }> = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.active !== false && data.endpoint && data.keys?.p256dh && data.keys?.auth) {
        // Filtragem por destinatários
        if (excludeUserId && data.userId === excludeUserId) {
          // Permite que o remetente também receba se quiser testar, ou ignore
        }

        let matches = true;
        if (targetRoles && targetRoles.length > 0 && targetGroup !== 'todos') {
          const userRole = (data.userRole || 'membro').toLowerCase();
          matches = targetRoles.some(r => r.toLowerCase() === userRole);
        }

        if (matches) {
          subscriptions.push({
            docId: docSnap.id,
            endpoint: data.endpoint,
            keys: data.keys,
            userId: data.userId,
            userRole: data.userRole || 'membro'
          });
        }
      }
    });

    console.log(`[Push] Encontrados ${subscriptions.length} aparelhos para receber o push.`);

    // 2. Registra no histórico de notificações do Firestore
    try {
      await addDoc(collection(db, 'notifications'), {
        title,
        body,
        type: 'push_broadcast',
        targetGroup,
        roles: targetRoles,
        category,
        targetUrl: url,
        senderName,
        senderId,
        readBy: [],
        recipientsCount: subscriptions.length,
        createdAt: serverTimestamp()
      });
    } catch (dbErr) {
      console.warn('[Push] Erro ao salvar histórico no banco:', dbErr);
    }

    if (subscriptions.length === 0) {
      return { success: true, sentCount: 0, totalSubscribers: 0 };
    }

    // 3. Envia para a rota backend Express que dispara WebPush com VAPID
    const response = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        url,
        category,
        tag: `adbn-${Date.now()}`,
        subscriptions: subscriptions.map(s => ({
          endpoint: s.endpoint,
          keys: s.keys,
          userId: s.userId
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Falha no servidor push: ${response.statusText}`);
    }

    const result = await response.json();

    // 4. Limpa tokens expirados retornados pelo servidor
    if (result.expiredEndpoints && Array.isArray(result.expiredEndpoints) && result.expiredEndpoints.length > 0) {
      const expiredSet = new Set(result.expiredEndpoints);
      for (const sub of subscriptions) {
        if (expiredSet.has(sub.endpoint)) {
          try {
            await deleteDoc(doc(db, 'push_subscriptions', sub.docId));
            console.log('[Push] Assinatura expirada removida do banco:', sub.docId);
          } catch (e) {
            console.warn('[Push] Erro ao remover assinatura expirada:', e);
          }
        }
      }
    }

    return {
      success: true,
      sentCount: result.sentCount || 0,
      totalSubscribers: subscriptions.length
    };
  } catch (err) {
    console.error('[Push] Erro ao enviar notificações push para membros:', err);
    return { success: false, sentCount: 0, totalSubscribers: 0 };
  }
}

/**
 * Envia push de teste para o próprio aparelho (com atraso opcional para fechar o app e testar)
 */
export async function sendTestPushToSelf(
  subscription: PushSubscription,
  delaySeconds: number = 0
): Promise<{ success: boolean; message: string }> {
  try {
    const rawP256dh = subscription.getKey('p256dh');
    const rawAuth = subscription.getKey('auth');

    if (!rawP256dh || !rawAuth) {
      return { success: false, message: 'Chaves do aparelho não encontradas.' };
    }

    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawP256dh))));
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))));

    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: {
          endpoint: subscription.endpoint,
          keys: { p256dh, auth }
        },
        title: '🔔 AD Boas Novas - Notificação Ativa!',
        body: 'Parabéns! Suas notificações push estão funcionando mesmo com o aplicativo fechado.',
        url: '/',
        delaySeconds
      })
    });

    const data = await res.json();
    return {
      success: res.ok,
      message: data.message || (res.ok ? 'Push enviado!' : 'Falha ao enviar teste.')
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro ao conectar ao servidor de push.' };
  }
}

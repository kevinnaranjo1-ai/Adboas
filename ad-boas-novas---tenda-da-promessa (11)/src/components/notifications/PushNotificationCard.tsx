import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellOff, 
  CheckCircle2, 
  AlertTriangle, 
  Smartphone, 
  Clock, 
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { 
  isPushSupported, 
  getPushPermissionState, 
  getExistingPushSubscription, 
  subscribeToPush, 
  unsubscribeFromPush,
  sendTestPushToSelf
} from '../../lib/pushSubscription';

interface PushNotificationCardProps {
  currentUser: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
  } | null;
  userRole?: string;
}

export const PushNotificationCard: React.FC<PushNotificationCardProps> = ({
  currentUser,
  userRole = 'membro'
}) => {
  const [supported, setSupported] = useState<boolean>(true);
  const [permission, setPermission] = useState<string>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [testCountdown, setTestCountdown] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone === true
  );

  useEffect(() => {
    checkStatus();
  }, [currentUser]);

  const checkStatus = async () => {
    const isSup = isPushSupported();
    setSupported(isSup);
    if (!isSup) return;

    const perm = getPushPermissionState();
    setPermission(perm);

    const sub = await getExistingPushSubscription();
    setIsSubscribed(!!sub);
  };

  const handleToggle = async () => {
    if (!currentUser) return;
    setLoading(true);
    setMessage(null);

    try {
      if (isSubscribed) {
        const ok = await unsubscribeFromPush(currentUser.uid);
        if (ok) {
          setIsSubscribed(false);
          setMessage({ text: 'Notificações no celular desativadas.', type: 'info' });
        }
      } else {
        const res = await subscribeToPush({
          user: currentUser,
          role: userRole
        });

        if (res.success) {
          setIsSubscribed(true);
          setPermission('granted');
          setMessage({ 
            text: 'Pronto! Agora você receberá os avisos da igreja mesmo com o app fechado.', 
            type: 'success' 
          });
        } else {
          setMessage({ text: res.error || 'Falha ao ativar notificações.', type: 'error' });
          setPermission(getPushPermissionState());
        }
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Ocorreu um erro.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const sub = await getExistingPushSubscription();
      if (!sub) {
        setMessage({ text: 'Por favor, ative as notificações primeiro.', type: 'error' });
        setTesting(false);
        return;
      }

      // Inicia contagem regressiva de 5 segundos
      setTestCountdown(5);
      const res = await sendTestPushToSelf(sub, 5);

      if (res.success) {
        setMessage({
          text: '⏳ Teste agendado! Feche o aplicativo ou bloqueie a tela do celular AGORA. A notificação chegará em 5 segundos.',
          type: 'info'
        });

        let remaining = 5;
        const interval = setInterval(() => {
          remaining -= 1;
          setTestCountdown(remaining);
          if (remaining <= 0) {
            clearInterval(interval);
            setTestCountdown(null);
            setTesting(false);
          }
        }, 1000);
      } else {
        setMessage({ text: res.message, type: 'error' });
        setTesting(false);
        setTestCountdown(null);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Erro no envio do teste.', type: 'error' });
      setTesting(false);
      setTestCountdown(null);
    }
  };

  if (!supported) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
        <div className="flex items-center gap-2 font-medium mb-1">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          Navegador sem suporte a Notificações em Segundo Plano
        </div>
        <p className="text-xs text-amber-700">
          Para receber avisos com o aplicativo fechado, abra o sistema no navegador Google Chrome (Android/PC) ou Safari adicionado à Tela de Início (iPhone iOS 16.4+).
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            isSubscribed 
              ? 'bg-emerald-100 text-emerald-600' 
              : permission === 'denied'
                ? 'bg-rose-100 text-rose-600'
                : 'bg-indigo-100 text-indigo-600'
          }`}>
            {isSubscribed ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base">
              Notificações Push no Celular
            </h3>
            <p className="text-xs text-slate-500">
              Receba avisos, cultos, pedidos de oração e comunicados sem precisar entrar no app
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading || testing}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-2 ${
            isSubscribed
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200'
          }`}
        >
          {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
          {isSubscribed ? 'Desativar' : 'Ativar no Meu Celular'}
        </button>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500 font-medium">Status no aparelho:</span>
        {isSubscribed ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ativo em Segundo Plano (App Fechado)
          </span>
        ) : permission === 'denied' ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" /> Bloqueado no Navegador
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Não Ativado
          </span>
        )}
      </div>

      {/* Feedback Message */}
      {message && (
        <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : message.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* iOS Safari Tip */}
      {isIOS && !isStandalone && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <Smartphone className="w-4 h-4 text-indigo-600" />
            Dica Importante para iPhone / iPad:
          </div>
          <p>
            No iPhone, para receber notificações com o app fechado, toque no botão <strong>Compartilhar</strong> (ícone do quadrado com a seta para cima ⎋) do Safari e escolha <strong>&quot;Adicionar à Tela de Início&quot;</strong>.
          </p>
        </div>
      )}

      {/* Test Push Button */}
      {isSubscribed && (
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            Quer testar se funciona com o app fechado?
          </div>
          <button
            onClick={handleTestNotification}
            disabled={testing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-2"
          >
            {testCountdown !== null ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                Feche o app agora! ({testCountdown}s)
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                Testar com App Fechado (5s)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

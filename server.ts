import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));

// Web Push (VAPID) Credentials
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  "BECPa8laam2Gd7V0BCBuSLS1llLKl5BdFuV5VftiQMQ8bBroU3yior4pFOdXdku5mpv6uG44oqqkt6DOzwAkx18";
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "pIYv38fqE1Etc-kRs0C2naBj-HIJgFysuSC94Zu_0t8";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:ieadtc.boasnovas@gmail.com";

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("[WebPush] VAPID configurado com sucesso.");
} catch (err) {
  console.error("[WebPush] Erro ao configurar VAPID:", err);
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Healthcheck
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 2. Public VAPID Key (for browser subscription)
app.get("/api/push/public-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// 3. Send Web Push to list of device subscriptions
app.post("/api/push/send", async (req, res) => {
  try {
    const {
      title,
      body,
      url = "/",
      icon = "/logo.png",
      badge = "/logo.png",
      tag = `push-${Date.now()}`,
      category = "geral",
      subscriptions = []
    } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "Título e mensagem são obrigatórios" });
    }

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return res.json({
        success: true,
        message: "Nenhuma assinatura de dispositivo informada.",
        sentCount: 0,
        failedCount: 0,
        expiredEndpoints: []
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon,
      badge,
      tag,
      category,
      url,
      timestamp: Date.now()
    });

    const expiredEndpoints: string[] = [];
    let sentCount = 0;
    let failedCount = 0;

    // Dispara push para todos os aparelhos simultaneamente
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
          failedCount++;
          return;
        }

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth
          }
        };

        await webpush.sendNotification(pushSubscription, payload, {
          TTL: 86400 // 24 hours delivery window
        });
        sentCount++;
      } catch (error: any) {
        failedCount++;
        // 404 (Not Found) or 410 (Gone) indicates device unsubscribed or token expired
        if (error.statusCode === 404 || error.statusCode === 410) {
          console.log(`[WebPush] Dispositivo expirado/desinstalado (${error.statusCode}):`, sub.endpoint);
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.warn("[WebPush] Falha ao enviar para dispositivo:", error.message || error);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    console.log(`[WebPush] Push enviado. Sucesso: ${sentCount}, Falhas: ${failedCount}, Expirados: ${expiredEndpoints.length}`);

    return res.json({
      success: true,
      total: subscriptions.length,
      sentCount,
      failedCount,
      expiredEndpoints
    });
  } catch (error: any) {
    console.error("[WebPush] Erro geral ao disparar push:", error);
    return res.status(500).json({ error: "Falha interna ao disparar notificações push" });
  }
});

// 4. Test Web Push (immediate or delayed so user can close the app to test)
app.post("/api/push/test", async (req, res) => {
  try {
    const {
      subscription,
      title = "🔔 Teste de Notificação - AD Boas Novas",
      body = "As notificações push estão funcionando perfeitamente mesmo com o aplicativo fechado!",
      url = "/",
      delaySeconds = 0
    } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: "Assinatura do dispositivo inválida" });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: "/logo.png",
      badge: "/logo.png",
      tag: `test-push-${Date.now()}`,
      url,
      timestamp: Date.now()
    });

    const sendPush = async () => {
      try {
        await webpush.sendNotification(subscription, payload, { TTL: 300 });
        console.log("[WebPush] Push de teste enviado com sucesso!");
      } catch (err: any) {
        console.error("[WebPush] Falha ao enviar push de teste:", err.message || err);
      }
    };

    if (delaySeconds && delaySeconds > 0) {
      setTimeout(sendPush, delaySeconds * 1000);
      return res.json({
        success: true,
        message: `Notificação programada para daqui a ${delaySeconds} segundos! Feche o aplicativo agora no seu celular para testar.`
      });
    } else {
      await sendPush();
      return res.json({ success: true, message: "Notificação de teste disparada com sucesso!" });
    }
  } catch (error: any) {
    console.error("[WebPush] Erro no teste de push:", error);
    return res.status(500).json({ error: "Falha ao enviar teste" });
  }
});

// ----------------------------------------------------
// VITE DEV SERVER / STATIC PROD HANDLER
// ----------------------------------------------------

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Servidor rodando em http://0.0.0.0:${PORT}`);
  });
}

start();

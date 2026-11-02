export type CashDrawerKickPayload = {
  source: 'receipt-print' | 'print-test';
  saleId: string;
  receiptNumber: string;
  triggeredAt: string;
  printerName?: string | null;
};

export type CashDrawerKickResult =
  | { ok: true; mode: 'window-bridge' | 'http-bridge' | 'browser-event'; message: string }
  | { ok: false; mode: 'http-bridge' | 'browser-event'; message: string };

declare global {
  interface Window {
    VertexPOS?: {
      openCashDrawer?: (payload: CashDrawerKickPayload) => Promise<unknown> | unknown;
    };
    __VERTEX_POS_BRIDGE__?: {
      openCashDrawer?: (payload: CashDrawerKickPayload) => Promise<unknown> | unknown;
    };
  }
}

function dispatchFallbackEvent(payload: CashDrawerKickPayload) {
  window.dispatchEvent(
    new CustomEvent('vertex-pos:cash-drawer-kick', {
      detail: {
        mode: 'browser-event',
        ...payload
      }
    })
  );
}

function getHttpBridgeConfig() {
  const bridgeUrl = process.env.NEXT_PUBLIC_CASH_DRAWER_BRIDGE_URL?.trim();
  const bridgeToken = process.env.NEXT_PUBLIC_CASH_DRAWER_BRIDGE_TOKEN?.trim();

  if (!bridgeUrl) {
    return null;
  }

  return { bridgeUrl, bridgeToken };
}

export async function openCashDrawer(payload: CashDrawerKickPayload): Promise<CashDrawerKickResult> {
  if (typeof window === 'undefined') {
    return {
      ok: false,
      mode: 'browser-event',
      message: 'El cajón de efectivo solo puede abrirse desde una sesión de caja en el navegador.'
    };
  }

  const browserBridge = window.VertexPOS?.openCashDrawer ?? window.__VERTEX_POS_BRIDGE__?.openCashDrawer;

  if (browserBridge) {
    await browserBridge(payload);
    return {
      ok: true,
      mode: 'window-bridge',
      message: 'Comando de apertura de cajón enviado mediante el puente local de caja.'
    };
  }

  const httpBridge = getHttpBridgeConfig();

  if (httpBridge) {
    try {
      const response = await fetch(httpBridge.bridgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(httpBridge.bridgeToken
            ? { Authorization: `Bearer ${httpBridge.bridgeToken}` }
            : {})
        },
        body: JSON.stringify({
          action: 'open-cash-drawer',
          ...payload
        }),
        cache: 'no-store'
      });

      const data = await response
        .json()
        .catch(() => ({ ok: response.ok, message: response.ok ? null : 'El puente devolvió una respuesta ilegible.' }));

      if (!response.ok || data?.ok === false) {
        return {
          ok: false,
          mode: 'http-bridge',
          message: data?.message || 'El puente del cajón de efectivo rechazó la solicitud.'
        };
      }

      return {
        ok: true,
        mode: 'http-bridge',
        message: data?.message || 'Comando de apertura enviado al puente de hardware local.'
      };
    } catch (error) {
      return {
        ok: false,
        mode: 'http-bridge',
        message:
          error instanceof Error
            ? `No se pudo conectar con el puente del cajón de efectivo: ${error.message}`
            : 'No se pudo conectar con el puente del cajón de efectivo.'
      };
    }
  }

  dispatchFallbackEvent(payload);
  return {
    ok: true,
    mode: 'browser-event',
    message:
      'Evento local de apertura enviado. Configure un puente local o NEXT_PUBLIC_CASH_DRAWER_BRIDGE_URL para hardware físico.'
  };
}

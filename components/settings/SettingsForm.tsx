'use client';

import Link from 'next/link';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments';
import { DEFAULT_ARGENTINA_DENOMINATIONS, type RegisterDenominationItem } from '@/lib/register';
import {
  getPrinterConnectionLabel,
  getTaxModeLabel,
  PRINTER_CONNECTION_OPTIONS,
  type PrinterConnectionValue,
  TAX_MODE_OPTIONS,
  type TaxModeValue
} from '@/lib/shop-settings';

type ReceiptWidth = '58mm' | '80mm';

type Props = {
  initialValues: {
    shopName: string;
    legalBusinessName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    taxId: string | null;
    timezone: string;
    currencyCode: string;
    currencySymbol: string;
    taxMode: TaxModeValue;
    taxRate: string;
    receiptHeader: string | null;
    receiptFooter: string | null;
    receiptWidth: ReceiptWidth;
    receiptShowBrandMark: boolean;
    printerSafeMode: boolean;
    defaultPaymentMethods: PaymentMethod[];
    cashDenominations: RegisterDenominationItem[];
    printerName: string;
    printerConnection: PrinterConnectionValue;
    cashDrawerKickEnabled: boolean;
    barcodeScannerNotes: string;
    lowStockEnabled: boolean;
    lowStockThreshold: number;
    reorderSafetyStock: number;
    offlineStockStrict: boolean;
    offlineStockMaxAgeMinutes: number;
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    fefoEnabled: boolean;
    expiryAlertDays: number;
    openingFloatRequired: boolean;
    openingFloatAmount: string;
    salePrefix: string;
    receiptPrefix: string;
    purchasePrefix: string;
  };
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 p-5">
      <div>
        <h3 className="text-lg font-black text-stone-900">{title}</h3>
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function SettingsForm({ initialValues }: Props) {
  const [form, setForm] = useState({ ...initialValues, taxRate: String(initialValues.taxRate) });
  const [newDenomValue, setNewDenomValue] = useState('');
  const [newDenomLabel, setNewDenomLabel] = useState('');
  const [denomError, setDenomError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function togglePaymentMethod(method: PaymentMethod) {
    setForm((current) => {
      const hasMethod = current.defaultPaymentMethods.includes(method);
      const nextMethods = hasMethod
        ? current.defaultPaymentMethods.filter((entry) => entry !== method)
        : [...current.defaultPaymentMethods, method];

      return {
        ...current,
        defaultPaymentMethods: nextMethods.length ? nextMethods : current.defaultPaymentMethods
      };
    });
  }

  function handleAddDenomination() {
    setDenomError('');
    const val = Number(newDenomValue);
    if (!Number.isFinite(val) || val <= 0) {
      setDenomError('Ingrese un valor numérico mayor a cero.');
      return;
    }

    const roundedVal = Math.round(val * 100) / 100;
    if (form.cashDenominations.some((d) => d.value === roundedVal)) {
      setDenomError(`La denominación ${form.currencySymbol} ${roundedVal.toLocaleString('es-AR')} ya está en la lista.`);
      return;
    }

    const label =
      newDenomLabel.trim() ||
      (roundedVal >= 10
        ? `Billete de $${roundedVal.toLocaleString('es-AR')}`
        : `Moneda de $${roundedVal.toLocaleString('es-AR')}`);

    const nextDenoms = [...form.cashDenominations, { value: roundedVal, label }].sort(
      (a, b) => b.value - a.value
    );

    setForm((current) => ({ ...current, cashDenominations: nextDenoms }));
    setNewDenomValue('');
    setNewDenomLabel('');
  }

  function handleRemoveDenomination(val: number) {
    setDenomError('');
    if (form.cashDenominations.length <= 1) {
      setDenomError('Debe mantener al menos una denominación para el conteo de caja.');
      return;
    }
    setForm((current) => ({
      ...current,
      cashDenominations: current.cashDenominations.filter((d) => d.value !== val)
    }));
  }

  function handleResetArgentinaDenominations() {
    setDenomError('');
    setForm((current) => ({
      ...current,
      cashDenominations: [...DEFAULT_ARGENTINA_DENOMINATIONS]
    }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        taxRate: Number(form.taxRate),
        lowStockThreshold: Number(form.lowStockThreshold),
        reorderSafetyStock: Number(form.reorderSafetyStock),
        offlineStockMaxAgeMinutes: Number(form.offlineStockMaxAgeMinutes),
        openingFloatAmount: Number(form.openingFloatAmount),
        cashDenominations: form.cashDenominations
      })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo guardar la configuración.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'No se pudo guardar la configuración.');
      return;
    }

    setMessage('Configuración guardada correctamente.');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <h2 className="text-xl font-black text-stone-900">Configuración de la sucursal</h2>
        <p className="mt-2 text-sm text-stone-500">
          Mantén la identidad de la sucursal, los impuestos, los valores de cobro, la impresora y las reglas de caja alineados con la operación real de la tienda.
        </p>
      </Card>

      <Section title="Datos del negocio" description="Usa la razón social para los registros formales y el nombre de la sucursal para las operaciones diarias.">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Nombre de la sucursal o tienda"
            value={form.shopName}
            onChange={(event) => setForm((current) => ({ ...current, shopName: event.target.value }))}
          />
          <Input
            placeholder="Razón social"
            value={form.legalBusinessName}
            onChange={(event) => setForm((current) => ({ ...current, legalBusinessName: event.target.value }))}
          />
          <Input
            placeholder="Teléfono"
            value={form.phone ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
          <Input
            placeholder="Correo electrónico"
            value={form.email ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <Input
            placeholder="Identificación fiscal o referencia empresarial"
            value={form.taxId ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value }))}
          />
          <Input
            placeholder="Zona horaria"
            value={form.timezone}
            onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
          />
          <div className="md:col-span-2">
            <Input
              placeholder="Dirección"
              value={form.address ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            />
          </div>
        </div>
      </Section>

      <Section title="Impuestos y moneda" description="Estos valores determinan los cálculos de cobro y cómo aparecen los totales en recibos y reportes.">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Código de moneda"
            value={form.currencyCode}
            onChange={(event) => setForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))}
          />
          <Input
            placeholder="Símbolo de moneda"
            value={form.currencySymbol}
            onChange={(event) => setForm((current) => ({ ...current, currencySymbol: event.target.value }))}
          />
          <div className="space-y-2">
            <div className="text-sm font-semibold text-stone-700">Modo de impuestos</div>
            <select
              className={selectClassName}
              value={form.taxMode}
              onChange={(event) => setForm((current) => ({ ...current, taxMode: event.target.value as TaxModeValue }))}
            >
              {TAX_MODE_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {getTaxModeLabel(entry)}
                </option>
              ))}
            </select>
          </div>
          <Input
            type="number"
            step="0.01"
            placeholder="Tasa de impuesto"
            value={form.taxRate}
            onChange={(event) => setForm((current) => ({ ...current, taxRate: event.target.value }))}
          />
        </div>
      </Section>

      <Section title="Cobro y caja" description="Define los medios de pago que los cajeros verán primero y la regla de fondo inicial de cada turno.">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-stone-700">Medios de pago predeterminados</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => {
                const active = form.defaultPaymentMethods.includes(method);
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => togglePaymentMethod(method)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    {method === 'Cash'
                      ? 'Efectivo'
                      : method === 'Card'
                      ? 'Tarjeta'
                      : method === 'E-Wallet'
                      ? 'Billetera virtual'
                      : method === 'Bank Transfer'
                      ? 'Transferencia bancaria'
                      : method}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.openingFloatRequired}
                onChange={(event) => setForm((current) => ({ ...current, openingFloatRequired: event.target.checked }))}
              />
              Requerir un fondo inicial mínimo antes de iniciar sesión de caja
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="Fondo inicial requerido"
              value={form.openingFloatAmount}
              onChange={(event) => setForm((current) => ({ ...current, openingFloatAmount: event.target.value }))}
            />
            <Input
              type="number"
              placeholder="Umbral de existencias bajas"
              value={String(form.lowStockThreshold)}
              onChange={(event) => setForm((current) => ({ ...current, lowStockThreshold: Number(event.target.value) }))}
            />
            <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.lowStockEnabled}
                onChange={(event) => setForm((current) => ({ ...current, lowStockEnabled: event.target.checked }))}
              />
              Habilitar alertas de existencias bajas
            </label>
            <Input
              type="number"
              placeholder="Antigüedad máxima del inventario sin conexión (minutos)"
              value={String(form.offlineStockMaxAgeMinutes)}
              onChange={(event) => setForm((current) => ({ ...current, offlineStockMaxAgeMinutes: Number(event.target.value) }))}
            />
            <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.offlineStockStrict}
                onChange={(event) => setForm((current) => ({ ...current, offlineStockStrict: event.target.checked }))}
              />
              Bloquear cobro sin conexión cuando el stock local esté desactualizado
            </label>
          </div>
        </div>
      </Section>

      <Section
        title="Denominaciones de efectivo (Arqueo de caja)"
        description="Configura los billetes y monedas que se utilizan para el conteo físico en el cierre de caja. Puedes agregar nuevas denominaciones o quitar las que tu negocio no maneje para agilizar el arqueo."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                {form.cashDenominations.length} denominación(es) activa(s)
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetArgentinaDenominations}
              className="rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
            >
              Restablecer a valores estándar de Argentina
            </button>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {form.cashDenominations.map((denom) => (
              <div
                key={denom.value}
                className="group relative flex items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-stone-50/80 p-3 transition hover:border-stone-300 hover:bg-white"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-base font-black text-stone-900">
                    {form.currencySymbol} {denom.value.toLocaleString('es-AR')}
                  </div>
                  <div className="truncate text-xs text-stone-500">{denom.label}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDenomination(denom.value)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                  title={`Quitar denominación de $${denom.value.toLocaleString('es-AR')}`}
                  aria-label={`Quitar denominación de $${denom.value.toLocaleString('es-AR')}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Agregar nueva denominación
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
              <Input
                type="number"
                min="0.01"
                step="any"
                placeholder="Valor (ej: 50000)"
                value={newDenomValue}
                onChange={(e) => setNewDenomValue(e.target.value)}
              />
              <Input
                placeholder="Etiqueta opcional (ej: Billete de $50.000)"
                value={newDenomLabel}
                onChange={(e) => setNewDenomLabel(e.target.value)}
              />
              <Button type="button" variant="secondary" onClick={handleAddDenomination}>
                + Agregar
              </Button>
            </div>
            {denomError ? (
              <p className="mt-2 text-xs font-semibold text-red-600">{denomError}</p>
            ) : null}
          </div>
        </div>
      </Section>

      <Section title="Valores predeterminados de inventario" description="Estos valores respaldan las alertas de existencias bajas, el control de vencimiento y cómo la sucursal desea rotar el stock operativamente.">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            type="number"
            placeholder="Existencias de seguridad predeterminadas"
            value={String(form.reorderSafetyStock)}
            onChange={(event) => setForm((current) => ({ ...current, reorderSafetyStock: Number(event.target.value) }))}
          />
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            Las sugerencias inteligentes de reabastecimiento usan este valor predeterminado junto con la velocidad de ventas reciente, el tiempo de entrega del proveedor y el stock actual antes de generar borradores de órdenes de compra.
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.batchTrackingEnabled}
              onChange={(event) => setForm((current) => ({ ...current, batchTrackingEnabled: event.target.checked }))}
            />
            Habilitar seguimiento por lote de forma predeterminada
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.expiryTrackingEnabled}
              onChange={(event) => setForm((current) => ({ ...current, expiryTrackingEnabled: event.target.checked }))}
            />
            Habilitar seguimiento de vencimiento de forma predeterminada
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.fefoEnabled}
              onChange={(event) => setForm((current) => ({ ...current, fefoEnabled: event.target.checked }))}
            />
            Priorizar rotación FEFO (primero en vencer, primero en salir)
          </label>
          <Input
            type="number"
            placeholder="Días de alerta de caducidad"
            value={String(form.expiryAlertDays)}
            onChange={(event) => setForm((current) => ({ ...current, expiryAlertDays: Number(event.target.value) }))}
          />
        </div>
      </Section>

      <Section title="Recibo y hardware" description="Mantenga la salida del recibo térmico práctica y registre notas de la impresora o escáner de la sucursal sin sobrecargar las integraciones.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-stone-700">Ancho del recibo</div>
            <select
              className={selectClassName}
              value={form.receiptWidth}
              onChange={(event) =>
                setForm((current) => ({ ...current, receiptWidth: event.target.value as ReceiptWidth }))
              }
            >
              <option value="58mm">Rollo térmico de 58 mm</option>
              <option value="80mm">Rollo térmico de 80 mm</option>
            </select>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-stone-700">Conexión de impresora</div>
            <select
              className={selectClassName}
              value={form.printerConnection}
              onChange={(event) =>
                setForm((current) => ({ ...current, printerConnection: event.target.value as PrinterConnectionValue }))
              }
            >
              {PRINTER_CONNECTION_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {getPrinterConnectionLabel(entry)}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.receiptShowBrandMark}
              onChange={(event) => setForm((current) => ({ ...current, receiptShowBrandMark: event.target.checked }))}
            />
            Mostrar el logotipo o marca de la sucursal en recibos térmicos
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.printerSafeMode}
              onChange={(event) => setForm((current) => ({ ...current, printerSafeMode: event.target.checked }))}
            />
            Usar formato seguro para impresoras térmicas (compatible con ESC/POS)
          </label>
          <Input
            placeholder="Nombre o cola de la impresora"
            value={form.printerName}
            onChange={(event) => setForm((current) => ({ ...current, printerName: event.target.value }))}
          />
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.cashDrawerKickEnabled}
              onChange={(event) => setForm((current) => ({ ...current, cashDrawerKickEnabled: event.target.checked }))}
            />
            Mostrar el activador de apertura de cajón en las páginas de impresión
          </label>
          <Input
            placeholder="Encabezado del recibo"
            value={form.receiptHeader ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, receiptHeader: event.target.value }))}
          />
          <div className="md:col-span-2">
            <Input
              placeholder="Pie del recibo"
              value={form.receiptFooter ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, receiptFooter: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <textarea
              className="min-h-24 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              placeholder="Notas del lector, de la impresora o indicaciones para cajeros"
              value={form.barcodeScannerNotes}
              onChange={(event) => setForm((current) => ({ ...current, barcodeScannerNotes: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            <div className="font-semibold text-stone-900">Prueba de impresora e integración del cajón</div>
            <div className="mt-2">
              Abra una página de prueba térmica en vivo para verificar el espaciado de 58 mm u 80 mm, el formato compacto, la claridad del código de barras del recibo y la apertura del cajón de dinero antes de operar en una caja.
            </div>
            <div className="mt-4">
              <Link
                href="/print/receipt/test?autoprint=1"
                target="_blank"
                className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                Abrir página de prueba de impresión
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Numeración de documentos" description="Utilice prefijos cortos para que las referencias de ventas, recibos y compras o facturas sean específicas de la sucursal y fáciles de leer.">
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            placeholder="Prefijo de ventas (ej. VTA-)"
            value={form.salePrefix}
            onChange={(event) => setForm((current) => ({ ...current, salePrefix: event.target.value.toUpperCase() }))}
          />
          <Input
            placeholder="Prefijo de recibos (ej. REC-)"
            value={form.receiptPrefix}
            onChange={(event) => setForm((current) => ({ ...current, receiptPrefix: event.target.value.toUpperCase() }))}
          />
          <Input
            placeholder="Prefijo de compras (ej. COM-)"
            value={form.purchasePrefix}
            onChange={(event) => setForm((current) => ({ ...current, purchasePrefix: event.target.value.toUpperCase() }))}
          />
        </div>
      </Section>

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando configuración...' : 'Guardar configuración'}
        </Button>
      </div>
    </form>
  );
}

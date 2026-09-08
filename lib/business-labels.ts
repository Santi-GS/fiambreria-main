export function humanizeEnumLabel(value: string | null | undefined) {
  if (!value) {
    return 'N/D';
  }

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getSaleStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'COMPLETED':
      return 'Completada';
    case 'VOIDED':
      return 'Anulada';
    default:
      return humanizeEnumLabel(status);
  }
}

export function getAdjustmentTypeLabel(type: string | null | undefined) {
  switch (type) {
    case 'REFUND':
      return 'Reembolso';
    case 'EXCHANGE':
      return 'Cambio';
    case 'VOID':
      return 'Anulación';
    default:
      return humanizeEnumLabel(type);
  }
}

export function getInventoryMovementTypeLabel(type: string | null | undefined) {
  switch (type) {
    case 'PURCHASE_RECEIVED':
      return 'Compra recibida';
    case 'SUPPLIER_RETURN_POSTED':
      return 'Devolución al proveedor enviada';
    case 'SALE_COMPLETED':
      return 'Venta completada';
    case 'SALE_VOIDED':
      return 'Reposición por anulación';
    case 'RETURN_RESTOCKED':
      return 'Devolución del cliente repuesta';
    case 'EXCHANGE_ISSUED':
      return 'Cambio emitido';
    case 'STOCK_COUNT_POSTED':
      return 'Variación de inventario registrada';
    case 'MANUAL_ADJUSTMENT':
      return 'Corrección de inventario con motivo';
    case 'OPENING_STOCK':
      return 'Inventario inicial';
    case 'TRANSFER_OUT':
      return 'Transferencia de sucursal enviada';
    case 'TRANSFER_IN':
      return 'Transferencia de sucursal recibida';
    default:
      return humanizeEnumLabel(type);
  }
}

export function getStockCountStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'DRAFT':
      return 'Planificado';
    case 'IN_PROGRESS':
      return 'Conteo en curso';
    case 'SUBMITTED':
      return 'Pendiente de aprobación';
    case 'APPROVED':
      return 'Listo para registrar';
    case 'POSTED':
      return 'Registrado en inventario';
    case 'CANCELLED':
      return 'Cancelado';
    default:
      return humanizeEnumLabel(status);
  }
}

export function getRegisterSessionStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'OPEN':
      return 'Caja abierta';
    case 'CLOSED':
      return 'Cerrada';
    case 'OVERRIDE_CLOSED':
      return 'Cerrada por un gerente';
    default:
      return humanizeEnumLabel(status);
  }
}

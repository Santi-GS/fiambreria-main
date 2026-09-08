import PageSkeleton from '@/components/system/PageSkeleton';

export default function AppSegmentLoading() {
  return <PageSkeleton title="Cargando el espacio de trabajo" subtitle="Obteniendo métricas de la tienda, existencias y herramientas de caja." rows={6} />;
}

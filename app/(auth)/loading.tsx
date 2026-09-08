import PageSkeleton from '@/components/system/PageSkeleton';

export default function AuthSegmentLoading() {
  return <PageSkeleton title="Cargando acceso" subtitle="Preparando las pantallas seguras de inicio de sesión y recuperación de cuenta." rows={3} />;
}

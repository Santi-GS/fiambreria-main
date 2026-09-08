import PageSkeleton from '@/components/system/PageSkeleton';

export default function RootLoading() {
  return <PageSkeleton title="Cargando Vertex POS" subtitle="Iniciando la aplicación y tu sesión más reciente." rows={5} />;
}

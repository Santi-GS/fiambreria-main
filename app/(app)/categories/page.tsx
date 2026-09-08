import AppHeader from '@/components/layout/AppHeader';
import CategoryManager from '@/components/categories/CategoryManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export default async function CategoriesPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const categories = await prisma.category.findMany({
    where: { shopId },
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true, children: true } } }
  });

  return (
    <div className="space-y-6">
      <AppHeader
        title="Categorías"
        subtitle="Organiza el catálogo sin romper las asignaciones de productos ni crear árboles de categorías duplicados."
      />
      <CategoryManager initialCategories={categories} />
    </div>
  );
}

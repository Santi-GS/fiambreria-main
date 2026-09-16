'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useWorkspaceHeader } from './WorkspaceHeaderContext';

export default function AppHeader({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { setHeaderData } = useWorkspaceHeader();

  useEffect(() => {
    setHeaderData({
      pathname,
      title,
      subtitle,
      actions
    });

    return () => {
      setHeaderData((current) => (current?.pathname === pathname ? null : current));
    };
  }, [pathname, title, subtitle, actions, setHeaderData]);

  return null;
}

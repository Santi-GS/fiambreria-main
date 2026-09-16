'use client';

import React, { createContext, useContext, useState } from 'react';
import { usePathname } from 'next/navigation';

export type WorkspaceHeaderData = {
  pathname: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

type WorkspaceHeaderContextType = {
  headerData: WorkspaceHeaderData | null;
  setHeaderData: React.Dispatch<React.SetStateAction<WorkspaceHeaderData | null>>;
};

const WorkspaceHeaderContext = createContext<WorkspaceHeaderContextType>({
  headerData: null,
  setHeaderData: () => {}
});

export function WorkspaceHeaderProvider({ children }: { children: React.ReactNode }) {
  const [headerData, setHeaderData] = useState<WorkspaceHeaderData | null>(null);
  const pathname = usePathname();

  const activeHeaderData = headerData?.pathname === pathname ? headerData : null;

  return (
    <WorkspaceHeaderContext.Provider value={{ headerData: activeHeaderData, setHeaderData }}>
      {children}
    </WorkspaceHeaderContext.Provider>
  );
}

export function useWorkspaceHeader() {
  return useContext(WorkspaceHeaderContext);
}

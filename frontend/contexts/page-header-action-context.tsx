"use client";

import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react";

const PageHeaderActionValueContext = createContext<ReactNode>(null);
const PageHeaderActionSetterContext =
  createContext<Dispatch<SetStateAction<ReactNode>> | null>(null);

const PageHeaderBreadcrumbValueContext = createContext<ReactNode>(null);
const PageHeaderBreadcrumbSetterContext =
  createContext<Dispatch<SetStateAction<ReactNode>> | null>(null);

export function PageHeaderActionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [action, setAction] = useState<ReactNode>(null);
  const [breadcrumb, setBreadcrumb] = useState<ReactNode>(null);

  return (
    <PageHeaderActionSetterContext.Provider value={setAction}>
      <PageHeaderActionValueContext.Provider value={action}>
        <PageHeaderBreadcrumbSetterContext.Provider value={setBreadcrumb}>
          <PageHeaderBreadcrumbValueContext.Provider value={breadcrumb}>
            {children}
          </PageHeaderBreadcrumbValueContext.Provider>
        </PageHeaderBreadcrumbSetterContext.Provider>
      </PageHeaderActionValueContext.Provider>
    </PageHeaderActionSetterContext.Provider>
  );
}

export function usePageHeaderActionSlot() {
  return useContext(PageHeaderActionValueContext);
}

export function usePageHeaderAction(action: ReactNode) {
  const setAction = useContext(PageHeaderActionSetterContext);
  if (!setAction) {
    throw new Error(
      "usePageHeaderAction must be used within a PageHeaderActionProvider",
    );
  }

  useEffect(() => {
    setAction(action);
    return () => setAction(null);
  });
}

export function usePageHeaderBreadcrumbSlot() {
  return useContext(PageHeaderBreadcrumbValueContext);
}

/** Substitui as abas da seção por um trilho de navegação (ex: "Impressoras > Bambu Lab A1"). */
export function usePageHeaderBreadcrumb(breadcrumb: ReactNode) {
  const setBreadcrumb = useContext(PageHeaderBreadcrumbSetterContext);
  if (!setBreadcrumb) {
    throw new Error(
      "usePageHeaderBreadcrumb must be used within a PageHeaderActionProvider",
    );
  }

  useEffect(() => {
    setBreadcrumb(breadcrumb);
    return () => setBreadcrumb(null);
  });
}

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

export function PageHeaderActionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [action, setAction] = useState<ReactNode>(null);

  return (
    <PageHeaderActionSetterContext.Provider value={setAction}>
      <PageHeaderActionValueContext.Provider value={action}>
        {children}
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

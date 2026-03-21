"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import { gravureProductCatalog, GravureProductCatalog } from "@/data/dummyData";

type CatalogCtxType = {
  catalog: GravureProductCatalog[];
  saveCatalogItem: (item: GravureProductCatalog) => void;
  deleteCatalogItem: (id: string) => void;
};

const CatalogCtx = createContext<CatalogCtxType>({
  catalog: gravureProductCatalog,
  saveCatalogItem: () => {},
  deleteCatalogItem: () => {},
});

export function ProductCatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<GravureProductCatalog[]>(gravureProductCatalog);

  const saveCatalogItem = (item: GravureProductCatalog) => {
    setCatalog(prev => {
      const exists = prev.find(c => c.id === item.id);
      return exists ? prev.map(c => c.id === item.id ? item : c) : [...prev, item];
    });
  };

  const deleteCatalogItem = (id: string) => {
    setCatalog(prev => prev.filter(c => c.id !== id));
  };

  return (
    <CatalogCtx.Provider value={{ catalog, saveCatalogItem, deleteCatalogItem }}>
      {children}
    </CatalogCtx.Provider>
  );
}

export const useProductCatalog = () => useContext(CatalogCtx);

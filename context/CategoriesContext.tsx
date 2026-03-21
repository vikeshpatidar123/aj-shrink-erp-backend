"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import { CategoryMaster, categories as initData } from "@/data/dummyData";

type CategoriesCtxType = {
  categories: CategoryMaster[];
  saveCategory: (cat: CategoryMaster) => void;
  deleteCategory: (id: string) => void;
};

const CategoriesCtx = createContext<CategoriesCtxType>({
  categories: initData,
  saveCategory: () => {},
  deleteCategory: () => {},
});

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<CategoryMaster[]>(initData);

  const saveCategory = (cat: CategoryMaster) => {
    setCategories(prev => {
      const exists = prev.find(c => c.id === cat.id);
      return exists
        ? prev.map(c => c.id === cat.id ? cat : c)
        : [...prev, cat];
    });
  };

  const deleteCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  return (
    <CategoriesCtx.Provider value={{ categories, saveCategory, deleteCategory }}>
      {children}
    </CategoriesCtx.Provider>
  );
}

export const useCategories = () => useContext(CategoriesCtx);

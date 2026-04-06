"use client";
import { createContext, useContext, useState } from "react";

export type BusinessUnit = "Extrusion" | "Gravure";

type UnitContextType = {
  unit: BusinessUnit;
  setUnit: (u: BusinessUnit) => void;
};

const UnitContext = createContext<UnitContextType>({
  unit: "Gravure",
  setUnit: () => {},
});

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnit] = useState<BusinessUnit>("Gravure");
  return (
    <UnitContext.Provider value={{ unit, setUnit }}>
      {children}
    </UnitContext.Provider>
  );
}

export const useUnit = () => useContext(UnitContext);

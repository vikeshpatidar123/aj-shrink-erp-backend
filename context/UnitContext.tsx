"use client";
import { createContext, useContext, useState } from "react";

export type BusinessUnit = "Extrusion" | "Gravure" | "Both";

type UnitContextType = {
  unit: BusinessUnit;
  setUnit: (u: BusinessUnit) => void;
};

const UnitContext = createContext<UnitContextType>({
  unit: "Both",
  setUnit: () => {},
});

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnit] = useState<BusinessUnit>("Both");
  return (
    <UnitContext.Provider value={{ unit, setUnit }}>
      {children}
    </UnitContext.Provider>
  );
}

export const useUnit = () => useContext(UnitContext);

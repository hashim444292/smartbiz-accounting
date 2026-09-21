"use client";

import React, { createContext, useContext, useState } from "react";

export type DatePreset = "TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "LAST_MONTH" | "CUSTOM";

export interface DateRangeState {
  preset: DatePreset;
  startDate: Date;
  endDate: Date;
  label: string;
}

interface DateRangeContextType {
  range: DateRangeState;
  setPreset: (preset: DatePreset) => void;
  setCustomRange: (start: Date, end: Date) => void;
}

function calculateDates(preset: DatePreset): { startDate: Date; endDate: Date; label: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  switch (preset) {
    case "TODAY":
      return { startDate: startOfDay(now), endDate: endOfDay(now), label: "Today" };
    case "YESTERDAY": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { startDate: startOfDay(y), endDate: endOfDay(y), label: "Yesterday" };
    }
    case "THIS_WEEK": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(now.setDate(diff));
      return { startDate: startOfDay(monday), endDate: endOfDay(new Date()), label: "This Week" };
    }
    case "THIS_MONTH": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: startOfDay(firstDay), endDate: endOfDay(now), label: "This Month" };
    }
    case "LAST_MONTH": {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: startOfDay(firstDay), endDate: endOfDay(lastDay), label: "Last Month" };
    }
    case "CUSTOM":
    default:
      return { startDate: startOfDay(now), endDate: endOfDay(now), label: "Custom Range" };
  }
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRange] = useState<DateRangeState>(() => {
    const dates = calculateDates("TODAY");
    return {
      preset: "TODAY",
      ...dates,
    };
  });

  const setPreset = (preset: DatePreset) => {
    const dates = calculateDates(preset);
    setRange({
      preset,
      ...dates,
    });
  };

  const setCustomRange = (start: Date, end: Date) => {
    setRange({
      preset: "CUSTOM",
      startDate: start,
      endDate: end,
      label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
    });
  };

  return (
    <DateRangeContext.Provider value={{ range, setPreset, setCustomRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error("useDateRange must be used within a DateRangeProvider");
  }
  return context;
}

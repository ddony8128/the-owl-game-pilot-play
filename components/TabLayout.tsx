"use client";

import type { ReactNode } from "react";

export type TabKey = string;

export type TabDefinition = {
  key: TabKey;
  label: string;
};

type Props = {
  tabs: TabDefinition[];
  activeKey: TabKey;
  onChange: (key: TabKey) => void;
  children: ReactNode;
};

export function TabLayout({ tabs, activeKey, onChange, children }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab.key === activeKey
                ? "bg-amber-400 text-zinc-950"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto pt-1">{children}</div>
    </div>
  );
}

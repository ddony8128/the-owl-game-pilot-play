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

// 폰 탭 바. 탭 버튼은 손가락 터치 기준 최소 44px 높이(Iteration 5 접근성) + role/aria 로 스크린리더에 탭임을 알린다.
// ITER6 A — 탭이 한 줄에 안 들어가면(마피아 거래 단계 7개) 가로 스크롤로 숨기지 않고 두 줄로 감싼다(정보·규칙 탭이 화면 밖으로 밀리던 문제).
export function TabLayout({ tabs, activeKey, onChange, children }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div
        role="tablist"
        aria-label="화면 탭"
        className="mb-3 flex flex-wrap gap-1.5 pb-1"
      >
        {tabs.map((tab) => {
          const selected = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`${tab.label} 탭`}
              data-testid={`tab-${tab.key}`}
              className={`min-h-11 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "bg-amber-400 text-zinc-950"
                  : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              }`}
              onClick={() => onChange(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto pt-1">{children}</div>
    </div>
  );
}

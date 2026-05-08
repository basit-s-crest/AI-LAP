"use client";

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { cn } from "@/lib/cn";

export interface TabItem {
  key: string;
  label: string;
  content: React.ReactNode;
}

export function Tabs({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <TabGroup className={className}>
      <TabList className="mb-[22px] flex w-fit gap-0.5 rounded-[10px] bg-[#EDE7DC] p-1">
        {items.map((t) => (
          <Tab
            key={t.key}
            className={({ selected }) =>
              cn(
                "rounded-[7px] px-[18px] py-[7px] text-[13px] font-semibold outline-none transition-all",
                selected
                  ? "bg-card text-ink shadow-[0_1px_4px_rgba(60,50,40,0.1)]"
                  : "text-mid hover:text-ink"
              )
            }
          >
            {t.label}
          </Tab>
        ))}
      </TabList>
      <TabPanels>
        {items.map((t) => (
          <TabPanel key={t.key} className="animate-fadeIn focus:outline-none">
            {t.content}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
}

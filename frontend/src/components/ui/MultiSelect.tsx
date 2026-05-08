"use client";

import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import { ChevronDown, X } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/cn";
import type { SelectOption } from "./Select";

export interface MultiSelectProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  className,
}: MultiSelectProps) {
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  const labels = options.filter((o) => value.includes(o.value)).map((o) => o.label);

  return (
    <Menu as="div" className={cn("relative", className)}>
      <MenuButton className="flex w-full items-center justify-between rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3.5 py-2.5 text-left text-[13.5px] outline-none focus:border-sage">
        <span className={cn(!labels.length && "text-dim")}>
          {labels.length ? labels.join(", ") : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-dim" />
      </MenuButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <MenuItems className="absolute z-[300] mt-1 max-h-56 w-full overflow-auto rounded-[9px] border border-line bg-card py-1 shadow-soft focus:outline-none">
          {options.map((opt) => (
            <MenuItem key={opt.value}>
              {({ focus }) => (
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-left text-[13px]",
                    focus && "bg-[#EDE7DC]"
                  )}
                  onClick={() => toggle(opt.value)}
                >
                  <span className="flex-1">{opt.label}</span>
                  {value.includes(opt.value) ? <X className="h-3 w-3" /> : null}
                </button>
              )}
            </MenuItem>
          ))}
        </MenuItems>
      </Transition>
    </Menu>
  );
}

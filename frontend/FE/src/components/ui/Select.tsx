"use client";

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select…",
  className,
  disabled,
}: SelectProps) {
  const selected = options.find((o) => o.value === value);
  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className={cn("relative", className)}>
        <ListboxButton
          className={cn(
            "flex w-full items-center justify-between rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3.5 py-2.5 text-left text-[13.5px] text-ink outline-none focus:border-sage focus:shadow-[0_0_0_3px_#EBF5EC]",
            disabled && "opacity-50"
          )}
        >
          <span className={cn(!selected && "text-dim")}>{selected?.label ?? placeholder}</span>
          <ChevronDown className="h-4 w-4 text-dim" aria-hidden />
        </ListboxButton>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <ListboxOptions
            transition
            className="absolute z-[300] mt-1 max-h-60 w-full overflow-auto rounded-[9px] border border-line bg-card py-1 shadow-soft focus:outline-none"
          >
            {options.map((opt) => (
              <ListboxOption
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-[13px] data-[focus]:bg-[#EDE7DC] data-[disabled]:opacity-40"
              >
                {({ selected: sel }) => (
                  <>
                    <span className="flex-1">{opt.label}</span>
                    {sel ? <Check className="h-4 w-4 text-sage" /> : null}
                  </>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}

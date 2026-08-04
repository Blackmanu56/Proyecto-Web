"use client";

import { cn } from "@/lib/utils";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check,ChevronDown } from "lucide-react";
import * as React from "react";

type ToolbarSelectOption = {
  value: string;
  label: string;
  icon?: React.ElementType;
};

type ToolbarSelectTone = {
  trigger: string;
  icon: string;
  content: string;
  itemFocus: string;
  selected: string;
  check: string;
  chevron: string;
};

interface ToolbarSelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: ToolbarSelectOption[];
  triggerIcon: React.ElementType;
  tone?: ToolbarSelectTone;
  minWidth?: string;
}

const defaultTone: ToolbarSelectTone = {
  trigger: "border-[#3B82F6]/25 hover:border-[#3B82F6]/60 focus-visible:border-[#3B82F6] focus-visible:ring-[#3B82F6]/20 data-[state=open]:border-[#3B82F6]/70 data-[state=open]:ring-[#3B82F6]/20",
  icon: "bg-[#3B82F6]/15 text-[#60A5FA] ring-[#3B82F6]/20",
  content: "border-[#3B82F6]/30",
  itemFocus: "focus:bg-[#3B82F6]/10",
  selected: "data-[state=checked]:bg-[#3B82F6]/12 data-[state=checked]:text-[#BFDBFE]",
  check: "text-[#60A5FA]",
  chevron: "text-[#60A5FA]",
};

function ToolbarSelect({
  label,
  value,
  onValueChange,
  options,
  triggerIcon: TriggerIcon,
  tone = defaultTone,
  minWidth = "min-w-[140px]",
}: ToolbarSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{label}</label>
      <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger
          className={cn(
            "group flex h-10 items-center justify-between gap-2 rounded-xl border bg-[var(--bg)] py-2 pl-2 pr-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] outline-none transition-all duration-200 focus-visible:ring-2",
            minWidth,
            tone.trigger
          )}
          aria-label={label}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1", tone.icon)}>
              <TriggerIcon size={14} />
            </span>
            <SelectPrimitive.Value />
          </span>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180", tone.chevron)} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            align="start"
            className={cn(
              "z-50 max-h-72 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border bg-[var(--panel)] p-1.5 shadow-[var(--shadow-lg)] ring-1 ring-white/5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              tone.content
            )}
          >
            <SelectPrimitive.Viewport className="max-h-64 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
              {options.map(option => {
                const OptionIcon = option.icon;
                return (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className={cn(
                      "relative flex h-9 w-full cursor-pointer select-none items-center gap-2 rounded-xl px-2.5 pr-8 text-sm text-[var(--text)] outline-none transition-colors duration-150 whitespace-nowrap data-[state=checked]:font-bold data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                      tone.itemFocus,
                      tone.selected
                    )}
                  >
                    {OptionIcon && <OptionIcon size={14} className="shrink-0 opacity-85" />}
                    <SelectPrimitive.ItemText><span className="whitespace-nowrap">{option.label}</span></SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-2 flex h-5 w-5 items-center justify-center">
                      <Check size={14} className={tone.check} strokeWidth={2.6} />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                );
              })}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

export { ToolbarSelect };
export type { ToolbarSelectTone };

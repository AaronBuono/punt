import { type ButtonHTMLAttributes, type KeyboardEvent } from "react";

type BetSide = 0 | 1;

type BetOption = {
  value: BetSide;
  label: string;
  accent: "yes" | "no";
  disabled?: boolean;
};

type BetToggleGroupProps = {
  options: BetOption[];
  selected: BetSide | null;
  onChange: (next: BetSide | null) => void;
  className?: string;
};

const BASE_CLASSES = "rounded-md px-3 py-2 text-sm font-semibold transition border focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20";
const GREY_CLASSES = "border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:bg-white/10";
const YES_SELECTED_CLASSES = "border-transparent bg-emerald-500 text-gray-900 shadow-[0_0_15px_rgba(34,197,94,0.4)]";
const YES_IDLE_ACCENT_CLASSES = "border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 hover:border-emerald-400/60";
const NO_SELECTED_CLASSES = "border-transparent bg-[#b91c1c] text-white shadow-[0_0_18px_rgba(185,28,28,0.45)]";
const NO_IDLE_ACCENT_CLASSES = "border-[#b91c1c]/50 bg-[#7f1d1d]/40 text-[#fecaca] hover:bg-[#991b1b]/50 hover:border-[#dc2626]/60";

const buildClasses = (accent: "yes" | "no", selected: boolean, disabled?: boolean) => {
  if (disabled && !selected) {
    return `${BASE_CLASSES} ${GREY_CLASSES} opacity-50 cursor-not-allowed`;
  }
  if (!selected) {
    // Default to grey, but allow subtle accent hint on hover.
    const accentHover = accent === "yes" ? YES_IDLE_ACCENT_CLASSES : NO_IDLE_ACCENT_CLASSES;
    return `${BASE_CLASSES} ${GREY_CLASSES} ${disabled ? "" : accentHover}`.trim();
  }
  if (accent === "yes") {
    return `${BASE_CLASSES} ${YES_SELECTED_CLASSES}`;
  }
  return `${BASE_CLASSES} ${NO_SELECTED_CLASSES}`;
};

export function BetToggleGroup({ options, selected, onChange, className }: BetToggleGroupProps) {
  return (
    <div className={className ?? "grid grid-cols-2 gap-2"}>
      {options.map(option => {
        const isSelected = selected === option.value;
        const buttonClasses = buildClasses(option.accent, isSelected, option.disabled);
        const handleClick: ButtonHTMLAttributes<HTMLButtonElement>["onClick"] = event => {
          event.preventDefault();
          if (option.disabled) return;
          onChange(isSelected ? null : option.value);
        };
        const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
          if (option.disabled) return;
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            onChange(isSelected ? null : option.value);
          }
        };
        return (
          <button
            key={option.value}
            type="button"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            disabled={option.disabled}
            className={buttonClasses}
            aria-pressed={isSelected}
            aria-label={option.label}
            data-selected={isSelected ? "true" : "false"}
            data-accent={option.accent}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export type { BetSide, BetOption, BetToggleGroupProps };

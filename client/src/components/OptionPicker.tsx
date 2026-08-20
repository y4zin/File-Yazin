import { Check, ChevronDown, X } from "lucide-react";
import { useId, useState } from "react";

export type PickerOption = { value: string; label: string; detail?: string };

type Props = {
  label?: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  compact?: boolean;
  ariaLabel?: string;
};

export function OptionPicker({ label, value, options, onChange, compact = false, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];
  return <div className={`option-picker ${compact ? "compact" : ""}`}>
    {label && <span>{label}</span>}
    <button type="button" aria-label={ariaLabel ?? label} aria-haspopup="dialog" onClick={() => setOpen(true)}><b>{selected?.label}</b><ChevronDown size={16} /></button>
    {open && <div className="choice-overlay" onMouseDown={() => setOpen(false)}><div className="choice-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId} onMouseDown={(event) => event.stopPropagation()}><button className="choice-close" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button><h3 id={headingId}>{label ?? "Choose an option"}</h3><div className="choice-list">{options.map((option) => <button className={option.value === value ? "selected" : ""} type="button" key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}><span className="choice-radio">{option.value === value && <Check size={14} />}</span><span><b>{option.label}</b>{option.detail && <small>{option.detail}</small>}</span></button>)}</div></div></div>}
  </div>;
}

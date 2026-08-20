import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

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
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const close = () => { setOpen(false); window.requestAnimationFrame(() => triggerRef.current?.focus()); };
  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLButtonElement>(".choice-list .selected, .choice-close")?.focus());
  }, [open]);
  return <div className={`option-picker ${compact ? "compact" : ""}`}>
    {label && <span>{label}</span>}
    <button ref={triggerRef} type="button" aria-label={ariaLabel ?? label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined} onClick={() => setOpen(true)}><b>{selected?.label}</b><ChevronDown size={16} /></button>
    {open && <div className="choice-overlay" onMouseDown={close}><div ref={dialogRef} id={dialogId} className="choice-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId} onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") close(); }}><button className="choice-close" aria-label="Close" onClick={close}><X size={18} /></button><h3 id={headingId}>{label ?? "Choose an option"}</h3><div className="choice-list">{options.map((option) => <button className={option.value === value ? "selected" : ""} type="button" key={option.value} onClick={() => { onChange(option.value); close(); }}><span className="choice-radio">{option.value === value && <Check size={14} />}</span><span><b>{option.label}</b>{option.detail && <small>{option.detail}</small>}</span></button>)}</div></div></div>}
  </div>;
}

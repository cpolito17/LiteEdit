import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

type UiButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "neutral" | "accent" | "danger";
};

export const UiButton = forwardRef<HTMLButtonElement, UiButtonProps>(function UiButton(
  { className = "", tone = "neutral", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`ui-button ui-button-${tone} ${className}`.trim()}
      type={type}
      {...props}
    />
  );
});

type TooltipProps = {
  label: string;
  children: ReactNode;
};

export function Tooltip({ label, children }: TooltipProps) {
  return (
    <span className="tooltip-wrap">
      <span className="tooltip-content" role="tooltip">
        {label}
      </span>
      {children}
    </span>
  );
}

type PopoverProps = {
  label: string;
  content: ReactNode;
};

export function Popover({ label, content }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <span className="popover-wrap">
      <UiButton
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((visible) => !visible)}
      >
        {label}
      </UiButton>
      {open ? (
        <span
          id={popoverId}
          className="popover-content"
          role="dialog"
          aria-label={`${label} details`}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

export type TabOption = {
  id: string;
  label: string;
};

type TabsProps = {
  options: readonly TabOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
};

export function Tabs({ options, value, onChange, ariaLabel }: TabsProps) {
  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (options.length < 2) {
      return;
    }

    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowDown" &&
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : (index + direction + options.length) % options.length;
    const next = options[nextIndex];
    if (next) {
      onChange(next.id);
      document.getElementById(`tab-${next.id}`)?.focus();
    }
  }

  return (
    <div className="panel-tabs" role="tablist" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            id={`tab-${option.id}`}
            className={`panel-tab${selected ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${option.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

type SliderFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
};

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: SliderFieldProps) {
  const id = useId();

  return (
    <div className="field-group">
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        <span className="field-value" aria-live="polite">
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        className="ui-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

type NumericFieldProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
};

export function NumericField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: NumericFieldProps) {
  const id = useId();

  return (
    <div className="field-group numeric-field-group">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="numeric-input-wrap">
        <input
          id={id}
          className="numeric-input"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? <span className="numeric-suffix">{suffix}</span> : null}
      </div>
    </div>
  );
}

type DialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function Dialog({ open, title, children, footer, onClose }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    panelRef.current?.querySelector<HTMLElement>("button, input, [tabindex='0']")?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          <UiButton className="dialog-close" aria-label="Close dialog" onClick={onClose}>
            ×
          </UiButton>
        </div>
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

type ToastProps = {
  message: string;
  tone?: "info" | "success" | "warning";
};

export function Toast({ message, tone = "info" }: ToastProps) {
  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
      <span className="status-led" aria-hidden="true" />
      {message}
    </div>
  );
}

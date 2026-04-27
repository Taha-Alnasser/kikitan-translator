import * as React from "react";
import { IconButton } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

type Size = "sm" | "md" | "lg" | "xl";

const sizeCls: Record<Size, string> = {
  sm: "w-6/12 max-w-md",
  md: "w-8/12 max-w-2xl",
  lg: "w-10/12 max-w-4xl",
  xl: "w-11/12 max-w-6xl",
};

type Props = {
  open: boolean;
  onClose?: () => void;
  size?: Size;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** When true, the close button is hidden (e.g. updater progress). */
  hideClose?: boolean;
  /** When true, clicking the backdrop does NOT close the modal. */
  persistent?: boolean;
  /** Optional z-index override. */
  z?: number;
};

export default function Modal({ open, onClose, size = "md", title, children, hideClose, persistent, z = 30 }: Props) {
  return (
    <div
      className={`transition-all w-full h-screen flex backdrop-blur-sm justify-center items-center absolute ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{ zIndex: z, background: "var(--tk-backdrop)" }}
      onClick={() => { if (!persistent && onClose) onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex flex-col rounded-xl border ${sizeCls[size]} max-h-[85vh] overflow-hidden`}
        style={{ borderColor: "var(--tk-border)", background: "var(--tk-surface-elevated)", color: "var(--tk-text)" }}
      >
        {(title || (!hideClose && onClose)) && (
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--tk-border)" }}>
            <div className="font-semibold text-sm">{title}</div>
            {!hideClose && onClose && (
              <IconButton size="small" onClick={onClose} aria-label="Close">
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </div>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

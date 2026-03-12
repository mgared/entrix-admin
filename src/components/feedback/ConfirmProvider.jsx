import React, { useCallback, useMemo, useState } from "react";
import { ConfirmContext } from "./useConfirm";
import "./feedback.css";

export default function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setState({
        title: opts?.title || "Are you sure?",
        message: opts?.message || "",
        confirmText: opts?.confirmText || "Confirm",
        cancelText: opts?.cancelText || "Cancel",
        tone: opts?.tone || "danger", // "danger" | "neutral"
        resolve,
      });
    });
  }, []);

  const api = useMemo(() => ({ confirm }), [confirm]);

  const close = (val) => {
    if (!state) return;
    state.resolve(val);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={api}>
      {children}

      {state && (
        <div
          className="fb-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div className="fb-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="fb-dialog-title">{state.title}</div>
            {state.message ? (
              <div className="fb-dialog-msg">{state.message}</div>
            ) : null}

            <div className="fb-dialog-actions">
              <button
                type="button"
                className="fb-btn fb-btn-ghost"
                onClick={() => close(false)}
              >
                {state.cancelText}
              </button>

              <button
                type="button"
                className={`fb-btn ${
                  state.tone === "danger" ? "fb-btn-danger" : "fb-btn-primary"
                }`}
                onClick={() => close(true)}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

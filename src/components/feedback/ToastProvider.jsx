import React, { useCallback, useMemo, useRef, useState } from "react";
import { ToastContext } from "./useToast";
import "./feedback.css";

function uid() {
  return (
    (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) clearTimeout(tm);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    ({ type = "info", title = "", message = "", duration = 2600 } = {}) => {
      const id = uid();
      const t = { id, type, title, message };
      setToasts((prev) => [...prev, t]);

      const tm = setTimeout(() => remove(id), duration);
      timers.current.set(id, tm);

      return id;
    },
    [remove]
  );

  const api = useMemo(
    () => ({
      push,
      remove,
      success: (message, opts) => push({ type: "success", message, ...opts }),
      error: (message, opts) => push({ type: "error", message, ...opts }),
      info: (message, opts) => push({ type: "info", message, ...opts }),
      warning: (message, opts) => push({ type: "warning", message, ...opts }),
    }),
    [push, remove]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        className="fb-toast-stack"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((t) => (
          <div key={t.id} className={`fb-toast fb-${t.type}`}>
            <div className="fb-toast-body">
              {t.title ? <div className="fb-toast-title">{t.title}</div> : null}
              {t.message ? (
                <div className="fb-toast-msg">{t.message}</div>
              ) : null}
            </div>

            <button
              className="fb-toast-x"
              type="button"
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

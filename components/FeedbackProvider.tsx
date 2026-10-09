"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import "./FeedbackProvider.css";

type DialogTone = "default" | "danger";
type SnackbarTone = "info" | "success" | "error";

type AlertOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  tone?: DialogTone;
};

type ConfirmOptions = AlertOptions & {
  cancelText?: string;
};

type SnackbarOptions = {
  message: string;
  tone?: SnackbarTone;
  duration?: number;
};

type DialogState = {
  kind: "alert" | "confirm";
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  tone: DialogTone;
  resolve: (value: boolean) => void;
};

type SnackbarState = SnackbarOptions & { id: number };

type FeedbackContextValue = {
  alert: (options: string | AlertOptions) => Promise<void>;
  confirm: (options: string | ConfirmOptions) => Promise<boolean>;
  snackbar: (options: string | SnackbarOptions) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function normalizeAlert(options: string | AlertOptions): Required<AlertOptions> {
  const value = typeof options === "string" ? { message: options } : options;
  return {
    title: value.title ?? "알림",
    message: value.message,
    confirmText: value.confirmText ?? "확인",
    tone: value.tone ?? "default",
  };
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [snackbars, setSnackbars] = useState<SnackbarState[]>([]);
  const nextSnackbarId = useRef(0);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const closeDialog = useCallback((result: boolean) => {
    setDialog((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  const alert = useCallback((options: string | AlertOptions) => {
    const value = normalizeAlert(options);
    return new Promise<void>((resolve) => {
      setDialog({
        kind: "alert",
        ...value,
        cancelText: "",
        resolve: () => resolve(),
      });
    });
  }, []);

  const confirm = useCallback((options: string | ConfirmOptions) => {
    const raw = typeof options === "string" ? { message: options } : options;
    const value = normalizeAlert(raw);
    return new Promise<boolean>((resolve) => {
      setDialog({
        kind: "confirm",
        ...value,
        cancelText: raw.cancelText ?? "취소",
        resolve,
      });
    });
  }, []);

  const snackbar = useCallback((options: string | SnackbarOptions) => {
    const value = typeof options === "string" ? { message: options } : options;
    const id = ++nextSnackbarId.current;
    const item: SnackbarState = {
      id,
      message: value.message,
      tone: value.tone ?? "info",
      duration: value.duration ?? 3500,
    };
    setSnackbars((current) => [...current.slice(-2), item]);
    window.setTimeout(() => {
      setSnackbars((current) => current.filter((entry) => entry.id !== id));
    }, item.duration);
  }, []);

  useEffect(() => {
    if (!dialog) return;
    confirmButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dialog, closeDialog]);

  return (
    <FeedbackContext.Provider value={{ alert, confirm, snackbar }}>
      {children}
      {dialog ? (
        <div className="feedback-backdrop" role="presentation" onMouseDown={() => closeDialog(false)}>
          <section
            className={`feedback-dialog ${dialog.tone === "danger" ? "danger" : ""}`}
            role={dialog.kind === "alert" ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            aria-describedby="feedback-dialog-message"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="feedback-dialog-mark" aria-hidden="true">{dialog.tone === "danger" ? "!" : "i"}</span>
            <h2 id="feedback-dialog-title">{dialog.title}</h2>
            <p id="feedback-dialog-message">{dialog.message}</p>
            <div className="feedback-dialog-actions">
              {dialog.kind === "confirm" ? (
                <button type="button" className="secondary" onClick={() => closeDialog(false)}>{dialog.cancelText}</button>
              ) : null}
              <button ref={confirmButtonRef} type="button" className={dialog.tone === "danger" ? "danger" : "primary"} onClick={() => closeDialog(true)}>{dialog.confirmText}</button>
            </div>
          </section>
        </div>
      ) : null}
      <div className="feedback-snackbar-region" aria-live="polite" aria-atomic="false">
        {snackbars.map((item) => (
          <div className={`feedback-snackbar ${item.tone ?? "info"}`} key={item.id} role={item.tone === "error" ? "alert" : "status"}>
            <span aria-hidden="true">{item.tone === "success" ? "✓" : item.tone === "error" ? "!" : "i"}</span>
            <p>{item.message}</p>
            <button type="button" aria-label="알림 닫기" onClick={() => setSnackbars((current) => current.filter((entry) => entry.id !== item.id))}>×</button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback은 FeedbackProvider 안에서 사용해야 합니다.");
  return context;
}

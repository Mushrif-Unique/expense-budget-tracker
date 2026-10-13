import { useEffect, useRef } from 'react';

export default function Modal({ title, children, busy = false, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50 sm:p-8">
    <div className="mb-6 flex items-start justify-between gap-4"><h2 id="modal-title" className="text-xl font-semibold">{title}</h2><button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose} className="rounded px-2 text-xl disabled:opacity-40">×</button></div>
    {children}
  </dialog>;
}

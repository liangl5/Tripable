import LoadingProgressBar from "./LoadingProgressBar.jsx";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  onCancel,
  onConfirm,
  loading = false,
  tone = "danger",
  cancelText = "Cancel",
  showLoadingBar = false
}) {
  if (!open) return null;

  const confirmButtonClassName =
    tone === "danger"
      ? "bg-[#baf59c] text-[#1e4840] hover:bg-[#a7ee84]"
      : "bg-amber-500 text-white hover:bg-amber-600";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-5 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        {loading && showLoadingBar ? (
          <>
            <div className="absolute inset-0 rounded-2xl bg-white/60" />
            <LoadingProgressBar indeterminate className="absolute left-0 top-0 rounded-t-2xl" />
          </>
        ) : null}
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-60"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${confirmButtonClassName}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
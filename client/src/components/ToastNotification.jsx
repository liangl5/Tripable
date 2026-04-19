export default function ToastNotification({
  message,
  onDismiss,
  actionLabel = null,
  onAction = null,
  actionClassName = "text-base font-semibold text-sky-200 underline hover:text-white"
}) {
  return (
    <div className="inline-flex items-center gap-4 rounded-xl bg-ink px-5 py-3 text-base font-semibold text-white shadow-lg">
      <span>{message}</span>
      {actionLabel && onAction ? (
        <button type="button" className={actionClassName} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        className="ml-auto text-white/70 hover:text-white"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}
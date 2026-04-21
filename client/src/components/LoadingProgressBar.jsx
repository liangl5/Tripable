export default function LoadingProgressBar({
  progress = 0,
  className = "",
  indeterminate = false
}) {
  return (
    <div className={`h-1.5 w-full overflow-hidden bg-slate-200 ${className}`.trim()}>
      {indeterminate ? (
        <>
          <style>{`@keyframes tripableLoadingProgress {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(30%); }
            100% { transform: translateX(200%); }
          }`}</style>
          <div
            className="h-full w-2/5 bg-[#5cb3ed]"
            style={{ animation: "tripableLoadingProgress 1.2s ease-in-out infinite" }}
          />
        </>
      ) : (
        <div
          className="h-full bg-[#5cb3ed] transition-all"
          style={{ width: `${progress}%` }}
        />
      )}
    </div>
  );
}
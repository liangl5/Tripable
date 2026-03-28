function IconThumbUp({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M8.5 10.5V20a2 2 0 0 0 2 2h5.4a2 2 0 0 0 1.9-1.4l1.6-4.8a2 2 0 0 0-1.9-2.6H14V7.8c0-2-1.6-3.6-3.6-3.6-.6 0-1 .4-1 1v2.3c0 1.1-.4 2.1-1.1 3l-.2.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5 10.5h3.5V22H5a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconThumbDown({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M8.5 13.5V4a2 2 0 0 1 2-2h5.4a2 2 0 0 1 1.9 1.4l1.6 4.8a2 2 0 0 1-1.9 2.6H14v5.4c0 2-1.6 3.6-3.6 3.6-.6 0-1-.4-1-1v-2.3c0-1.1-.4-2.1-1.1-3l-.2-.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5 13.5h3.5V2H5a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconNeutral({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M7 12h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function VoteButtons({ score, userVote, onVote, compact = false }) {
  const outerClassName = compact ? "flex items-center gap-1.5" : "flex items-center gap-2";
  const voteButtonClassName = compact
    ? "inline-flex h-8 w-8 items-center justify-center rounded-full transition"
    : "inline-flex h-9 w-9 items-center justify-center rounded-full transition";
  const scoreWrapClassName = compact
    ? "flex min-w-14 items-center justify-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 shadow-soft"
    : "flex min-w-16 items-center justify-center gap-2 rounded-full bg-white/70 px-3 py-1 shadow-card";
  const neutralButtonClassName = compact
    ? "inline-flex h-6 w-6 items-center justify-center rounded-full transition"
    : "inline-flex h-7 w-7 items-center justify-center rounded-full transition";
  const iconClassName = compact ? "h-4 w-4" : "h-5 w-5";
  const neutralIconClassName = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className={outerClassName}>
      <button
        type="button"
        onClick={() => onVote(userVote === 1 ? 0 : 1)}
        aria-label={userVote === 1 ? "Remove upvote" : "Upvote"}
        className={`${voteButtonClassName} ${
          userVote === 1
            ? "bg-moss text-white shadow"
            : "bg-mist text-slate-600 hover:bg-moss/15 hover:text-moss"
        }`}
      >
        <IconThumbUp className={iconClassName} />
      </button>
      <div className={scoreWrapClassName}>
        <span className="text-sm font-semibold text-ink">{score}</span>
        <button
          type="button"
          onClick={() => onVote(0)}
          aria-label="No preference"
          className={`${neutralButtonClassName} ${
            userVote === 0 ? "bg-slate-200 text-ink" : "bg-transparent text-slate-500 hover:bg-slate-200/70"
          }`}
        >
          <IconNeutral className={neutralIconClassName} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onVote(userVote === -1 ? 0 : -1)}
        aria-label={userVote === -1 ? "Remove downvote" : "Downvote"}
        className={`${voteButtonClassName} ${
          userVote === -1
            ? "bg-coral text-white shadow"
            : "bg-mist text-slate-600 hover:bg-coral/15 hover:text-coral"
        }`}
      >
        <IconThumbDown className={iconClassName} />
      </button>
    </div>
  );
}

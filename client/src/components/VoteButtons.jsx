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

export default function VoteButtons({ upvotes = 0, downvotes = 0, userVote, onVote, compact = false, layout = "horizontal" }) {
  const safeUpvotes = Number.isFinite(Number(upvotes)) ? Number(upvotes) : 0;
  const safeDownvotes = Number.isFinite(Number(downvotes)) ? Number(downvotes) : 0;
  return (
    <div className={compact ? "flex items-center gap-1.5" : "flex items-center gap-2"}>
      <button
        type="button"
        onClick={() => onVote(userVote === 1 ? 0 : 1)}
        aria-label={userVote === 1 ? "Remove upvote" : "Upvote"}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
          userVote === 1
            ? "border-moss bg-moss text-white shadow"
            : "border-slate-200 bg-white text-slate-600 hover:border-moss/40 hover:bg-moss/10 hover:text-moss"
        }`}
      >
        <IconThumbUp className={compact ? "h-4 w-4" : "h-5 w-5"} />
        <span>{safeUpvotes}</span>
      </button>
      <button
        type="button"
        onClick={() => onVote(userVote === -1 ? 0 : -1)}
        aria-label={userVote === -1 ? "Remove downvote" : "Downvote"}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
          userVote === -1
            ? "border-coral bg-coral text-white shadow"
            : "border-slate-200 bg-white text-slate-600 hover:border-coral/40 hover:bg-coral/10 hover:text-coral"
        }`}
      >
        <IconThumbDown className={compact ? "h-4 w-4" : "h-5 w-5"} />
        <span>{safeDownvotes}</span>
      </button>
    </div>
  );
}

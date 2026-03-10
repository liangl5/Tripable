export default function VoteButtons({ score, userVote, onVote }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onVote(1)}
        className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
          userVote === 1 ? "bg-moss text-white" : "bg-mist text-slate-500 hover:bg-moss/20"
        }`}
      >
        +1
      </button>
      <span className="text-sm font-semibold text-ink">{score}</span>
      <button
        type="button"
        onClick={() => onVote(-1)}
        className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
          userVote === -1 ? "bg-coral text-white" : "bg-mist text-slate-500 hover:bg-coral/20"
        }`}
      >
        -1
      </button>
    </div>
  );
}

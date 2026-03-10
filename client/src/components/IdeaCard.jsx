import VoteButtons from "./VoteButtons.jsx";

export default function IdeaCard({ idea, onVote }) {
  return (
    <div className="rounded-2xl bg-white/95 p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-lg font-semibold text-ink">{idea.title}</h4>
          <p className="mt-2 text-sm text-slate-500">{idea.description}</p>
          <p className="mt-3 text-xs font-semibold text-slateblue">
            {idea.location} · {idea.category || "General"}
          </p>
        </div>
        <VoteButtons score={idea.voteScore} userVote={idea.userVote} onVote={onVote} />
      </div>
      <p className="mt-4 text-xs text-slate-400">Submitted by {idea.submittedBy}</p>
    </div>
  );
}

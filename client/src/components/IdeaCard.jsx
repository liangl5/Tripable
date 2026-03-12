import VoteButtons from "./VoteButtons.jsx";
import { formatRelativeTime } from "../lib/timeFormat.js";

export default function IdeaCard({ idea, onVote }) {
  return (
    <div className="idea-block rounded-2xl bg-white/95 p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-lg font-semibold text-ink">{idea.title}</h4>
          <p className="mt-2 text-sm text-slate-500">{idea.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slateblue">
            <span>{idea.location}</span>
            <span className="text-slate-300">·</span>
            <span>{idea.category || "General"}</span>
            {typeof idea.voteCount === "number" ? (
              <>
                <span className="text-slate-300">·</span>
                <span>{idea.voteCount} voters</span>
              </>
            ) : null}
          </div>
        </div>
        <VoteButtons score={idea.voteScore} userVote={idea.userVote} onVote={onVote} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-400">Submitted by {idea.submittedBy}</p>
        <p className="text-xs text-slate-400">{formatRelativeTime(idea.createdAt)}</p>
      </div>
    </div>
  );
}

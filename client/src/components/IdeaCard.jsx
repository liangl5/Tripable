import VoteButtons from "./VoteButtons.jsx";
import { formatRelativeTime } from "../lib/timeFormat.js";

export default function IdeaCard({ idea, onVote, onDeleteRequest, isOwner, onFocusLocation }) {
  const canDelete = isOwner || idea.isCreator;
  const showActivityImage = idea.entryType === "activity" && Boolean(idea.photoUrl);

  return (
    <div className="idea-block rounded-2xl bg-white/95 p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {showActivityImage ? (
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-mist">
              <img
                src={idea.photoUrl}
                alt={idea.title}
                className="h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold text-ocean">
                {idea.listName}
              </span>
              <span className="rounded-full bg-mist px-3 py-1 text-[11px] font-semibold text-slate-500">
                {idea.entryType === "place" ? "Place" : "Activity"}
              </span>
            </div>
            <h4 className="mt-3 text-lg font-semibold text-ink">{idea.title}</h4>
            {idea.description ? <p className="mt-2 text-sm text-slate-500">{idea.description}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slateblue">
              <span>{idea.locationLabel || idea.location || "Flexible plan"}</span>
              {typeof idea.voteCount === "number" ? (
                <>
                  <span className="text-slate-300">|</span>
                  <span>{idea.voteCount} voters</span>
                </>
              ) : null}
              {idea.recommendationSource ? (
                <>
                  <span className="text-slate-300">|</span>
                  <span>Suggested</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <VoteButtons score={idea.voteScore} userVote={idea.userVote} onVote={onVote} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-400">Submitted by {idea.submittedBy}</p>
        <div className="flex items-center gap-3">
          {idea.hasMapLocation && onFocusLocation ? (
            <button
              type="button"
              onClick={() => onFocusLocation(idea.mapQuery)}
              className="text-xs font-semibold text-ocean transition hover:text-ocean/80"
            >
              Show on map
            </button>
          ) : null}
          <p className="text-xs text-slate-400">{formatRelativeTime(idea.createdAt)}</p>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDeleteRequest(idea.id, idea.title)}
              className="text-xs font-semibold text-red-600 transition hover:text-red-700"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

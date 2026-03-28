import VoteButtons from "./VoteButtons.jsx";
import { formatRelativeTime } from "../lib/timeFormat.js";

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4.167 13.75V15.833H6.25L13.854 8.229L11.771 6.146L4.167 13.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10.729 7.188L12.813 9.271"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12.396 3.958C12.791 3.562 13.328 3.34 13.888 3.34C14.448 3.34 14.985 3.562 15.38 3.958C15.776 4.353 15.998 4.89 15.998 5.45C15.998 6.01 15.776 6.547 15.38 6.942L13.854 8.469L11.771 6.385L13.297 4.859L12.396 3.958Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function IdeaCard({
  idea,
  onVote,
  onDeleteRequest,
  onEditRequest,
  isOwner,
  onFocusLocation,
  parentLabel
}) {
  const canDelete = isOwner || idea.isCreator;
  const canEdit = isOwner || idea.isCreator;
  const showActivityImage = idea.entryType === "activity" && Boolean(idea.photoUrl);
  const detailLabel = idea.locationLabel || idea.location || "";
  const metaLabel = ["Submitted by " + idea.submittedBy, formatRelativeTime(idea.createdAt)].filter(Boolean).join(" | ");

  return (
    <div className="idea-block rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {showActivityImage ? (
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-mist">
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
              {idea.listName ? (
                <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold text-ocean">
                  {idea.listName}
                </span>
              ) : null}
              {parentLabel ? (
                <span className="rounded-full bg-[#FFF4E5] px-3 py-1 text-[11px] font-semibold text-[#B76600]">
                  {parentLabel}
                </span>
              ) : null}
            </div>

            <h4 className="mt-2 text-lg font-semibold text-ink">{idea.title}</h4>
            {detailLabel && detailLabel !== idea.title ? (
              <p className="mt-1 text-sm text-slate-500">{detailLabel}</p>
            ) : null}
            {idea.description ? <p className="mt-1 text-sm text-slate-500">{idea.description}</p> : null}
          </div>
        </div>

        <VoteButtons score={idea.voteScore} userVote={idea.userVote} onVote={onVote} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">{metaLabel}</p>
        <div className="flex flex-wrap items-center gap-3">
          {idea.hasMapLocation && onFocusLocation ? (
            <button
              type="button"
              onClick={() => onFocusLocation(idea.mapQuery)}
              className="text-xs font-semibold text-ocean transition hover:text-ocean/80"
            >
              Show on map
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={() => onEditRequest?.(idea)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-ink"
            >
              <EditIcon />
              Edit
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={() => onDeleteRequest(idea.id, idea.title)}
              className="text-xs font-semibold text-red-600 transition hover:text-red-700"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

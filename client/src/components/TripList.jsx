import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTripStore } from "../hooks/useTripStore.js";
import { formatDateRange } from "../lib/timeFormat.js";
import ShareTripModal from "./ShareTripModal.jsx";

const ROLE_LABELS = {
  owner: "Owner",
  editor: "Editor",
  suggestor: "Suggestor"
};

const getInitials = (name) => {
  const value = String(name || "").trim();
  if (!value) return "?";
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-cyan-100 text-cyan-700",
  "bg-blue-100 text-blue-700",
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700"
];

const getAvatarColor = (id) => {
  const value = String(id || "");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function TripList({ trips, selectionMode = false, openOnCardClick = false }) {
  const duplicateTrip = useTripStore((state) => state.duplicateTrip);
  const updateTripMeta = useTripStore((state) => state.updateTripMeta);
  const deleteTrip = useTripStore((state) => state.deleteTrip);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renameTrip, setRenameTrip] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameNotice, setRenameNotice] = useState(null);
  const [renameNoticeAt, setRenameNoticeAt] = useState(0);
  const [renameUndoNotice, setRenameUndoNotice] = useState("");
  const [renameUndoNoticeAt, setRenameUndoNoticeAt] = useState(0);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameUndoSaving, setRenameUndoSaving] = useState(false);
  const [shareTrip, setShareTrip] = useState(null);
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteStatusAt, setInviteStatusAt] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteNotice, setDeleteNotice] = useState(null);
  const [deleteNoticeAt, setDeleteNoticeAt] = useState(0);
  const [copyNotice, setCopyNotice] = useState(null);
  const [copyNoticeAt, setCopyNoticeAt] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const [copyStatusAt, setCopyStatusAt] = useState(0);
  const [selectedTripIds, setSelectedTripIds] = useState(() => new Set());
  const [hiddenTripIds, setHiddenTripIds] = useState(() => new Set());
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [shareMenuOpenId, setShareMenuOpenId] = useState(null);
  const [shareMenuPinnedId, setShareMenuPinnedId] = useState(null);
  const [lastShareTrip, setLastShareTrip] = useState(null);
  const menuRef = useRef(null);
  const deleteTimeoutsRef = useRef(new Map());

  useEffect(() => {
    if (!menuOpenId) return undefined;
    const handleClickOutside = (event) => {
      if (!event.target.closest("[data-trip-menu]")) {
        setMenuOpenId(null);
        setShareMenuOpenId(null);
        setShareMenuPinnedId(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpenId(null);
        setShareMenuOpenId(null);
        setShareMenuPinnedId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpenId]);

  useEffect(() => {
    if (!inviteStatus) return undefined;
    const timer = setTimeout(() => setInviteStatus(""), 10000);
    return () => clearTimeout(timer);
  }, [inviteStatus]);

  useEffect(() => {
    if (!renameNotice) return undefined;
    const timer = setTimeout(() => setRenameNotice(null), 10000);
    return () => clearTimeout(timer);
  }, [renameNotice]);

  useEffect(() => {
    if (!renameUndoNotice) return undefined;
    const timer = setTimeout(() => setRenameUndoNotice(""), 10000);
    return () => clearTimeout(timer);
  }, [renameUndoNotice]);

  useEffect(() => {
    if (!deleteNotice) return undefined;
    const timer = setTimeout(() => setDeleteNotice(null), 10000);
    return () => clearTimeout(timer);
  }, [deleteNotice]);

  useEffect(() => {
    if (!copyNotice) return undefined;
    const timer = setTimeout(() => setCopyNotice(null), 10000);
    return () => clearTimeout(timer);
  }, [copyNotice]);

  useEffect(() => {
    if (!copyStatus) return undefined;
    const timer = setTimeout(() => setCopyStatus(""), 10000);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  useEffect(() => {
    if (selectionMode) return undefined;
    setSelectedTripIds(new Set());
    return undefined;
  }, [selectionMode]);

  useEffect(() => {
    if (!renameUndoSaving) return undefined;
    const timer = setTimeout(() => setRenameUndoSaving(false), 2000);
    return () => clearTimeout(timer);
  }, [renameUndoSaving]);

  const handleRenameSave = async () => {
    if (!renameTrip?.id) return;
    const nextName = String(renameValue || "").trim();
    if (!nextName) return;
    if (nextName === (renameTrip.name || "")) {
      setRenameTrip(null);
      return;
    }
    try {
      const previousName = renameTrip.name || "Trip";
      const tripId = renameTrip.id;
      setRenameSaving(true);
      await updateTripMeta(tripId, { name: nextName });
      setRenameTrip(null);
      setRenameNotice({
        tripId,
        from: previousName,
        to: nextName
      });
      setRenameNoticeAt(Date.now());
    } catch (error) {
      console.error("Failed to rename trip", error);
    } finally {
      setRenameSaving(false);
    }
  };

  const showInviteStatus = (message) => {
    setInviteStatus(message);
    setInviteStatusAt(Date.now());
  };

  const showRenameUndoNotice = (message) => {
    setRenameUndoNotice(message);
    setRenameUndoNoticeAt(Date.now());
  };

  const showActionUndone = () => {
    showRenameUndoNotice("Action undone");
  };

  const showDeleteNotice = (trip) => {
    setDeleteNotice({
      id: trip.id,
      name: trip.name || "Trip"
    });
    setDeleteNoticeAt(Date.now());
  };

  const showCopyNotice = (trip) => {
    if (!trip?.id) return;
    setCopyNotice({
      id: trip.id,
      name: trip.name || "Trip"
    });
    setCopyNoticeAt(Date.now());
  };

  const showCopyStatus = (message) => {
    setCopyStatus(message);
    setCopyStatusAt(Date.now());
  };

  const scheduleTripDelete = (trip) => {
    if (!trip?.id) return;
    setDeleteConfirm(null);
    setHiddenTripIds((current) => new Set([...current, trip.id]));
    showDeleteNotice(trip);

    const timeoutId = setTimeout(async () => {
      try {
        await deleteTrip(trip.id);
      } catch (error) {
        console.error("Failed to delete trip", error);
        setHiddenTripIds((current) => {
          const next = new Set(current);
          next.delete(trip.id);
          return next;
        });
        showInviteStatus("Unable to delete trip.");
      } finally {
        deleteTimeoutsRef.current.delete(trip.id);
      }
    }, 10000);

    deleteTimeoutsRef.current.set(trip.id, timeoutId);
  };

  const undoTripDelete = (tripId) => {
    if (!tripId) return;
    const timeoutId = deleteTimeoutsRef.current.get(tripId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      deleteTimeoutsRef.current.delete(tripId);
    }
    setHiddenTripIds((current) => {
      const next = new Set(current);
      next.delete(tripId);
      return next;
    });
    setDeleteNotice(null);
    showActionUndone();
  };

  const undoTripCopy = async (tripId) => {
    if (!tripId) return;
    try {
      await deleteTrip(tripId);
      setHiddenTripIds((current) => {
        const next = new Set(current);
        next.delete(tripId);
        return next;
      });
      setCopyNotice(null);
      showActionUndone();
    } catch (error) {
      console.error("Failed to undo trip copy", error);
      showInviteStatus("Unable to undo copy.");
    }
  };

  const visibleTrips = useMemo(
    () => trips.filter((trip) => !hiddenTripIds.has(trip.id)),
    [trips, hiddenTripIds]
  );

  const toggleTripSelection = (tripId) => {
    setSelectedTripIds((current) => {
      const next = new Set(current);
      if (next.has(tripId)) {
        next.delete(tripId);
      } else {
        next.add(tripId);
      }
      return next;
    });
  };

  const handleBulkCopy = async () => {
    const ids = Array.from(selectedTripIds);
    if (!ids.length) return;
    setDuplicateLoading(true);
    try {
      showCopyStatus("Creating copy...");
      for (const tripId of ids) {
        const trip = trips.find((item) => item.id === tripId);
        if (!trip) continue;
        const copyName = `Copy of ${trip.name || "Trip"}`;
        const newTrip = await duplicateTrip(tripId, { name: copyName });
        showCopyNotice({ id: newTrip.id, name: trip.name || "Trip" });
      }
      setSelectedTripIds(new Set());
    } catch (error) {
      console.error("Unable to duplicate trips", error);
      showInviteStatus("Unable to create copy.");
    } finally {
      setCopyStatus("");
      setDuplicateLoading(false);
    }
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedTripIds);
    if (!ids.length) return;
    ids.forEach((tripId) => {
      const trip = trips.find((item) => item.id === tripId);
      if (trip) {
        scheduleTripDelete(trip);
      }
    });
    setSelectedTripIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedTripIds.size === visibleTrips.length) {
      setSelectedTripIds(new Set());
      return;
    }
    setSelectedTripIds(new Set(visibleTrips.map((trip) => trip.id)));
  };

  if (!visibleTrips.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
        <p className="text-lg font-semibold">No trips yet</p>
        <p className="mt-2 text-sm text-slate-500">Create a trip to start collaborating.</p>
      </div>
    );
  }

  return (
    <>
      {selectionMode ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
          <span>{selectedTripIds.size} selected</span>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-ink hover:border-ocean hover:text-ocean"
          >
            {selectedTripIds.size === visibleTrips.length ? "Deselect all" : "Select all"}
          </button>
          <button
            type="button"
            onClick={handleBulkCopy}
            disabled={!selectedTripIds.size || duplicateLoading}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-ink hover:border-ocean hover:text-ocean disabled:opacity-60"
          >
            {duplicateLoading ? "Making copy..." : "Make copies"}
          </button>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={!selectedTripIds.size}
            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-coral hover:bg-rose-100 disabled:opacity-60"
          >
            Delete selected
          </button>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleTrips.map((trip) => (
          <div
            key={trip.id}
            className={`relative overflow-visible rounded-3xl border border-slate-200 bg-white/90 transition ${
              selectionMode ? "cursor-pointer hover:border-ocean" : ""
            } ${
              !selectionMode && openOnCardClick ? "cursor-pointer hover:bg-slate-100" : ""
            } ${selectionMode && selectedTripIds.has(trip.id) ? "border-ocean ring-2 ring-ocean/30" : ""}`}
            onClickCapture={
              selectionMode
                ? (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleTripSelection(trip.id);
                  }
                : undefined
            }
            onClick={
              !selectionMode && openOnCardClick
                ? () => {
                    window.location.href = `/trips/${trip.id}`;
                  }
                : undefined
            }
            role={selectionMode ? "button" : undefined}
            aria-pressed={selectionMode ? selectedTripIds.has(trip.id) : undefined}
          >
            <div className="h-40 rounded-t-3xl bg-gradient-to-br from-sky-100 via-indigo-100 to-rose-100" />
            <div
              className="absolute right-4 top-4"
              ref={menuRef}
              data-trip-menu
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setMenuOpenId(menuOpenId === trip.id ? null : trip.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-white/40 hover:text-ink"
                aria-label="Trip actions"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpenId(menuOpenId === trip.id ? null : trip.id);
                }}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="12" cy="19" r="1.6" />
                </svg>
              </button>
              {menuOpenId === trip.id && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                    onClick={() => {
                      setMenuOpenId(null);
                      setRenameTrip(trip);
                      setRenameValue(trip.name || "");
                    }}
                  >
                    <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                    Rename
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                    onClick={async () => {
                      setMenuOpenId(null);
                      setDuplicateLoading(true);
                      try {
                        showCopyStatus("Creating copy...");
                        const copyName = `Copy of ${trip.name || "Trip"}`;
                        const newTrip = await duplicateTrip(trip.id, { name: copyName });
                        showCopyNotice({ id: newTrip.id, name: trip.name || "Trip" });
                      } catch (error) {
                        console.error("Unable to duplicate trip", error);
                        showInviteStatus("Unable to create copy.");
                      } finally {
                        setCopyStatus("");
                        setDuplicateLoading(false);
                      }
                    }}
                  >
                    <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <rect x="2" y="2" width="13" height="13" rx="2" />
                    </svg>
                    {duplicateLoading ? "Making copy..." : "Make a copy"}
                  </button>
                  <div
                    className="group relative"
                    onMouseEnter={() => setShareMenuOpenId(trip.id)}
                    onMouseLeave={() => {
                      if (shareMenuPinnedId !== trip.id) {
                        setShareMenuOpenId(null);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-slate-100"
                      onClick={() => {
                        setShareMenuOpenId(trip.id);
                        setShareMenuPinnedId(trip.id);
                      }}
                    >
                      <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                        <path d="M16 6l-4-4-4 4" />
                        <path d="M12 2v13" />
                      </svg>
                      Share
                      <svg className="ml-auto h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M7 5l5 5-5 5" />
                      </svg>
                    </button>
                    {shareMenuOpenId === trip.id && (
                      <div
                        className="absolute left-full top-1/2 z-10 -ml-1 w-44 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg"
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                          onClick={() => {
                            setMenuOpenId(null);
                            setShareMenuOpenId(null);
                            setShareMenuPinnedId(null);
                            setShareTrip(trip);
                            setInviteStatus("");
                            setInviteStatusAt(0);
                          }}
                        >
                        <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        Share
                      </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                          onClick={async () => {
                            const link = `${window.location.origin}/trips/${trip.id}/invite`;
                            await navigator.clipboard.writeText(link);
                            setMenuOpenId(null);
                            setShareMenuOpenId(null);
                            setShareMenuPinnedId(null);
                            showInviteStatus("Link copied");
                            setLastShareTrip(trip);
                          }}
                        >
                        <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <rect x="2" y="2" width="13" height="13" rx="2" />
                        </svg>
                        Copy link
                      </button>
                    </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-coral hover:bg-rose-50"
                    onClick={() => {
                      setMenuOpenId(null);
                      setDeleteConfirm(trip);
                    }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M6 6l1 14h10l1-14" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                    Delete trip
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div>
                <h3 className="truncate text-xl font-semibold tracking-tight text-ink">
                  {trip.destination?.name || trip.destination?.label
                    ? `${trip.name} at ${trip.destination.name || trip.destination.label}`
                    : trip.name}
                </h3>
                {trip.startDate && trip.endDate ? (
                  <p className="mt-2 text-sm text-slate-500">{formatDateRange(trip.startDate, trip.endDate)}</p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-500">
                  {trip.createdAt || trip.created_at
                    ? new Date(trip.createdAt || trip.created_at).toLocaleDateString()
                    : ""}
                </div>
                <div className="relative flex items-center">
                  {(() => {
                    const allMembers = trip.members && trip.members.length
                      ? trip.members
                      : [{ id: trip.createdById || "owner", name: trip.ownerDisplayName || "Trip owner" }];
                    const maxVisible = 5;
                    const visibleMembers = allMembers.slice(0, maxVisible);
                    const overflowCount = Math.max(allMembers.length - maxVisible, 0);
                    const memberNames = allMembers
                      .map((member) => member.name || "Traveler")
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <>
                        <div className="group relative flex items-center">
                          {visibleMembers.map((member, index) => (
                            <div
                              key={member.id}
                              className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white text-xs font-semibold ${
                                index === 0 ? "z-10" : "-ml-2"
                              } ${member.photoUrl ? "bg-slate-100 text-slate-600" : getAvatarColor(member.id)}`}
                              style={{ zIndex: 10 - index }}
                            >
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt={member.name || "Traveler"} className="h-full w-full object-cover" />
                              ) : (
                                <span>{getInitials(member.name)}</span>
                              )}
                            </div>
                          ))}
                          {overflowCount > 0 && (
                            <div
                              className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white bg-slate-200 text-xs font-semibold text-slate-700 -ml-2"
                              style={{ zIndex: 10 - visibleMembers.length }}
                              title={`${overflowCount} more`}
                            >
                              +{overflowCount}
                            </div>
                          )}
                          {memberNames ? (
                            <div className="pointer-events-none absolute left-0 bottom-12 z-20 hidden w-max max-w-[260px] rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white shadow-lg group-hover:block">
                              {memberNames}
                              <span className="absolute left-4 top-full h-0 w-0 border-x-8 border-x-transparent border-t-8 border-t-ink" />
                            </div>
                          ) : null}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              {openOnCardClick ? null : (
                <Link
                  to={`/trips/${trip.id}`}
                  className="w-full rounded-full bg-ink px-4 py-2 text-center text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                  onClick={(event) => event.stopPropagation()}
                >
                  View Trip
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {renameTrip ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => setRenameTrip(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">Rename trip</h3>
            <input
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleRenameSave();
                }
              }}
              placeholder="Trip name"
              disabled={renameSaving}
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setRenameTrip(null)}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600"
                disabled={renameSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSave}
                className="rounded-xl bg-ocean px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-70"
                disabled={renameSaving}
              >
                {renameSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ShareTripModal
        open={Boolean(shareTrip)}
        trip={shareTrip}
        onClose={() => setShareTrip(null)}
        onLinkCopied={(trip) => {
          showInviteStatus("Link copied");
          setLastShareTrip(trip);
        }}
      />

      {deleteConfirm ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">Delete trip?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete &quot;{deleteConfirm.name || "this trip"}&quot;? This cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    scheduleTripDelete(deleteConfirm);
                  } catch (error) {
                    console.error("Failed to delete trip", error);
                  }
                }}
                className="rounded-xl bg-coral px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {(() => {
        const notifications = [
          inviteStatus
            ? {
                key: "invite",
                ts: inviteStatusAt,
                node: (
                  <div className="inline-flex items-center gap-4 rounded-xl bg-ink px-5 py-3 text-base font-semibold text-white shadow-lg">
                    <span>{inviteStatus}</span>
                    {lastShareTrip ? (
                      <button
                        type="button"
                        className="text-base font-semibold text-sky-200 underline hover:text-white"
                        onClick={() => {
                          setShareTrip(lastShareTrip);
                          setInviteStatus("");
                          setInviteStatusAt(0);
                        }}
                      >
                        Manage access
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ml-auto text-white/70 hover:text-white"
                      onClick={() => {
                        setInviteStatus("");
                        setInviteStatusAt(0);
                      }}
                      aria-label="Dismiss notification"
                    >
                      ✕
                    </button>
                  </div>
                )
              }
            : null,
          renameNotice
            ? {
                key: "rename",
                ts: renameNoticeAt || 0,
                node: (
                  <div className="inline-flex items-center gap-4 rounded-xl bg-ink px-5 py-3 text-base font-semibold text-white shadow-lg">
                    <span>
                      “{renameNotice.from}” renamed to “{renameNotice.to}”
                    </span>
                    {renameSaving && !renameUndoSaving ? (
                      <span className="text-base font-semibold text-white/80">Saving...</span>
                    ) : null}
                    <button
                      type="button"
                      className="text-base font-semibold text-sky-200 underline hover:text-white"
                      onClick={async () => {
                        try {
                          setRenameUndoSaving(true);
                          await updateTripMeta(renameNotice.tripId, { name: renameNotice.from });
                          showRenameUndoNotice("Action undone");
                        } catch (error) {
                          console.error("Failed to undo rename", error);
                        } finally {
                          setRenameNotice(null);
                        }
                      }}
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      className="ml-auto text-white/70 hover:text-white"
                      onClick={() => setRenameNotice(null)}
                      aria-label="Dismiss notification"
                    >
                      ✕
                    </button>
                  </div>
                )
              }
            : null,
          renameUndoNotice
            ? {
                key: "rename-undo",
                ts: renameUndoNoticeAt,
                node: (
                  <div className="inline-flex items-center gap-4 rounded-xl bg-ink px-5 py-3 text-base font-semibold text-white shadow-lg">
                    <span>{renameUndoNotice}</span>
                    <button
                      type="button"
                      className="ml-auto text-white/70 hover:text-white"
                      onClick={() => {
                        setRenameUndoNotice("");
                        setRenameUndoNoticeAt(0);
                      }}
                      aria-label="Dismiss notification"
                    >
                      ✕
                    </button>
                  </div>
                )
              }
            : null
          ,
          deleteNotice
            ? {
                key: "delete",
                ts: deleteNoticeAt,
                node: (
                  <div className="inline-flex items-center gap-4 rounded-xl bg-ink px-5 py-3 text-base font-semibold text-white shadow-lg">
                    <span>“{deleteNotice.name}” deleted</span>
                    <button
                      type="button"
                      className="text-base font-semibold text-sky-200 underline hover:text-white"
                      onClick={() => undoTripDelete(deleteNotice.id)}
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      className="ml-auto text-white/70 hover:text-white"
                      onClick={() => setDeleteNotice(null)}
                      aria-label="Dismiss notification"
                    >
                      ✕
                    </button>
                  </div>
                )
              }
            : null
          ,
          copyNotice
            ? {
                key: "copy",
                ts: copyNoticeAt,
                node: (
                  <div className="inline-flex items-center gap-4 rounded-xl bg-ink px-5 py-3 text-base font-semibold text-white shadow-lg">
                    <span>Copy of “{copyNotice.name}” created</span>
                    <button
                      type="button"
                      className="text-base font-semibold text-sky-200 underline hover:text-white"
                      onClick={() => undoTripCopy(copyNotice.id)}
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      className="ml-auto text-white/70 hover:text-white"
                      onClick={() => setCopyNotice(null)}
                      aria-label="Dismiss notification"
                    >
                      ✕
                    </button>
                  </div>
                )
              }
            : null
          ,
          copyStatus
            ? {
                key: "copy-status",
                ts: copyStatusAt,
                node: (
                  <div className="inline-flex items-center gap-4 rounded-xl bg-ink px-5 py-3 text-base font-semibold text-white shadow-lg">
                    <span>{copyStatus}</span>
                    <button
                      type="button"
                      className="ml-auto text-white/70 hover:text-white"
                      onClick={() => setCopyStatus("")}
                      aria-label="Dismiss notification"
                    >
                      ✕
                    </button>
                  </div>
                )
              }
            : null
        ]
          .filter(Boolean)
          .sort((a, b) => b.ts - a.ts);

        const latest = notifications[0];

        return latest ? (
          <div className="fixed bottom-4 right-6 z-[70]">{latest.node}</div>
        ) : null;
      })()}
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTripStore } from "../hooks/useTripStore.js";
import { useUserProfile } from "../App";
import { formatDateRange } from "../lib/timeFormat.js";
import { getAvatarColor } from "../lib/avatarColors.js";
import ShareTripModal from "./ShareTripModal.jsx";
import planeImage from "../../imgs/plane.png";

const ROLE_LABELS = {
  owner: "Owner",
  editor: "Editor",
  suggestor: "Suggestor"
};

const getInitials = (name) => {
  const value = String(name || "").trim();
  if (!value) return "?";
  const parts = value.split(/\s+/).filter(Boolean);
  return parts[0][0].toUpperCase();
};

export default function TripList({
  trips,
  selectionMode = false,
  openOnCardClick = false,
  onCardClick = null,
  starredTripIds = new Set(),
  onToggleStar = null,
  emptyStateTitle = "No trips yet",
  emptyStateDescription = "Create a trip to start collaborating."
}) {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const duplicateTrip = useTripStore((state) => state.duplicateTrip);
  const updateTripMeta = useTripStore((state) => state.updateTripMeta);
  const deleteTrip = useTripStore((state) => state.deleteTrip);
  const leaveTrip = useTripStore((state) => state.leaveTrip);
  const setFlashNotice = useTripStore((state) => state.setFlashNotice);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renameTrip, setRenameTrip] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameNotice, setRenameNotice] = useState(null);
  const [renameNoticeAt, setRenameNoticeAt] = useState(0);
  const [renameSaving, setRenameSaving] = useState(false);
  const [shareTrip, setShareTrip] = useState(null);
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteStatusAt, setInviteStatusAt] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteNotice, setDeleteNotice] = useState(null);
  const [deleteNoticeAt, setDeleteNoticeAt] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [copyStatusAt, setCopyStatusAt] = useState(0);
  const [selectedTripIds, setSelectedTripIds] = useState(() => new Set());
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [shareMenuOpenId, setShareMenuOpenId] = useState(null);
  const [shareMenuPinnedId, setShareMenuPinnedId] = useState(null);
  const [lastShareTrip, setLastShareTrip] = useState(null);
  const menuRef = useRef(null);
  const toastTsRef = useRef(0);

  const nextToastTs = () => {
    const now = Date.now();
    const next = now > toastTsRef.current ? now : toastTsRef.current + 1;
    toastTsRef.current = next;
    return next;
  };

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
    if (!deleteNotice) return undefined;
    const timer = setTimeout(() => setDeleteNotice(null), 10000);
    return () => clearTimeout(timer);
  }, [deleteNotice]);

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
      setRenameNoticeAt(nextToastTs());
    } catch (error) {
      console.error("Failed to rename trip", error);
    } finally {
      setRenameSaving(false);
    }
  };

  const showInviteStatus = (message) => {
    setInviteStatus(message);
    setInviteStatusAt(nextToastTs());
  };

  const showDeleteNotice = (trip) => {
    setFlashNotice({
      kind: "trip_deleted",
      name: trip.name || "Trip",
      message: "deleted",
      createdAt: Date.now()
    });
    setInviteStatus("");
    setDeleteNotice(null);
    setRenameNotice(null);
    showCopyStatus(`“${trip.name || "Trip"}” deleted`);
  };

  const showCopyNotice = (trip) => {
    if (!trip?.id) return;
    setFlashNotice({
      kind: "trip_copied",
      name: trip.name || "Trip",
      message: "created",
      createdAt: Date.now()
    });
  };

  const showCopyStatus = (message) => {
    setCopyStatus(message);
    setCopyStatusAt(nextToastTs());
  };

  const renderNotifications = () => {
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
      deleteNotice
        ? {
            key: "delete",
            ts: deleteNoticeAt,
            node: (
              <div className="inline-flex items-center gap-4 rounded-xl bg-ink px-5 py-3 text-base font-semibold text-white shadow-lg">
                <span>“{deleteNotice.name}” deleted</span>
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
        : null,
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
    return latest ? <div className="fixed bottom-4 right-6 z-[70]">{latest.node}</div> : null;
  };

  const visibleTrips = useMemo(() => trips, [trips]);

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
    void Promise.all(
      ids.map(async (tripId) => {
        const trip = trips.find((item) => item.id === tripId);
        if (!trip) return;
        try {
          await deleteTrip(trip.id);
          showDeleteNotice(trip);
        } catch (error) {
          console.error("Failed to delete trip", error);
          showInviteStatus("Unable to delete trip.");
        }
      })
    );
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
      <>
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-[#1e4840]">
          <p className="text-lg font-semibold">{emptyStateTitle}</p>
          <p className="mt-2 text-sm text-[#1e4840]/75">{emptyStateDescription}</p>
        </div>
        {renderNotifications()}
      </>
    );
  }

  return (
    <>
      {selectionMode ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#1e4840]">
          <span>{selectedTripIds.size} selected</span>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1e4840] hover:border-[#1e4840] hover:text-[#1e4840]"
          >
            {selectedTripIds.size === visibleTrips.length ? "Deselect all" : "Select all"}
          </button>
          <button
            type="button"
            onClick={handleBulkCopy}
            disabled={!selectedTripIds.size || duplicateLoading}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#1e4840] hover:border-[#1e4840] hover:text-[#1e4840] disabled:opacity-60"
          >
            {duplicateLoading ? "Making copy..." : "Make copy"}
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
          (() => {
            const isStarred = starredTripIds?.has(trip.id);
            return (
          <div
            key={trip.id}
            className={`group relative overflow-visible rounded-3xl bg-white/90 transition ${
              selectionMode ? "cursor-pointer" : ""
            } ${
              !selectionMode && (openOnCardClick || onCardClick) ? "cursor-pointer hover:bg-slate-50" : ""
            } ${selectionMode && selectedTripIds.has(trip.id) ? "ring-2 ring-[#1e4840]/30" : ""}`}
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
              !selectionMode && (openOnCardClick || onCardClick)
                ? () => {
                    if (onCardClick) {
                      onCardClick(trip.id);
                    } else {
                      navigate(`/trips/${trip.id}`);
                    }
                  }
                : undefined
            }
            role={selectionMode ? "button" : undefined}
            aria-pressed={selectionMode ? selectedTripIds.has(trip.id) : undefined}
          >
            <div className="h-40 overflow-hidden rounded-t-3xl bg-[#dcead7]">
              <img src={planeImage} alt="" className="h-full w-full object-cover object-right" aria-hidden="true" />
            </div>
            <div className="pointer-events-none absolute left-0 right-0 top-0 h-20 rounded-t-3xl bg-gradient-to-b from-[#1e4840]/20 via-[#1e4840]/10 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            {!selectionMode ? (
              <div
                className="absolute left-4 right-4 top-3 flex items-center justify-between"
                ref={menuRef}
                data-trip-menu
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                {onToggleStar ? (
                  <button
                    type="button"
                    className={`flex h-9 w-9 items-center justify-center rounded-full bg-transparent hover:bg-white/40 ${
                      isStarred ? "text-[#1e4840]" : "text-[#1e4840]"
                    }`}
                    aria-label={isStarred ? "Unstar trip" : "Star trip"}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleStar(trip.id);
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill={isStarred ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="m12 3 2.9 6.4 6.9.6-5.2 4.5 1.6 6.8L12 17.9 5.8 21.3l1.6-6.8L2.2 10l6.9-.6L12 3z" />
                    </svg>
                  </button>
                ) : <span />}
                <div className="relative">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[#1e4840] hover:bg-white/40 hover:text-[#1e4840]"
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
                      className="absolute right-0 top-full mt-0 w-56 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg"
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                    >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[#1e4840] hover:bg-slate-100"
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
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[#1e4840] hover:bg-slate-100"
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
                  {trip.userRole === "owner" || trip.userRole === "editor" ? (
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
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[#1e4840] hover:bg-slate-100"
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
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[#1e4840] hover:bg-slate-100"
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
                  ) : null}
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left ${
                      trip.canDelete === false ? "text-[#1e4840] hover:bg-slate-100" : "text-[#1e4840] hover:bg-slate-100"
                    }`}
                    onClick={() => {
                      setMenuOpenId(null);
                      setDeleteConfirm({
                        ...trip,
                        actionType: trip.canDelete === false ? "leave" : "delete"
                      });
                    }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M6 6l1 14h10l1-14" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                    {trip.canDelete === false ? "Leave trip" : "Delete trip"}
                  </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-4 px-6 pt-6 pb-3">
              <div>
                <h3 className="truncate text-xl font-semibold tracking-tight text-[#1e4840]">
                  {trip.destination?.name || trip.destination?.label
                    ? `${trip.name} at ${trip.destination.name || trip.destination.label}`
                    : trip.name}
                </h3>
                {trip.startDate && trip.endDate ? (
                  <p className="mt-2 text-sm text-[#1e4840]/75">{formatDateRange(trip.startDate, trip.endDate)}</p>
                ) : null}
                <p className="mt-2 text-sm font-semibold text-[#1e4840]/75">Owner: {trip.ownerDisplayName || "Trip owner"}</p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[#1e4840]/75">
                  {trip.createdAt || trip.created_at
                    ? new Date(trip.createdAt || trip.created_at).toLocaleDateString()
                    : ""}
                </div>
                <div className="relative flex items-center">
                  {(() => {
                    const allMembers = trip.members && trip.members.length
                      ? trip.members
                      : [{ id: trip.createdById || "owner", name: trip.ownerDisplayName || "Trip owner" }];
                    const sortedMembers = [...allMembers].sort((a, b) =>
                      String(a.name || "Traveler").localeCompare(String(b.name || "Traveler"), undefined, {
                        sensitivity: "base"
                      })
                    );
                    const maxVisible = 2;
                    const visibleMembers = sortedMembers.slice(0, maxVisible);
                    const overflowCount = Math.max(sortedMembers.length - maxVisible, 0);
                    const memberNames = sortedMembers
                      .map((member) => member.name || "Traveler")
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <>
                        <div className="group/member relative flex items-center">
                          {visibleMembers.map((member, index) => {
                            const isCurrentUser = profile?.id && member.id === profile.id;
                            const effectiveAvatarColor = member.avatarColor || (isCurrentUser ? profile.avatarColor : "");
                            return (
                            <div
                              key={member.id}
                              className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white text-xs font-semibold ${
                                index === 0 ? "z-10" : "-ml-2"
                              } ${effectiveAvatarColor || getAvatarColor(member.id)}`}
                              style={{ zIndex: 10 + index }}
                            >
                              <span>{getInitials(member.name)}</span>
                            </div>
                          );
                          })}
                          {overflowCount > 0 && (
                            <div
                              className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white bg-slate-200 text-xs font-semibold text-slate-700 -ml-2"
                              style={{ zIndex: 10 + visibleMembers.length }}
                              title={`${overflowCount} more`}
                            >
                              +{overflowCount}
                            </div>
                          )}
                          {memberNames && !selectionMode ? (
                            <div className="pointer-events-none absolute bottom-12 left-1/2 z-20 hidden w-max max-w-[260px] -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white shadow-lg group-hover/member:block">
                              {memberNames}
                              <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-8 border-x-transparent border-t-8 border-t-ink" />
                            </div>
                          ) : null}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

            </div>
          </div>
            );
          })()
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
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            {deleteLoading ? (
              <>
                <div className="absolute inset-0 rounded-2xl bg-white/60" />
                <div className="absolute left-0 top-0 h-1 w-full bg-slate-200">
                  <div className="auth-progress-bar" />
                </div>
              </>
            ) : null}
            <h3 className="text-lg font-semibold text-ink">
              {deleteConfirm.actionType === "leave" ? "Leave trip?" : "Delete trip?"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {deleteConfirm.actionType === "leave"
                ? `Leave \"${deleteConfirm.name || "this trip"}\"? You will need a new invite link to rejoin.`
                : `Delete \"${deleteConfirm.name || "this trip"}\"? This cannot be undone.`}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    setDeleteLoading(true);
                    if (deleteConfirm.actionType === "leave") {
                      await leaveTrip(deleteConfirm.id);
                      showInviteStatus("Left trip.");
                    } else {
                      await deleteTrip(deleteConfirm.id);
                      showDeleteNotice(deleteConfirm);
                    }
                    setDeleteConfirm(null);
                  } catch (error) {
                    if (deleteConfirm.actionType === "leave") {
                      console.error("Failed to leave trip", error);
                      showInviteStatus("Unable to leave trip.");
                    } else {
                      console.error("Failed to delete trip", error);
                      showInviteStatus("Unable to delete trip.");
                    }
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60 ${
                  deleteConfirm.actionType === "leave" ? "bg-amber-500 hover:bg-amber-600" : "bg-coral hover:bg-red-600"
                }`}
                disabled={deleteLoading}
              >
                {deleteConfirm.actionType === "leave" ? "Leave" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {renderNotifications()}
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { DAY_NAMES, addMonths, formatISO, monthKey, startOfMonth } from "../../lib/calendarHelpers.js";
import { isDeletedUserProfile } from "../../lib/userProfile.js";
import { buildUserNamesById, fetchUserProfilesByIds } from "../../lib/userProfiles.js";

export default function AvailabilityTab({ tab, tripId, userId, userRole, isActive, onReadyChange }) {
  const availabilityGreenRgb = "34, 197, 94";
  const availabilityMinAlpha = 0.16;
  const availabilityMaxAlpha = 0.78;
  const [startMonth, setStartMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null); // "select" | "deselect" | null
  const [isEditing, setIsEditing] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [availabilityData, setAvailabilityData] = useState({});
  const [userAvailability, setUserAvailability] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [availableUsersByDate, setAvailableUsersByDate] = useState({});
  const [hoverTooltip, setHoverTooltip] = useState({ visible: false, text: "", x: 0, y: 0 });
  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsSaving, setCommentsSaving] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentsTableReady, setCommentsTableReady] = useState(true);
  const [commentAuthorNamesById, setCommentAuthorNamesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [userSubmittedAt, setUserSubmittedAt] = useState(null);
  const [editStartSelectedDates, setEditStartSelectedDates] = useState(new Set());
  const [memberAvailabilityThreshold, setMemberAvailabilityThreshold] = useState(2);
  const canEditAvailability = true;
  const canEditCells = canEditAvailability && (!showHeatmap || isEditing);
  const canDeleteAnyComment = userRole === "owner";

  useEffect(() => {
    if (!isActive) return;
    onReadyChange?.(!loading);
  }, [isActive, loading, onReadyChange]);

  // Load user's current availability for this tab
  useEffect(() => {
    const loadAvailability = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("AvailabilityTabData")
          .select("date, isSelected, submittedAt")
          .eq("tabId", tab.id)
          .eq("userId", userId);

        if (data) {
          const dates = new Set(data.filter((d) => d.isSelected).map((d) => d.date.split("T")[0]));
          setSelectedDates(dates);

          // Check if user has submitted availability
          const submitted = data.find((d) => d.submittedAt);
          setUserSubmittedAt(submitted?.submittedAt);
          setShowHeatmap(!!submitted);
        }
      } catch (error) {
        console.error("Failed to load availability:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAvailability();
  }, [tab.id, userId]);

  // Load member-scoped availability data (trip members only)
  useEffect(() => {
    if (!showHeatmap) return;

    const loadAvailabilityData = async () => {
      try {
        const { data: tripData, error: tripError } = await supabase
          .from("Trip")
          .select("createdById")
          .eq("id", tripId)
          .single();
        if (tripError) throw tripError;

        const { data: tripMembers, error: memberError } = await supabase
          .from("TripMember")
          .select("userId")
          .eq("tripId", tripId);
        if (memberError) throw memberError;

        const memberIds = Array.from(
          new Set([tripData?.createdById, ...(tripMembers || []).map((member) => member.userId)].filter(Boolean))
        );

        if (memberIds.length === 0) {
          setAllUsers([]);
          setAvailabilityData({});
          setUserAvailability({});
          setAvailableUsersByDate({});
          return;
        }

        const { data, error: availabilityError } = await supabase
          .from("AvailabilityTabData")
          .select("date, userId")
          .eq("tabId", tab.id)
          .eq("isSelected", true);
        if (availabilityError) throw availabilityError;

        const participantIds = Array.from(
          new Set([
            ...memberIds,
            ...(data || []).map((entry) => entry.userId)
          ].filter(Boolean))
        );
        const userProfiles = await fetchUserProfilesByIds(participantIds);
        const activeProfiles = userProfiles.filter((profile) => !isDeletedUserProfile(profile));
        const activeUserIds = new Set(activeProfiles.map((profile) => profile.id));
        const availabilityRows = (data || []).filter((entry) => activeUserIds.has(entry.userId));
        const sortedProfiles = [...activeProfiles].sort((left, right) =>
          String(left.name || left.email || "").localeCompare(String(right.name || right.email || ""))
        );
        const userNameById = buildUserNamesById(sortedProfiles);
        setAllUsers(sortedProfiles);

        const counts = {};
        const byDateUserIds = {};
        availabilityRows.forEach(({ date, userId: uid }) => {
          const dateStr = date.split("T")[0];
          counts[dateStr] = (counts[dateStr] || 0) + 1;
          if (!byDateUserIds[dateStr]) byDateUserIds[dateStr] = [];
          byDateUserIds[dateStr].push(uid);
        });
        setAvailabilityData(counts);

        const byDateNames = {};
        Object.entries(byDateUserIds).forEach(([date, ids]) => {
          byDateNames[date] = ids
            .map((id) => userNameById[id] || "Traveler")
            .sort((a, b) => a.localeCompare(b));
        });
        setAvailableUsersByDate(byDateNames);

        const byUser = {};
        availabilityRows.forEach(({ userId: uid, date }) => {
          if (!byUser[uid]) byUser[uid] = [];
          byUser[uid].push(date.split("T")[0]);
        });
        setUserAvailability(byUser);
      } catch (error) {
        console.error("Failed to load availability data:", error);
      }
    };

    loadAvailabilityData();
  }, [showHeatmap, tab.id, tripId]);

  useEffect(() => {
    const loadComments = async () => {
      if (!showHeatmap) return;
      setCommentsLoading(true);
      setCommentsError("");
      try {
        const { data, error } = await supabase
          .from("AvailabilityTabComment")
          .select("id, tabId, userId, body, parentCommentId, createdAt, updatedAt")
          .eq("tabId", tab.id)
          .order("createdAt", { ascending: true });

        if (error) {
          const message = String(error.message || "");
          if (message.toLowerCase().includes("relation") || message.toLowerCase().includes("does not exist")) {
            setCommentsTableReady(false);
            setComments([]);
            return;
          }
          throw error;
        }

        setCommentsTableReady(true);
        setComments(data || []);

        const missingAuthorIds = Array.from(
          new Set(
            (data || [])
              .map((comment) => comment.userId)
              .filter((uid) => uid && !commentAuthorNamesById[uid])
          )
        );
        if (missingAuthorIds.length > 0) {
          const profiles = await fetchUserProfilesByIds(missingAuthorIds);
          setCommentAuthorNamesById((current) => ({
            ...current,
            ...buildUserNamesById(profiles)
          }));
        }
      } catch (error) {
        console.error("Failed to load availability comments:", error);
        setCommentsError("Failed to load comments.");
      } finally {
        setCommentsLoading(false);
      }
    };

    loadComments();
  }, [commentAuthorNamesById, showHeatmap, tab.id]);

  const month1 = startOfMonth(startMonth);
  const month2 = addMonths(startMonth, 1);
  const month1Label = useMemo(
    () => month1.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    [month1]
  );
  const month2Label = useMemo(
    () => month2.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    [month2]
  );
  const displayedDates = useMemo(() => {
    const dates = [];
    const cursor = new Date(startOfMonth(startMonth));
    const rangeEnd = new Date(addMonths(startOfMonth(startMonth), 2));
    rangeEnd.setDate(rangeEnd.getDate() - 1);

    while (cursor.getTime() <= rangeEnd.getTime()) {
      dates.push(formatISO(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }, [startMonth]);
  const maxMemberAvailabilityThreshold = Math.max(2, allUsers.length || 2);
  const effectiveMemberAvailabilityThreshold = Math.min(memberAvailabilityThreshold, maxMemberAvailabilityThreshold);
  const memberAvailabilityThresholdOptions = useMemo(() => {
    if (allUsers.length < 2) return [];
    return Array.from({ length: allUsers.length - 1 }, (_, index) => index + 2);
  }, [allUsers.length]);
  const visibleAvailabilityDates = useMemo(() => {
    return displayedDates.filter((date) => (availabilityData[date] || 0) >= effectiveMemberAvailabilityThreshold);
  }, [availabilityData, displayedDates, effectiveMemberAvailabilityThreshold]);
  const dateShadeByColumn = useMemo(() => {
    const shadeMap = {};
    let shade = "light";
    let previous = null;

    for (const date of visibleAvailabilityDates) {
      if (previous) {
        const prevDate = new Date(`${previous}T00:00:00`);
        prevDate.setDate(prevDate.getDate() + 1);
        const expectedNext = formatISO(prevDate);
        if (date !== expectedNext) {
          shade = shade === "light" ? "dark" : "light";
        }
      }

      shadeMap[date] = shade;
      previous = date;
    }

    return shadeMap;
  }, [visibleAvailabilityDates]);
  const maxAvailabilityCount = useMemo(() => {
    return Object.values(availabilityData).reduce((max, value) => Math.max(max, Number(value) || 0), 0);
  }, [availabilityData]);
  const userNamesById = useMemo(() => {
    return {
      ...buildUserNamesById(allUsers),
      ...commentAuthorNamesById
    };
  }, [allUsers, commentAuthorNamesById]);

  useEffect(() => {
    setMemberAvailabilityThreshold((current) => Math.min(current, maxMemberAvailabilityThreshold));
  }, [maxMemberAvailabilityThreshold]);

  useEffect(() => {
    const stopDrag = () => {
      setIsDragging(false);
      setDragMode(null);
    };
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    return () => {
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, []);

  const applyDateSelection = (dateStr, mode) => {
    if (!dateStr || !mode) return;
    setSelectedDates((current) => {
      const next = new Set(current);
      if (mode === "select") {
        next.add(dateStr);
      } else {
        next.delete(dateStr);
      }
      return next;
    });
  };

  const handleDatePointerDown = (event, dateStr) => {
    event.preventDefault();
    hideAvailabilityTooltip();
    if (!canEditCells || !dateStr) return;
    const shouldSelect = !selectedDates.has(dateStr);
    const nextMode = shouldSelect ? "select" : "deselect";
    setIsDragging(true);
    setDragMode(nextMode);
    applyDateSelection(dateStr, nextMode);
  };

  const handleDatePointerEnter = (dateStr) => {
    if (!canEditCells || !isDragging || !dragMode || !dateStr) return;
    hideAvailabilityTooltip();
    applyDateSelection(dateStr, dragMode);
  };

  const showAvailabilityTooltip = (event, dateStr) => {
    if (!dateStr || isDragging || Boolean(dragMode)) return;
    if (!showHeatmap) return;

    const names = availableUsersByDate[dateStr] || [];
    if (!names.length) {
      hideAvailabilityTooltip();
      return;
    }

    const text = names.join(", ");
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipOffset = 12;
    const y = Math.min(window.innerHeight - 24, Math.max(24, rect.top + rect.height / 2));

    setHoverTooltip({
      visible: true,
      text,
      x: rect.right + tooltipOffset,
      y
    });
  };

  const hideAvailabilityTooltip = () => {
    setHoverTooltip((current) => {
      if (!current.visible) return current;
      return { ...current, visible: false };
    });
  };

  const handleAvailabilityCellMouseLeave = (event) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof HTMLElement && nextTarget.closest("[data-availability-date-cell='true']")) {
      return;
    }
    hideAvailabilityTooltip();
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const now = new Date().toISOString();

      // Delete old entries
      await supabase.from("AvailabilityTabData").delete().eq("tabId", tab.id).eq("userId", userId);

      // Insert new entries
      const entriesToInsert = Array.from(selectedDates).map((dateStr) => ({
        id: crypto.randomUUID(),
        tabId: tab.id,
        userId,
        date: `${dateStr}T00:00:00Z`,
        isSelected: true,
        submittedAt: now,
        createdAt: now
      }));

      if (entriesToInsert.length > 0) {
        await supabase.from("AvailabilityTabData").insert(entriesToInsert);
      }

      setUserSubmittedAt(now);
      setShowHeatmap(true);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save availability:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditStartSelectedDates(new Set(selectedDates));
    setIsEditing(true);
    setShowHeatmap(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset selected dates to submitted dates
    if (userSubmittedAt) {
      setShowHeatmap(true);
    }
  };

  const handleResetEditSelection = () => {
    if (!isEditing) return;
    setSelectedDates(new Set(editStartSelectedDates));
  };

  const handleCommentSubmit = async () => {
    const body = commentDraft.trim();
    if (!body || commentsSaving || !commentsTableReady) return;

    setCommentsSaving(true);
    setCommentsError("");
    const now = new Date().toISOString();
    const optimistic = {
      id: crypto.randomUUID(),
      tabId: tab.id,
      userId,
      body,
      parentCommentId: null,
      createdAt: now
    };

    try {
      setComments((current) => [optimistic, ...current]);
      setCommentDraft("");

      const { error } = await supabase.from("AvailabilityTabComment").insert([
        {
          id: optimistic.id,
          tabId: tab.id,
          userId,
          body,
          parentCommentId: null,
          createdAt: now
        }
      ]);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to post comment:", error);
      setComments((current) => current.filter((comment) => comment.id !== optimistic.id));
      setCommentsError("Could not post comment.");
      setCommentDraft(body);
    } finally {
      setCommentsSaving(false);
    }
  };

  const handleReplySubmit = async (parentCommentId) => {
    const body = replyDraft.trim();
    if (!body || commentsSaving || !commentsTableReady || !parentCommentId) return;

    setCommentsSaving(true);
    setCommentsError("");
    const now = new Date().toISOString();
    const optimistic = {
      id: crypto.randomUUID(),
      tabId: tab.id,
      userId,
      body,
      parentCommentId,
      createdAt: now
    };

    try {
      setComments((current) => [...current, optimistic]);
      setReplyDraft("");
      setReplyingToId(null);

      const { error } = await supabase.from("AvailabilityTabComment").insert([
        {
          id: optimistic.id,
          tabId: tab.id,
          userId,
          body,
          parentCommentId,
          createdAt: now
        }
      ]);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to post reply:", error);
      setComments((current) => current.filter((comment) => comment.id !== optimistic.id));
      setCommentsError("Could not post reply.");
      setReplyDraft(body);
      setReplyingToId(parentCommentId);
    } finally {
      setCommentsSaving(false);
    }
  };

  const handleStartEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditDraft(comment.body || "");
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditDraft("");
  };

  const handleSaveEditComment = async (commentId) => {
    const body = editDraft.trim();
    if (!body || !commentId || commentsSaving) return;

    const previous = comments;
    const now = new Date().toISOString();
    setCommentsSaving(true);
    setCommentsError("");
    setComments((current) =>
      current.map((comment) => (comment.id === commentId ? { ...comment, body, updatedAt: now } : comment))
    );

    try {
      const { error } = await supabase
        .from("AvailabilityTabComment")
        .update({ body, updatedAt: now })
        .eq("id", commentId)
        .eq("userId", userId);
      if (error) throw error;
      setEditingCommentId(null);
      setEditDraft("");
    } catch (error) {
      console.error("Failed to edit comment:", error);
      setComments(previous);
      setCommentsError("Could not edit comment.");
    } finally {
      setCommentsSaving(false);
    }
  };

  const collectCommentIdsForDelete = (allComments, rootId) => {
    const ids = new Set([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const comment of allComments) {
        if (comment.parentCommentId && ids.has(comment.parentCommentId) && !ids.has(comment.id)) {
          ids.add(comment.id);
          changed = true;
        }
      }
    }
    return ids;
  };

  const handleDeleteComment = async (comment) => {
    if (!comment?.id || commentsSaving) return;
    const previous = comments;
    const idsToRemove = collectCommentIdsForDelete(comments, comment.id);
    const canModerateDelete = canDeleteAnyComment && comment.userId !== userId;

    setCommentsSaving(true);
    setCommentsError("");
    setComments((current) => current.filter((comment) => !idsToRemove.has(comment.id)));

    try {
      let query = supabase.from("AvailabilityTabComment").delete().eq("id", comment.id);
      if (!canModerateDelete) {
        query = query.eq("userId", userId);
      }
      const { error } = await query;
      if (error) throw error;
    } catch (error) {
      console.error("Failed to delete comment:", error);
      setComments(previous);
      setCommentsError("Could not delete comment.");
    } finally {
      setCommentsSaving(false);
    }
  };

  const commentsByParent = useMemo(() => {
    const map = new Map();
    for (const comment of comments) {
      const parentId = comment.parentCommentId || "__root__";
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId).push(comment);
    }
    return map;
  }, [comments]);

  const renderComments = (parentId = "__root__", depth = 0) => {
    const branch = commentsByParent.get(parentId) || [];
    return branch.map((comment) => {
      const authorName = userNamesById[comment.userId] || "Traveler";
      const createdLabel = new Date(comment.createdAt).toLocaleString();
      const isAuthor = comment.userId === userId;
      const canDeleteComment = isAuthor || canDeleteAnyComment;
      const children = renderComments(comment.id, depth + 1);

      return (
        <div key={comment.id} className={depth > 0 ? "mt-3 ml-8" : "mt-3"}>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-semibold text-slate-700">
              {authorName.slice(0, 1).toUpperCase()}
            </div>
            <div className="max-w-full rounded-2xl bg-white px-3 py-2 shadow-sm">
              <p className="text-xs font-semibold text-ink">{authorName}</p>
              {editingCommentId === comment.id ? (
                <div className="mt-1">
                  <textarea
                    value={editDraft}
                    onChange={(event) => setEditDraft(event.target.value)}
                    className="min-h-[64px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-ink outline-none focus:border-[#1e4840]"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveEditComment(comment.id)}
                      disabled={!editDraft.trim() || commentsSaving}
                      className="rounded-full bg-[#1877F2] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditComment}
                      className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{comment.body}</p>
              )}
              <div className="mt-1 flex items-center gap-3 text-[11px]">
                <span className="text-slate-400">{createdLabel}</span>
                {comment.updatedAt && comment.updatedAt !== comment.createdAt ? (
                  <span className="text-slate-400">(edited)</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setReplyingToId(comment.id);
                    setReplyDraft("");
                  }}
                  className="font-semibold text-[#1877F2] hover:underline"
                >
                  Reply
                </button>
                {isAuthor ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartEditComment(comment)}
                      className="font-semibold text-slate-600 hover:underline"
                    >
                      Edit
                    </button>
                  </>
                ) : null}
                {canDeleteComment ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(comment)}
                    className="font-semibold text-coral hover:underline"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {replyingToId === comment.id ? (
            <div className="mt-2 ml-11 rounded-xl bg-white p-3 shadow-sm">
              <textarea
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                placeholder="Write a reply..."
                className="min-h-[64px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-ink outline-none focus:border-[#1e4840]"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReplyingToId(null);
                    setReplyDraft("");
                  }}
                  className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleReplySubmit(comment.id)}
                  disabled={!replyDraft.trim() || commentsSaving}
                  className="rounded-full bg-[#1877F2] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Reply
                </button>
              </div>
            </div>
          ) : null}

          {children}
        </div>
      );
    });
  };

  const handlePreviousMonth = () => {
    setStartMonth(addMonths(startMonth, -1));
  };

  const handleNextMonth = () => {
    setStartMonth(addMonths(startMonth, 1));
  };

  const CalendarMonth = ({ month }) => {
    const monthStart = startOfMonth(month);
    const monthEnd = addMonths(month, 1);
    const firstDayOfWeek = monthStart.getDay();
    const daysInMonth = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), i));
    }

    return (
      <div className="select-none" onMouseLeave={hideAvailabilityTooltip}>
        <div className="grid grid-cols-7 gap-2">
          {DAY_NAMES.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-slate-600 h-8">
              {day}
            </div>
          ))}
          {days.map((day, index) => {
            const dateStr = day ? formatISO(day) : null;
            const isSelected = dateStr && selectedDates.has(dateStr);
            const count = dateStr ? availabilityData[dateStr] || 0 : 0;
            const isInteractiveDate = Boolean(dateStr) && canEditCells;

            let bgColor = "bg-white";
            let inlineStyle;
            if (showHeatmap && count > 0) {
              const intensity = maxAvailabilityCount > 0 ? count / maxAvailabilityCount : 0;
              const alpha = availabilityMinAlpha + intensity * (availabilityMaxAlpha - availabilityMinAlpha);
              bgColor = "text-ink";
              inlineStyle = {
                backgroundColor: `rgba(${availabilityGreenRgb}, ${alpha})`
              };
            } else if (isSelected && !showHeatmap) {
              bgColor = "border-emerald-600 text-ink";
              inlineStyle = {
                backgroundColor: `rgba(${availabilityGreenRgb}, ${availabilityMaxAlpha})`
              };
            }

              return (
                <button
                  key={index}
                  onPointerDown={(event) => handleDatePointerDown(event, dateStr)}
                  onPointerEnter={() => handleDatePointerEnter(dateStr)}
                  onPointerUp={() => {
                    setIsDragging(false);
                    setDragMode(null);
                  }}
                  onPointerCancel={hideAvailabilityTooltip}
                  onMouseDown={hideAvailabilityTooltip}
                  onClick={(event) => {
                    event.preventDefault();
                  }}
                  onMouseEnter={(event) => showAvailabilityTooltip(event, dateStr)}
                  onMouseLeave={handleAvailabilityCellMouseLeave}
                  disabled={!dateStr}
                  tabIndex={isInteractiveDate ? 0 : -1}
                  aria-disabled={dateStr && !canEditCells ? "true" : undefined}
                  data-availability-date-cell={dateStr ? "true" : undefined}
                  className={`relative h-8 rounded text-xs font-medium border border-slate-300 ${bgColor} ${
                    isInteractiveDate ? "cursor-pointer hover:bg-slate-100 select-none" : "cursor-default"
                  }`}
                  style={inlineStyle}
                >
                  {day && day.getDate()}
                </button>
              );
          })}
        </div>
      </div>
    );
  };

  const CalendarMonthLayout = () => (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4" onMouseLeave={hideAvailabilityTooltip}>
      <button
        onClick={handlePreviousMonth}
        className="mt-0.5 h-8 w-8 rounded-full bg-slate-200 text-sm font-semibold text-ink transition hover:bg-slate-300"
        aria-label="Previous month"
      >
        <svg viewBox="0 0 20 20" fill="none" className="mx-auto h-4 w-4" aria-hidden="true">
          <path d="M11.5 5.5 7 10l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <div className="grid min-w-0 grid-cols-2 gap-6">
        <div className="min-w-0">
          <h3 className="mb-4 text-center font-semibold text-ink">{month1Label}</h3>
          <CalendarMonth month={month1} />
        </div>
        <div className="min-w-0 border-l border-slate-200 pl-4">
          <h3 className="mb-4 text-center font-semibold text-ink">{month2Label}</h3>
          <CalendarMonth month={month2} />
        </div>
      </div>
      <button
        onClick={handleNextMonth}
        className="mt-0.5 h-8 w-8 rounded-full bg-slate-200 text-sm font-semibold text-ink transition hover:bg-slate-300"
        aria-label="Next month"
      >
        <svg viewBox="0 0 20 20" fill="none" className="mx-auto h-4 w-4" aria-hidden="true">
          <path d="M8.5 5.5 13 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );

  if (loading) {
    return <div className="p-6" />;
  }

  return (
    <div className="p-6">
      {hoverTooltip.visible ? (
        <div
          className="pointer-events-none fixed z-50 max-w-[18rem] -translate-y-1/2 rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white shadow-lg"
          style={{ left: hoverTooltip.x, top: hoverTooltip.y }}
        >
          {hoverTooltip.text}
        </div>
      ) : null}
      {showHeatmap && !isEditing ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Group Availability</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStartMonth(addMonths(startMonth, -1))}
                className="hidden"
                aria-label="Previous month"
              >
                ←
              </button>
              <button
                onClick={() => setStartMonth(addMonths(startMonth, 1))}
                className="hidden"
                aria-label="Next month"
              >
                →
              </button>
              <div className="w-[18rem] shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-600">
                  <span>Fewer people available</span>
                  <span>More people available</span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full border border-slate-200"
                  style={{
                    background: `linear-gradient(90deg, rgba(${availabilityGreenRgb}, ${availabilityMinAlpha}) 0%, rgba(${availabilityGreenRgb}, ${availabilityMaxAlpha}) 100%)`
                  }}
                />
              </div>
              {canEditAvailability && (
                <button
                  onClick={handleEdit}
                  className="rounded-lg bg-slate-200 px-3 py-1 text-sm font-semibold text-ink hover:bg-slate-300"
                >
                  Edit My Availability
                </button>
              )}
            </div>
          </div>

          <CalendarMonthLayout />

          <div className="mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-ink">Member Availability</h3>
              {memberAvailabilityThresholdOptions.length ? (
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <span>Show dates with</span>
                  <select
                    value={effectiveMemberAvailabilityThreshold}
                    onChange={(event) => setMemberAvailabilityThreshold(Number(event.target.value))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-ink outline-none transition focus:border-[#1e4840]"
                  >
                    {memberAvailabilityThresholdOptions.map((threshold) => (
                      <option key={threshold} value={threshold}>
                        {threshold}+ members
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            {!visibleAvailabilityDates.length ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No dates currently have {effectiveMemberAvailabilityThreshold}+ members available.
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead className="border-b border-slate-300">
                  <tr>
                    <th className="sticky left-0 z-20 whitespace-nowrap border-r border-slate-300 bg-white py-2 px-3 text-left font-semibold text-ink">
                      Member
                    </th>
                    {visibleAvailabilityDates.map((date) => {
                      const headerLabel = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric"
                      });
                      const shadeClass = dateShadeByColumn[date] === "dark" ? "bg-slate-100" : "bg-white";
                      return (
                        <th
                          key={date}
                          className={`whitespace-nowrap px-2 py-2 text-center text-xs font-semibold text-slate-600 ${shadeClass}`}
                        >
                          {headerLabel}
                        </th>
                      );
                    })}
                    <th className="sticky right-0 z-20 whitespace-nowrap border-l border-slate-300 bg-white py-2 px-3 text-center font-semibold text-slate-600">
                      Days Available
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((user) => {
                    const memberDates = new Set(userAvailability[user.id] || []);
                    const availableCount = visibleAvailabilityDates.reduce(
                      (count, date) => (memberDates.has(date) ? count + 1 : count),
                      0
                    );

                    return (
                      <tr key={user.id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-300 bg-white py-2 px-3 font-medium text-ink">
                          {user.name}
                        </td>
                        {visibleAvailabilityDates.map((date) => {
                          const isAvailable = memberDates.has(date);
                          const shadeClass = dateShadeByColumn[date] === "dark" ? "bg-slate-100" : "bg-white";
                          return (
                            <td key={`${user.id}-${date}`} className={`px-2 py-2 text-center ${shadeClass}`}>
                              <span
                                className={isAvailable ? "font-semibold text-emerald-600" : "font-semibold text-slate-400"}
                                aria-label={isAvailable ? "Available" : "Not available"}
                              >
                                {isAvailable ? "✓" : "✕"}
                              </span>
                            </td>
                          );
                        })}
                        <td className="sticky right-0 z-10 whitespace-nowrap border-l border-slate-300 bg-white py-2 px-3 text-center font-semibold text-slate-700">
                          {availableCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-[#F0F2F5] p-4">
            <h3 className="mb-3 text-base font-semibold text-ink">Comments</h3>

            {!commentsTableReady ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Comments are not enabled yet in your DB. Add table <code>AvailabilityTabComment</code> in schema.
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1e4840] text-xs font-semibold text-white">
                    {(userNamesById[userId] || "You").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      placeholder="Write a comment..."
                      className="min-h-[72px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-ink outline-none focus:border-[#1e4840]"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleCommentSubmit}
                        disabled={!commentDraft.trim() || commentsSaving}
                        className="rounded-full bg-[#1877F2] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1665cc] disabled:opacity-60"
                      >
                        {commentsSaving ? "Posting..." : "Post"}
                      </button>
                    </div>
                  </div>
                </div>

                {commentsError ? <p className="mb-3 text-sm text-coral">{commentsError}</p> : null}

                {commentsLoading ? (
                  <p className="text-sm text-slate-500">Loading comments...</p>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-slate-500">No comments yet. Start the conversation.</p>
                ) : (
                  <div>{renderComments()}</div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">
              {isEditing ? "Select Your Available Dates" : "Your Availability"}
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStartMonth(addMonths(startMonth, -1))}
                className="hidden"
                aria-label="Previous month"
              >
                ←
              </button>
              <button
                onClick={() => setStartMonth(addMonths(startMonth, 1))}
                className="hidden"
                aria-label="Next month"
              >
                →
              </button>
            </div>
          </div>

          <CalendarMonthLayout />

          {canEditAvailability && (!showHeatmap || isEditing) && (
            <div className="flex gap-3 mt-4">
              {isEditing ? (
                <button
                  onClick={handleResetEditSelection}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Reset
                </button>
              ) : null}
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-[#152f2a] disabled:opacity-50"
              >
                Save Availability
              </button>
              {isEditing ? (
                <button
                  onClick={handleCancel}
                  className="flex-1 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-300"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

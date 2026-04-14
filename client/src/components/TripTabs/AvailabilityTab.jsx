import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { DAY_NAMES, addMonths, formatISO, monthKey, startOfMonth } from "../../lib/calendarHelpers.js";

export default function AvailabilityTab({ tab, tripId, userId, userRole }) {
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
  const [showAvailabilityHints, setShowAvailabilityHints] = useState(false);
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
  const [loading, setLoading] = useState(false);
  const [userSubmittedAt, setUserSubmittedAt] = useState(null);
  const [editStartSelectedDates, setEditStartSelectedDates] = useState(new Set());
  const canEditAvailability = true;
  const canEditCells = canEditAvailability && (!showHeatmap || isEditing);

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
    if (!showHeatmap && !showAvailabilityHints) return;

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

        const { data: userProfiles, error: userError } = await supabase
          .from("User")
          .select("id, name")
          .in("id", memberIds);
        if (userError) throw userError;
        setAllUsers(userProfiles || []);

        const { data, error: availabilityError } = await supabase
          .from("AvailabilityTabData")
          .select("date, userId")
          .eq("tabId", tab.id)
          .eq("isSelected", true)
          .in("userId", memberIds);
        if (availabilityError) throw availabilityError;

        if (data) {
          const counts = {};
          const byDateUserIds = {};
          data.forEach(({ date, userId: uid }) => {
            const dateStr = date.split("T")[0];
            counts[dateStr] = (counts[dateStr] || 0) + 1;
            if (!byDateUserIds[dateStr]) byDateUserIds[dateStr] = [];
            byDateUserIds[dateStr].push(uid);
          });
          setAvailabilityData(counts);

          const userNameById = {};
          (userProfiles || []).forEach((user) => {
            userNameById[user.id] = user.name;
          });

          const byDateNames = {};
          Object.entries(byDateUserIds).forEach(([date, ids]) => {
            byDateNames[date] = ids
              .map((id) => userNameById[id] || "Traveler")
              .sort((a, b) => a.localeCompare(b));
          });
          setAvailableUsersByDate(byDateNames);
        }

        const { data: allAvailability } = await supabase
          .from("AvailabilityTabData")
          .select("userId, date, isSelected, submittedAt")
          .eq("tabId", tab.id)
          .eq("isSelected", true)
          .in("userId", memberIds);

        const byUser = {};
        (allAvailability || []).forEach(({ userId: uid, date, isSelected }) => {
          if (!byUser[uid]) byUser[uid] = [];
          if (isSelected) {
            byUser[uid].push(date.split("T")[0]);
          }
        });
        setUserAvailability(byUser);
      } catch (error) {
        console.error("Failed to load availability data:", error);
      }
    };

    loadAvailabilityData();
  }, [showHeatmap, showAvailabilityHints, tab.id, tripId]);

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
      } catch (error) {
        console.error("Failed to load availability comments:", error);
        setCommentsError("Failed to load comments.");
      } finally {
        setCommentsLoading(false);
      }
    };

    loadComments();
  }, [showHeatmap, tab.id]);

  const month1 = startOfMonth(startMonth);
  const month2 = addMonths(startMonth, 1);
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
  const visibleAvailabilityDates = useMemo(() => {
    return displayedDates.filter((date) =>
      Object.values(userAvailability).some((dates) => Array.isArray(dates) && dates.includes(date))
    );
  }, [displayedDates, userAvailability]);
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
    const names = {};
    for (const user of allUsers) {
      names[user.id] = user.name;
    }
    return names;
  }, [allUsers]);

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
    if (!showHeatmap && !showAvailabilityHints) return;

    const names = availableUsersByDate[dateStr] || [];
    const text = names.length > 0 ? `Available: ${names.join(", ")}` : "No one available";
    const rect = event.currentTarget.getBoundingClientRect();

    setHoverTooltip({
      visible: true,
      text,
      x: rect.right + 10,
      y: rect.top + rect.height / 2
    });
  };

  const hideAvailabilityTooltip = () => {
    setHoverTooltip((current) => {
      if (!current.visible) return current;
      return { ...current, visible: false };
    });
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

  const handleDeleteComment = async (commentId) => {
    if (!commentId || commentsSaving) return;
    const previous = comments;
    const idsToRemove = collectCommentIdsForDelete(comments, commentId);

    setCommentsSaving(true);
    setCommentsError("");
    setComments((current) => current.filter((comment) => !idsToRemove.has(comment.id)));

    try {
      const { error } = await supabase.from("AvailabilityTabComment").delete().eq("id", commentId).eq("userId", userId);
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
      const isOwner = comment.userId === userId;
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
                    className="min-h-[64px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-ink outline-none focus:border-[#4C6FFF]"
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
                {isOwner ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartEditComment(comment)}
                      className="font-semibold text-slate-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="font-semibold text-coral hover:underline"
                    >
                      Delete
                    </button>
                  </>
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
                className="min-h-[64px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-ink outline-none focus:border-[#4C6FFF]"
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

  const CalendarMonth = ({ month, isFirst }) => {
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

    const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    return (
      <div
        className={`flex-1 select-none ${!isFirst && "border-l border-slate-200 pl-4"}`}
        onMouseLeave={hideAvailabilityTooltip}
      >
        <h3 className="font-semibold text-ink mb-4">{monthLabel}</h3>
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

            let bgColor = "bg-white";
            let inlineStyle;
            if (showHeatmap && count > 0) {
              const intensity = maxAvailabilityCount > 0 ? count / maxAvailabilityCount : 0;
              const alpha = 0.16 + intensity * 0.62;
              bgColor = "text-ink";
              inlineStyle = {
                backgroundColor: `rgba(34, 197, 94, ${alpha})`
              };
            } else if (isSelected && !showHeatmap) {
              bgColor = "bg-ocean text-white";
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
                  onPointerLeave={hideAvailabilityTooltip}
                  onPointerCancel={hideAvailabilityTooltip}
                  onMouseDown={hideAvailabilityTooltip}
                  onClick={(event) => {
                    event.preventDefault();
                  }}
                  onMouseEnter={(event) => showAvailabilityTooltip(event, dateStr)}
                  onMouseLeave={hideAvailabilityTooltip}
                  disabled={!dateStr || (showHeatmap && !isEditing)}
                  className={`relative h-8 rounded text-xs font-medium border border-slate-300 ${bgColor} ${
                    canEditCells && dateStr ? "cursor-pointer hover:bg-slate-100 select-none" : "cursor-default"
                  }`}
                  style={inlineStyle}
                >
                  {day && day.getDate()}
                  {!showHeatmap && showAvailabilityHints && dateStr && (availabilityData[dateStr] || 0) > 0 ? (
                    <span className="pointer-events-none absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-emerald-500" />
                  ) : null}
                </button>
              );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="p-6" />;
  }

  return (
    <div className="p-6">
      {hoverTooltip.visible ? (
        <div
          className="pointer-events-none fixed z-50 -translate-y-1/2 rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white shadow-lg"
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
                className="h-8 w-8 rounded-full bg-slate-200 text-sm font-semibold text-ink transition hover:bg-slate-300"
                aria-label="Previous month"
              >
                ←
              </button>
              <button
                onClick={() => setStartMonth(addMonths(startMonth, 1))}
                className="h-8 w-8 rounded-full bg-slate-200 text-sm font-semibold text-ink transition hover:bg-slate-300"
                aria-label="Next month"
              >
                →
              </button>
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

          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Fewer people available</span>
              <span>More people available</span>
            </div>
            <div
              className="h-3 w-full rounded-full border border-slate-200"
              style={{ background: "linear-gradient(90deg, rgba(34,197,94,0.16) 0%, rgba(34,197,94,0.78) 100%)" }}
            />
            <div className="mt-2 text-xs text-slate-500">
              Continuous scale (max overlap: {maxAvailabilityCount || 0})
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6" onMouseLeave={hideAvailabilityTooltip}>
            <CalendarMonth month={month1} isFirst={true} />
            <CalendarMonth month={month2} isFirst={false} />
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-ink mb-4">Member Availability</h3>
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
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4C6FFF] text-xs font-semibold text-white">
                    {(userNamesById[userId] || "You").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      placeholder="Write a comment..."
                      className="min-h-[72px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-ink outline-none focus:border-[#4C6FFF]"
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">View others</span>
              <button
                type="button"
                role="switch"
                aria-checked={showAvailabilityHints}
                aria-label="View others"
                onClick={() => setShowAvailabilityHints((current) => !current)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  showAvailabilityHints ? "bg-ocean" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    showAvailabilityHints ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
              <button
                onClick={() => setStartMonth(addMonths(startMonth, -1))}
                className="h-8 w-8 rounded-full bg-slate-200 text-sm font-semibold text-ink transition hover:bg-slate-300"
                aria-label="Previous month"
              >
                ←
              </button>
              <button
                onClick={() => setStartMonth(addMonths(startMonth, 1))}
                className="h-8 w-8 rounded-full bg-slate-200 text-sm font-semibold text-ink transition hover:bg-slate-300"
                aria-label="Next month"
              >
                →
              </button>
            </div>
          </div>

          {showAvailabilityHints ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
              Hover a date to see who is available.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-6" onMouseLeave={hideAvailabilityTooltip}>
            <CalendarMonth month={month1} isFirst={true} />
            <CalendarMonth month={month2} isFirst={false} />
          </div>

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
                className="flex-1 rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
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

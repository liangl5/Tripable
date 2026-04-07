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

  // Load heatmap data when showing heatmap
  useEffect(() => {
    if (!showHeatmap) return;

    const loadHeatmapData = async () => {
      try {
        const { data } = await supabase
          .from("AvailabilityTabData")
          .select("date, userId")
          .eq("tabId", tab.id)
          .eq("isSelected", true);

        if (data) {
          const counts = {};
          data.forEach(({ date, userId: uid }) => {
            const dateStr = date.split("T")[0];
            counts[dateStr] = (counts[dateStr] || 0) + 1;
          });
          setAvailabilityData(counts);
        }

        // Load user availability for table
        const { data: userProfiles } = await supabase.from("User").select("id, name");
        setAllUsers(userProfiles || []);

        const { data: allAvailability } = await supabase
          .from("AvailabilityTabData")
          .select("userId, date, isSelected, submittedAt")
          .eq("tabId", tab.id)
          .eq("isSelected", true);

        const byUser = {};
        (allAvailability || []).forEach(({ userId: uid, date, isSelected }) => {
          if (!byUser[uid]) byUser[uid] = [];
          if (isSelected) {
            byUser[uid].push(date.split("T")[0]);
          }
        });
        setUserAvailability(byUser);
      } catch (error) {
        console.error("Failed to load heatmap data:", error);
      }
    };

    loadHeatmapData();
  }, [showHeatmap, tab.id]);

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
    if (!canEditCells || !dateStr) return;
    const shouldSelect = !selectedDates.has(dateStr);
    const nextMode = shouldSelect ? "select" : "deselect";
    setIsDragging(true);
    setDragMode(nextMode);
    applyDateSelection(dateStr, nextMode);
  };

  const handleDatePointerEnter = (dateStr) => {
    if (!canEditCells || !isDragging || !dragMode || !dateStr) return;
    applyDateSelection(dateStr, dragMode);
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
      <div className={`flex-1 select-none ${!isFirst && "border-l border-slate-200 pl-4"}`}>
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
            if (showHeatmap && count > 0) {
              if (count >= 3) bgColor = "bg-green-500";
              else if (count === 2) bgColor = "bg-green-300";
              else bgColor = "bg-green-100";
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
                  onClick={(event) => {
                    event.preventDefault();
                  }}
                  disabled={!dateStr || (showHeatmap && !isEditing)}
                  className={`h-8 rounded text-xs font-medium border border-slate-300 ${bgColor} ${
                    canEditCells && dateStr ? "cursor-pointer hover:bg-slate-100 select-none" : "cursor-default"
                  }`}
                >
                  {day && day.getDate()}
                </button>
              );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-600">Loading availability...</div>;
  }

  return (
    <div className="p-6">
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

          <div className="flex gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-slate-300"></div>
              <span className="text-xs text-slate-600">1 person</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-300 border border-slate-300"></div>
              <span className="text-xs text-slate-600">2 people</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 border border-slate-300"></div>
              <span className="text-xs text-slate-600">3+ people</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
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

          <div className="grid grid-cols-2 gap-6">
            <CalendarMonth month={month1} isFirst={true} />
            <CalendarMonth month={month2} isFirst={false} />
          </div>

          {canEditAvailability && (!showHeatmap || isEditing) && (
            <div className="flex gap-3 mt-4">
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

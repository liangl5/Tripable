import { useEffect, useMemo, useState } from "react";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import { supabase } from "../lib/supabase";
import { getAvatarColor } from "../lib/avatarColors.js";
import { formatRelativeTime } from "../lib/timeFormat.js";
import { buildUserAvatarColorsById, buildUserNamesById, fetchUserProfilesByIds } from "../lib/userProfiles.js";

function sortByCreatedAtAscending(items) {
  return [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function hasCommentBeenEdited(comment) {
  if (!comment?.updatedAt || !comment?.createdAt) return false;
  const createdAt = new Date(comment.createdAt).getTime();
  const updatedAt = new Date(comment.updatedAt).getTime();
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return false;
  return updatedAt - createdAt > 5000;
}

const COMMENT_EMOJIS = ["😀", "😂", "😍", "🥳", "😎", "😊", "😭", "😅", "👏", "🙌", "👍", "👀", "❤️", "🔥", "✨", "🎉"];

export default function ThreadedComments({
  tableName,
  resourceColumn,
  resourceId,
  userId,
  userNamesById = {},
  userAvatarColorsById = {},
  canDeleteAnyComment = false,
  title = "Comments",
  initiallyOpen = false
}) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyEmojiMenuCommentId, setReplyEmojiMenuCommentId] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [editEmojiMenuCommentId, setEditEmojiMenuCommentId] = useState(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsSaving, setCommentsSaving] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentsTableReady, setCommentsTableReady] = useState(true);
  const [resolvedUserNamesById, setResolvedUserNamesById] = useState({});
  const [resolvedUserAvatarColorsById, setResolvedUserAvatarColorsById] = useState({});

  useEffect(() => {
    if (!isOpen || !resourceId || !tableName || !resourceColumn) return;
    let isMounted = true;

    const loadComments = async () => {
      setCommentsLoading(true);
      setCommentsError("");
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select(`id, ${resourceColumn}, userId, body, parentCommentId, createdAt, updatedAt`)
          .eq(resourceColumn, resourceId)
          .order("createdAt", { ascending: true });

        if (error) {
          const message = String(error.message || "").toLowerCase();
          if (message.includes("relation") || message.includes("does not exist")) {
            if (!isMounted) return;
            setCommentsTableReady(false);
            setComments([]);
            return;
          }
          throw error;
        }

        if (!isMounted) return;
        setCommentsTableReady(true);
        setComments(data || []);
      } catch (error) {
        if (!isMounted) return;
        console.error(`Failed to load comments from ${tableName}:`, error);
        setCommentsError("Failed to load comments.");
      } finally {
        if (isMounted) {
          setCommentsLoading(false);
        }
      }
    };

    void loadComments();
    return () => {
      isMounted = false;
    };
  }, [isOpen, resourceId, tableName, resourceColumn]);

  useEffect(() => {
    if (!comments.length) return;
    let isMounted = true;

    const loadMissingAuthorProfiles = async () => {
      const commentUserIds = Array.from(
        new Set(
          comments
            .map((comment) => comment.userId)
            .filter(Boolean)
        )
      );
      const missingUserIds = commentUserIds.filter(
        (uid) =>
          (!userNamesById[uid] && !resolvedUserNamesById[uid]) ||
          (!userAvatarColorsById[uid] && !resolvedUserAvatarColorsById[uid])
      );

      if (!missingUserIds.length) return;

      try {
        const profiles = await fetchUserProfilesByIds(missingUserIds);
        if (!isMounted || !profiles.length) return;
        const nextNames = buildUserNamesById(profiles);
        const nextAvatarColors = buildUserAvatarColorsById(profiles);
        setResolvedUserNamesById((current) => ({
          ...current,
          ...nextNames
        }));
        setResolvedUserAvatarColorsById((current) => ({
          ...current,
          ...nextAvatarColors
        }));
      } catch (error) {
        console.error(`Failed to load comment author profiles for ${tableName}:`, error);
      }
    };

    void loadMissingAuthorProfiles();
    return () => {
      isMounted = false;
    };
  }, [
    comments,
    resolvedUserAvatarColorsById,
    resolvedUserNamesById,
    tableName,
    userAvatarColorsById,
    userNamesById
  ]);

  const commentsByParent = useMemo(() => {
    const map = new Map();
    for (const comment of comments) {
      const parentId = comment.parentCommentId || "__root__";
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId).push(comment);
    }
    return map;
  }, [comments]);

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

  const getAuthorName = (uid) => {
    if (resolvedUserNamesById[uid]) return resolvedUserNamesById[uid];
    if (userNamesById[uid]) return userNamesById[uid];
    if (uid === userId) return "You";
    return "Traveler";
  };

  const getAuthorAvatarColor = (uid) => {
    return userAvatarColorsById[uid] || resolvedUserAvatarColorsById[uid] || getAvatarColor(uid);
  };

  const handleCommentSubmit = async () => {
    const body = commentDraft.trim();
    if (!body || commentsSaving || !commentsTableReady) return;

    setCommentsSaving(true);
    setCommentsError("");
    const now = new Date().toISOString();
    const optimistic = {
      id: crypto.randomUUID(),
      [resourceColumn]: resourceId,
      userId,
      body,
      parentCommentId: null,
      createdAt: now,
      updatedAt: null
    };

    try {
      setComments((current) => sortByCreatedAtAscending([...current, optimistic]));
      setCommentDraft("");
      setCommentComposerOpen(false);
      setEmojiMenuOpen(false);

      const { error } = await supabase.from(tableName).insert([
        {
          id: optimistic.id,
          [resourceColumn]: resourceId,
          userId,
          body,
          parentCommentId: null,
          createdAt: now,
          updatedAt: null
        }
      ]);

      if (error) throw error;
    } catch (error) {
      console.error(`Failed to post comment to ${tableName}:`, error);
      setComments((current) => current.filter((comment) => comment.id !== optimistic.id));
      setCommentsError("Could not post comment.");
      setCommentDraft(body);
      setCommentComposerOpen(true);
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
      [resourceColumn]: resourceId,
      userId,
      body,
      parentCommentId,
      createdAt: now,
      updatedAt: null
    };

    try {
      setComments((current) => sortByCreatedAtAscending([...current, optimistic]));
      setReplyDraft("");
      setReplyingToId(null);
      setReplyEmojiMenuCommentId(null);

      const { error } = await supabase.from(tableName).insert([
        {
          id: optimistic.id,
          [resourceColumn]: resourceId,
          userId,
          body,
          parentCommentId,
          createdAt: now,
          updatedAt: null
        }
      ]);

      if (error) throw error;
    } catch (error) {
      console.error(`Failed to post reply to ${tableName}:`, error);
      setComments((current) => current.filter((comment) => comment.id !== optimistic.id));
      setCommentsError("Could not post reply.");
      setReplyDraft(body);
      setReplyingToId(parentCommentId);
    } finally {
      setCommentsSaving(false);
    }
  };

  const handleCancelCommentDraft = () => {
    setCommentDraft("");
    setCommentComposerOpen(false);
    setEmojiMenuOpen(false);
  };

  const handleAddCommentEmoji = (emoji) => {
    setCommentDraft((current) => `${current}${emoji}`);
    setCommentComposerOpen(true);
    setEmojiMenuOpen(false);
  };

  const handleAddReplyEmoji = (emoji) => {
    setReplyDraft((current) => `${current}${emoji}`);
    setReplyEmojiMenuCommentId(null);
  };

  const handleAddEditEmoji = (emoji) => {
    setEditDraft((current) => `${current}${emoji}`);
    setEditEmojiMenuCommentId(null);
  };

  const handleStartEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditDraft(comment.body || "");
    setEditEmojiMenuCommentId(null);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditDraft("");
    setEditEmojiMenuCommentId(null);
  };

  const handleSaveEditComment = async (commentId) => {
    const body = editDraft.trim();
    if (!body || !commentId || commentsSaving) return;

    const commentToEdit = comments.find((comment) => comment.id === commentId);
    if (commentToEdit && body === (commentToEdit.body || "").trim()) {
      setEditingCommentId(null);
      setEditDraft("");
      setEditEmojiMenuCommentId(null);
      return;
    }

    const previous = comments;
    const now = new Date().toISOString();
    setCommentsSaving(true);
    setCommentsError("");
    setComments((current) =>
      current.map((comment) => (comment.id === commentId ? { ...comment, body, updatedAt: now } : comment))
    );

    try {
      const { error } = await supabase
        .from(tableName)
        .update({ body, updatedAt: now })
        .eq("id", commentId)
        .eq("userId", userId);
      if (error) throw error;
      setEditingCommentId(null);
      setEditDraft("");
      setEditEmojiMenuCommentId(null);
    } catch (error) {
      console.error(`Failed to edit comment in ${tableName}:`, error);
      setComments(previous);
      setCommentsError("Could not edit comment.");
    } finally {
      setCommentsSaving(false);
    }
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
      let query = supabase.from(tableName).delete().eq("id", comment.id);
      if (!canModerateDelete) {
        query = query.eq("userId", userId);
      }
      const { error } = await query;
      if (error) throw error;
    } catch (error) {
      console.error(`Failed to delete comment in ${tableName}:`, error);
      setComments(previous);
      setCommentsError("Could not delete comment.");
    } finally {
      setCommentsSaving(false);
    }
  };

  const renderComments = (parentId = "__root__", depth = 0) => {
    const branch = commentsByParent.get(parentId) || [];
    return branch.map((comment) => {
      const indentLevel = Math.min(depth, 3);
      const authorName = getAuthorName(comment.userId);
      const createdLabel = formatRelativeTime(comment.createdAt);
      const isAuthor = comment.userId === userId;
      const canDeleteComment = isAuthor || canDeleteAnyComment;
      const children = renderComments(comment.id, depth + 1);

      return (
        <div
          key={comment.id}
          className={`mt-5 min-w-0 ${depth > 0 ? "relative border-l-2 border-slate-300 pl-5" : ""}`}
          style={{ marginLeft: depth > 0 ? `${indentLevel * 18}px` : 0 }}
        >
          {depth > 0 ? <span className="absolute -left-2 top-4 h-3 w-3 rounded-full border-2 border-white bg-slate-300" /> : null}
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getAuthorAvatarColor(
                comment.userId
              )}`}
            >
              {authorName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 max-w-4xl pr-2 sm:pr-6">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-ink">{authorName}</span>
                <span className="text-xs text-slate-500">{createdLabel}</span>
                {hasCommentBeenEdited(comment) ? <span className="text-xs text-slate-500">(edited)</span> : null}
              </div>
              {editingCommentId === comment.id ? (
                <div className="mt-2 rounded-2xl bg-slate-50 p-3">
                  <textarea
                    value={editDraft}
                    onChange={(event) => setEditDraft(event.target.value)}
                    className="min-h-[64px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-[#1e4840]"
                  />
                  <div className="mt-2 flex gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setEditEmojiMenuCommentId((current) => (current === comment.id ? null : comment.id))
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-800 hover:bg-slate-100"
                        aria-label="Add emoji"
                        aria-expanded={editEmojiMenuCommentId === comment.id}
                      >
                        <SentimentSatisfiedAltIcon fontSize="small" />
                      </button>
                      {editEmojiMenuCommentId === comment.id ? (
                        <div className="absolute left-0 top-9 z-20 grid w-48 grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                          {COMMENT_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleAddEditEmoji(emoji)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-slate-100"
                              aria-label={`Add ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="ml-auto flex gap-2">
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
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-900">{comment.body}</p>
              )}
              <div className="mt-2 max-w-full overflow-x-auto">
                <div className="flex min-w-max items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setReplyingToId(comment.id);
                    setReplyDraft("");
                    setReplyEmojiMenuCommentId(null);
                  }}
                    className="shrink-0 rounded-full px-2 py-1 font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Reply
                </button>
                {isAuthor ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartEditComment(comment)}
                        className="shrink-0 rounded-full px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                  </>
                ) : null}
                {canDeleteComment ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(comment)}
                    className="shrink-0 rounded-full px-2 py-1 font-semibold text-coral hover:bg-red-50"
                  >
                    Delete
                  </button>
                ) : null}
                </div>
              </div>
            </div>
          </div>

          {replyingToId === comment.id ? (
            <div className="mt-2 ml-14 min-w-0 max-w-4xl rounded-2xl bg-slate-50 p-3">
              <textarea
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                placeholder="Write a reply..."
                className="min-h-[64px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-[#1e4840]"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setReplyEmojiMenuCommentId((current) => (current === comment.id ? null : comment.id))
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-full text-slate-800 hover:bg-slate-100"
                    aria-label="Add emoji"
                    aria-expanded={replyEmojiMenuCommentId === comment.id}
                  >
                    <SentimentSatisfiedAltIcon fontSize="small" />
                  </button>
                  {replyEmojiMenuCommentId === comment.id ? (
                    <div className="absolute left-0 top-9 z-20 grid w-48 grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                      {COMMENT_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleAddReplyEmoji(emoji)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-slate-100"
                          aria-label={`Add ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingToId(null);
                      setReplyDraft("");
                      setReplyEmojiMenuCommentId(null);
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
            </div>
          ) : null}

          {children}
        </div>
      );
    });
  };

  return (
    <div className={`mt-1.5 rounded-md border border-slate-200 bg-white ${isOpen ? "p-2" : "p-1.5"}`}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0 text-left"
      >
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{title}</h4>
        <span className="text-[10px] font-semibold text-slate-500">{isOpen ? "Hide" : "Show"}</span>
      </button>

      {isOpen ? (
        <div className="mt-2">
          {!commentsTableReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Comments are not enabled in DB yet. Please create table <code>{tableName}</code>.
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-start gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAuthorAvatarColor(
                    userId
                  )}`}
                >
                  {getAuthorName(userId).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 max-w-4xl">
                  <textarea
                    value={commentDraft}
                    onFocus={() => setCommentComposerOpen(true)}
                    onChange={(event) => {
                      setCommentDraft(event.target.value);
                      if (!commentComposerOpen) setCommentComposerOpen(true);
                    }}
                    rows={commentComposerOpen ? 1 : 1}
                    placeholder="Add a comment..."
                    className={`block min-h-[28px] w-full resize-none overflow-hidden border-0 border-b bg-transparent px-0 py-0.5 text-sm text-ink outline-none placeholder:text-slate-500 ${
                      commentComposerOpen ? "border-b-2 border-slate-950" : "border-slate-300"
                    }`}
                  />
                  {commentComposerOpen ? (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setEmojiMenuOpen((current) => !current)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-800 hover:bg-slate-100"
                          aria-label="Add emoji"
                          aria-expanded={emojiMenuOpen}
                        >
                          <SentimentSatisfiedAltIcon fontSize="small" />
                        </button>
                        {emojiMenuOpen ? (
                          <div className="absolute left-0 top-10 z-20 grid w-48 grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                            {COMMENT_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleAddCommentEmoji(emoji)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-slate-100"
                                aria-label={`Add ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCancelCommentDraft}
                          className="rounded-full px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCommentSubmit}
                          disabled={!commentDraft.trim() || commentsSaving}
                          className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {commentsSaving ? "Commenting..." : "Comment"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {commentsError ? <p className="mb-2 text-xs text-coral">{commentsError}</p> : null}

              {commentsLoading ? (
                <p className="text-xs text-slate-500">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-slate-500">No comments yet. Start the conversation.</p>
              ) : (
                <div className="max-h-[28rem] overflow-y-auto overflow-x-hidden pr-1">{renderComments()}</div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

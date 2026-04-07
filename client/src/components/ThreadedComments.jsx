import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function sortByCreatedAtAscending(items) {
  return [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export default function ThreadedComments({
  tableName,
  resourceColumn,
  resourceId,
  userId,
  userNamesById = {},
  title = "Comments",
  initiallyOpen = false
}) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
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
    if (userNamesById[uid]) return userNamesById[uid];
    if (uid === userId) return "You";
    return "Traveler";
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
      updatedAt: now
    };

    try {
      setComments((current) => sortByCreatedAtAscending([...current, optimistic]));
      setCommentDraft("");

      const { error } = await supabase.from(tableName).insert([
        {
          id: optimistic.id,
          [resourceColumn]: resourceId,
          userId,
          body,
          parentCommentId: null,
          createdAt: now,
          updatedAt: now
        }
      ]);

      if (error) throw error;
    } catch (error) {
      console.error(`Failed to post comment to ${tableName}:`, error);
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
      [resourceColumn]: resourceId,
      userId,
      body,
      parentCommentId,
      createdAt: now,
      updatedAt: now
    };

    try {
      setComments((current) => sortByCreatedAtAscending([...current, optimistic]));
      setReplyDraft("");
      setReplyingToId(null);

      const { error } = await supabase.from(tableName).insert([
        {
          id: optimistic.id,
          [resourceColumn]: resourceId,
          userId,
          body,
          parentCommentId,
          createdAt: now,
          updatedAt: now
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
        .from(tableName)
        .update({ body, updatedAt: now })
        .eq("id", commentId)
        .eq("userId", userId);
      if (error) throw error;
      setEditingCommentId(null);
      setEditDraft("");
    } catch (error) {
      console.error(`Failed to edit comment in ${tableName}:`, error);
      setComments(previous);
      setCommentsError("Could not edit comment.");
    } finally {
      setCommentsSaving(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!commentId || commentsSaving) return;
    const previous = comments;
    const idsToRemove = collectCommentIdsForDelete(comments, commentId);

    setCommentsSaving(true);
    setCommentsError("");
    setComments((current) => current.filter((comment) => !idsToRemove.has(comment.id)));

    try {
      const { error } = await supabase.from(tableName).delete().eq("id", commentId).eq("userId", userId);
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
      const authorName = getAuthorName(comment.userId);
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

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-[#F0F2F5] p-3">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between text-left"
      >
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        <span className="text-xs font-semibold text-slate-500">{isOpen ? "Hide" : "Show"}</span>
      </button>

      {isOpen ? (
        <div className="mt-3">
          {!commentsTableReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Comments are not enabled in DB yet. Please create table <code>{tableName}</code>.
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4C6FFF] text-xs font-semibold text-white">
                  {getAuthorName(userId).slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1">
                  <textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Write a comment..."
                    className="min-h-[64px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-ink outline-none focus:border-[#4C6FFF]"
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

              {commentsError ? <p className="mb-2 text-xs text-coral">{commentsError}</p> : null}

              {commentsLoading ? (
                <p className="text-xs text-slate-500">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-slate-500">No comments yet. Start the conversation.</p>
              ) : (
                <div>{renderComments()}</div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

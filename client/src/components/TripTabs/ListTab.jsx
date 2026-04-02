import { useEffect, useState, useRef } from "react";
import { api } from "../../lib/api";
import TripMapPanel from "../TripMapPanel.jsx";
import { trackEvent } from "../../lib/analytics.js";
import ActivityComposerModal from "../ActivityComposerModal.jsx";
import VoteButtons from "../VoteButtons.jsx";

export default function ListTab({ tab, trip, tripId, userId, userRole, ideas, onAddIdea, onVoteIdea, onDeleteIdea }) {
  const [lists, setLists] = useState([]);
  const [mapPanelWidth, setMapPanelWidth] = useState(50);
  const [collapsedLists, setCollapsedLists] = useState({});
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState("");
  const [loading, setLoading] = useState(false);
  const [listCreateLoading, setListCreateLoading] = useState(false);
  const [deleteListConfirm, setDeleteListConfirm] = useState(null);
  const [deleteIdeaConfirm, setDeleteIdeaConfirm] = useState(null);
  const [composerState, setComposerState] = useState(null);
  const [listActionError, setListActionError] = useState("");
  const containerRef = useRef(null);
  const mapDragRef = useRef(null);
  const canManageLists = userRole === "owner" || userRole === "editor";

  // Load lists from database
  useEffect(() => {
    const loadLists = async () => {
      try {
        setLoading(true);
        const dbLists = await api.getLists(tripId, tab.id);
        setLists(dbLists);
      } catch (error) {
        console.error("Failed to load lists:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLists();
  }, [tripId, tab.id]);

  const handleMapDragStart = (e) => {
    e.preventDefault();
    mapDragRef.current = { startX: e.clientX, startWidth: mapPanelWidth };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = (e) => {
    if (!mapDragRef.current) return;

    const deltaX = e.clientX - mapDragRef.current.startX;
    const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
    const newWidth = Math.max(20, Math.min(80, mapDragRef.current.startWidth - (deltaX / containerWidth) * 100));
    setMapPanelWidth(newWidth);
  };

  const handleMouseUp = () => {
    mapDragRef.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const handleAddList = async () => {
    if (listCreateLoading || !newListName.trim()) return;

    try {
      setListCreateLoading(true);
      setListActionError("");
      const newList = await api.createList(tripId, newListName, tab.id);
      setLists((current) => (current.some((list) => list.id === newList.id) ? current : [...current, newList]));
      void trackEvent("list_created", {
        trip_id: tripId,
        list_id: newList.id,
        list_name: newList.name
      });
      setNewListName("");
      setIsAddingList(false);
    } catch (error) {
      console.error("Failed to create list:", error);
      setListActionError(error?.message || "Failed to create list");
    } finally {
      setListCreateLoading(false);
    }
  };

  const handleDeleteList = async (listId) => {
    if (!deleteListConfirm?.id || deleteListConfirm.id !== listId) return;

    try {
      setListActionError("");
      await api.deleteList(listId);
      setLists(lists.filter((l) => l.id !== listId));
      void trackEvent("list_deleted", {
        trip_id: tripId,
        list_id: listId
      });
      setDeleteListConfirm(null);
    } catch (error) {
      console.error("Failed to delete list:", error);
      setListActionError(error?.message || "Failed to delete list");
    }
  };

  const handleRenameList = async (listId) => {
    if (!editingListName.trim()) return;

    try {
      setListActionError("");
      const updatedList = await api.updateList(listId, editingListName);
      setLists(lists.map((l) => (l.id === listId ? updatedList : l)));
      void trackEvent("list_updated", {
        trip_id: tripId,
        list_id: listId,
        list_name: editingListName
      });
      setEditingListId(null);
      setEditingListName("");
    } catch (error) {
      console.error("Failed to rename list:", error);
      setListActionError(error?.message || "Failed to rename list");
    }
  };

  const openComposer = (listId) => {
    const list = lists.find((candidate) => candidate.id === listId) || lists[0] || null;
    setComposerState({
      defaultListId: list?.id || "",
      defaultTitle: ""
    });
  };

  const handleCreateIdea = async (payload) => {
    try {
      setListActionError("");
      const createdIdea = await onAddIdea({
        ...payload,
        tabId: tab.id
      });
      void trackEvent("activity_created_from_list_tab", {
        trip_id: tripId,
        list_id: payload.listId || createdIdea?.listId || "",
        idea_id: createdIdea?.id || ""
      });
      setComposerState(null);
    } catch (error) {
      console.error("Failed to add activity:", error);
      setListActionError(error?.message || "Failed to add activity");
    }
  };

  const handleDeleteIdea = async (ideaId) => {
    if (!deleteIdeaConfirm?.id || deleteIdeaConfirm.id !== ideaId) return;

    try {
      setListActionError("");
      await onDeleteIdea(ideaId);
      void trackEvent("activity_deleted_from_list_tab", {
        trip_id: tripId,
        idea_id: ideaId
      });
      setDeleteIdeaConfirm(null);
    } catch (error) {
      console.error("Failed to delete activity:", error);
      setListActionError(error?.message || "Failed to delete activity");
    }
  };

  const toggleCollapse = (listId) => {
    setCollapsedLists({
      ...collapsedLists,
      [listId]: !collapsedLists[listId]
    });
  };

  const getListIdeas = (listId) => {
    return ideas.filter((idea) => idea.listId === listId && (!idea.tabId || idea.tabId === tab.id));
  };

  const leftWidth = `${100 - mapPanelWidth}%`;
  const rightWidth = `${mapPanelWidth}%`;

  return (
    <div ref={containerRef} className="flex h-[calc(100dvh-180px)] max-h-[calc(100dvh-180px)] overflow-hidden gap-0">
      {/* Left Panel: Lists */}
      <div className="h-full flex flex-col overflow-y-auto border-r border-slate-200" style={{ width: leftWidth }}>
        <div className="flex-1 p-4 space-y-2">
          {/* Empty state: No lists or activities */}
          {!loading && lists.length === 0 && !isAddingList && (
            <div>
              {canManageLists && (
                <button
                  onClick={() => setIsAddingList(true)}
                  className="w-full rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-ocean hover:text-ink"
                >
                  + New List
                </button>
              )}
            </div>
          )}

          {listActionError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {listActionError}
            </p>
          ) : null}

          {isAddingList && (
            <div className="rounded-lg border border-slate-300 p-3 space-y-2">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name"
                className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                onKeyPress={(e) => e.key === "Enter" && handleAddList()}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                    onClick={handleAddList}
                    disabled={listCreateLoading}
                    className="flex-1 rounded-lg bg-ocean px-2 py-1 text-xs font-semibold text-white hover:bg-blue-600"
                  >
                    {listCreateLoading ? "Creating..." : "Create"}
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingList(false);
                      setNewListName("");
                    }}
                    disabled={listCreateLoading}
                    className="flex-1 rounded-lg bg-slate-200 px-2 py-1 text-xs font-semibold text-ink hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

          {lists.map((list) => (
            <div key={list.id} className="rounded-lg border border-slate-200">
              <div className="flex items-center justify-between bg-slate-50 px-4 py-2 hover:bg-slate-100">
                <button
                  type="button"
                  onClick={() => toggleCollapse(list.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <svg
                    className={`h-4 w-4 text-slate-600 transform transition-transform ${
                      collapsedLists[list.id] ? "-rotate-90" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  {editingListId === list.id ? (
                    <input
                      type="text"
                      value={editingListName}
                      onChange={(e) => setEditingListName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => handleRenameList(list.id)}
                      onKeyPress={(e) => e.key === "Enter" && handleRenameList(list.id)}
                      className="rounded px-2 py-1 text-sm font-semibold text-ink border border-ocean"
                      autoFocus
                    />
                  ) : (
                    <h3 className="min-w-0 truncate font-semibold text-ink text-sm">{list.name}</h3>
                  )}
                </button>
                {canManageLists && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingListId(list.id);
                        setEditingListName(list.name);
                      }}
                      className="p-1 text-slate-600 hover:text-ink text-sm"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteListConfirm(list);
                      }}
                      className="p-1 text-slate-600 hover:text-coral text-sm"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

                {!collapsedLists[list.id] && (
                  <div className="p-3 space-y-2">
                    {getListIdeas(list.id).map((idea) => (
                      <div key={idea.id} className="flex items-start gap-2 border-b border-slate-200 pb-2 last:border-0">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink text-sm">{idea.title}</p>
                          {idea.location && <p className="text-xs text-slate-600">{idea.location}</p>}
                          {Number.isFinite(Number(idea.costEstimate)) && (
                            <span className="text-xs text-ocean font-semibold">${Number(idea.costEstimate).toFixed(2)}</span>
                          )}
                        </div>
                        <VoteButtons
                          score={idea.voteScore || 0}
                          userVote={idea.userVote || 0}
                          onVote={(voteValue) => void onVoteIdea(idea.id, voteValue)}
                          layout="stack"
                        />
                        {(canManageLists || idea.createdById === userId) && (
                          <button
                            onClick={() => setDeleteIdeaConfirm(idea)}
                            className="text-xs text-coral hover:font-semibold flex-shrink-0"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => openComposer(list.id)}
                      className="w-full rounded-lg border-2 border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-ink hover:border-ocean"
                    >
                      + Add Activity
                    </button>
                  </div>
                )}
              </div>
            ))}

          {canManageLists && lists.length > 0 && !isAddingList && (
            <button
              onClick={() => setIsAddingList(true)}
              className="w-full rounded-lg border-2 border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-ocean hover:text-ink"
            >
              + New List
            </button>
          )}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMapDragStart}
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize list and map"
        className="group relative flex w-3 cursor-col-resize items-center justify-center border-x border-slate-300 bg-slate-100 transition-colors hover:bg-slate-200"
      >
        <div className="h-14 w-1.5 rounded-full bg-slate-400/70 transition-colors group-hover:bg-ocean" />
      </div>

      {/* Right Panel: Map */}
      <div className="h-full overflow-hidden" style={{ width: rightWidth }}>
        <TripMapPanel tripId={tripId} destination={trip?.destination} mappedIdeas={ideas} immersive />
      </div>

      {deleteListConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => setDeleteListConfirm(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">Delete list?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete {deleteListConfirm?.name ? `"${deleteListConfirm.name}"` : "this list"}? This will also remove
              the activities in it.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteListConfirm(null)}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteList(deleteListConfirm.id)}
                className="rounded-xl bg-coral px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteIdeaConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => setDeleteIdeaConfirm(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">Delete activity?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete {deleteIdeaConfirm?.title ? `"${deleteIdeaConfirm.title}"` : "this activity"}?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteIdeaConfirm(null)}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteIdea(deleteIdeaConfirm.id)}
                className="rounded-xl bg-coral px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {composerState ? (
        <ActivityComposerModal
          open={Boolean(composerState)}
          tabId={tab.id}
          destination={trip?.destination || null}
          listOptions={lists}
          defaultListId={composerState.defaultListId}
          defaultTitle={composerState.defaultTitle}
          onClose={() => setComposerState(null)}
          onSave={handleCreateIdea}
        />
      ) : null}
    </div>
  );
}

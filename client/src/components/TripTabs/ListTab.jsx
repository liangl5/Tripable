import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import TripMapPanel from "../TripMapPanel.jsx";
import { trackEvent } from "../../lib/analytics.js";
import ActivityComposerModal from "../ActivityComposerModal.jsx";
import VoteButtons from "../VoteButtons.jsx";
import ThreadedComments from "../ThreadedComments.jsx";
import { useTripStore } from "../../hooks/useTripStore.js";

export default function ListTab({
  tab,
  trip,
  tripId,
  userId,
  userRole,
  tripMembers,
  ideas,
  onAddIdea,
  onVoteIdea,
  onDeleteIdea
}) {
  const [lists, setLists] = useState([]);
  const [mapPanelWidth, setMapPanelWidth] = useState(50);
  const [panelHeight, setPanelHeight] = useState(null);
  const [collapsedLists, setCollapsedLists] = useState({});
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState("");
  const [loading, setLoading] = useState(false);
  const [listCreateLoading, setListCreateLoading] = useState(false);
  const [deleteListConfirm, setDeleteListConfirm] = useState(null);
  const [deleteIdeaConfirm, setDeleteIdeaConfirm] = useState(null);
  const [deleteListLoadingId, setDeleteListLoadingId] = useState(null);
  const [deleteIdeaLoadingId, setDeleteIdeaLoadingId] = useState(null);
  const [composerState, setComposerState] = useState(null);
  const [actionMenu, setActionMenu] = useState(null);
  const [dragState, setDragState] = useState({ ideaId: null, overListId: null, overIdeaId: null, overSide: null });
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [listActionError, setListActionError] = useState("");
  const containerRef = useRef(null);
  const mapDragRef = useRef(null);
  const actionMenuRef = useRef(null);
  const canManageLists = userRole === "owner" || userRole === "editor";
  const reloadIdeas = useTripStore((state) => state.loadIdeas);
  const updateIdea = useTripStore((state) => state.updateIdea);
  const reorderIdeas = useTripStore((state) => state.reorderIdeas);

  const DisclosureChevron = ({ open }) => (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : "rotate-0"}`}
    >
      <path
        d="M7.5 4.5L12.5 10L7.5 15.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let frameId = 0;

    const measurePanelHeight = () => {
      if (!containerRef.current) return;
      const viewportHeight = window.visualViewport?.height || window.innerHeight || 0;
      const { top } = containerRef.current.getBoundingClientRect();
      const nextHeight = Math.max(320, Math.round(viewportHeight - Math.max(top, 0)));
      setPanelHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    const scheduleMeasure = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        measurePanelHeight();
      });
    };

    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, []);

  const sortIdeas = (left, right) => {
    const leftOrder = Number.isFinite(Number(left?.order)) ? Number(left.order) : 0;
    const rightOrder = Number.isFinite(Number(right?.order)) ? Number(right.order) : 0;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return new Date(left?.createdAt || 0).getTime() - new Date(right?.createdAt || 0).getTime();
  };

  useEffect(() => {
    if (!actionMenu) return undefined;

    const handlePointerDown = (event) => {
      if (event.target?.closest?.("[data-action-menu-toggle='true']")) {
        return;
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActionMenu(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setActionMenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionMenu]);

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
      setDeleteListLoadingId(listId);
      await api.deleteList(listId);
      setLists(lists.filter((l) => l.id !== listId));
      await reloadIdeas(tripId);
      void trackEvent("list_deleted", {
        trip_id: tripId,
        list_id: listId
      });
      setDeleteListConfirm(null);
    } catch (error) {
      console.error("Failed to delete list:", error);
      setListActionError(error?.message || "Failed to delete list");
    } finally {
      setDeleteListLoadingId(null);
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

  const openListMenu = (listId) => {
    if (!canManageLists) return;
    setActionMenu({ kind: "list", id: listId });
  };

  const openIdeaMenu = (ideaId) => {
    if (!canManageLists && !ideas.some((idea) => idea.id === ideaId && idea.createdById === userId)) {
      return;
    }
    setActionMenu({ kind: "idea", id: ideaId });
  };

  const openComposer = (listId) => {
    const list = lists.find((candidate) => candidate.id === listId) || lists[0] || null;
    setComposerState({
      mode: "create",
      idea: null,
      defaultListId: list?.id || "",
      defaultListName: list?.name || "",
      defaultTitle: "",
      defaultLocation: "",
      defaultDescription: "",
      defaultCostEstimate: ""
    });
  };

  const openIdeaEditor = (idea) => {
    if (!idea) return;
    const list = lists.find((candidate) => candidate.id === idea.listId) || lists[0] || null;
    setComposerState({
      mode: "edit",
      idea,
      defaultListId: list?.id || idea.listId || "",
      defaultListName: list?.name || "",
      defaultTitle: idea.title || "",
      defaultLocation: idea.location || "",
      defaultDescription: idea.description || "",
      defaultCostEstimate: idea.costEstimate ?? ""
    });
    setActionMenu(null);
  };

  const getNextOrderForList = (listId, excludeIdeaId = null) => {
    return ideas.filter((idea) => {
      if (idea.listId !== listId || idea.tabId !== tab.id) return false;
      if (excludeIdeaId && idea.id === excludeIdeaId) return false;
      return true;
    }).length;
  };

  const resetDragState = () => {
    setDragState({ ideaId: null, overListId: null, overIdeaId: null, overSide: null });
  };

  const canReorderIdea = (idea) => {
    if (!idea) return false;
    return canManageLists || idea.createdById === userId;
  };

  const handleIdeaDragStart = (event, idea) => {
    if (!canReorderIdea(idea) || !idea?.id) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", idea.id);
    setActionMenu(null);
    setDragState({ ideaId: idea.id, overListId: idea.listId || null, overIdeaId: null, overSide: null });
  };

  const handleIdeaDragOver = (event, listId, overIdeaId = null) => {
    if (!dragState.ideaId) return;
    const draggedIdea = ideas.find((idea) => idea.id === dragState.ideaId);
    if (!canReorderIdea(draggedIdea)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    let overSide = null;
    if (overIdeaId) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const midpointY = bounds.top + bounds.height / 2;
      overSide = event.clientY >= midpointY ? "bottom" : "top";
    }
    setDragState((current) => {
      if (current.overListId === listId && current.overIdeaId === overIdeaId && current.overSide === overSide) {
        return current;
      }
      return {
        ...current,
        overListId: listId,
        overIdeaId,
        overSide
      };
    });
  };

  const commitIdeaDrop = async (draggedIdeaId, targetListId, targetIdeaId = null, targetSide = null) => {
    const draggedIdea = ideas.find((idea) => idea.id === draggedIdeaId && (!idea.tabId || idea.tabId === tab.id));
    if (!draggedIdea || !targetListId) return;

    const sourceListId = draggedIdea.listId;
    if (!sourceListId) return;
    if (sourceListId === targetListId && targetIdeaId === draggedIdeaId) return;

    const sourceIdeas = getListIdeas(sourceListId).filter((idea) => idea.id !== draggedIdeaId);
    const targetIdeasBase =
      sourceListId === targetListId
        ? sourceIdeas
        : getListIdeas(targetListId).filter((idea) => idea.id !== draggedIdeaId);

    let insertIndex = targetIdeasBase.length;
    if (targetIdeaId) {
      const targetIndex = targetIdeasBase.findIndex((idea) => idea.id === targetIdeaId);
      if (targetIndex >= 0) {
        insertIndex = targetSide === "bottom" ? targetIndex + 1 : targetIndex;
      }
    }

    const movedIdea = {
      ...draggedIdea,
      listId: targetListId,
      tabId: tab.id
    };
    const targetIdeas = [...targetIdeasBase];
    targetIdeas.splice(insertIndex, 0, movedIdea);

    const updates =
      sourceListId === targetListId
        ? targetIdeas.map((idea, index) => ({
            id: idea.id,
            listId: targetListId,
            tabId: tab.id,
            order: index
          }))
        : [
            ...sourceIdeas.map((idea, index) => ({
              id: idea.id,
              listId: sourceListId,
              tabId: tab.id,
              order: index
            })),
            ...targetIdeas.map((idea, index) => ({
              id: idea.id,
              listId: targetListId,
              tabId: tab.id,
              order: index
            }))
          ];

    if (!updates.length) return;

    try {
      setListActionError("");
      await reorderIdeas(tripId, updates, { movedIdeaId: draggedIdeaId });
      void trackEvent("activity_reordered_in_list_tab", {
        trip_id: tripId,
        idea_id: draggedIdeaId,
        from_list_id: sourceListId,
        to_list_id: targetListId
      });
    } catch (error) {
      console.error("Failed to reorder activity:", error);
      setListActionError(error?.message || "Failed to reorder activity");
    }
  };

  const handleIdeaDrop = async (event, listId, targetIdeaId = null) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedIdeaId = dragState.ideaId || event.dataTransfer.getData("text/plain");
    if (!draggedIdeaId) {
      resetDragState();
      return;
    }

    const draggedIdea = ideas.find((idea) => idea.id === draggedIdeaId);
    if (!canReorderIdea(draggedIdea)) {
      resetDragState();
      return;
    }

    await commitIdeaDrop(draggedIdeaId, listId, targetIdeaId, dragState.overSide);
    resetDragState();
  };

  const handleSaveActivity = async (payload) => {
    try {
      setListActionError("");
      const targetListId = payload.listId || composerState?.defaultListId || composerState?.idea?.listId || "";
      const targetOrder = composerState?.mode === "edit" && composerState?.idea?.listId === targetListId
        ? composerState.idea.order
        : getNextOrderForList(targetListId, composerState?.mode === "edit" ? composerState?.idea?.id : null);
      if (composerState?.mode === "edit" && composerState?.idea?.id) {
        const updatedIdea = await updateIdea(composerState.idea.id, tripId, {
          ...payload,
          tabId: tab.id,
          listId: targetListId,
          order: targetOrder
        });
        void trackEvent("activity_updated_from_list_tab", {
          trip_id: tripId,
          list_id: updatedIdea?.listId || payload.listId || "",
          idea_id: updatedIdea?.id || composerState.idea.id
        });
      } else {
        const createdIdea = await onAddIdea({
          ...payload,
          tabId: tab.id,
          listId: targetListId,
          order: targetOrder
        });
        void trackEvent("activity_created_from_list_tab", {
          trip_id: tripId,
          list_id: payload.listId || createdIdea?.listId || "",
          idea_id: createdIdea?.id || ""
        });
      }
      setComposerState(null);
    } catch (error) {
      console.error("Failed to add activity:", error);
      setListActionError(error?.message || "Failed to save activity");
    }
  };

  const handleDeleteIdea = async (ideaId) => {
    if (!deleteIdeaConfirm?.id || deleteIdeaConfirm.id !== ideaId) return;

    try {
      setListActionError("");
      setDeleteIdeaLoadingId(ideaId);
      await onDeleteIdea(ideaId);
      void trackEvent("activity_deleted_from_list_tab", {
        trip_id: tripId,
        idea_id: ideaId
      });
      setDeleteIdeaConfirm(null);
    } catch (error) {
      console.error("Failed to delete activity:", error);
      setListActionError(error?.message || "Failed to delete activity");
    } finally {
      setDeleteIdeaLoadingId(null);
    }
  };

  const toggleCollapse = (listId) => {
    setCollapsedLists({
      ...collapsedLists,
      [listId]: !collapsedLists[listId]
    });
  };

  const toggleDescription = (ideaId) => {
    setExpandedDescriptions((current) => ({
      ...current,
      [ideaId]: !current[ideaId]
    }));
  };

  const getListIdeas = (listId) => {
    return ideas
      .filter((idea) => idea.listId === listId && (!idea.tabId || idea.tabId === tab.id))
      .sort(sortIdeas);
  };
  const getIdeaLocationLabel = (idea) => {
    const primary = String(idea?.mapQuery || idea?.location || "").trim();
    return {
      primary,
      secondary: ""
    };
  };
  const ideasForThisTab = useMemo(() => {
    return (ideas || []).filter((idea) => idea?.tabId === tab.id);
  }, [ideas, tab.id]);
  const listIdsForThisTab = useMemo(() => new Set((lists || []).map((list) => list.id)), [lists]);
  const mappedIdeasForThisTab = useMemo(() => {
    if (!listIdsForThisTab.size) return [];
    return ideasForThisTab.filter((idea) => idea?.listId && listIdsForThisTab.has(idea.listId));
  }, [ideasForThisTab, listIdsForThisTab]);

  const leftWidth = `${100 - mapPanelWidth}%`;
  const rightWidth = `${mapPanelWidth}%`;
  const memberNamesById = (tripMembers || []).reduce((acc, member) => {
    acc[member.id] = member.name || member.email || "Traveler";
    return acc;
  }, {});
  const panelHeightStyle = panelHeight ? { height: `${panelHeight}px`, maxHeight: `${panelHeight}px` } : undefined;

  return (
    <div ref={containerRef} className="flex min-h-[320px] overflow-hidden gap-0" style={panelHeightStyle}>
      {/* Left Panel: Lists */}
      <div className="flex h-full min-h-0 flex-col border-r border-slate-200" style={{ width: leftWidth }}>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-2">
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
                    className="flex-1 rounded-lg bg-ocean px-2 py-1 text-xs font-semibold text-white hover:bg-[#152f2a]"
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
            <div
              key={list.id}
              className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                dragState.ideaId && dragState.overListId === list.id && !dragState.overIdeaId
                  ? "border-ocean ring-1 ring-ocean/25"
                  : "border-slate-200"
              }`}
              onDragOver={(event) => handleIdeaDragOver(event, list.id, null)}
              onDrop={(event) => void handleIdeaDrop(event, list.id, null)}
            >
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleCollapse(list.id)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-ink"
                  aria-label={collapsedLists[list.id] ? "Expand list" : "Collapse list"}
                >
                  <svg
                    className={`h-4 w-4 transform transition-transform ${collapsedLists[list.id] ? "-rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>

                <div className="min-w-0 flex-1">
                  {editingListId === list.id ? (
                    <input
                      type="text"
                      value={editingListName}
                      onChange={(e) => setEditingListName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => handleRenameList(list.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleRenameList(list.id);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingListId(null);
                          setEditingListName("");
                        }
                      }}
                      className="w-full rounded-xl border border-ocean bg-white px-3 py-2 text-sm font-semibold text-ink outline-none"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleCollapse(list.id)}
                      className="block w-full min-w-0 text-left"
                    >
                      <h3 className="truncate text-sm font-semibold text-ink">{list.name}</h3>
                    </button>
                  )}
                </div>

                {canManageLists ? (
                  <button
                    type="button"
                    data-action-menu-toggle="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      openListMenu(list.id);
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-ink"
                    aria-label="List actions"
                    title="List actions"
                  >
                    ⋯
                  </button>
                ) : null}

                {actionMenu?.kind === "list" && actionMenu?.id === list.id ? (
                  <div
                    ref={actionMenuRef}
                    className="absolute right-3 top-12 z-30 min-w-[180px] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-slate-100"
                      onClick={() => {
                        const target = lists.find((candidate) => candidate.id === actionMenu.id);
                        if (target) {
                          setEditingListId(target.id);
                          setEditingListName(target.name || "");
                          setCollapsedLists((current) => ({ ...current, [target.id]: false }));
                        }
                        setActionMenu(null);
                      }}
                    >
                      Edit list
                    </button>
                    <button
                      type="button"
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-coral transition hover:bg-rose-50"
                      onClick={() => {
                        const target = lists.find((candidate) => candidate.id === actionMenu.id);
                        if (target) {
                          setDeleteListConfirm(target);
                        }
                        setActionMenu(null);
                      }}
                    >
                      Delete list
                    </button>
                  </div>
                ) : null}
              </div>

              {!collapsedLists[list.id] ? (
                <div className="space-y-3 p-3">
                  {getListIdeas(list.id).map((idea) => {
                    const locationText = getIdeaLocationLabel(idea);
                    const canActOnIdea = canManageLists || idea.createdById === userId;
                    const isDragSource = dragState.ideaId === idea.id;
                    const isDropTarget =
                      Boolean(dragState.ideaId) &&
                      dragState.ideaId !== idea.id &&
                      dragState.overListId === list.id &&
                      dragState.overIdeaId === idea.id;
                    const showInsertionTop = isDropTarget && dragState.overSide === "top";
                    const showInsertionBottom = isDropTarget && dragState.overSide === "bottom";

                    const canDragIdea = canReorderIdea(idea);

                    return (
                      <div
                        key={idea.id}
                        draggable={canDragIdea}
                        onDragStart={(event) => handleIdeaDragStart(event, idea)}
                        onDragEnd={resetDragState}
                        onDragOver={(event) => handleIdeaDragOver(event, list.id, idea.id)}
                        onDrop={(event) => void handleIdeaDrop(event, list.id, idea.id)}
                        className={`relative rounded-xl border bg-slate-50/75 p-3 transition ${
                          isDropTarget
                            ? "border-ocean/70 ring-1 ring-ocean/25"
                            : "border-slate-200"
                        } ${isDragSource ? "opacity-65" : "opacity-100"} ${canDragIdea ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        {showInsertionTop ? (
                          <div className="pointer-events-none absolute -top-1 left-2 right-2 h-0.5 rounded-full bg-ocean" />
                        ) : null}
                        {showInsertionBottom ? (
                          <div className="pointer-events-none absolute -bottom-1 left-2 right-2 h-0.5 rounded-full bg-ocean" />
                        ) : null}
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-ink">{idea.title}</p>
                                {locationText.primary ? <p className="mt-0.5 truncate text-xs text-slate-600">{locationText.primary}</p> : null}
                                {idea.description ? (
                                  <div className="mt-1">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleDescription(idea.id);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 shadow-sm transition hover:border-ocean hover:text-ocean"
                                    >
                                      <span>Description</span>
                                      <DisclosureChevron open={Boolean(expandedDescriptions[idea.id])} />
                                    </button>
                                    {expandedDescriptions[idea.id] ? (
                                      <p className="mt-1 max-w-prose whitespace-pre-wrap text-xs leading-5 text-slate-600">
                                        {idea.description}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                                <p className="mt-0.5 text-[11px] text-slate-400">Added by {idea.submittedBy || "Traveler"}</p>
                                {idea.costEstimate !== null && idea.costEstimate !== undefined && idea.costEstimate !== "" && Number.isFinite(Number(idea.costEstimate)) ? (
                                  <p className="mt-1 text-[11px] font-semibold text-ocean">${Number(idea.costEstimate).toFixed(2)}</p>
                                ) : null}
                              </div>

                              <div className="flex shrink-0 items-start gap-1">
                                <VoteButtons
                                  upvotes={idea.upvoteCount}
                                  downvotes={idea.downvoteCount}
                                  userVote={idea.userVote || 0}
                                  onVote={(voteValue) => void onVoteIdea(idea.id, voteValue)}
                                  compact
                                  layout="stack"
                                />
                                {canActOnIdea ? (
                                  <button
                                    type="button"
                                    data-action-menu-toggle="true"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openIdeaMenu(idea.id);
                                    }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-ink"
                                    aria-label="Activity actions"
                                    title="Activity actions"
                                  >
                                    ⋯
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {actionMenu?.kind === "idea" && actionMenu?.id === idea.id ? (
                              <div
                                ref={actionMenuRef}
                                className="absolute right-3 top-12 z-30 min-w-[180px] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-slate-100"
                                  onClick={() => {
                                    const target = ideas.find((candidate) => candidate.id === actionMenu.id);
                                    if (target) {
                                      openIdeaEditor(target);
                                    }
                                    setActionMenu(null);
                                  }}
                                >
                                  Edit activity
                                </button>
                                <button
                                  type="button"
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-coral transition hover:bg-rose-50"
                                  onClick={() => {
                                    const target = ideas.find((candidate) => candidate.id === actionMenu.id);
                                    if (target) {
                                      setDeleteIdeaConfirm(target);
                                    }
                                    setActionMenu(null);
                                  }}
                                >
                                  Delete activity
                                </button>
                              </div>
                            ) : null}

                            <ThreadedComments
                              tableName="IdeaComment"
                              resourceColumn="ideaId"
                              resourceId={idea.id}
                              userId={userId}
                              userNamesById={memberNamesById}
                              canDeleteAnyComment={userRole === "owner"}
                              title="Comments"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => openComposer(list.id)}
                    className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-ocean hover:text-ink"
                  >
                    + Add Activity
                  </button>

                </div>
              ) : null}
            </div>
          ))}

          {canManageLists && lists.length > 0 && !isAddingList && (
            <button
              onClick={() => setIsAddingList(true)}
              className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-ocean hover:text-ink"
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
      <div className="h-full min-h-0 overflow-hidden" style={{ width: rightWidth }}>
        <TripMapPanel tripId={tripId} destination={trip?.destination} mappedIdeas={mappedIdeasForThisTab} immersive />
      </div>

      {deleteListConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => {
            if (!deleteListLoadingId) setDeleteListConfirm(null);
          }}
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
                disabled={Boolean(deleteListLoadingId)}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteList(deleteListConfirm.id)}
                disabled={Boolean(deleteListLoadingId)}
                className="rounded-xl bg-coral px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600"
              >
                {deleteListLoadingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteIdeaConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => {
            if (!deleteIdeaLoadingId) setDeleteIdeaConfirm(null);
          }}
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
                disabled={Boolean(deleteIdeaLoadingId)}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteIdea(deleteIdeaConfirm.id)}
                disabled={Boolean(deleteIdeaLoadingId)}
                className="rounded-xl bg-coral px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600"
              >
                {deleteIdeaLoadingId ? "Deleting..." : "Delete"}
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
          defaultListId={composerState.defaultListId}
          defaultListName={composerState.defaultListName}
          availableLists={lists}
          defaultTitle={composerState.defaultTitle}
          defaultLocation={composerState.defaultLocation}
          defaultDescription={composerState.defaultDescription}
          defaultCostEstimate={composerState.defaultCostEstimate}
          initialIdea={composerState.idea}
          submitLabel={composerState.mode === "edit" ? "Save changes" : "Add"}
          onClose={() => setComposerState(null)}
          onSave={handleSaveActivity}
        />
      ) : null}
    </div>
  );
}

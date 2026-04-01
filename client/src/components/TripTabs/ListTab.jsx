import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import TripMapPanel from "../TripMapPanel.jsx";
import IdeaCard from "../IdeaCard.jsx";
import VoteButtons from "../VoteButtons.jsx";

export default function ListTab({ tab, tripId, userId, userRole, ideas, onAddIdea, onVoteIdea, onDeleteIdea }) {
  const [lists, setLists] = useState([]);
  const [mapPanelWidth, setMapPanelWidth] = useState(50);
  const [draggedListId, setDraggedListId] = useState(null);
  const [sortBy, setSortBy] = useState("recent");
  const [collapsedLists, setCollapsedLists] = useState({});
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState("");
  const mapDragRef = useRef(null);
  const canManageLists = userRole === "owner" || userRole === "editor";

  // Load lists for this tab
  useEffect(() => {
    // Get unique list IDs from ideas
    const listIds = [...new Set(ideas.filter((idea) => idea.listId).map((idea) => idea.listId))];

    // Create list objects grouping ideas by listId
    const groupedLists = listIds.map((listId) => ({
      id: listId,
      name: listId,
      category: ideas.find((i) => i.listId === listId)?.category || listId,
      ideas: ideas.filter((i) => i.listId === listId)
    }));

    setLists(groupedLists);
  }, [ideas]);

  const handleMapDragStart = (e) => {
    mapDragRef.current = { startX: e.clientX, startWidth: mapPanelWidth };
  };

  const handleMouseMove = (e) => {
    if (!mapDragRef.current) return;

    const deltaX = e.clientX - mapDragRef.current.startX;
    const containerWidth = window.innerWidth;
    const newWidth = Math.max(20, Math.min(80, mapDragRef.current.startWidth + (deltaX / containerWidth) * 100));
    setMapPanelWidth(newWidth);
  };

  const handleMouseUp = () => {
    mapDragRef.current = null;
  };

  useEffect(() => {
    if (mapDragRef.current) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, []);

  const handleAddList = async () => {
    if (!newListName.trim()) return;

    try {
      const { data, error } = await supabase
        .from("Idea")
        .insert([
          {
            id: crypto.randomUUID(),
            tripId,
            title: newListName,
            category: "custom",
            entryType: "place",
            createdById: userId,
            createdAt: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setNewListName("");
      setIsAddingList(false);
      setLists([...lists, data]);
    } catch (error) {
      console.error("Failed to add list:", error);
      alert("Failed to create list");
    }
  };

  const handleDeleteList = async (listId) => {
    if (!window.confirm("Delete this list and all its activities?")) return;

    try {
      await supabase.from("Idea").delete().eq("listId", listId);
      setLists(lists.filter((l) => l.id !== listId));
    } catch (error) {
      console.error("Failed to delete list:", error);
      alert("Failed to delete list");
    }
  };

  const handleRenameList = async (listId) => {
    if (!editingListName.trim()) return;

    try {
      await supabase.from("Idea").update({ title: editingListName }).eq("id", listId);
      setLists(lists.map((l) => (l.id === listId ? { ...l, title: editingListName } : l)));
      setEditingListId(null);
      setEditingListName("");
    } catch (error) {
      console.error("Failed to rename list:", error);
      alert("Failed to rename list");
    }
  };

  const toggleCollapse = (listId) => {
    setCollapsedLists({
      ...collapsedLists,
      [listId]: !collapsedLists[listId]
    });
  };

  const getListIdeas = (listId) => {
    let filtered = ideas.filter((idea) => idea.listId === listId);

    if (sortBy === "upvoted") {
      filtered.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
    } else {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return filtered;
  };

  const leftWidth = `${100 - mapPanelWidth}%`;
  const rightWidth = `${mapPanelWidth}%`;

  return (
    <div className="flex h-[calc(100vh-200px)] gap-0">
      {/* Left Panel: Lists */}
      <div className="flex flex-col overflow-y-auto border-r border-slate-200" style={{ width: leftWidth }}>
        <div className="flex-1 p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Activities</h2>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm bg-white"
              >
                <option value="recent">Most Recent</option>
                <option value="upvoted">Most Upvoted</option>
              </select>
            </div>

            {lists.length === 0 && !isAddingList && (
              <button
                onClick={() => setIsAddingList(true)}
                className="w-full rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
              >
                Create First List
              </button>
            )}

            {isAddingList && (
              <div className="rounded-lg border border-slate-300 p-3 space-y-2">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="List name (e.g., Restaurants, Museums)"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  onKeyPress={(e) => e.key === "Enter" && handleAddList()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddList}
                    className="flex-1 rounded-lg bg-ocean px-2 py-1 text-xs font-semibold text-white hover:bg-blue-600"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingList(false);
                      setNewListName("");
                    }}
                    className="flex-1 rounded-lg bg-slate-200 px-2 py-1 text-xs font-semibold text-ink hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {lists.map((list) => (
              <div key={list.id} className="rounded-lg border border-slate-200">
                <button
                  onClick={() => toggleCollapse(list.id)}
                  className="w-full flex items-center justify-between bg-slate-50 px-4 py-3 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-2">
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
                      <h3 className="font-semibold text-ink">{list.title}</h3>
                    )}
                  </div>
                  {canManageLists && (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingListId(list.id);
                          setEditingListName(list.title);
                        }}
                        className="p-1 text-slate-600 hover:text-ink"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteList(list.id);
                        }}
                        className="p-1 text-slate-600 hover:text-coral"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </button>

                {!collapsedLists[list.id] && (
                  <div className="p-3 space-y-3">
                    {getListIdeas(list.id).map((idea) => (
                      <div key={idea.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                        {idea.photoUrl && (
                          <img
                            src={idea.photoUrl}
                            alt={idea.title}
                            className="w-full h-40 object-cover rounded-lg"
                          />
                        )}
                        <h4 className="font-semibold text-ink">{idea.title}</h4>
                        {idea.location && <p className="text-xs text-slate-600">{idea.location}</p>}
                        {idea.description && <p className="text-sm text-slate-700">{idea.description}</p>}

                        <div className="flex items-center gap-2">
                          <VoteButtons
                            idea={idea}
                            userId={userId}
                            onVote={(voteValue) => onVoteIdea(idea.id, voteValue)}
                          />
                          {(canManageLists || idea.createdById === userId) && (
                            <button
                              onClick={() => onDeleteIdea(idea.id)}
                              className="ml-auto text-xs text-coral hover:font-semibold"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => onAddIdea(list.id)}
                      className="w-full rounded-lg border-2 border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-ink hover:border-ocean"
                    >
                      + Add Activity
                    </button>
                  </div>
                )}
              </div>
            ))}

            {lists.length > 0 && !isAddingList && (
              <button
                onClick={() => setIsAddingList(true)}
                className="w-full rounded-lg border-2 border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-ink hover:border-ocean"
              >
                + New List
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMapDragStart}
        className="w-1 bg-slate-200 hover:bg-ocean cursor-col-resize transition-colors"
      />

      {/* Right Panel: Map */}
      <div className="overflow-hidden" style={{ width: rightWidth }}>
        <TripMapPanel tripId={tripId} destination={null} />
      </div>
    </div>
  );
}

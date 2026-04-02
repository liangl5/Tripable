import { useEffect, useState } from "react";
import { getTripTabs, reorderTabs, deleteTab, createTab, updateTab } from "../lib/tabManagement.js";
import { trackEvent } from "../lib/analytics.js";
import { useTripStore } from "../hooks/useTripStore.js";
import AvailabilityTab from "./TripTabs/AvailabilityTab.jsx";
import ListTab from "./TripTabs/ListTab.jsx";
import ItineraryTab from "./TripTabs/ItineraryTab.jsx";
import TransactionTab from "./TripTabs/TransactionTab.jsx";

const TAB_TYPE_OPTIONS = [
  { type: "availability", label: "Availability", aliases: ["1", "availability"] },
  { type: "list", label: "List", aliases: ["2", "list"] },
  { type: "itinerary", label: "Itinerary", aliases: ["3", "itinerary"] },
  {
    type: "expenses",
    label: "Expenses",
    aliases: ["4", "expenses", "expense", "budget", "transaction", "transactions"]
  }
];

export default function TabManager({ trip, tripId, userId, userRole, ideas, tripMembers }) {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [loading, setLoading] = useState(false);
  const [draggedTab, setDraggedTab] = useState(null);
  const [tabDeleteConfirm, setTabDeleteConfirm] = useState(null);
  const [tabDeleteLoading, setTabDeleteLoading] = useState(false);
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingTabName, setEditingTabName] = useState("");
  const [tabRenameLoading, setTabRenameLoading] = useState(false);
  const [tabCreateOpen, setTabCreateOpen] = useState(false);
  const [tabCreateType, setTabCreateType] = useState("availability");
  const [tabCreateName, setTabCreateName] = useState("");
  const [tabCreateError, setTabCreateError] = useState("");
  const canManageTabs = userRole === "owner" || userRole === "editor";

  // Load tabs on mount
  useEffect(() => {
    const loadTabs = async () => {
      try {
        setLoading(true);
        const loadedTabs = await getTripTabs(tripId);
        setTabs(loadedTabs);
        if (loadedTabs.length > 0) {
          setActiveTab(loadedTabs[0].id);
          void trackEvent("trip_tab_viewed", {
            trip_id: tripId,
            tab_id: loadedTabs[0].id,
            tab_type: loadedTabs[0].tabType || "custom"
          });
        }
      } catch (error) {
        console.error("Failed to load tabs:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTabs();
  }, [tripId]);

  const executeTabDelete = async (tabId) => {
    if (!canManageTabs) return;

    try {
      setTabDeleteLoading(true);
      await deleteTab(tabId);
      setTabs(tabs.filter((t) => t.id !== tabId));
      void trackEvent("trip_tab_deleted", {
        trip_id: tripId,
        tab_id: tabId
      });
      if (activeTab === tabId) {
        setActiveTab(tabs[0]?.id || null);
      }
    } catch (error) {
      console.error("Failed to delete tab:", error);
    } finally {
      setTabDeleteLoading(false);
    }
  };

  const handleTabDelete = (tab) => {
    if (!canManageTabs || !tab?.id) return;
    setTabDeleteConfirm({
      id: tab.id,
      name: tab.name
    });
  };

  const confirmTabDelete = async () => {
    if (!tabDeleteConfirm?.id || tabDeleteLoading) return;
    const tabId = tabDeleteConfirm.id;
    await executeTabDelete(tabId);
    setTabDeleteConfirm(null);
  };

  const openTabCreateModal = () => {
    if (!canManageTabs) return;
    setTabCreateError("");
    setTabCreateType("availability");
    setTabCreateName("");
    setTabCreateOpen(true);
  };

  const closeTabCreateModal = () => {
    if (tabRenameLoading) return;
    setTabCreateOpen(false);
    setTabCreateError("");
    setTabCreateName("");
  };

  const handleAddNewTab = async () => {
    if (!canManageTabs) return;

    const selectedOption = TAB_TYPE_OPTIONS.find((option) => option.type === tabCreateType) || TAB_TYPE_OPTIONS[0];
    const existingTypeCount = tabs.filter((tab) => tab.tabType === selectedOption.type).length;
    const defaultName = existingTypeCount > 0 ? `${selectedOption.label} ${existingTypeCount + 1}` : selectedOption.label;
    const nextName = String(tabCreateName || "").trim() || defaultName;

    try {
      const newTab = await createTab(tripId, nextName, selectedOption.type);
      setTabs([...tabs, newTab]);
      setActiveTab(newTab.id);
      void trackEvent("trip_tab_created", {
        trip_id: tripId,
        tab_id: newTab.id,
        tab_type: selectedOption.type
      });
      closeTabCreateModal();
    } catch (error) {
      console.error("Failed to create tab:", error);
      setTabCreateError(error?.message || "Failed to create tab.");
    }
  };

  const beginTabRename = (tab) => {
    if (!canManageTabs || !tab?.id) return;
    setEditingTabId(tab.id);
    setEditingTabName(tab.name || "");
  };

  const cancelTabRename = () => {
    if (tabRenameLoading) return;
    setEditingTabId(null);
    setEditingTabName("");
  };

  const submitTabRename = async (tab) => {
    if (!canManageTabs || !tab?.id || tabRenameLoading) return;
    const nextName = String(editingTabName || "").trim();

    if (!nextName) {
      cancelTabRename();
      return;
    }

    if (nextName === tab.name) {
      cancelTabRename();
      return;
    }

    try {
      setTabRenameLoading(true);
      const updated = await updateTab(tab.id, { name: nextName });
      setTabs((prev) => prev.map((candidate) => (candidate.id === tab.id ? { ...candidate, ...updated } : candidate)));
      void trackEvent("trip_tab_renamed", {
        trip_id: tripId,
        tab_id: tab.id,
        tab_type: tab.tabType || "custom"
      });
      setEditingTabId(null);
      setEditingTabName("");
    } catch (error) {
      console.error("Failed to rename tab:", error);
    } finally {
      setTabRenameLoading(false);
    }
  };

  const handleDragStart = (tabId) => {
    setDraggedTab(tabId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDropOnTab = async (targetId) => {
    if (!draggedTab || draggedTab === targetId) {
      setDraggedTab(null);
      return;
    }

    const fromIndex = tabs.findIndex((t) => t.id === draggedTab);
    const toIndex = tabs.findIndex((t) => t.id === targetId);

    const newTabs = Array.from(tabs);
    const [moved] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, moved);

    setTabs(newTabs);

    try {
      await reorderTabs(
        tripId,
        newTabs.map((t) => t.id)
      );
    } catch (error) {
      console.error("Failed to reorder tabs:", error);
      // Revert on error
      setTabs(tabs);
    }

    setDraggedTab(null);
  };

  // List tab callbacks
  const handleAddIdea = async (payload) => {
    const ideaPayload = payload && typeof payload === "object" ? payload : null;
    if (!ideaPayload?.title) return;

    try {
      const createdIdea = await useTripStore.getState().addIdea(tripId, {
        ...ideaPayload,
        tabId: ideaPayload.tabId || null,
        listId: ideaPayload.listId || null,
        category: ideaPayload.category || null
      });
      return createdIdea;
    } catch (error) {
      console.error("Failed to add activity:", error);
      throw error;
    }
  };

  const handleVoteIdea = async (ideaId, value) => {
    try {
      await useTripStore.getState().voteIdea(ideaId, value);
    } catch (error) {
      console.error("Failed to vote:", error);
    }
  };

  const handleDeleteIdea = async (ideaId) => {
    try {
      await useTripStore.getState().deleteIdea(ideaId, tripId);
    } catch (error) {
      console.error("Failed to delete activity:", error);
    }
  };

  const activeTabData = tabs.find((t) => t.id === activeTab);

  if (loading) {
    return <div className="p-6 text-center text-slate-600">Loading tabs...</div>;
  }

  const renderTabPanel = (tab) => {
    switch (tab.tabType) {
      case "availability":
        return (
          <AvailabilityTab
            tab={tab}
            tripId={tripId}
            userId={userId}
            userRole={userRole}
          />
        );
      case "list":
        return (
          <ListTab
            tab={tab}
            tripId={tripId}
            trip={trip}
            userId={userId}
            userRole={userRole}
            ideas={ideas}
            onAddIdea={handleAddIdea}
            onVoteIdea={handleVoteIdea}
            onDeleteIdea={handleDeleteIdea}
          />
        );
      case "itinerary":
        return (
          <ItineraryTab
            tab={tab}
            tripId={tripId}
            userId={userId}
            userRole={userRole}
            ideas={ideas}
            trip={trip}
          />
        );
      case "expenses":
        return (
          <TransactionTab
            tab={tab}
            tripId={tripId}
            userId={userId}
            userRole={userRole}
            tripMembers={tripMembers}
          />
        );
      default:
        return <div className="p-6">Custom tab: {tab.name}</div>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-slate-200 bg-white overflow-x-auto px-3">
        <div className="flex min-w-max items-end gap-1">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              draggable={canManageTabs}
              onDragStart={() => handleDragStart(tab.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDropOnTab(tab.id)}
              className={`-mb-px flex items-center gap-2 rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium leading-none transition-all duration-150 ${
                activeTab === tab.id
                  ? "border-slate-200 bg-white text-ink shadow-[0_-1px_0_rgba(0,0,0,0.02)]"
                  : "border-transparent bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700"
              } ${canManageTabs ? "cursor-move" : ""}`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  void trackEvent("trip_tab_viewed", {
                    trip_id: tripId,
                    tab_id: tab.id,
                    tab_type: tab.tabType || "custom"
                  });
                }}
                className="min-w-0"
              >
                {editingTabId === tab.id ? (
                  <input
                    type="text"
                    value={editingTabName}
                    onChange={(event) => setEditingTabName(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onBlur={() => void submitTabRename(tab)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitTabRename(tab);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelTabRename();
                      }
                    }}
                    disabled={tabRenameLoading}
                    className="rounded border border-ocean px-2 py-1 text-sm font-medium text-ink"
                    autoFocus
                  />
                ) : (
                  <span>{tab.name}</span>
                )}
              </button>

              {canManageTabs && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      beginTabRename(tab);
                    }}
                    className="rounded p-0.5 text-slate-400 transition hover:bg-white hover:text-ocean"
                    title="Rename tab"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleTabDelete(tab);
                    }}
                    className="rounded p-0.5 text-slate-400 transition hover:bg-white hover:text-coral"
                    title="Delete tab"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}

          {canManageTabs && (
            <button
              onClick={openTabCreateModal}
              className="-mb-px rounded-t-lg border border-transparent border-b-0 bg-slate-50 px-4 py-2 text-sm font-medium leading-none text-slate-600 transition-all duration-150 hover:border-slate-200 hover:bg-slate-100 hover:text-ink"
            >
              + New Tab
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {tabs.map((tab) => (
          <div key={tab.id} className={activeTab === tab.id ? "block" : "hidden"}>
            {renderTabPanel(tab)}
          </div>
        ))}
      </div>

      {tabDeleteConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => {
            if (!tabDeleteLoading) setTabDeleteConfirm(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">Delete tab?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete {tabDeleteConfirm.name ? `"${tabDeleteConfirm.name}"` : "this tab"}? This cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setTabDeleteConfirm(null)}
                disabled={tabDeleteLoading}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmTabDelete}
                disabled={tabDeleteLoading}
                className="rounded-xl bg-coral px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
              >
                {tabDeleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tabCreateOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"
          onClick={closeTabCreateModal}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">Create tab</h3>
            <p className="mt-2 text-sm text-slate-600">Pick a tab type and optionally give it a name.</p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tab type</span>
                <select
                  value={tabCreateType}
                  onChange={(event) => setTabCreateType(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-ink"
                >
                  {TAB_TYPE_OPTIONS.map((option) => (
                    <option key={option.type} value={option.type}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Optional tab name
                </span>
                <input
                  type="text"
                  value={tabCreateName}
                  onChange={(event) => setTabCreateName(event.target.value)}
                  placeholder="Leave blank to use the default name"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-ink"
                />
              </label>

              {tabCreateError ? <p className="text-sm text-coral">{tabCreateError}</p> : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeTabCreateModal}
                disabled={tabRenameLoading}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAddNewTab()}
                disabled={tabRenameLoading}
                className="rounded-xl bg-ocean px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getTripTabs, reorderTabs, deleteTab, createTab } from "../lib/tabManagement.js";
import { trackEvent } from "../lib/analytics.js";
import AvailabilityTab from "./TripTabs/AvailabilityTab.jsx";
import ListTab from "./TripTabs/ListTab.jsx";
import ItineraryTab from "./TripTabs/ItineraryTab.jsx";
import TransactionTab from "./TripTabs/TransactionTab.jsx";

export default function TabManager({ trip, tripId, userId, userRole, ideas, tripMembers }) {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [loading, setLoading] = useState(false);
  const [draggedTab, setDraggedTab] = useState(null);
  const [tabDeleteConfirm, setTabDeleteConfirm] = useState(null);
  const [tabDeleteLoading, setTabDeleteLoading] = useState(false);
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

  const handleAddNewTab = async () => {
    if (!canManageTabs) return;

    const name = prompt("Tab name:");
    if (!name) return;

    try {
      const newTab = await createTab(tripId, name, "custom");
      setTabs([...tabs, newTab]);
      setActiveTab(newTab.id);
      void trackEvent("trip_tab_created", {
        trip_id: tripId,
        tab_id: newTab.id,
        tab_type: "custom"
      });
    } catch (error) {
      console.error("Failed to create tab:", error);
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

  const activeTabData = tabs.find((t) => t.id === activeTab);

  if (loading) {
    return <div className="p-6 text-center text-slate-600">Loading tabs...</div>;
  }

  const renderTabContent = () => {
    if (!activeTabData) return null;

    switch (activeTabData.tabType) {
      case "availability":
        return (
          <AvailabilityTab
            tab={activeTabData}
            tripId={tripId}
            userId={userId}
            userRole={userRole}
          />
        );
      case "list":
        return (
          <ListTab
            tab={activeTabData}
            tripId={tripId}
            userId={userId}
            userRole={userRole}
            ideas={ideas}
            onAddIdea={() => {}}
            onVoteIdea={() => {}}
            onDeleteIdea={() => {}}
          />
        );
      case "itinerary":
        return (
          <ItineraryTab
            tab={activeTabData}
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
            tab={activeTabData}
            tripId={tripId}
            userId={userId}
            userRole={userRole}
            tripMembers={tripMembers}
          />
        );
      default:
        return <div className="p-6">Custom tab: {activeTabData.name}</div>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-slate-200 bg-white overflow-x-auto px-3">
        <div className="flex min-w-max items-end gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              draggable={canManageTabs}
              onDragStart={() => handleDragStart(tab.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDropOnTab(tab.id)}
              onClick={() => {
                setActiveTab(tab.id);
                void trackEvent("trip_tab_viewed", {
                  trip_id: tripId,
                  tab_id: tab.id,
                  tab_type: tab.tabType || "custom"
                });
              }}
              className={`-mb-px flex items-center gap-2 rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium leading-none transition-all duration-150 ${
                activeTab === tab.id
                  ? "border-slate-200 bg-white text-ink shadow-[0_-1px_0_rgba(0,0,0,0.02)]"
                  : "border-transparent bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700"
              } ${canManageTabs ? "cursor-move" : ""}`}
            >
              <span>{tab.name}</span>
              {canManageTabs && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTabDelete(tab);
                  }}
                  className="rounded p-0.5 text-slate-400 transition hover:bg-white hover:text-coral"
                >
                  ✕
                </button>
              )}
            </button>
          ))}

          {canManageTabs && (
            <button
              onClick={handleAddNewTab}
              className="-mb-px rounded-t-lg border border-transparent border-b-0 bg-slate-50 px-4 py-2 text-sm font-medium leading-none text-slate-600 transition-all duration-150 hover:border-slate-200 hover:bg-slate-100 hover:text-ink"
            >
              + New Tab
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {renderTabContent()}
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
    </div>
  );
}

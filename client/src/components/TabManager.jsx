import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getTripTabs, reorderTabs, deleteTab, createTab, updateTab } from "../lib/tabManagement.js";
import { trackEvent } from "../lib/analytics.js";
import { useTripStore } from "../hooks/useTripStore.js";
import { supabase } from "../lib/supabase.js";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AddIcon from "@mui/icons-material/Add";
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

const TAB_PANEL_CACHE_LIMIT = 4;

export default function TabManager({ trip, tripId, userId, userRole, ideas, tripMembers }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [displayedTabId, setDisplayedTabId] = useState(null);
  const [hydratedTab, setHydratedTab] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draggedTab, setDraggedTab] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null);
  const [tabDeleteConfirm, setTabDeleteConfirm] = useState(null);
  const [tabDeleteLoading, setTabDeleteLoading] = useState(false);
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingTabName, setEditingTabName] = useState("");
  const [tabNameError, setTabNameError] = useState("");
  const [tabRenameLoading, setTabRenameLoading] = useState(false);
  const [tabCreateOpen, setTabCreateOpen] = useState(false);
  const [tabCreateType, setTabCreateType] = useState("availability");
  const [tabCreateName, setTabCreateName] = useState("");
  const [tabCreateError, setTabCreateError] = useState("");
  const [tabMenu, setTabMenu] = useState(null);
  const [hoveredTabId, setHoveredTabId] = useState(null);
  const [tabDropdownOpen, setTabDropdownOpen] = useState(false);
  const [tabDropdownPosition, setTabDropdownPosition] = useState(null);
  const [buttonTooltip, setButtonTooltip] = useState(null);
  const [cachedTabIds, setCachedTabIds] = useState([]);
  const [tabReadyById, setTabReadyById] = useState({});
  const [activePanelEntered, setActivePanelEntered] = useState(true);
  const tabStripRef = useRef(null);
  const tabMenuRef = useRef(null);
  const tabDropdownRef = useRef(null);
  const canManageTabs = userRole === "owner" || userRole === "editor";
  const isAsyncTabType = (tabType) => tabType === "availability" || tabType === "list" || tabType === "itinerary" || tabType === "expenses";

  const normalizeTabName = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  const isTabNameTaken = (candidateName, excludeTabId = null) => {
    const normalized = normalizeTabName(candidateName);
    if (!normalized) return false;
    return tabs.some((tab) => tab.id !== excludeTabId && normalizeTabName(tab.name) === normalized);
  };

  const urlTabId = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return params.get("tab") || "";
  }, [location.search]);

  const syncUrlTab = (nextTabId, { replace } = { replace: false }) => {
    const nextId = String(nextTabId || "").trim();
    const params = new URLSearchParams(location.search || "");
    if (nextId) {
      params.set("tab", nextId);
    } else {
      params.delete("tab");
    }
    const nextSearch = params.toString();
    const search = nextSearch ? `?${nextSearch}` : "";
    if (search === (location.search || "")) return;
    navigate(
      {
        pathname: location.pathname,
        search
      },
      { replace: Boolean(replace) }
    );
  };

  // Load tabs on mount
  useEffect(() => {
    const loadTabs = async () => {
      try {
        setLoading(true);
        const loadedTabs = await getTripTabs(tripId);
        setTabs(loadedTabs);
        if (loadedTabs.length > 0) {
          let storedTabId = "";
          const urlPreferred = loadedTabs.some((tab) => tab.id === urlTabId) ? urlTabId : "";
          if (urlPreferred) {
            storedTabId = urlPreferred;
          }
          if (userId) {
            const { data, error } = await supabase
              .from("TripTabPreference")
              .select("activeTabId")
              .eq("tripId", tripId)
              .eq("userId", userId)
              .maybeSingle();
            if (error) {
              if (!String(error.message || "").includes("TripTabPreference")) {
                throw error;
              }
            } else {
              storedTabId = storedTabId || data?.activeTabId || "";
            }
          }
          const nextActive = loadedTabs.some((tab) => tab.id === storedTabId) ? storedTabId : loadedTabs[0].id;
          setActiveTab(nextActive);
          setDisplayedTabId(nextActive);
          syncUrlTab(nextActive, { replace: true });
          setHydratedTab(true);
        }
      } catch (error) {
        console.error("Failed to load tabs:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTabs();
  }, [tripId, userId]);

  // Respond to back/forward navigation between tabs.
  useEffect(() => {
    if (!hydratedTab || !tabs.length) return;
    if (!urlTabId) return;
    if (!tabs.some((tab) => tab.id === urlTabId)) return;
    if (activeTab === urlTabId) return;
    setActiveTab(urlTabId);
  }, [activeTab, hydratedTab, tabs, urlTabId]);

  useEffect(() => {
    if (!activeTab || !userId) return;
    const activeTabData = tabs.find((tab) => tab.id === activeTab);
    void supabase
      .from("TripTabPreference")
      .upsert(
        {
          tripId,
          userId,
          activeTabId: activeTab,
          updatedAt: new Date().toISOString()
        },
        { onConflict: "tripId,userId" }
      );
    if (activeTabData && hydratedTab) {
      void trackEvent("trip_tab_viewed", {
        trip_id: tripId,
        tab_id: activeTab,
        tab_type: activeTabData.tabType || "custom"
      });
    }
  }, [activeTab, tabs, tripId, userId, hydratedTab]);

  useEffect(() => {
    if (!activeTab) return;
    setTabReadyById((current) => ({ ...current, [activeTab]: false }));
  }, [activeTab]);

  useEffect(() => {
    setTabReadyById((current) => {
      const validIds = new Set(tabs.map((tab) => tab.id));
      const next = {};
      Object.entries(current).forEach(([tabId, ready]) => {
        if (validIds.has(tabId)) {
          next[tabId] = ready;
        }
      });
      return next;
    });
  }, [tabs]);

  useEffect(() => {
    if (!activeTab) return;
    const activeTabEntry = tabs.find((tab) => tab.id === activeTab);
    if (!activeTabEntry) return;

    if (!isAsyncTabType(activeTabEntry.tabType) || tabReadyById[activeTab]) {
      setDisplayedTabId(activeTab);
    }
  }, [activeTab, tabReadyById, tabs]);

  useEffect(() => {
    if (!displayedTabId) return;
    setCachedTabIds((current) => {
      const validTabIds = new Set(tabs.map((tab) => tab.id));
      const next = [...current.filter((id) => id !== displayedTabId && validTabIds.has(id)), displayedTabId];
      return next.slice(-TAB_PANEL_CACHE_LIMIT);
    });
  }, [displayedTabId, tabs]);

  useEffect(() => {
    if (!displayedTabId) return;
    setActivePanelEntered(false);
    const frameId = window.requestAnimationFrame(() => {
      setActivePanelEntered(true);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [displayedTabId]);

  const handleTabReadyChange = (tabId, ready) => {
    if (!tabId) return;
    setTabReadyById((current) => {
      if (current[tabId] === ready) return current;
      return { ...current, [tabId]: ready };
    });
  };

  useEffect(() => {
    if (!draggedTab) return undefined;

    const handleWindowDragOver = (event) => {
      const strip = tabStripRef.current;
      if (!strip) return;
      const rect = strip.getBoundingClientRect();
      const margin = 12;
      const outsideX = event.clientX < rect.left - margin || event.clientX > rect.right + margin;
      const outsideY = event.clientY < rect.top - margin || event.clientY > rect.bottom + margin;
      if (outsideX || outsideY) {
        setDropIndicator(null);
      }
    };

    window.addEventListener("dragover", handleWindowDragOver);
    return () => window.removeEventListener("dragover", handleWindowDragOver);
  }, [draggedTab]);

  useEffect(() => {
    if (!tabMenu && !tabDropdownOpen) return undefined;

    const handlePointerDown = (event) => {
      if (event.target?.closest?.("[data-tab-menu-toggle='true']")) {
        return;
      }
      if (event.target?.closest?.("[data-tab-dropdown-toggle='true']")) {
        return;
      }
      if (tabMenuRef.current && !tabMenuRef.current.contains(event.target)) {
        setTabMenu(null);
      }
      if (tabDropdownRef.current && !tabDropdownRef.current.contains(event.target)) {
        setTabDropdownOpen(false);
        setTabDropdownPosition(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setTabMenu(null);
        setTabDropdownOpen(false);
        setTabDropdownPosition(null);
      }
    };

    const handleViewportChange = () => {
      setTabMenu(null);
      setTabDropdownOpen(false);
      setTabDropdownPosition(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [tabMenu, tabDropdownOpen]);

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
    setTabNameError("");
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
    const requestedName = String(tabCreateName || "").trim();
    let nextName = requestedName || defaultName;

    if (requestedName && isTabNameTaken(requestedName)) {
      setTabCreateError("Tab name already exists. Pick a different name.");
      return;
    }
    if (!requestedName) {
      let suffix = 2;
      while (isTabNameTaken(nextName)) {
        suffix += 1;
        nextName = `${defaultName} ${suffix}`;
      }
    }

    try {
      const newTab = await createTab(tripId, nextName, selectedOption.type);
      setTabs([...tabs, newTab]);
      setActiveTab(newTab.id);
      syncUrlTab(newTab.id, { replace: false });
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
    setTabNameError("");
  };

  const cancelTabRename = () => {
    if (tabRenameLoading) return;
    setEditingTabId(null);
    setEditingTabName("");
    setTabNameError("");
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

    if (isTabNameTaken(nextName, tab.id)) {
      setTabNameError("Tab name already exists. Pick a different name.");
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

  const handleDragStart = (event, tab) => {
    const dataTransfer = event?.dataTransfer;
    if (dataTransfer) {
      dataTransfer.effectAllowed = "move";
      const preview = document.createElement("div");
      preview.textContent = tab.name || "Tab";
      preview.style.position = "fixed";
      preview.style.top = "-1000px";
      preview.style.left = "-1000px";
      preview.style.display = "inline-flex";
      preview.style.alignItems = "center";
      preview.style.justifyContent = "center";
      preview.style.padding = "6px 10px";
      preview.style.borderRadius = "10px";
      preview.style.background = "rgba(226, 232, 240, 0.85)";
      preview.style.border = "1px solid rgba(148, 163, 184, 0.95)";
      preview.style.color = "#1e293b";
      preview.style.fontSize = "12px";
      preview.style.fontWeight = "600";
      preview.style.boxShadow = "0 10px 24px rgba(15, 23, 42, 0.18)";
      document.body.appendChild(preview);
      dataTransfer.setDragImage(preview, 20, 16);
      window.requestAnimationFrame(() => {
        document.body.removeChild(preview);
      });
    }

    setDraggedTab(tab.id);
    document.body.style.cursor = "grabbing";
  };

  const handleDragEnd = () => {
    setDraggedTab(null);
    setDropIndicator(null);
    document.body.style.cursor = "";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleTabDragOver = (event, tabId) => {
    event.preventDefault();
    if (event?.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    if (!draggedTab) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const midpoint = bounds.left + bounds.width / 2;
    const side = event.clientX > midpoint ? "right" : "left";

    setDropIndicator((prev) => {
      if (prev?.tabId === tabId && prev?.side === side) return prev;
      return { tabId, side };
    });
  };

  const handleDropOnTab = async (targetId) => {
    if (!draggedTab) {
      setDraggedTab(null);
      setDropIndicator(null);
      document.body.style.cursor = "";
      return;
    }

    const fromIndex = tabs.findIndex((t) => t.id === draggedTab);
    const targetIndex = tabs.findIndex((t) => t.id === targetId);
    const insertAfterTarget = dropIndicator?.tabId === targetId && dropIndicator?.side === "right";
    const baseInsertIndex = insertAfterTarget ? targetIndex + 1 : targetIndex;
    const adjustedInsertIndex = fromIndex < baseInsertIndex ? baseInsertIndex - 1 : baseInsertIndex;

    const newTabs = Array.from(tabs);
    const [moved] = newTabs.splice(fromIndex, 1);
    newTabs.splice(adjustedInsertIndex, 0, moved);

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
    setDropIndicator(null);
    document.body.style.cursor = "";
  };

  const openTabContextMenuAt = (tabId, x) => {
    if (!canManageTabs) return;
    const strip = tabStripRef.current;
    const stripRect = strip?.getBoundingClientRect();
    setTabMenu({
      tabId,
      x,
      y: (stripRect?.bottom || 0) + 6
    });
  };

  const showButtonTooltip = (event, text) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setButtonTooltip({
      text,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8
    });
  };

  const hideButtonTooltip = () => {
    setButtonTooltip(null);
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
    return <div className="p-6" />;
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
            isActive={activeTab === tab.id}
            onReadyChange={(ready) => handleTabReadyChange(tab.id, ready)}
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
            tripMembers={tripMembers}
            ideas={ideas}
            onAddIdea={handleAddIdea}
            onVoteIdea={handleVoteIdea}
            onDeleteIdea={handleDeleteIdea}
            isActive={activeTab === tab.id}
            onReadyChange={(ready) => handleTabReadyChange(tab.id, ready)}
          />
        );
      case "itinerary":
        return (
          <ItineraryTab
            tab={tab}
            tripId={tripId}
            userId={userId}
            userRole={userRole}
            tripMembers={tripMembers}
            ideas={ideas}
            trip={trip}
            isActive={activeTab === tab.id}
            onReadyChange={(ready) => handleTabReadyChange(tab.id, ready)}
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
            isActive={activeTab === tab.id}
            onReadyChange={(ready) => handleTabReadyChange(tab.id, ready)}
          />
        );
      default:
        return <div className="p-6">Custom tab: {tab.name}</div>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {buttonTooltip ? (
        <div
          className="pointer-events-none fixed z-[95] -translate-x-1/2 rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white shadow-lg"
          style={{ left: buttonTooltip.x, top: buttonTooltip.y }}
        >
          {buttonTooltip.text}
        </div>
      ) : null}
      {/* Tab Navigation */}
      <div ref={tabStripRef} className="h-10 overflow-x-hidden overflow-y-visible border-t border-slate-200 bg-[#baf59c]/50 pl-0 pr-3">
        <div className="flex h-full w-full items-stretch">
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            const leftNeighborActive = tabs[index - 1]?.id === activeTab;
            const leftNeighborHovered = tabs[index - 1]?.id === hoveredTabId;
            const isHovered = hoveredTabId === tab.id;
            const showLeftDivider = index > 0 && !isActive && !leftNeighborActive && !isHovered && !leftNeighborHovered;

            return (
            <div key={tab.id} className="relative flex h-full shrink-0 items-stretch">
              <div
                    className={`relative -mb-px flex h-full items-center gap-2 whitespace-nowrap px-5 py-0 text-sm font-medium leading-none transition-[background-color,border-color,color,box-shadow,transform,padding] duration-200 ease-out cursor-pointer ${
                isActive
                      ? "relative z-30 rounded-t-lg border border-slate-200 border-b-transparent bg-white pr-8 text-ink"
                      : `rounded-t-lg border border-transparent bg-transparent text-[#1e4840] hover:relative hover:z-20 hover:bg-[#9dd67f]/70 hover:text-[#173630] ${showLeftDivider ? "before:absolute before:left-0 before:top-1 before:bottom-1 before:w-px before:bg-slate-300 before:content-['']" : ""}`
              } ${canManageTabs && draggedTab === tab.id ? "cursor-grabbing" : ""} ${draggedTab === tab.id ? "border-slate-300 bg-slate-200/70 text-slate-500" : ""}`}
                draggable={canManageTabs}
                onClick={() => {
                  if (draggedTab) return;
                  setTabMenu(null);
                  setActiveTab(tab.id);
                  syncUrlTab(tab.id, { replace: false });
                  void trackEvent("trip_tab_viewed", {
                    trip_id: tripId,
                    tab_id: tab.id,
                    tab_type: tab.tabType || "custom"
                  });
                }}
                  onMouseEnter={() => setHoveredTabId(tab.id)}
                  onMouseLeave={() => setHoveredTabId((current) => (current === tab.id ? null : current))}
                onDragStart={(event) => handleDragStart(event, tab)}
                onDragEnd={handleDragEnd}
                onDragOver={(event) => handleTabDragOver(event, tab.id)}
                onDrop={() => handleDropOnTab(tab.id)}
                onContextMenu={(event) => {
                  if (!canManageTabs) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  openTabContextMenuAt(tab.id, rect.left);
                }}
              >
                <div
                  className={`min-w-0 whitespace-nowrap font-medium ${draggedTab === tab.id ? "invisible" : ""}`}
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
                      className={`rounded border px-2 py-1 text-sm font-medium text-ink ${
                        tabNameError ? "border-rose-400" : "border-ocean"
                      }`}
                      autoFocus
                    />
                  ) : (
                    <span>{tab.name}</span>
                  )}
                </div>

                {canManageTabs ? (
                  <button
                    type="button"
                    data-tab-menu-toggle="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!isActive) {
                        setActiveTab(tab.id);
                        syncUrlTab(tab.id, { replace: false });
                      }
                      if (tabMenu?.tabId === tab.id) {
                        setTabMenu(null);
                        return;
                      }
                      const rect = event.currentTarget.getBoundingClientRect();
                      openTabContextMenuAt(tab.id, rect.left);
                    }}
                    className={`absolute right-2 top-1/2 z-40 h-5 w-5 -translate-y-1/2 rounded p-0 text-slate-500 transition-opacity duration-150 hover:bg-white hover:text-[#1e4840] ${
                      isActive && draggedTab !== tab.id ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
                    aria-label="Open tab menu"
                    title="Tab options"
                  >
                    <ExpandMoreIcon fontSize="small" />
                  </button>
                ) : null}
              </div>

              {dropIndicator?.tabId === tab.id ? (
                <div
                  className={`pointer-events-none absolute bottom-0 top-2 w-0.5 rounded-full bg-slate-500/80 ${
                    dropIndicator.side === "right" ? "-right-0.5" : "-left-0.5"
                  }`}
                />
              ) : null}
            </div>
            );
          })}

          {canManageTabs && (
            <>
              <div
                className={`relative -mb-px flex h-full items-stretch border-y border-y-transparent ${
                  tabs.length > 0 && (activeTab === tabs[tabs.length - 1]?.id || hoveredTabId === tabs[tabs.length - 1]?.id)
                    ? "before:opacity-0"
                    : "before:opacity-100"
                } before:absolute before:left-0 before:top-1 before:bottom-1 before:w-px before:bg-slate-300 before:content-['']`}
              >
                <button
                  type="button"
                  data-tab-dropdown-toggle="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    setButtonTooltip(null);
                    const rect = event.currentTarget.getBoundingClientRect();
                    setTabDropdownOpen((current) => {
                      const next = !current;
                      if (next) {
                        setTabDropdownPosition({ x: rect.right, y: rect.bottom + 6 });
                      } else {
                        setTabDropdownPosition(null);
                      }
                      return next;
                    });
                  }}
                  onMouseEnter={(event) => showButtonTooltip(event, "All tabs")}
                  onMouseLeave={hideButtonTooltip}
                  className="flex h-full items-center justify-center rounded-t-lg border border-x-transparent border-t-transparent border-b-transparent bg-transparent px-2 py-0 text-[#1e4840] transition-all duration-150"
                  aria-label="All tabs"
                >
                  <KeyboardArrowDownIcon fontSize="small" />
                </button>
                {tabDropdownOpen ? (
                  <div
                    ref={tabDropdownRef}
                    className="fixed z-[90] min-w-[180px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                    style={{ left: `${tabDropdownPosition?.x || 0}px`, top: `${tabDropdownPosition?.y || 0}px`, transform: "translateX(-100%)" }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      All tabs
                    </div>
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.id);
                          syncUrlTab(tab.id, { replace: false });
                          setTabDropdownOpen(false);
                          setTabDropdownPosition(null);
                          void trackEvent("trip_tab_viewed_from_dropdown", {
                            trip_id: tripId,
                            tab_id: tab.id,
                            tab_type: tab.tabType || "custom"
                          });
                        }}
                        className={`block w-full rounded-md px-3 py-2 text-left text-sm font-semibold transition ${
                          activeTab === tab.id
                            ? "bg-[#baf59c] text-[#1e4840]"
                            : "text-[#1e4840] hover:bg-slate-100"
                        }`}
                      >
                        {tab.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                onClick={() => {
                  setButtonTooltip(null);
                  openTabCreateModal();
                }}
                onMouseEnter={(event) => showButtonTooltip(event, "Add new tab")}
                onMouseLeave={hideButtonTooltip}
                className="-mb-px flex h-full items-center justify-center rounded-t-lg border border-x-transparent border-t-transparent border-b-transparent bg-transparent px-2 py-0 text-[#1e4840] transition-all duration-150"
                aria-label="Add new tab"
              >
                <AddIcon fontSize="small" />
              </button>
            </>
          )}
        </div>
      </div>
      {tabNameError ? (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">
          {tabNameError}
        </div>
      ) : null}

      {tabMenu && canManageTabs ? (
        <div
          ref={tabMenuRef}
          className="fixed z-[80] min-w-[150px] rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
          style={{ left: `${tabMenu.x}px`, top: `${tabMenu.y}px` }}
        >
          <button
            type="button"
            className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-ink hover:bg-slate-100"
            onClick={() => {
              const targetTab = tabs.find((tab) => tab.id === tabMenu.tabId);
              if (targetTab) {
                beginTabRename(targetTab);
              }
              setTabMenu(null);
            }}
          >
            Rename tab
          </button>
          <button
            type="button"
            className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-coral hover:bg-rose-50"
            onClick={() => {
              const targetTab = tabs.find((tab) => tab.id === tabMenu.tabId);
              if (targetTab) {
                handleTabDelete(targetTab);
              }
              setTabMenu(null);
            }}
          >
            Delete tab
          </button>
        </div>
      ) : null}

      {/* Tab Content */}
      <div className="grid flex-1 min-h-0 bg-white">
        {tabs
          .filter((tab) => tab.id === activeTab || tab.id === displayedTabId || cachedTabIds.includes(tab.id))
          .map((tab) => {
            const isDisplayedPanel = displayedTabId === tab.id;
            const panelOwnsScroll = tab.tabType === "list";
            return (
              <div
                key={tab.id}
                aria-hidden={!isDisplayedPanel}
                className={`col-start-1 row-start-1 transition-opacity duration-300 ease-in-out ${
                  panelOwnsScroll ? "overflow-hidden" : "overflow-y-auto"
                } ${
                  isDisplayedPanel
                    ? `z-10 pointer-events-auto ${activePanelEntered ? "opacity-100" : "opacity-0"}`
                    : "z-0 opacity-0 pointer-events-none"
                }`}
              >
                {renderTabPanel(tab)}
              </div>
            );
          })}
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
                className="rounded-xl bg-ocean px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#152f2a] disabled:opacity-60"
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

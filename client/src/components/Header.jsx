import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api.js";
import { useSession, useUserProfile } from "../App";
import { getDisplayName } from "../lib/userProfile.js";
import { trackEvent } from "../lib/analytics.js";
import TripableLogoLink from "./TripableLogoLink.jsx";
import { AVATAR_COLOR_CHOICES, getAvatarColor } from "../lib/avatarColors.js";

export default function Header() {
  const session = useSession();
  const { profile, refreshProfile } = useUserProfile();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [pendingInvitesLoading, setPendingInvitesLoading] = useState(false);
  const [joinStatus, setJoinStatus] = useState("");
  const [avatarPhotoOverride, setAvatarPhotoOverride] = useState("");
  const [avatarColorOverride, setAvatarColorOverride] = useState("");
  const [avatarCrop, setAvatarCrop] = useState({ zoom: 1, x: 0, y: 0, size: 60, cx: 50, cy: 50 });
  const [avatarEditorStep, setAvatarEditorStep] = useState("choose");
  const [draftPhoto, setDraftPhoto] = useState("");
  const [draftColor, setDraftColor] = useState("");
  const [draftCrop, setDraftCrop] = useState({ zoom: 1, x: 0, y: 0, size: 60, cx: 50, cy: 50 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [isResizingCrop, setIsResizingCrop] = useState(false);
  const pinchRef = useRef({ startDistance: 0, startZoom: 1 });
  const dragStartRef = useRef({
    x: 0,
    y: 0,
    cropX: 0,
    cropY: 0,
    width: 1,
    height: 1,
    size: 60,
    handle: "se"
  });
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  const displayName = getDisplayName(profile, session);
  const userId = profile?.id || session?.user?.id;
  const profilePhoto = profile?.photoUrl || avatarPhotoOverride || "";
  const avatarColor = avatarColorOverride || profile?.avatarColor || getAvatarColor(userId);

  const resetAvatarDraft = () => {
    setDraftPhoto(avatarPhotoOverride || "");
    setDraftColor(avatarColorOverride || "");
    setDraftCrop(avatarCrop || { zoom: 1, x: 0, y: 0, size: 60, cx: 50, cy: 50 });
    setDraftCrop((current) => ({
      ...current,
      zoom: Math.max(1, current.zoom || 1),
      size: Math.min(80, Math.max(30, current.size || 60))
    }));
    setAvatarEditorStep("choose");
  };

  const closeAvatarEditor = () => {
    setIsAvatarEditorOpen(false);
    resetAvatarDraft();
  };

  useEffect(() => {
    if (!userId || !profile) return;
    setAvatarPhotoOverride(profile.photoUrl || "");
    setAvatarColorOverride(profile.avatarColor || "");
    if (profile.avatarCrop) {
      try {
        const parsed = typeof profile.avatarCrop === "string" ? JSON.parse(profile.avatarCrop) : profile.avatarCrop;
        if (parsed && typeof parsed === "object") {
          const fallbackCx = typeof parsed.cx === "number" ? parsed.cx : 50 - (Number(parsed.x) || 0);
          const fallbackCy = typeof parsed.cy === "number" ? parsed.cy : 50 - (Number(parsed.y) || 0);
          setAvatarCrop({
            zoom: Number(parsed.zoom) || 1,
            x: Number(parsed.x) || 0,
            y: Number(parsed.y) || 0,
            size: Number(parsed.size) || 60,
            cx: fallbackCx,
            cy: fallbackCy
          });
        }
      } catch {
        // ignore invalid crop state
      }
    }
  }, [userId, profile]);

  useEffect(() => {
    if (!userId || !profile) return;
    if (profile.photoUrl || profile.avatarColor) return;
    const randomColor = AVATAR_COLOR_CHOICES[Math.floor(Math.random() * AVATAR_COLOR_CHOICES.length)];
    const persistDefault = async () => {
      try {
        await supabase.from("User").update({ avatarColor: randomColor }).eq("id", userId);
        await refreshProfile();
      } catch (error) {
        console.error("Failed to set default avatar color", error);
      }
    };
    void persistDefault();
  }, [userId, profile, refreshProfile]);

  useEffect(() => {
    if (!isAvatarEditorOpen) return;
    resetAvatarDraft();
  }, [isAvatarEditorOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    void trackEvent("auth_sign_out", {
      source: "header_menu"
    });
    navigate("/");
    setIsProfileMenuOpen(false);
  };

  const handleProfileClick = () => {
    void trackEvent("profile_opened", {
      source: "header_menu"
    });
    navigate("/profile");
    setIsProfileMenuOpen(false);
  };

  const handleDeclineInvite = async (inviteId) => {
    if (!inviteId) return;
    try {
      await supabase
        .from("PendingTripInvite")
        .update({ status: "canceled", canceledAt: new Date().toISOString() })
        .eq("id", inviteId);
      setPendingInvites((current) => current.filter((invite) => invite.id !== inviteId));
    } catch (error) {
      console.error("Failed to decline invite", error);
    }
  };

  const handleJoinInvite = async (tripId, inviteId) => {
    if (!tripId) return;
    try {
      setJoinStatus("Joining trip...");
      await api.joinTrip(tripId);
      setPendingInvites((current) => current.filter((invite) => invite.id !== inviteId));
      setIsNotificationOpen(false);
      setJoinStatus("");
      navigate(`/trips/${tripId}`);
    } catch (error) {
      console.error("Failed to join trip", error);
      setJoinStatus("");
    }
  };

  useEffect(() => {
    if (!isProfileMenuOpen && !isNotificationOpen) return undefined;
    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
        setIsNotificationOpen(false);
        setIsAvatarEditorOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
        setIsNotificationOpen(false);
        setIsAvatarEditorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isProfileMenuOpen, isNotificationOpen]);

  useEffect(() => {
    if (!isAvatarEditorOpen) return undefined;
    const handleTouchMove = (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isAvatarEditorOpen]);

  useEffect(() => {
    if (!isDraggingCrop && !isResizingCrop) return undefined;
    const handleMove = (event) => {
      const { x, y, cropX, cropY, width, height, size, handle } = dragStartRef.current;
      const dx = ((event.clientX - x) / width) * 100;
      const dy = ((event.clientY - y) / height) * 100;
      if (isDraggingCrop) {
        setDraftCrop((current) => {
          const half = current.size / 2;
          const min = half;
          const max = 100 - half;
          return {
            ...current,
            cx: Math.max(min, Math.min(max, cropX + dx)),
            cy: Math.max(min, Math.min(max, cropY + dy))
          };
        });
        return;
      }

      if (isResizingCrop) {
        const delta = Math.max(dx, dy);
        const proposed = size + (handle === "nw" || handle === "ne" ? -delta : delta);
        setDraftCrop((current) => {
          const maxSize = Math.min(current.cx, current.cy, 100 - current.cx, 100 - current.cy) * 2;
          const nextSize = Math.max(30, Math.min(Math.min(80, maxSize), proposed));
          return {
            ...current,
            size: nextSize
          };
        });
      }
    };
    const handleUp = () => {
      setIsDraggingCrop(false);
      setIsResizingCrop(false);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingCrop, isResizingCrop]);

  useEffect(() => {
    if (!session?.user?.email) {
      setPendingInvites([]);
      return;
    }

    const loadPendingInvites = async () => {
      setPendingInvitesLoading(true);
      try {
        const normalizedEmail = String(session.user.email || "").trim().toLowerCase();
        const { data: inviteRows, error: inviteError } = await supabase
          .from("PendingTripInvite")
          .select("id, tripId, role, createdAt, createdById")
          .ilike("email", normalizedEmail)
          .eq("status", "pending")
          .order("createdAt", { ascending: false });

        if (inviteError) {
          if (String(inviteError.message || "").includes("PendingTripInvite")) {
            setPendingInvites([]);
            return;
          }
          throw inviteError;
        }

        const rows = inviteRows || [];
        if (!rows.length) {
          setPendingInvites([]);
          return;
        }

        const tripIds = rows.map((invite) => invite.tripId);
        const { data: tripRows, error: tripError } = await supabase
          .from("Trip")
          .select("id, name, createdById")
          .in("id", tripIds);
        if (tripError) throw tripError;

        const ownerIds = Array.from(new Set((tripRows || []).map((trip) => trip.createdById).filter(Boolean)));
        const inviterIds = Array.from(new Set((rows || []).map((invite) => invite.createdById).filter(Boolean)));
        let ownerMap = new Map();
        let inviterMap = new Map();
        if (ownerIds.length > 0 || inviterIds.length > 0) {
          const allIds = Array.from(new Set([...ownerIds, ...inviterIds]));
          const { data: ownerRows, error: ownerError } = await supabase
            .from("User")
            .select("id, name, photoUrl, avatarColor")
            .in("id", allIds);
          if (ownerError) throw ownerError;
          ownerMap = new Map((ownerRows || []).map((owner) => [owner.id, owner.name || "Trip owner"]));
          inviterMap = new Map(
            (ownerRows || []).map((owner) => [
              owner.id,
              {
                id: owner.id,
                name: owner.name || "Traveler",
                photoUrl: owner.photoUrl || "",
                avatarColor: owner.avatarColor || ""
              }
            ])
          );
        }

        const tripMap = new Map((tripRows || []).map((trip) => [trip.id, trip]));
        const invitesWithTripName = rows.map((invite) => ({
          ...invite,
          tripName: tripMap.get(invite.tripId)?.name || "Trip invitation",
          ownerName: ownerMap.get(tripMap.get(invite.tripId)?.createdById) || "Trip owner",
          inviter: inviterMap.get(invite.createdById) || {
            id: invite.createdById,
            name: ownerMap.get(invite.createdById) || "Traveler",
            photoUrl: "",
            avatarColor: ""
          }
        }));

        setPendingInvites(invitesWithTripName);
      } catch (error) {
        console.error("Failed to load pending invites:", error);
        setPendingInvites([]);
      } finally {
        setPendingInvitesLoading(false);
      }
    };

    void loadPendingInvites();
  }, [session]);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <TripableLogoLink className="w-fit" compact />

        {session ? (
          <div className="relative flex items-center gap-2" ref={menuRef}>
            <div className="relative">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-ink"
                aria-label="Notifications"
                onClick={() => {
                  setIsNotificationOpen((current) => !current);
                  setIsProfileMenuOpen(false);
                }}
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22z" />
                  <path d="M19 17H5l1.4-1.4A2 2 0 0 0 7 14.2V11a5 5 0 1 1 10 0v3.2c0 .5.2 1 .6 1.4L19 17z" />
                </svg>
              </button>

              {isNotificationOpen ? (
                <div className="absolute right-0 mt-2 w-96 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-lg">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notifications</p>
                  {joinStatus ? (
                    <p className="mt-2 text-sm font-semibold text-slate-600">{joinStatus}</p>
                  ) : null}
                  {pendingInvitesLoading ? (
                    <p className="mt-2 text-sm text-slate-500">Loading invites...</p>
                  ) : pendingInvites.length ? (
                    <div className="mt-3 space-y-2">
                      {pendingInvites.map((invite) => (
                        <div key={invite.id} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-xs font-semibold">
                              {invite.inviter?.photoUrl ? (
                                <img
                                  src={invite.inviter.photoUrl}
                                  alt={invite.inviter.name || "Traveler"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span
                                  className={`flex h-full w-full items-center justify-center ${
                                    invite.inviter?.avatarColor || getAvatarColor(invite.inviter?.id)
                                  }`}
                                >
                                  {(invite.inviter?.name || "T")[0].toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-ink">
                                <span className="font-semibold">{invite.inviter?.name || "Someone"}</span> invited you to{" "}
                                <span className="font-semibold">{invite.tripName}</span>
                              </p>
                              <p className="text-xs text-slate-500">
                                {invite.createdAt ? new Date(invite.createdAt).toLocaleString() : ""}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              onClick={() => handleDeclineInvite(invite.id)}
                            >
                              Decline
                            </button>
                            <button
                              className="flex-1 rounded-lg bg-ocean px-3 py-2 text-center text-xs font-semibold text-white hover:bg-blue-600"
                              onClick={() => handleJoinInvite(invite.tripId, invite.id)}
                            >
                              Join trip
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No new notifications.</p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-ink hover:bg-slate-200"
                aria-label="Open profile menu"
                onClickCapture={() => setIsNotificationOpen(false)}
              >
              {profilePhoto ? (
                <div className="relative h-full w-full">
                  <img
                    src={profilePhoto}
                    alt={displayName || "Profile"}
                    className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 object-cover"
                    style={{
                      transform: `translate(-50%, -50%) scale(${avatarCrop.zoom})`,
                      transformOrigin: "center"
                    }}
                  />
                </div>
              ) : (
                <span
                  className={`flex h-full w-full items-center justify-center rounded-full text-base font-bold ${avatarColor}`}
                >
                  {displayName?.charAt(0).toUpperCase()}
                </span>
              )}
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg bg-white shadow-lg border border-slate-200 z-50">
                  <div className="px-4 py-3 border-b border-slate-200 text-center">
                    <p className="text-xs font-semibold tracking-wide text-slate-400 break-all">
                      {profile?.email || session?.user?.email || "Account"}
                    </p>
                    <div className="mt-3 flex flex-col items-center gap-3">
                      <div className="relative">
                      {profilePhoto ? (
                        <div className="relative h-12 w-12 overflow-hidden rounded-full">
                          <img
                            src={profilePhoto}
                            alt={displayName || "Profile"}
                            className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 object-cover"
                            style={{
                              transform: `translate(-50%, -50%) scale(${avatarCrop.zoom})`,
                              transformOrigin: "center"
                            }}
                          />
                        </div>
                      ) : (
                        <span
                          className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${avatarColor}`}
                        >
                          {displayName?.charAt(0).toUpperCase()}
                        </span>
                      )}
                        <button
                          type="button"
                          onClick={() => setIsAvatarEditorOpen((current) => !current)}
                          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 text-slate-500 hover:text-ink"
                          aria-label="Edit profile photo"
                        >
                          ✎
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-ink">
                        Hi, {displayName || "Traveler"}!
                      </p>
                      {isAvatarEditorOpen ? (
                        <div
                          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 px-4"
                          onClick={closeAvatarEditor}
                        >
                          <div
                            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {avatarEditorStep !== "choose" ? (
                                  <button
                                    type="button"
                                    className="text-slate-400 hover:text-ink"
                                    onClick={() => setAvatarEditorStep("choose")}
                                    aria-label="Back"
                                  >
                                    ←
                                  </button>
                                ) : null}
                                <h3 className="text-lg font-semibold text-ink">Edit profile</h3>
                              </div>
                              <button
                                type="button"
                                className="text-slate-400 hover:text-ink"
                                onClick={closeAvatarEditor}
                                aria-label="Close"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="mt-4 flex flex-col items-center gap-4">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (!file || !userId) return;
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    const result = String(reader.result || "");
                                    setDraftPhoto(result);
                                    setDraftCrop((current) => ({
                                      ...current,
                                      cx: 50,
                                      cy: 50,
                                      size: Math.min(60, Math.max(30, current.size || 60))
                                    }));
                                    setAvatarEditorStep("photo");
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                              {avatarEditorStep === "choose" ? (
                                <div className="w-full space-y-3">
                                  <button
                                    type="button"
                                    className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-200"
                                    onClick={() => fileInputRef.current?.click()}
                                  >
                                    Upload photo
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                    onClick={() => setAvatarEditorStep("color")}
                                  >
                                    Choose colors
                                  </button>
                                </div>
                              ) : null}

                              {avatarEditorStep === "photo" ? (
                                <>
                                  <div
                                    className="relative h-56 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 touch-none overscroll-contain"
                                    onWheel={(event) => {
                                      if (!draftPhoto) return;
                                      event.preventDefault();
                                      event.stopPropagation();
                                      const delta = event.deltaY > 0 ? -0.05 : 0.05;
                                      setDraftCrop((current) => ({
                                        ...current,
                                        zoom: Math.min(2, Math.max(1, current.zoom + delta))
                                      }));
                                    }}
                                    onTouchStart={(event) => {
                                      if (!draftPhoto) return;
                                      if (event.touches.length === 2) {
                                        const [a, b] = event.touches;
                                        const dx = a.clientX - b.clientX;
                                        const dy = a.clientY - b.clientY;
                                        pinchRef.current = {
                                          startDistance: Math.hypot(dx, dy),
                                          startZoom: draftCrop.zoom
                                        };
                                      }
                                    }}
                                    onTouchMove={(event) => {
                                      if (!draftPhoto) return;
                                      if (event.touches.length === 2) {
                                        event.preventDefault();
                                        const [a, b] = event.touches;
                                        const dx = a.clientX - b.clientX;
                                        const dy = a.clientY - b.clientY;
                                        const distance = Math.hypot(dx, dy);
                                        const scale = distance / (pinchRef.current.startDistance || distance);
                                        const nextZoom = pinchRef.current.startZoom * scale;
                                        setDraftCrop((current) => ({
                                          ...current,
                                          zoom: Math.min(2, Math.max(1, nextZoom))
                                        }));
                                      }
                                    }}
                                    onTouchEnd={() => {
                                      pinchRef.current = { startDistance: 0, startZoom: draftCrop.zoom };
                                    }}
                                  >
                                    {draftPhoto ? (
                                      <img
                                        src={draftPhoto}
                                        alt="Profile preview"
                                        className="absolute inset-0 h-full w-full object-cover"
                                        style={{
                                          transform: `scale(${draftCrop.zoom})`,
                                          transformOrigin: "center"
                                        }}
                                      />
                                    ) : null}
                                    <div className="absolute inset-0 bg-slate-900/10" />
                                    <div
                                      className={`absolute border-2 border-white shadow-lg ${
                                        draftPhoto ? "cursor-grab active:cursor-grabbing" : ""
                                      }`}
                                      style={{
                                        width: `${draftCrop.size}%`,
                                        aspectRatio: "1 / 1",
                                        left: `${draftCrop.cx}%`,
                                        top: `${draftCrop.cy}%`,
                                        transform: "translate(-50%, -50%)",
                                        boxShadow: "0 0 0 9999px rgba(15,23,42,0.35)"
                                      }}
                                      onMouseDown={(event) => {
                                        if (!draftPhoto) return;
                                        const rect = event.currentTarget.parentElement.getBoundingClientRect();
                                        dragStartRef.current = {
                                          x: event.clientX,
                                          y: event.clientY,
                                          cropX: draftCrop.cx,
                                          cropY: draftCrop.cy,
                                          width: rect.width,
                                          height: rect.height,
                                          size: draftCrop.size
                                        };
                                        setIsDraggingCrop(true);
                                      }}
                                    >
                                      <div className="absolute inset-2 rounded-full border border-white/70" />
                                      {["nw", "ne", "sw", "se"].map((handle) => (
                                        <div
                                          key={handle}
                                          role="button"
                                          tabIndex={-1}
                                          className={`absolute h-3 w-3 rounded-full border border-white bg-white shadow ${
                                            handle === "nw"
                                              ? "-left-1.5 -top-1.5 cursor-nwse-resize"
                                              : handle === "ne"
                                              ? "-right-1.5 -top-1.5 cursor-nesw-resize"
                                              : handle === "sw"
                                              ? "-left-1.5 -bottom-1.5 cursor-nesw-resize"
                                              : "-right-1.5 -bottom-1.5 cursor-nwse-resize"
                                          }`}
                                          onMouseDown={(event) => {
                                            if (!draftPhoto) return;
                                            event.stopPropagation();
                                            const rect = event.currentTarget.parentElement.parentElement.getBoundingClientRect();
                                            dragStartRef.current = {
                                              x: event.clientX,
                                              y: event.clientY,
                                              cropX: draftCrop.cx,
                                              cropY: draftCrop.cy,
                                              width: rect.width,
                                              height: rect.height,
                                              size: draftCrop.size,
                                              handle
                                            };
                                            setIsResizingCrop(true);
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                  <p className="text-xs font-semibold text-slate-500">
                                    Drag to crop. Scroll to zoom.
                                  </p>
                                </>
                              ) : null}

                              {avatarEditorStep === "color" ? (
                                <div className="w-full">
                                  <div className="mb-3 flex justify-center">
                                    <div className="h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                                      <span
                                        className={`flex h-full w-full items-center justify-center text-xl font-bold ${
                                          draftColor || avatarColor
                                        }`}
                                      >
                                        {displayName?.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-xs font-semibold text-slate-500">Avatar colors</p>
                                  <div className="mt-2 grid grid-cols-4 gap-2">
                                    {AVATAR_COLOR_CHOICES.map((color) => (
                                      <button
                                        key={color}
                                        type="button"
                                        className={`h-8 w-8 rounded-full ${color} ${
                                          draftColor === color ? "ring-2 ring-ocean" : "ring-1 ring-slate-200"
                                        }`}
                                        onClick={() => setDraftColor(color)}
                                        aria-label="Select avatar color"
                                      />
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {avatarEditorStep !== "choose" ? (
                                <div className="flex w-full items-center gap-2">
                                  <button
                                    type="button"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                    onClick={closeAvatarEditor}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                    onClick={() => {
                                      if (!userId) return;
                                    const persistAvatar = async () => {
                                      if (!userId) return;
                                      if (avatarEditorStep === "photo" && draftPhoto) {
                                        const nextCrop = {
                                          ...draftCrop,
                                          x: 50 - draftCrop.cx,
                                          y: 50 - draftCrop.cy
                                        };
                                        await supabase
                                          .from("User")
                                          .update({
                                            photoUrl: draftPhoto,
                                            avatarCrop: nextCrop
                                          })
                                          .eq("id", userId);
                                        setAvatarPhotoOverride(draftPhoto);
                                        setAvatarCrop(nextCrop);
                                      }
                                      if (avatarEditorStep === "color") {
                                        await supabase
                                          .from("User")
                                          .update({
                                            avatarColor: draftColor,
                                            photoUrl: null,
                                            avatarCrop: null
                                          })
                                          .eq("id", userId);
                                        setAvatarColorOverride(draftColor);
                                        setAvatarPhotoOverride("");
                                      }
                                      await refreshProfile();
                                    };
                                    persistAvatar()
                                      .catch((error) => {
                                        console.error("Failed to update avatar", error);
                                      })
                                      .finally(() => {
                                        setIsAvatarEditorOpen(false);
                                        setAvatarEditorStep("choose");
                                      });
                                    }}
                                  >
                                    Save
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="p-3">
                    <button
                      onClick={handleProfileClick}
                      className="w-full rounded-lg bg-ocean px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                    >
                      Manage your account
                    </button>
                    <button
                      onClick={handleLogout}
                      className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-coral hover:bg-slate-50"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/auth?mode=signup"
              className="rounded-full bg-ocean px-5 py-2 text-sm font-semibold text-white shadow-card hover:bg-blue-600"
            >
              Sign up
            </Link>
            <Link
              to="/auth?mode=signin"
              className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

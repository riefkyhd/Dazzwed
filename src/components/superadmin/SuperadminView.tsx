"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { triggerHaptic } from "@/lib/camera/haptics";

export interface SuperadminEvent {
  id: string;
  slug: string;
  couple_names: string;
  shots_per_guest: number;
  status: "active" | "paused" | "archived";
  package_tier?: string;
  package_max_guests?: number | null;
  package_max_shots_per_guest?: number;
  client_id?: string | null;
  drive_root_folder_id?: string | null;
  access_token?: string;
  photo_count?: number;
  guest_count?: number;
  created_at?: string;
}

export interface SuperadminClient {
  id: string;
  name: string;
  email: string;
  access_code: string;
  max_events: number;
  status: "active" | "suspended";
  notes?: string;
  created_at: string;
  events: SuperadminEvent[];
}

interface SuperadminViewProps {
  ownerEmail: string;
  initialClients: SuperadminClient[];
  initialUnassignedEvents: SuperadminEvent[];
  allEvents: SuperadminEvent[];
}

export function SuperadminView({
  ownerEmail,
  initialClients,
  initialUnassignedEvents,
  allEvents,
}: SuperadminViewProps) {
  const router = useRouter();
  const [clients, setClients] = useState<SuperadminClient[]>(initialClients);
  const [unassignedEvents, setUnassignedEvents] = useState<SuperadminEvent[]>(initialUnassignedEvents);

  // Modal States
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [createdClientResult, setCreatedClientResult] = useState<{
    name: string;
    email: string;
    accessCode: string;
  } | null>(null);

  const [clientForm, setClientForm] = useState({
    name: "",
    email: "",
    maxEvents: 1,
    notes: "",
  });
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);
  const [clientFormError, setClientFormError] = useState<string | null>(null);

  // Edit Event Modal State
  const [editingEvent, setEditingEvent] = useState<SuperadminEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    clientId: "",
    packageTier: "classic_35mm",
    packageMaxGuests: 300,
    packageMaxShotsPerGuest: 27,
    shotsPerGuest: 27,
    status: "active",
  });
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Summary Metrics
  const totalPhotos = allEvents.reduce((acc, ev) => acc + (ev.photo_count || 0), 0);
  const totalGuests = allEvents.reduce((acc, ev) => acc + (ev.guest_count || 0), 0);
  const activeClients = clients.filter((c) => c.status === "active").length;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    triggerHaptic(10);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getWhatsAppInvite = (client: { name: string; email: string; access_code: string }) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://dazzwed.my.id";
    return `✨ Halo ${client.name}! Akun Wedding Admin Dazzwed Anda sudah siap:

🔗 Link Portal: ${origin}/admin/login
📧 Email: ${client.email}
🔑 Access Code: ${client.access_code}

Silakan buka link di atas dan masukkan Email serta Access Code untuk mulai mengelola acara, memantau galeri foto tamu, dan mengunduh file cetak QR Code A4.`;
  };

  // Toggle Client Suspension
  const handleToggleStatus = async (client: SuperadminClient) => {
    const nextStatus = client.status === "active" ? "suspended" : "active";
    const confirmMsg = nextStatus === "suspended"
      ? `Suspend client "${client.name}"? Their login session will be immediately revoked!`
      : `Reactivate client "${client.name}"?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/superadmin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, status: nextStatus } : c))
      );
      triggerHaptic([15, 30]);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Reset Client Access Code
  const handleResetAccessCode = async (client: SuperadminClient) => {
    if (!confirm(`Generate a new 8-character access code for "${client.name}"?`)) return;

    try {
      const res = await fetch("/api/superadmin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, resetAccessCode: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset code");

      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, access_code: data.accessCode } : c))
      );
      triggerHaptic(20);
      alert(`New Access Code for ${client.name}:\n\n${data.accessCode}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Create Client Submit
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name.trim() || !clientForm.email.trim() || isSubmittingClient) return;

    setIsSubmittingClient(true);
    setClientFormError(null);
    try {
      const res = await fetch("/api/superadmin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create client");

      const newClient: SuperadminClient = {
        id: data.client.id,
        name: data.client.name,
        email: data.client.email,
        access_code: data.client.access_code,
        max_events: data.client.max_events,
        status: data.client.status,
        notes: data.client.notes,
        created_at: data.client.created_at,
        events: [],
      };

      setClients((prev) => [newClient, ...prev]);
      setCreatedClientResult({
        name: data.client.name,
        email: data.client.email,
        accessCode: data.client.access_code,
      });
      setClientForm({ name: "", email: "", maxEvents: 1, notes: "" });
      triggerHaptic([20, 50]);
    } catch (err) {
      setClientFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmittingClient(false);
    }
  };

  // Open Edit Event Modal
  const openEditEvent = (ev: SuperadminEvent) => {
    setEditingEvent(ev);
    setEventForm({
      clientId: ev.client_id || "",
      packageTier: ev.package_tier || "classic_35mm",
      packageMaxGuests: ev.package_max_guests ?? 300,
      packageMaxShotsPerGuest: ev.package_max_shots_per_guest || 27,
      shotsPerGuest: ev.shots_per_guest || 27,
      status: ev.status || "active",
    });
  };

  // Save Event Overrides
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || isUpdatingEvent) return;

    setIsUpdatingEvent(true);
    try {
      const res = await fetch("/api/superadmin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: editingEvent.id,
          clientId: eventForm.clientId ? eventForm.clientId : null,
          packageTier: eventForm.packageTier,
          packageMaxGuests: eventForm.packageMaxGuests,
          packageMaxShotsPerGuest: eventForm.packageMaxShotsPerGuest,
          shotsPerGuest: eventForm.shotsPerGuest,
          status: eventForm.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update event");

      router.refresh();
      setEditingEvent(null);
      triggerHaptic([15, 30]);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdatingEvent(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Navigation / Platform Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="relative h-8 w-[84px] hover:opacity-90 transition-opacity">
            <Image
              src="/Unveiled_logo_horizontal_transparent.png"
              alt="Unveiled"
              fill
              className="object-contain"
            />
          </Link>
          <span className="text-[11px] font-mono uppercase tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
            <span>👑</span>
            <span>Superadmin Console</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>←</span>
            <span>Return to Wedding Admin</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setShowCreateClientModal(true);
              setCreatedClientResult(null);
            }}
            className="px-4 py-2 rounded-xl bg-amber-400 text-black text-xs font-bold hover:bg-amber-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-400/10"
          >
            <span>+</span>
            <span>New Client Account</span>
          </button>
        </div>
      </header>

      {/* Platform KPI Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
            Active Clients
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {activeClients} <span className="text-xs text-zinc-500 font-sans">/ {clients.length} total</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
            Total Event Rolls
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {allEvents.length}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
            Photos Synced
          </div>
          <div className="text-2xl font-bold font-mono text-sky-400">
            {totalPhotos.toLocaleString()}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
            Registered Guests
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400">
            {totalGuests.toLocaleString()}
          </div>
        </div>
      </section>

      {/* Client Accounts Management */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
            <span>Client Accounts & Assigned Weddings</span>
            <span className="text-xs font-mono font-normal text-zinc-500">
              ({clients.length})
            </span>
          </h2>
        </div>

        {clients.length === 0 ? (
          <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 text-center space-y-3">
            <p className="text-sm text-zinc-400">
              No client accounts yet. Click &quot;New Client Account&quot; to provision login credentials for a couple or Wedding Organizer.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {clients.map((client) => {
              const inviteText = getWhatsAppInvite(client);
              const isSuspended = client.status === "suspended";

              return (
                <div
                  key={client.id}
                  className={`p-6 rounded-2xl border transition-all ${
                    isSuspended
                      ? "bg-red-950/10 border-red-900/40 opacity-75"
                      : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {/* Client Header Info */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-base font-serif font-bold text-white">
                          {client.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border ${
                            isSuspended
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {client.status}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
                          Quota: {client.events.length} / {client.max_events} Events
                        </span>
                      </div>
                      <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                        <span>{client.email}</span>
                        {client.notes && (
                          <span className="text-zinc-500 italic text-[11px]">
                            • {client.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Access Credentials & Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono">
                        <span className="text-zinc-500">Code:</span>
                        <span className="text-amber-300 font-bold tracking-wider">
                          {client.access_code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(client.access_code, `code-${client.id}`)}
                          className="ml-1 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                          title="Copy Code"
                        >
                          {copiedId === `code-${client.id}` ? "✓" : "📋"}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(inviteText, `invite-${client.id}`)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>💬</span>
                        <span>{copiedId === `invite-${client.id}` ? "Copied!" : "WhatsApp Invite"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResetAccessCode(client)}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors cursor-pointer"
                        title="Generate New Access Code"
                      >
                        Reset Code
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(client)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                          isSuspended
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                        }`}
                      >
                        {isSuspended ? "Reactivate" : "Suspend"}
                      </button>
                    </div>
                  </div>

                  {/* Assigned Events for this Client */}
                  <div className="pt-4 space-y-2.5">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                      Assigned Wedding Rolls ({client.events.length})
                    </div>
                    {client.events.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">
                        No events assigned yet. Create an event in Wedding Admin or assign an unassigned event below.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {client.events.map((ev) => (
                          <div
                            key={ev.id}
                            className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-serif font-bold text-white truncate">
                                {ev.couple_names}
                              </span>
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                  ev.status === "active"
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : ev.status === "paused"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-zinc-700/50 text-zinc-400"
                                }`}
                              >
                                {ev.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-zinc-400 truncate">
                              /e/{ev.slug}
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-[10px] font-mono text-zinc-400">
                              <span>Tier: {ev.package_tier || "custom"}</span>
                              <span>{ev.photo_count || 0} photos</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => openEditEvent(ev)}
                              className="w-full mt-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-amber-300 transition-colors cursor-pointer text-center"
                            >
                              Edit Package & Quota →
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Unassigned / Platform Owner Events */}
      {unassignedEvents.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-serif font-bold text-zinc-300 flex items-center gap-2">
              <span>Unassigned / Platform Owner Events</span>
              <span className="text-xs font-mono font-normal text-zinc-500">
                ({unassignedEvents.length})
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unassignedEvents.map((ev) => (
              <div
                key={ev.id}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-serif font-bold text-white truncate">
                    {ev.couple_names}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    OWNER
                  </span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400 truncate">
                  /e/{ev.slug}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span>{ev.photo_count || 0} photos</span>
                  <span>{ev.guest_count || 0} guests</span>
                </div>
                <button
                  type="button"
                  onClick={() => openEditEvent(ev)}
                  className="w-full py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-medium text-amber-400 transition-colors cursor-pointer text-center"
                >
                  Assign to Client or Set Tier →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal: Create Client */}
      {showCreateClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl relative text-left">
            <h2 className="text-lg font-serif font-bold text-white mb-1">
              Create Client Account
            </h2>
            <p className="text-xs text-zinc-400 mb-5">
              Provision login access for a wedding couple or Wedding Organizer.
            </p>

            {createdClientResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <div className="text-xs font-bold text-emerald-400">
                    ✓ Client Account Created Successfully!
                  </div>
                  <div className="text-xs font-mono text-zinc-300 space-y-1">
                    <div><span className="text-zinc-500">Name:</span> {createdClientResult.name}</div>
                    <div><span className="text-zinc-500">Email:</span> {createdClientResult.email}</div>
                    <div><span className="text-zinc-500">Access Code:</span> <span className="text-amber-300 font-bold">{createdClientResult.accessCode}</span></div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const invite = getWhatsAppInvite({
                      name: createdClientResult.name,
                      email: createdClientResult.email,
                      access_code: createdClientResult.accessCode,
                    });
                    handleCopy(invite, "modal-invite");
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>💬</span>
                  <span>{copiedId === "modal-invite" ? "Copied to Clipboard!" : "Copy WhatsApp Invitation"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreateClientModal(false)}
                  className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateClient} className="space-y-4">
                {clientFormError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                    {clientFormError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Client / Couple Name <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dhifa & Riefky"
                    value={clientForm.name}
                    onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Client Email (Login Identifier) <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="client@wedding.com"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Max Allowed Event Rolls
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={clientForm.maxEvents}
                    onChange={(e) => setClientForm({ ...clientForm, maxEvents: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-400 focus:outline-none"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Default 1. Set to 2 or 3 for multi-event packages (e.g. Engagement + Wedding).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Internal Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Paid in full, WO Lumina contact"
                    value={clientForm.notes}
                    onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateClientModal(false)}
                    disabled={isSubmittingClient}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingClient || !clientForm.name || !clientForm.email}
                    className="px-5 py-2 rounded-xl bg-amber-400 text-black font-bold text-xs hover:bg-amber-300 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isSubmittingClient ? "Creating..." : "Create Client"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Edit Event & Quota Override */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl relative text-left">
            <h2 className="text-lg font-serif font-bold text-white mb-1">
              Edit Event: {editingEvent.couple_names}
            </h2>
            <p className="text-xs text-zinc-400 mb-5">
              Owner-locked package quotas, client assignment, and status.
            </p>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Assign to Client
                </label>
                <select
                  value={eventForm.clientId}
                  onChange={(e) => setEventForm({ ...eventForm, clientId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-400 focus:outline-none"
                >
                  <option value="">(Unassigned / Platform Owner)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Package Tier Preset
                </label>
                <select
                  value={eventForm.packageTier}
                  onChange={(e) => {
                    const tier = e.target.value;
                    let maxGuests = 300;
                    let maxShots = 27;
                    if (tier === "pocket_roll") {
                      maxGuests = 100;
                      maxShots = 15;
                    } else if (tier === "classic_35mm") {
                      maxGuests = 300;
                      maxShots = 27;
                    } else if (tier === "grand_archive") {
                      maxGuests = 9999;
                      maxShots = 36;
                    } else if (tier === "owner_unlimited") {
                      maxGuests = 99999;
                      maxShots = 100;
                    }
                    setEventForm({
                      ...eventForm,
                      packageTier: tier,
                      packageMaxGuests: maxGuests,
                      packageMaxShotsPerGuest: maxShots,
                      shotsPerGuest: maxShots,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-400 focus:outline-none"
                >
                  <option value="pocket_roll">Pocket Roll (100 Guests, 15 Shots)</option>
                  <option value="classic_35mm">Classic 35mm (300 Guests, 27 Shots)</option>
                  <option value="grand_archive">Grand Archive (Unlimited, 36 Shots)</option>
                  <option value="owner_unlimited">Owner Unlimited (Full Platform Access)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Max Guest Cap
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={eventForm.packageMaxGuests}
                    onChange={(e) => setEventForm({ ...eventForm, packageMaxGuests: parseInt(e.target.value, 10) || 100 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Max Shots Cap
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={eventForm.packageMaxShotsPerGuest}
                    onChange={(e) => setEventForm({
                      ...eventForm,
                      packageMaxShotsPerGuest: parseInt(e.target.value, 10) || 25,
                      shotsPerGuest: parseInt(e.target.value, 10) || 25,
                    })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Event Status
                </label>
                <select
                  value={eventForm.status}
                  onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-400 focus:outline-none"
                >
                  <option value="active">Active (Camera Open)</option>
                  <option value="paused">Paused (Temporarily Locked)</option>
                  <option value="archived">Archived (Event Concluded)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  disabled={isUpdatingEvent}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingEvent}
                  className="px-5 py-2 rounded-xl bg-amber-400 text-black font-bold text-xs hover:bg-amber-300 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isUpdatingEvent ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

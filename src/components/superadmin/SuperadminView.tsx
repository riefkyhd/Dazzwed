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
  driveHealth?: { ok: boolean; error?: string } | null;
}

const PACKAGE_TIERS = [
  { id: "pocket_roll", name: "Pocket Roll", guests: 100, shots: 15, desc: "100 Guests · 15 Shots" },
  { id: "classic_35mm", name: "Classic 35mm", guests: 300, shots: 27, desc: "300 Guests · 27 Shots" },
  { id: "grand_archive", name: "Grand Archive", guests: 9999, shots: 36, desc: "Unlimited · 36 Shots" },
  { id: "owner_unlimited", name: "Owner Unlimited", guests: 99999, shots: 100, desc: "Full Access · 100 Shots" },
];

export function SuperadminView({
  ownerEmail,
  initialClients,
  initialUnassignedEvents,
  allEvents,
  driveHealth,
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
    createStarterEvent: true,
  });
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);
  const [clientFormError, setClientFormError] = useState<string | null>(null);

  // Edit Event Modal State
  const [editingEvent, setEditingEvent] = useState<SuperadminEvent | null>(null);
  const [isTransferringOwnership, setIsTransferringOwnership] = useState(false);
  const [eventForm, setEventForm] = useState({
    clientId: "",
    packageTier: "classic_35mm",
    packageMaxGuests: 300,
    packageMaxShotsPerGuest: 27,
    shotsPerGuest: 27,
    status: "active",
  });
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);
  const [clientFilter, setClientFilter] = useState<"all" | "active" | "suspended">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Summary Metrics
  const totalPhotos = allEvents.reduce((acc, ev) => acc + (ev.photo_count || 0), 0);
  const totalGuests = allEvents.reduce((acc, ev) => acc + (ev.guest_count || 0), 0);
  const activeClients = clients.filter((c) => c.status === "active").length;
  const filteredClients = clients.filter((c) =>
    clientFilter === "all" ? true : c.status === clientFilter
  );

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    triggerHaptic(10);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getWhatsAppInvite = (client: { name: string; email: string; access_code: string }) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://dazzwed.my.id";
    return `Halo ${client.name}, akun Wedding Admin Dazzwed Anda sudah aktif:

Portal Login: ${origin}/admin/login
Email: ${client.email}
Access Code: ${client.access_code}

Silakan buka tautan di atas dan masukkan Email serta Access Code untuk mulai mengelola acara, memantau galeri foto tamu, dan mengunduh file cetak QR Code A4.`;
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
      setClientForm({ name: "", email: "", maxEvents: 1, notes: "", createStarterEvent: true });
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
    setIsTransferringOwnership(false);
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
      {/* 3-Zone Platform Header Architecture */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        {/* Zone 1: Platform Breadcrumb */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="relative h-8 w-[84px] hover:opacity-90 transition-opacity">
            <Image
              src="/Unveiled_logo_horizontal_transparent.png"
              alt="Unveiled"
              fill
              className="object-contain"
            />
          </Link>
          <span className="text-zinc-700 font-light select-none text-sm">/</span>
          <span className="text-[11px] font-mono uppercase tracking-widest text-amber-300/90 bg-amber-400/[0.08] border border-amber-400/25 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-amber-400">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            </svg>
            <span>Owner Console</span>
          </span>
        </div>

        {/* Zone 2: Segmented Directory Filter */}
        <div className="inline-flex max-w-full overflow-x-auto items-center bg-zinc-900/90 border border-zinc-800 p-0.5 rounded-lg text-xs font-medium self-start lg:self-center">
          <button
            type="button"
            onClick={() => setClientFilter("all")}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              clientFilter === "all"
                ? "bg-zinc-800 text-zinc-100 font-medium shadow-sm border border-white/10"
                : "text-zinc-400 hover:text-zinc-200 border border-transparent"
            }`}
          >
            <span>All Clients ({clients.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setClientFilter("active")}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              clientFilter === "active"
                ? "bg-zinc-800 text-zinc-100 font-medium shadow-sm border border-white/10"
                : "text-zinc-400 hover:text-zinc-200 border border-transparent"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Active ({activeClients})</span>
          </button>
          <button
            type="button"
            onClick={() => setClientFilter("suspended")}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              clientFilter === "suspended"
                ? "bg-zinc-800 text-zinc-100 font-medium shadow-sm border border-white/10"
                : "text-zinc-400 hover:text-zinc-200 border border-transparent"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Suspended ({clients.length - activeClients})</span>
          </button>
        </div>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/admin"
            className="h-8 px-3 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-zinc-400">
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            <span>Wedding Admin</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setShowCreateClientModal(true);
              setCreatedClientResult(null);
            }}
            className="h-8 px-3.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" x2="19" y1="8" y2="14" />
              <line x1="22" x2="16" y1="11" y2="11" />
            </svg>
            <span>New Client Account</span>
          </button>
        </div>
      </header>

      {/* Drive OAuth Alert Banner */}
      {driveHealth && !driveHealth.ok && (
        <div className="p-4 rounded-xl bg-amber-400/[0.08] border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 text-amber-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                Google Drive OAuth Disconnected or Expired ({driveHealth.error || "invalid_grant"})
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                Guest photo uploads and .ZIP archiving will fail until Drive is reconnected. In Google Cloud Console, ensure Publishing status is set to &ldquo;In Production&rdquo; to prevent 7-day token expirations.
              </p>
            </div>
          </div>
          <Link
            href="/admin/connect-drive"
            className="h-8 px-3.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-medium text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer self-start sm:self-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>Reconnect Google Drive</span>
          </Link>
        </div>
      )}

      {/* Platform KPI Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-white/10 transition-colors space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans uppercase tracking-[0.14em] text-zinc-400 font-medium">
              Active Clients
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-zinc-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-400">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-mono font-semibold text-zinc-100 tracking-tight">
            {activeClients} <span className="text-xs text-zinc-400 font-sans font-normal">/ {clients.length} total</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-white/10 transition-colors space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans uppercase tracking-[0.14em] text-zinc-400 font-medium">
              Event Rolls
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-zinc-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-400">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-mono font-semibold text-zinc-100 tracking-tight">
            {allEvents.length}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-white/10 transition-colors space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans uppercase tracking-[0.14em] text-zinc-400 font-medium">
              Photos Synced
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-zinc-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-sky-400">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-mono font-semibold text-zinc-100 tracking-tight">
            {totalPhotos.toLocaleString()}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-white/10 transition-colors space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans uppercase tracking-[0.14em] text-zinc-400 font-medium">
              Registered Guests
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-zinc-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-purple-400">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-mono font-semibold text-zinc-100 tracking-tight">
            {totalGuests.toLocaleString()}
          </div>
        </div>
      </section>

      {/* Client Accounts Management */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-serif font-normal text-zinc-100 flex items-center gap-2">
            <span>Client Accounts & Assigned Weddings</span>
            <span className="text-xs font-mono font-normal text-zinc-400">
              ({filteredClients.length})
            </span>
          </h2>
        </div>

        {filteredClients.length === 0 ? (
          <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 text-center space-y-3">
            <p className="text-sm text-zinc-400">
              {clientFilter === "all"
                ? "No client accounts yet. Click \"New Client Account\" to provision login credentials for a couple or Wedding Organizer."
                : `No ${clientFilter} client accounts found.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredClients.map((client) => {
              const inviteText = getWhatsAppInvite(client);
              const isSuspended = client.status === "suspended";

              return (
                <div
                  key={client.id}
                  className={`p-6 rounded-2xl border transition-all ${
                    isSuspended
                      ? "bg-rose-950/[0.08] border-rose-900/30 opacity-80"
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
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-medium border ${
                            isSuspended
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {client.status}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                          Quota: {client.events.length} / {client.max_events} Events
                        </span>
                      </div>
                      <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                        <span>{client.email}</span>
                        {client.notes && (
                          <span className="text-zinc-400 italic text-[11px]">
                            • {client.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Access Credentials & Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs font-mono">
                        <span className="text-zinc-400">Code:</span>
                        <span className="text-amber-300 font-bold tracking-wider">
                          {client.access_code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(client.access_code, `code-${client.id}`)}
                          className="ml-1 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                          title="Copy Code"
                        >
                          {copiedId === `code-${client.id}` ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-emerald-400">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(inviteText, `invite-${client.id}`)}
                        className="h-8 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
                          <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
                        </svg>
                        <span>{copiedId === `invite-${client.id}` ? "Copied!" : "WhatsApp Invite"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResetAccessCode(client)}
                        className="h-8 px-2.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                        title="Generate New Access Code"
                      >
                        Reset Code
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(client)}
                        className={`h-8 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          isSuspended
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-zinc-900/80 text-rose-400 border-zinc-800 hover:border-rose-500/30 hover:bg-rose-500/10"
                        }`}
                      >
                        {isSuspended ? "Reactivate" : "Suspend"}
                      </button>
                    </div>
                  </div>

                  {/* Assigned Events for this Client */}
                  <div className="pt-4 space-y-2.5">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                      Assigned Wedding Rolls ({client.events.length})
                    </div>
                    {client.events.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">
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
                  <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Client Account Created Successfully</span>
                  </div>
                  <div className="text-xs font-mono text-zinc-300 space-y-1">
                    <div><span className="text-zinc-400">Name:</span> {createdClientResult.name}</div>
                    <div><span className="text-zinc-400">Email:</span> {createdClientResult.email}</div>
                    <div><span className="text-zinc-400">Access Code:</span> <span className="text-amber-300 font-bold">{createdClientResult.accessCode}</span></div>
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
                  className="w-full py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
                    <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
                  </svg>
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
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-white text-sm focus:border-amber-400/60 focus:outline-none transition-colors"
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
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-white text-sm focus:border-amber-400/60 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Max Allowed Event Rolls
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={clientForm.maxEvents}
                    onChange={(e) => setClientForm({ ...clientForm, maxEvents: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-white text-sm focus:border-amber-400/60 focus:outline-none transition-colors"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Default 1. Supports any package size (e.g. 5, 20, 100 event rolls for wedding planners).
                  </p>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clientForm.createStarterEvent}
                      onChange={(e) => setClientForm({ ...clientForm, createStarterEvent: e.target.checked })}
                      className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-400 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs text-zinc-300 select-none">
                      Create initial Event Roll for this client (Recommended)
                    </span>
                  </label>
                  <p className="text-[10px] text-zinc-400 ml-6.5 mt-0.5">
                    Automatically provisions an active starter event so the client avoids empty-state confusion on first sign-in.
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
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-white text-sm focus:border-amber-400/60 focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateClientModal(false)}
                    disabled={isSubmittingClient}
                    className="h-8 px-4 rounded-lg text-xs font-medium text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingClient || !clientForm.name || !clientForm.email}
                    className="h-8 px-5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-medium text-xs disabled:opacity-50 transition-colors cursor-pointer"
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
          <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl relative text-left">
            <h2 className="text-lg font-serif font-bold text-white mb-1">
              Edit Event: {editingEvent.couple_names}
            </h2>
            <p className="text-xs text-zinc-400 mb-5">
              Owner-locked package quotas, client assignment, and status.
            </p>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Client Owner Assignment
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsTransferringOwnership((prev) => !prev)}
                    className="text-[11px] font-mono text-amber-400/90 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {isTransferringOwnership ? "Cancel Transfer" : "Transfer Ownership"}
                  </button>
                </div>

                {!isTransferringOwnership ? (
                  <div className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs flex items-center justify-between">
                    <span className="text-zinc-200">
                      {eventForm.clientId
                        ? (() => {
                            const c = clients.find((item) => item.id === eventForm.clientId);
                            return c ? `${c.name} (${c.email})` : "Assigned Client";
                          })()
                        : "(Unassigned / Platform Owner)"}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-zinc-400">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      Locked
                    </span>
                  </div>
                ) : (
                  <select
                    value={eventForm.clientId}
                    onChange={(e) => setEventForm({ ...eventForm, clientId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-amber-400/40 text-white text-sm focus:border-amber-400/60 focus:outline-none"
                  >
                    <option value="">(Unassigned / Platform Owner)</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Package Tier Preset
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PACKAGE_TIERS.map((tier) => {
                    const isSelected = eventForm.packageTier === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => {
                          setEventForm({
                            ...eventForm,
                            packageTier: tier.id,
                            packageMaxGuests: tier.guests,
                            packageMaxShotsPerGuest: tier.shots,
                            shotsPerGuest: tier.shots,
                          });
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? "bg-amber-400/[0.08] border-amber-400/40 text-amber-200 shadow-sm"
                            : "bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-100">{tier.name}</span>
                          <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-amber-400 ring-2 ring-amber-400/30" : "bg-zinc-700"}`} />
                        </div>
                        <p className="text-[11px] font-mono text-zinc-400 mt-1">{tier.desc}</p>
                      </button>
                    );
                  })}
                </div>
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
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-white text-sm focus:border-amber-400/60 focus:outline-none"
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
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-white text-sm focus:border-amber-400/60 focus:outline-none"
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
                  className="w-full px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-white text-sm focus:border-amber-400/60 focus:outline-none"
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
                  className="h-8 px-4 rounded-lg text-xs font-medium text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingEvent}
                  className="h-8 px-5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-medium text-xs disabled:opacity-50 transition-colors cursor-pointer"
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

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, clearSession, type PropertyAccess } from "@/lib/session";
import { getOwnerData, fetchIcal, getCleanerTasks, markAsCleaned, resetCleaningStatus, getTickets, fetchExpenses } from "@/lib/api";
import { toast } from "sonner";
import type { Booking, ManualReservation, Property, CleanerTask, Ticket, Expense } from "@/types";
import { CLEANING_STATUS_PRIORITY } from "@/lib/status-config";

export function useDashboardData() {
  const navigate = useNavigate();
  const session = getSession();
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [manualReservations, setManualReservations] = useState<ManualReservation[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cleanerTasks, setCleanerTasks] = useState<CleanerTask[]>([]);
  const [cleaningLoading, setCleaningLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [ownerTickets, setOwnerTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportPropertyId, setReportPropertyId] = useState<string>("");
  const [cleaningExpenses, setCleaningExpenses] = useState<Expense[]>([]);

  const userProperties: PropertyAccess[] = session?.properties || [];
  const hasAnyFinance = userProperties.some((p) => p.can_view_finance);
  const hasAnyCleaning = userProperties.some((p) => p.can_view_cleaning);
  const defaultTab = hasAnyFinance ? "finance" : "cleaning";
  const [activeTab, setActiveTab] = useState(defaultTab);

  const selectedAccess = userProperties.find((p) => p.id === selectedPropertyId);
  const hasFinance = selectedAccess?.can_view_finance ?? false;
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  const cleaningPropertyIds = userProperties.filter((p) => p.can_view_cleaning).map((p) => p.id);
  const filteredTasks = cleanerTasks.filter((t) => cleaningPropertyIds.includes(t.property_id));
  const sortedTasks = [...filteredTasks].sort(
    (a, b) => (CLEANING_STATUS_PRIORITY[a.status] ?? 5) - (CLEANING_STATUS_PRIORITY[b.status] ?? 5)
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAdhocExpenses = cleaningExpenses.filter((e) => e.date === todayStr);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!session || session.role !== "user") {
      navigate("/");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(async () => {
    try {
      const data = await getOwnerData(session!.pin);
      setProperties(data.properties);
      setBookings(data.bookings);
      setManualReservations(data.manual_reservations || []);
      if (data.properties.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(data.properties[0].id);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId]);

  const loadCleaningTasks = useCallback(async () => {
    setCleaningLoading(true);
    try {
      const [tasks, expenses] = await Promise.all([
        getCleanerTasks(session!.pin),
        fetchExpenses({ category: "cleaning" }).catch(() => [] as Expense[]),
      ]);
      setCleanerTasks(tasks);
      setCleaningExpenses(expenses);
    } catch {
      toast.error("Failed to load cleaning tasks");
    } finally {
      setCleaningLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = useCallback(async () => {
    if (!selectedPropertyId) return;
    setSyncing(true);
    try {
      const result = await fetchIcal(selectedPropertyId, session!.pin);
      setBookings((prev) => [
        ...prev.filter((b) => b.property_id !== selectedPropertyId),
        ...(result.bookings || []),
      ]);
      const cancelled = (result as any).cancelled || 0;
      const skipped = (result as any).skipped as string | null;
      if (skipped) {
        toast.warning(`Sync paused: too many bookings would be cancelled. Check the iCal feed.`);
      } else if (cancelled > 0) {
        toast.success(`Synced ${result.synced} events · ${cancelled} cancelled by guest`);
        loadData();
      } else {
        toast.success(`Synced ${result.synced} events`);
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId]);

  const handleMarkCleaned = useCallback(async (reservationId: string) => {
    setMarkingId(reservationId);
    try {
      await markAsCleaned(session!.pin, reservationId);
      toast.success("Marked as cleaned!");
      loadCleaningTasks();
    } catch {
      toast.error("Failed to update");
    } finally {
      setMarkingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCleaningTasks]);

  const handleRevertCleaning = useCallback(async (reservationId: string) => {
    setMarkingId(reservationId);
    try {
      await resetCleaningStatus(session!.pin, reservationId);
      toast.success("Reverted to pending");
      loadCleaningTasks();
    } catch {
      toast.error("Failed to update");
    } finally {
      setMarkingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCleaningTasks]);

  const handleLogout = useCallback(() => {
    clearSession();
    navigate("/");
  }, [navigate]);

  const loadOwnerTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const data = await getTickets(session!.pin, "user");
      setOwnerTickets(data);
    } catch {
      toast.error("Failed to load issues");
    } finally {
      setTicketsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    if (tab === "cleaning" && cleanerTasks.length === 0) loadCleaningTasks();
    if (tab === "tickets" && ownerTickets.length === 0) loadOwnerTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanerTasks.length, ownerTickets.length, loadCleaningTasks, loadOwnerTickets]);

  return {
    session,
    loading,
    syncing,
    activeTab,
    properties,
    bookings,
    manualReservations,
    selectedPropertyId,
    setSelectedPropertyId,
    selectedAccess,
    hasFinance,
    selectedProperty,
    userProperties,
    hasAnyFinance,
    hasAnyCleaning,
    cleaningLoading,
    sortedTasks,
    cleaningExpenses,
    todayAdhocExpenses,
    markingId,
    ownerTickets,
    ticketsLoading,
    reportDialogOpen,
    setReportDialogOpen,
    reportPropertyId,
    setReportPropertyId,
    loadData,
    loadCleaningTasks,
    handleSync,
    handleMarkCleaned,
    handleRevertCleaning,
    handleLogout,
    loadOwnerTickets,
    handleTabChange,
  };
}

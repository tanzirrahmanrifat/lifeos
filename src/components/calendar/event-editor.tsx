"use client";
import * as React from "react";
import { toast } from "sonner";
import { getEventAction } from "@/modules/calendar/actions";
import type { EventDTO } from "@/modules/calendar/types";
import { EventFormDialog } from "./event-form-dialog";

/** Opens an existing event by id, fetching its data on demand (calendar items don't carry the full record). */
export function EventEditor({ eventId, defaultDate, clients = [], onOpenChange }: { eventId: string | null; defaultDate: string; clients?: { id: string; name: string }[]; onOpenChange: (o: boolean) => void }) {
  return eventId ? <Loader key={eventId} eventId={eventId} defaultDate={defaultDate} clients={clients} onOpenChange={onOpenChange} /> : null;
}

/** Remounts (via the `key` above) whenever a different event is opened, so the fetch always starts fresh. */
function Loader({ eventId, defaultDate, clients, onOpenChange }: { eventId: string; defaultDate: string; clients: { id: string; name: string }[]; onOpenChange: (o: boolean) => void }) {
  const [event, setEvent] = React.useState<EventDTO | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    getEventAction(eventId).then((res) => {
      if (!active) return;
      setLoading(false);
      if (res.ok) setEvent(res.data);
      else {
        toast.error(res.error.message);
        onOpenChange(false);
      }
    });
    return () => {
      active = false;
    };
  }, [eventId, onOpenChange]);

  if (loading) return null; // the "+ Add event" dialog covers the create case instantly
  return <EventFormDialog open onOpenChange={onOpenChange} event={event} defaultDate={defaultDate} clients={clients} />;
}

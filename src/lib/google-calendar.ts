/**
 * Build a "create event" URL for Google Calendar's templated endpoint.
 *
 * No OAuth required. The user clicks the link, lands on the Google
 * Calendar create-event page pre-filled with title/dates/location/notes,
 * and clicks Save. Works because the user is already signed in to Google
 * in the same browser session.
 *
 * Reference: https://calendar.google.com/calendar/render?action=TEMPLATE
 *   - text:     event title
 *   - dates:    UTC range, formatted YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ
 *   - details:  free-text body
 *   - location: free-text location
 */
export type GoogleCalendarEvent = {
  title: string;
  startAt: number; // epoch ms
  endAt: number;   // epoch ms
  location?: string;
  notes?: string;
};

export function buildGoogleCalendarUrl(event: GoogleCalendarEvent): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", event.title);
  params.set(
    "dates",
    `${toGoogleUtc(event.startAt)}/${toGoogleUtc(event.endAt)}`,
  );
  if (event.location && event.location.trim()) {
    params.set("location", event.location.trim());
  }
  if (event.notes && event.notes.trim()) {
    params.set("details", event.notes.trim());
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Format epoch ms as Google Calendar's UTC string: YYYYMMDDTHHmmssZ. */
function toGoogleUtc(ms: number): string {
  // toISOString gives 2026-06-09T18:00:00.000Z; strip dashes/colons/millis.
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

import React, { useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import axios from "axios";

// Utility to get today's date in YYYY-MM-DD
function getTodayISO() {
  const today = new Date();
  return today.toISOString().slice(0, 10);
}

export default function SearchAndSendButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const handleSearchAndSend = async () => {
    setLoading(true);
    setResult("");
    try {
      // 1. Get all hotels
      const hotelsRes = await axios.get("/hotels");
      const hotels = hotelsRes.data || [];
      let totalSent = 0;
      let totalFound = 0;
      for (const hotel of hotels) {
        // 2. Get rooms for each hotel
        const roomsRes = await axios.get(`/hotels/${hotel.id}/rooms`);
        const rooms = roomsRes.data || [];
        for (const room of rooms) {
          // 3. For each room, get calendar events
          if (!room.calendar_url) continue;
          try {
            // API endpoint assumed: /calendar/events?calendar_url=...&date=YYYY-MM-DD
            const calRes = await axios.get("/calendar/events", {
              params: {
                calendar_url: room.calendar_url,
                date: getTodayISO(),
              },
            });
            const events = calRes.data || [];
            // Filter for check-in today
            const checkinEvents = events.filter(
              (ev) => ev.checkin_date === getTodayISO()
            );
            totalFound += checkinEvents.length;
            for (const ev of checkinEvents) {
              // 4. Send WhatsApp message via backend
              await axios.post("/messages", {
                hotel_id: hotel.id,
                room_id: room.id,
                guest_name: ev.guest_name,
                phone: room.whatsapp_number,
                content: `Bun venit, ${ev.guest_name}! Check-in astăzi la camera ${room.name}.`,
                checkin_date: ev.checkin_date,
                reservation_id: ev.id,
              });
              totalSent++;
            }
          } catch (err) {
            // Ignore calendar errors for missing/invalid URLs
          }
        }
      }
      setResult(
        `Au fost găsite ${totalFound} rezervări cu check-in astăzi. Mesaje trimise: ${totalSent}.`
      );
    } catch (err) {
      setResult("Eroare la procesare. Verifică conexiunea la API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: "24px 0", textAlign: "center" }}>
      <Button
        variant="contained"
        color="success"
        onClick={handleSearchAndSend}
        disabled={loading}
        size="large"
      >
        {loading ? <CircularProgress size={24} /> : "Search and Send"}
      </Button>
      {result && <div style={{ marginTop: 16 }}>{result}</div>}
    </div>
  );
}

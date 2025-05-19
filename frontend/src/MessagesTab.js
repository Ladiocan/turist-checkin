import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getHotels, getRooms, getMessages, getMessageStats } from "./api";
import { Box, Typography, Paper, Select, MenuItem, TextField, Button, Snackbar, Alert } from "@mui/material";

export default function MessagesTab() {
  const { t } = useTranslation();
  const [hotels, setHotels] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState("");
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  useEffect(() => { fetchHotels(); }, []);
  useEffect(() => { if (selectedHotel) fetchRooms(selectedHotel); else setRooms([]); }, [selectedHotel]);

  const fetchHotels = async () => {
    try {
      const res = await getHotels();
      // API-ul returnează direct array-ul, nu încapsulat în data
      setHotels(res || []);
      if (res && res.length > 0) setSelectedHotel(res[0].id);
    } catch (error) {
      console.error("Eroare la încărcarea hotelurilor:", error);
      setSnackbar({ 
        open: true, 
        message: `${t('common.error')}: ${t('hotels.loadError')} ${error.message}`, 
        severity: "error" 
      });
      setHotels([]);
    }
  };
  const fetchRooms = async (hotelId) => {
    try {
      const res = await getRooms(hotelId);
      // API-ul returnează direct array-ul, nu încapsulat în data
      setRooms(res || []);
      if (res && res.length > 0) setSelectedRoom(res[0].id);
    } catch (error) {
      console.error("Eroare la încărcarea camerelor:", error);
      setSnackbar({ 
        open: true, 
        message: `${t('common.error')}: ${t('rooms.loadError')} ${error.message}`,
        severity: "error" 
      });
      setRooms([]);
    }
  };
  const fetchMessages = async () => {
    try {
      const params = { hotel_id: selectedHotel, room_id: selectedRoom, start_date: startDate, end_date: endDate };
      const res = await getMessages(params);
      // API-ul returnează direct array-ul, nu încapsulat în data
      setMessages(res || []);
      setSnackbar({ 
        open: true, 
        message: t('messages.messagesFound', { count: res?.length || 0 }),
        severity: "success" 
      });
    } catch (error) {
      console.error("Eroare la încărcarea mesajelor:", error);
      setSnackbar({ 
        open: true, 
        message: `${t('common.error')}: ${t('messages.loadError')} ${error.message}`,
        severity: "error" 
      });
      setMessages([]);
    }
  };
  
  const fetchStats = async () => {
    try {
      const params = { hotel_id: selectedHotel, start_date: startDate, end_date: endDate };
      const res = await getMessageStats(params);
      // API-ul returnează direct array-ul, nu încapsulat în data
      setStats(res || []);
      setSnackbar({ 
        open: true, 
        message: t('messages.statsLoaded'),
        severity: "success" 
      });
    } catch (error) {
      console.error("Eroare la încărcarea statisticilor:", error);
      setSnackbar({ 
        open: true, 
        message: `${t('common.error')}: ${t('messages.statsLoadError')} ${error.message}`,
        severity: "error" 
      });
      setStats([]);
    }
  };
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>{t('messages.title')}</Typography>
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <Select 
          value={selectedHotel} 
          onChange={e => setSelectedHotel(e.target.value)}
          displayEmpty
          renderValue={(value) => {
            const hotel = hotels.find(h => h.id === value);
            return hotel ? hotel.name : t('messages.hotel');
          }}
        >
          {hotels.map(hotel => <MenuItem key={hotel.id} value={hotel.id}>{hotel.name}</MenuItem>)}
        </Select>
        <Select 
          value={selectedRoom} 
          onChange={e => setSelectedRoom(e.target.value)}
          displayEmpty
          renderValue={(value) => {
            const room = rooms.find(r => r.id === value);
            return room ? room.name : t('messages.room');
          }}
        >
          {rooms.map(room => <MenuItem key={room.id} value={room.id}>{room.name}</MenuItem>)}
        </Select>
        <TextField label={t('messages.startDate')} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label={t('messages.endDate')} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="contained" onClick={fetchMessages}>{t('messages.searchButton')}</Button>
        <Button variant="outlined" onClick={fetchStats}>{t('messages.statsButton')}</Button>
      </Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1">{t('messages.messagesTitle')}</Typography>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>{t('messages.hotel')}</th>
              <th>{t('messages.room')}</th>
              <th>{t('messages.date')}</th>
              <th>{t('messages.template')}</th>
              <th>{t('messages.status')}</th>
              <th>{t('messages.content')}</th>
            </tr>
          </thead>
          <tbody>
            {messages.map(msg => (
              <tr key={msg.id}>
                <td>{hotels.find(h => h.id === msg.hotel_id)?.name}</td>
                <td>{rooms.find(r => r.id === msg.room_id)?.name}</td>
                <td>{msg.sent_date}</td>
                <td>{msg.template_name}</td>
                <td>{msg.status}</td>
                <td>{msg.content}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1">{t('messages.statsTitle')}</Typography>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>{t('messages.hotel')}</th>
              <th>{t('messages.totalMessages')}</th>
              <th>{t('messages.period')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(stat => (
              <tr key={stat.hotel_id}>
                <td>{stat.hotel_name}</td>
                <td>{stat.total_messages}</td>
                <td>{stat.start_date} - {stat.end_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Paper>
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={5000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

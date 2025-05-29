import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getHotels, getRooms, getMessages, getMessageStats } from "./api";
import { 
  Box, 
  Typography, 
  Paper, 
  Select, 
  MenuItem, 
  TextField, 
  Button, 
  Snackbar, 
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Divider,
  Card,
  CardContent,
  Grid
} from "@mui/material";

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
  const [messageTypeFilter, setMessageTypeFilter] = useState("all");
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
      // Set default to "all" to show all rooms
      setSelectedRoom("all");
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
      // If "all" is selected, don't send room_id parameter to get all rooms
      const params = { 
        hotel_id: selectedHotel, 
        room_id: selectedRoom === "all" ? undefined : selectedRoom, 
        start_date: startDate, 
        end_date: endDate 
      };
      
      // If "all" is selected, also fetch stats to show total count
      if (selectedRoom === "all") {
        fetchStats();
      }
      
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
  // Filter messages based on type
  const filteredMessages = messages.filter(msg => {
    if (messageTypeFilter === "all") return true;
    if (messageTypeFilter === "ai" && msg.template_name === "AI_RESPONSE") return true;
    if (messageTypeFilter === "received" && msg.template_name === "RECEIVED_MESSAGE") return true;
    if (messageTypeFilter === "sent" && msg.template_name !== "AI_RESPONSE" && msg.template_name !== "RECEIVED_MESSAGE") return true;
    return false;
  });

  // Group messages by conversation (same room and date)
  const groupedMessages = {};
  filteredMessages.forEach(msg => {
    const key = `${msg.room_id}_${msg.sent_date}`;
    if (!groupedMessages[key]) {
      groupedMessages[key] = [];
    }
    groupedMessages[key].push(msg);
  });

  // Sort grouped messages by date (newest first)
  const sortedGroups = Object.keys(groupedMessages).sort((a, b) => {
    const dateA = groupedMessages[a][0].sent_date;
    const dateB = groupedMessages[b][0].sent_date;
    return new Date(dateB) - new Date(dateA);
  });

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>{t('messages.title')}</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="hotel-select-label">{t('messages.hotel')}</InputLabel>
              <Select
                labelId="hotel-select-label"
                value={selectedHotel}
                label={t('messages.hotel')}
                onChange={e => setSelectedHotel(e.target.value)}
              >
                {hotels.map(hotel => <MenuItem key={hotel.id} value={hotel.id}>{hotel.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="room-select-label">{t('messages.room')}</InputLabel>
              <Select
                labelId="room-select-label"
                value={selectedRoom}
                label={t('messages.room')}
                onChange={e => setSelectedRoom(e.target.value)}
                disabled={!selectedHotel}
              >
                <MenuItem value="all">Toate camerele</MenuItem>
                {rooms.map(room => <MenuItem key={room.id} value={room.id}>{room.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField 
              fullWidth
              label={t('messages.startDate')} 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              InputLabelProps={{ shrink: true }} 
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField 
              fullWidth
              label={t('messages.endDate')} 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              InputLabelProps={{ shrink: true }} 
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button variant="contained" onClick={fetchMessages} fullWidth>
              {t('messages.searchButton')}
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Typography variant="body2" sx={{ mr: 1 }}>
                {t('messages.filterByType')}:
              </Typography>
              <Chip 
                label={t('messages.allMessages')} 
                color={messageTypeFilter === "all" ? "primary" : "default"}
                onClick={() => setMessageTypeFilter("all")}
                variant={messageTypeFilter === "all" ? "filled" : "outlined"}
              />
              <Chip 
                label={t('messages.aiResponses')} 
                color={messageTypeFilter === "ai" ? "primary" : "default"}
                onClick={() => setMessageTypeFilter("ai")}
                variant={messageTypeFilter === "ai" ? "filled" : "outlined"}
              />
              <Chip 
                label={t('messages.receivedMessages')} 
                color={messageTypeFilter === "received" ? "primary" : "default"}
                onClick={() => setMessageTypeFilter("received")}
                variant={messageTypeFilter === "received" ? "filled" : "outlined"}
              />
              <Chip 
                label={t('messages.sentMessages')} 
                color={messageTypeFilter === "sent" ? "primary" : "default"}
                onClick={() => setMessageTypeFilter("sent")}
                variant={messageTypeFilter === "sent" ? "filled" : "outlined"}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t('messages.messagesTitle')} 
          {filteredMessages.length > 0 && (
            <Chip 
              label={filteredMessages.length} 
              size="small" 
              color="primary" 
              sx={{ ml: 1 }} 
            />
          )}
        </Typography>

        {sortedGroups.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {t('messages.noMessagesFound')}
            </Typography>
          </Paper>
        ) : (
          sortedGroups.map(groupKey => {
            const groupMessages = groupedMessages[groupKey];
            const roomId = groupKey.split('_')[0];
            const date = groupKey.split('_')[1];
            const roomName = rooms.find(r => r.id === parseInt(roomId))?.name || 'Unknown Room';
            const hotelId = groupMessages[0].hotel_id;
            const hotelName = hotels.find(h => h.id === hotelId)?.name || 'Unknown Hotel';
            
            return (
              <Card key={groupKey} sx={{ mb: 2, overflow: 'visible' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle1">
                      {hotelName} - {roomName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(date).toLocaleDateString()}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  {groupMessages.map(msg => {
                    // Determine message type for styling
                    const isAiResponse = msg.template_name === "AI_RESPONSE";
                    const isReceivedMessage = msg.template_name === "RECEIVED_MESSAGE";
                    
                    return (
                      <Box 
                        key={msg.id} 
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isAiResponse ? 'flex-start' : 'flex-end',
                          mb: 2
                        }}
                      >
                        <Box 
                          sx={{
                            maxWidth: '80%',
                            p: 2,
                            borderRadius: 2,
                            bgcolor: isAiResponse 
                              ? 'primary.light' 
                              : isReceivedMessage 
                                ? 'grey.200'
                                : 'success.light',
                            color: isAiResponse ? 'white' : 'text.primary',
                          }}
                        >
                          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                            {msg.content}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ mt: 0.5, display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip 
                            label={isAiResponse 
                              ? t('messages.aiResponse') 
                              : isReceivedMessage 
                                ? t('messages.receivedMessage')
                                : msg.template_name
                            } 
                            size="small" 
                            color={isAiResponse ? "primary" : isReceivedMessage ? "default" : "success"}
                            variant="outlined"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {msg.status}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })
        )}
      </Box>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>{t('messages.statsTitle')}</Typography>
        
        {stats.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', p: 2 }}>
            {t('messages.noStatsFound')}
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('messages.hotel')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>{t('messages.room')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>{t('messages.totalMessages')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('messages.period')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat, index) => {
                  // Check if this is a hotel-wide statistic
                  const isHotelWide = stat.room_id === null;
                  
                  return (
                    <tr 
                      key={`${stat.hotel_id}_${stat.room_id || 'all'}`} 
                      style={{ 
                        borderBottom: '1px solid #f5f5f5',
                        backgroundColor: isHotelWide ? '#f9f9f9' : 'transparent'
                      }}
                    >
                      <td style={{ 
                        padding: '12px 16px', 
                        fontWeight: isHotelWide ? 700 : 400,
                        borderLeft: isHotelWide ? '4px solid #1976d2' : 'none'
                      }}>
                        {stat.hotel_name}
                      </td>
                      <td style={{ 
                        padding: '12px 16px',
                        fontStyle: isHotelWide ? 'italic' : 'normal',
                        fontWeight: isHotelWide ? 500 : 'normal'
                      }}>
                        {stat.room_name}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <Chip 
                          label={stat.total_messages} 
                          color={isHotelWide ? "primary" : "default"}
                          variant={isHotelWide ? "filled" : "outlined"}
                          size={isHotelWide ? "medium" : "small"}
                        />
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#666' }}>
                        {stat.start_date ? stat.start_date : '-'} - {stat.end_date ? stat.end_date : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        )}
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

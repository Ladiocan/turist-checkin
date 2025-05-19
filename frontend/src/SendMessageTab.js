import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getHotels, getRooms, sendManualMessage, searchAndSendMessages, getRoomSettings } from "./api";
import { 
  Box, Typography, Button, Paper, Snackbar, Select, MenuItem, TextField,
  Divider, CircularProgress, Alert, Card, CardContent, Grid, FormControl,
  InputLabel, Chip, List, ListItem, ListItemText, ListItemIcon
} from "@mui/material";
import ScheduleIcon from '@mui/icons-material/Schedule';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
import HotelIcon from '@mui/icons-material/Hotel';
import BedIcon from '@mui/icons-material/Bed';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { format } from 'date-fns';

export default function SendMessageTab() {
  const { t } = useTranslation();
  // State pentru trimitere manuală
  const [hotels, setHotels] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState("");
  const [rooms, setRooms] = useState([]);
  const [roomsWithSettings, setRoomsWithSettings] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [roomSettings, setRoomSettings] = useState(null);
  const [templateName, setTemplateName] = useState("oberth");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  
  // State pentru trimitere automată
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [result, setResult] = useState("");
  
  // Încarcă lista de hoteluri la început
  useEffect(() => {
    fetchHotels();
  }, []);
  
  // Încarcă camerele când se schimbă hotelul selectat
  useEffect(() => {
    if (selectedHotel) {
      fetchRooms(selectedHotel);
    } else {
      setRooms([]);
    }
  }, [selectedHotel]);
  
  // Încarcă setările camerei când se schimbă camera selectată
  useEffect(() => {
    if (selectedRoom) {
      fetchRoomSettings(selectedRoom);
    } else {
      setRoomSettings(null);
    }
  }, [selectedRoom]);
  
  // Funcție pentru a obține lista de hoteluri
  const fetchHotels = async () => {
    try {
      setLoading(true);
      const response = await getHotels();
      setHotels(response);
      if (response.length > 0) {
        setSelectedHotel(response[0].id);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Eroare la încărcarea hotelurilor: ${error.message}`,
        severity: "error"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Funcție pentru a obține camerele unui hotel
  const fetchRooms = async (hotelId) => {
    try {
      setLoadingRooms(true);
      const response = await getRooms(hotelId);
      setRooms(response);
      
      if (response.length > 0) {
        setSelectedRoom(response[0].id);
        // Obținem setările pentru toate camerele
        fetchAllRoomSettings(response);
      } else {
        setSelectedRoom("");
        setRoomsWithSettings([]);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Eroare la încărcarea camerelor: ${error.message}`,
        severity: "error"
      });
      setRoomsWithSettings([]);
    } finally {
      setLoadingRooms(false);
    }
  };
  
  // Funcție pentru a obține setările pentru toate camerele
  const fetchAllRoomSettings = async (roomsList) => {
    try {
      const roomsWithSettingsPromises = roomsList.map(async (room) => {
        try {
          const settings = await getRoomSettings(room.id);
          // Formatăm timpul pentru afișare
          let formattedSettings = settings;
          if (settings && settings.send_time) {
            const timeParts = settings.send_time.split(':');
            formattedSettings = {
              ...settings,
              formattedTime: timeParts.length >= 2 ? `${timeParts[0]}:${timeParts[1]}` : '11:00'
            };
          }
          
          return {
            ...room,
            settings: formattedSettings
          };
        } catch (error) {
          // Dacă nu există setări, setăm valori implicite
          return {
            ...room,
            settings: {
              auto_send: false,
              send_time: '11:00:00',
              formattedTime: '11:00'
            }
          };
        }
      });
      
      const updatedRooms = await Promise.all(roomsWithSettingsPromises);
      setRoomsWithSettings(updatedRooms);
    } catch (error) {
      console.error('Eroare la obținerea setărilor pentru camere:', error);
      setRoomsWithSettings(roomsList.map(room => ({
        ...room,
        settings: {
          auto_send: false,
          send_time: '11:00:00',
          formattedTime: '11:00'
        }
      })));
    }
  };
  
  // Funcție pentru a obține setările unei camere
  const fetchRoomSettings = async (roomId) => {
    try {
      const response = await getRoomSettings(roomId);
      // Asigurăm că send_time este în format corect pentru afișare
      if (response && response.send_time) {
        // Păstrăm formatul original pentru API
        response.originalSendTime = response.send_time;
        // Extragem orele și minutele pentru afișare
        const timeParts = response.send_time.split(':');
        if (timeParts.length >= 2) {
          response.formattedTime = `${timeParts[0]}:${timeParts[1]}`;
        } else {
          response.formattedTime = '11:00';
        }
      }
      setRoomSettings(response);
      
      // Setează template-ul din setările camerei
      const selectedRoomData = rooms.find(room => room.id === roomId);
      if (selectedRoomData && selectedRoomData.template_name) {
        setTemplateName(selectedRoomData.template_name);
      }
    } catch (error) {
      // Dacă nu există setări, setează valori implicite
      setRoomSettings({
        auto_send: true,
        originalSendTime: '11:00:00',
        formattedTime: '11:00'
      });
    }
  };

  // Funcție pentru trimitere manuală
  const handleManualSend = async () => {
    if (!selectedRoom) {
      setSnackbar({ 
        open: true, 
        message: "Selectează o cameră pentru a trimite mesajul!", 
        severity: "error" 
      });
      return;
    }

    try {
      setLoading(true);
      const selectedRoomData = rooms.find(room => room.id === selectedRoom);
      
      const response = await sendManualMessage({
        room_id: selectedRoom,
        template_name: templateName
      });
      
      setSnackbar({ 
        open: true, 
        message: `Mesaj trimis cu succes către ${response.to || 'destinatar'}!`, 
        severity: "success" 
      });
      setResult(`Mesaj trimis cu template '${response.template}' către ${response.to || 'destinatar'}.`);
    } catch (e) {
      console.error("Eroare la trimitere:", e);
      setSnackbar({ 
        open: true, 
        message: `Eroare: ${e.response?.data?.detail || e.message || 'Eroare la trimitere'}`, 
        severity: "error" 
      });
    } finally {
      setLoading(false);
    }
  };

  // Funcție pentru căutare și trimitere automată
  const handleSearchAndSend = async () => {
    try {
      setLoading(true);
      setResult("");
      const response = await searchAndSendMessages();
      // API-ul returnează direct obiectul, nu încapsulat în data
      setResult(`${response.message || t('sendMessage.success')} ${t('sendMessage.messagesFound', { count: response.found || 0 })} ${t('common.and')} ${response.sent || 0} ${t('sendMessage.messagesSent')}.`);
      setSnackbar({ 
        open: true, 
        message: t('sendMessage.processComplete'), 
        severity: "success" 
      });
    } catch (e) {
      console.error("Eroare la procesare:", e);
      setSnackbar({ 
        open: true, 
        message: `${t('common.error')}: ${e.response?.detail || e.message || t('sendMessage.processError')}`, 
        severity: "error" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                <HotelIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                {t('sendMessage.selectHotelRoom')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t('sendMessage.selectRoomDescription')}
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>{t('sendMessage.hotel')}</InputLabel>
                <Select
                  value={selectedHotel}
                  onChange={(e) => setSelectedHotel(e.target.value)}
                  label={t('sendMessage.hotel')}
                  disabled={loading || hotels.length === 0}
                >
                  {hotels.map((hotel) => (
                    <MenuItem key={hotel.id} value={hotel.id}>
                      {hotel.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>{t('sendMessage.room')}</InputLabel>
                <Select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  label={t('sendMessage.room')}
                  disabled={loading || loadingRooms || rooms.length === 0}
                >
                  {rooms.map((room) => (
                    <MenuItem key={room.id} value={room.id}>
                      <BedIcon sx={{ mr: 1, fontSize: 18 }} /> {room.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {selectedRoom && roomSettings && (
                <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Setări de trimitere automată:
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <ScheduleIcon fontSize="small" color={roomSettings.auto_send ? "primary" : "disabled"} />
                      </ListItemIcon>
                      <ListItemText 
                        primary={roomSettings.auto_send ? "Trimitere automată activată" : "Trimitere automată dezactivată"}
                        secondary={roomSettings.auto_send ? `Ora de trimitere: ${roomSettings.formattedTime || '11:00'}` : null}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <WhatsAppIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Template WhatsApp"
                        secondary={templateName}
                      />
                    </ListItem>
                  </List>
                </Box>
              )}
              
              <Button 
                variant="contained" 
                color="primary"
                startIcon={<SendIcon />}
                onClick={handleManualSend} 
                disabled={loading || !selectedRoom}
                fullWidth
                size="large"
                sx={{ py: 1.2 }}
              >
                {loading ? <CircularProgress size={24} /> : "Trimite mesaj acum"}
              </Button>
              
              {result && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  {result}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>

          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                <SendIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                {t('sendMessage.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t('sendMessage.selectRoomDescription')}
              </Typography>
              
              <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {t('sendMessage.autoSendNote')}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {t('sendMessage.autoSendRoomsNote')}
                </Typography>
                
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                  {t('sendMessage.activeRoomsTitle')}
                </Typography>
                
                {roomsWithSettings.length > 0 ? (
                  <List dense sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
                    {roomsWithSettings.map(room => {
                      // Verificăm dacă camera are setări de trimitere automată
                      const hasAutoSend = room.settings && room.settings.auto_send;
                      return (
                        <ListItem key={room.id} sx={{ 
                          py: 0.5,
                          borderLeft: hasAutoSend ? '3px solid #4caf50' : '3px solid transparent'
                        }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <BedIcon fontSize="small" color={hasAutoSend ? "success" : "disabled"} />
                          </ListItemIcon>
                          <ListItemText 
                            primary={room.name}
                            secondary={hasAutoSend ? 
                              `${t('sendMessage.sendTimeLabel')}: ${room.settings.formattedTime || '11:00'}` : 
                              t('sendMessage.autoSendDisabled')}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {t('sendMessage.noRoomsConfigured')}
                  </Typography>
                )}
              </Box>
              
              <Button 
                variant="contained" 
                color="success" 
                startIcon={<SearchIcon />}
                onClick={handleSearchAndSend} 
                disabled={loading}
                fullWidth
                size="large"
                sx={{ py: 1.5 }}
              >
                {loading ? <CircularProgress size={24} /> : t('sendMessage.autoSendButton')}
              </Button>
              
              {result && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {result}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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


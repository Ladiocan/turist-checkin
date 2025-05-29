import React, { useState, useEffect } from "react";
import { 
  Box, 
  Typography, 
  Button, 
  TextField, 
  Paper, 
  IconButton, 
  Snackbar, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  MenuItem, 
  Select, 
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Tooltip,
  InputAdornment,
  FormHelperText,
  Chip
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BedIcon from '@mui/icons-material/Bed';
import LinkIcon from '@mui/icons-material/Link';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import TemplateIcon from '@mui/icons-material/Description';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

import { getHotels, getRooms, createRoom, updateRoom, getRoomSettings, updateRoomSettings } from "./api";

export default function RoomsTab() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHotel, setSelectedHotel] = useState("");
  const [rooms, setRooms] = useState([]);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editRoom, setEditRoom] = useState(null);
  const [form, setForm] = useState({ 
    name: "", 
    calendar_url: "", 
    template_name: "oberth" 
  });
  // State pentru setări de automatizare cu valori implicite sigure
  const [settings, setSettings] = useState({
    auto_send: true,
    send_time: new Date(new Date().setHours(11, 0, 0, 0)),
    room_id: null
  });
  const [snackbar, setSnackbar] = useState({ 
    open: false, 
    message: "", 
    severity: "success" 
  });

  useEffect(() => { 
    fetchHotels(); 
  }, []);
  
  useEffect(() => { 
    if (selectedHotel) fetchRooms(selectedHotel); 
    else setRooms([]); 
  }, [selectedHotel]);
  
  const fetchHotels = async () => {
    setLoading(true);
    try {
      const response = await getHotels();
      setHotels(response);
      if (response.length > 0) setSelectedHotel(response[0].id);
    } catch (error) {
      setSnackbar({ 
        open: true, 
        message: "Eroare la încărcarea hotelurilor: " + (error.response?.data?.detail || error.message), 
        severity: "error" 
      });
    } finally {
      setLoading(false);
    }
  };
  
  const fetchRooms = async (hotelId) => {
    setLoading(true);
    try {
      // Obținem lista de camere
      const roomsResponse = await getRooms(hotelId);
      
      // Pentru fiecare cameră, încearcăm să obținem setările
      const roomsWithSettings = await Promise.all(roomsResponse.map(async (room) => {
        try {
          // Încearcăm să obținem setările pentru această cameră
          const settings = await getRoomSettings(room.id);
          
          // Formatăm ora pentru afișare
          let autoSendTime = "11:00";
          
          if (settings?.send_time) {
            try {
              // Verificăm dacă e string de tipul HH:MM:SS
              if (typeof settings.send_time === 'string' && settings.send_time.includes(':')) {
                // Extragem doar HH:MM din HH:MM:SS
                autoSendTime = settings.send_time.split(':').slice(0, 2).join(':');
              } else {
                // Încearcăm să formatăm ca dată
                const timeDate = new Date(settings.send_time);
                if (!isNaN(timeDate.getTime())) {
                  autoSendTime = timeDate.getHours().toString().padStart(2, '0') + ':' + 
                                timeDate.getMinutes().toString().padStart(2, '0');
                }
              }
            } catch (e) {
              console.error("Eroare la formatarea orei:", e);
            }
          }
          
          // Returnăm camera cu setările adăugate
          return {
            ...room,
            auto_send: settings?.auto_send ?? true,
            auto_send_time: autoSendTime,
            has_settings: true
          };
        } catch (e) {
          // Dacă nu există setări, folosim valorile implicite
          return {
            ...room,
            auto_send: true,
            auto_send_time: "11:00",
            has_settings: false
          };
        }
      }));
      
      setRooms(roomsWithSettings);
    } catch (error) {
      console.error("Eroare la încărcarea camerelor:", error);
      setSnackbar({ 
        open: true, 
        message: "Eroare la încărcarea camerelor: " + (error.response?.data?.detail || error.message), 
        severity: "error" 
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpen = (room = null) => {
    setEditRoom(room);
    setForm(room ? { 
      name: room.name || "", 
      calendar_url: room.calendar_url || "", 
      template_name: room.template_name || "oberth" 
    } : { 
      name: "", 
      calendar_url: "", 
      template_name: "oberth" 
    });
    setOpen(true);
  };
  
  const handleOpenSettings = async (room) => {
    try {
      setLoading(true);
      // Încearcă să obțină setările existente pentru cameră
      const roomSettings = await getRoomSettings(room.id);
      
      // Creăm o dată validă pentru ora implicită (11:00)
      const defaultTime = new Date();
      defaultTime.setHours(11, 0, 0, 0);
      
      // Procesam ora din setări dacă există
      let timeValue;
      if (roomSettings?.send_time) {
        try {
          // Încearcăm să creăm un obiect Date valid din string-ul de timp
          if (typeof roomSettings.send_time === 'string' && roomSettings.send_time.includes(':')) {
            // Dacă e format 'HH:MM:SS', transformăm în Date
            const [hours, minutes, seconds] = roomSettings.send_time.split(':').map(Number);
            const timeDate = new Date();
            timeDate.setHours(hours || 11, minutes || 0, seconds || 0, 0);
            timeValue = timeDate;
          } else {
            // Încearcăm să parsam direct
            timeValue = new Date(roomSettings.send_time);
            
            // Verificăm dacă data rezultată e validă
            if (isNaN(timeValue.getTime())) {
              timeValue = defaultTime;
            }
          }
        } catch (e) {
          console.error("Eroare la parsarea timpului:", e);
          timeValue = defaultTime;
        }
      } else {
        timeValue = defaultTime;
      }
      
      // Setează valorile în state
      setSettings({
        auto_send: roomSettings?.auto_send ?? true,
        send_time: timeValue,
        room_id: room.id
      });
      
      setSettingsOpen(true);
    } catch (error) {
      console.error("Eroare la încărcarea setărilor:", error);
      
      // Dacă nu există setări, setează valorile implicite
      const defaultTime = new Date();
      defaultTime.setHours(11, 0, 0, 0);
      
      setSettings({
        auto_send: true,
        send_time: defaultTime,
        room_id: room.id
      });
      setSettingsOpen(true);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => { 
    setOpen(false); 
    setEditRoom(null); 
  };
  
  const handleCloseSettings = () => {
    setSettingsOpen(false);
  };
  
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  
  const handleSettingsChange = (name, value) => {
    setSettings({ ...settings, [name]: value });
  };
  
  const handleSubmit = async () => {
    // Validare de bază
    if (!form.name.trim() || !form.calendar_url.trim() || !form.template_name.trim()) {
      setSnackbar({ 
        open: true, 
        message: "Toate câmpurile sunt obligatorii", 
        severity: "error" 
      });
      return;
    }

    

    
    try {
      if (editRoom) {
        await updateRoom(editRoom.id, form);
        setSnackbar({ 
          open: true, 
          message: "Camera a fost actualizată cu succes!", 
          severity: "success" 
        });
      } else {
        await createRoom(selectedHotel, form);
        setSnackbar({ 
          open: true, 
          message: "Camera a fost adăugată cu succes!", 
          severity: "success" 
        });
      }
      fetchRooms(selectedHotel);
      handleClose();
    } catch (error) { 
      setSnackbar({ 
        open: true, 
        message: "Eroare: " + (error.response?.data?.detail || error.message), 
        severity: "error" 
      }); 
    }
  };
  
  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      // Verificăm dacă avem o valoare validă pentru ora de trimitere
      if (!settings.send_time || !(settings.send_time instanceof Date) || isNaN(settings.send_time)) {
        // Dacă nu avem o valoare validă, folosim ora implicită (11:00)
        settings.send_time = new Date(new Date().setHours(11, 0, 0, 0));
      }
      
      // Formatează ora pentru a fi trimisă la server
      const formattedSettings = {
        ...settings,
        send_time: format(new Date(settings.send_time), 'HH:mm:ss')
      };
      
      await updateRoomSettings(settings.room_id, formattedSettings);
      
      // Actualizăm lista de camere pentru a reflecta modificările
      if (selectedHotel) {
        await fetchRooms(selectedHotel);
      }
      
      // Trimitem un eveniment personalizat pentru a notifica alte componente despre schimbarea setărilor
      const event = new CustomEvent('roomSettingsChanged', { 
        detail: { roomId: settings.room_id, settings: formattedSettings } 
      });
      document.dispatchEvent(event);
      
      setSnackbar({ 
        open: true, 
        message: "Setările au fost salvate cu succes!", 
        severity: "success" 
      });
      
      handleCloseSettings();
    } catch (error) {
      console.error("Eroare la salvarea setărilor:", error);
      setSnackbar({ 
        open: true, 
        message: "Eroare la salvarea setărilor: " + (error.response?.data?.detail || error.message), 
        severity: "error" 
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5">Camerele tale</Typography>
        {selectedHotel && (
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />} 
            onClick={() => handleOpen()}
          >
            Adaugă cameră nouă
          </Button>
        )}
      </Box>
      
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="hotel-select-label">Alege hotelul</InputLabel>
        <Select
          labelId="hotel-select-label"
          value={selectedHotel}
          label="Alege hotelul"
          onChange={e => setSelectedHotel(e.target.value)}
        >
          {hotels.map(hotel => (
            <MenuItem key={hotel.id} value={hotel.id}>{hotel.name}</MenuItem>
          ))}
        </Select>
        {hotels.length === 0 && (
          <FormHelperText>Nu ai adăugat încă niciun hotel. Adaugă un hotel în tab-ul Hoteluri.</FormHelperText>
        )}
      </FormControl>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : selectedHotel && rooms.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', my: 4 }}>
          <BedIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Nu ai adăugat încă nicio cameră pentru acest hotel
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Adaugă prima cameră pentru a începe să gestionezi rezervările și mesajele de check-in.
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => handleOpen()}
          >
            Adaugă prima cameră
          </Button>
        </Paper>
      ) : selectedHotel ? (
        <Grid container spacing={3}>
          {rooms.map(room => (
            <Grid item xs={12} md={6} lg={4} key={room.id}>
              <Card elevation={3}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{room.name}</Typography>
                  <Divider sx={{ my: 1 }} />
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <LinkIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2" noWrap sx={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {room.calendar_url || "URL calendar nespecificat"}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box 
                      sx={{ 
                        width: 10, 
                        height: 10, 
                        borderRadius: '50%', 
                        bgcolor: room.auto_send ? 'success.main' : 'error.main',
                        mr: 1,
                        display: 'inline-block',
                        boxShadow: '0 0 4px rgba(0,0,0,0.2)'
                      }} 
                    />
                    <ScheduleIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      Trimitere automată: {room.auto_send_time ? room.auto_send_time : "11:00"}
                      {room.auto_send ? ' (activă)' : ' (inactivă)'}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TemplateIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      Template: {room.template_name || "nespecificat"}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    <Chip 
                      icon={<ScheduleIcon />} 
                      label="Automatizare mesaje" 
                      color="primary" 
                      variant="outlined"
                      onClick={() => handleOpenSettings(room)}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Box>
                </CardContent>
                
                <CardActions sx={{ justifyContent: 'flex-end' }}>
                  <Button 
                    size="small" 
                    startIcon={<EditIcon />} 
                    onClick={() => handleOpen(room)}
                  >
                    Editează
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : null}
      
      {/* Dialog pentru adăugare/editare cameră */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editRoom ? "Editează camera" : "Adaugă cameră nouă"}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TextField 
              label="Nume cameră" 
              name="name" 
              value={form.name} 
              onChange={handleChange} 
              fullWidth 
              margin="normal"
              required
              helperText="Numele camerei sau apartamentului"
            />
            
            <TextField 
              label="URL Calendar" 
              name="calendar_url" 
              value={form.calendar_url} 
              onChange={handleChange} 
              fullWidth 
              margin="normal"
              required
              helperText="URL-ul calendarului ICS pentru această cameră"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkIcon />
                  </InputAdornment>
                ),
              }}
            />
            

            
            <TextField 
              label="Template mesaj" 
              name="template_name" 
              value={form.template_name} 
              onChange={handleChange} 
              fullWidth 
              margin="normal"
              required
              helperText="Numele template-ului de mesaj WhatsApp (obligatoriu)"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <TemplateIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Anulează</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            color="primary"
          >
            {editRoom ? "Actualizează" : "Adaugă"}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog pentru setări de automatizare */}
      <Dialog 
        open={settingsOpen} 
        onClose={handleCloseSettings} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          elevation: 8,
          sx: { 
            borderRadius: 2,
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'primary.main', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <ScheduleIcon />
          Setări de automatizare mesaje
        </DialogTitle>
        
        <DialogContent sx={{ py: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Secțiunea de activare/dezactivare */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              bgcolor: settings.auto_send ? 'success.light' : 'grey.100',
              p: 2,
              borderRadius: 2,
              transition: 'background-color 0.3s'
            }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  {settings.auto_send ? 'Automatizare activată' : 'Automatizare dezactivată'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {settings.auto_send 
                    ? 'Mesajele vor fi trimise automat în fiecare zi.' 
                    : 'Mesajele trebuie trimise manual.'}
                </Typography>
              </Box>
              
              <Switch
                checked={settings.auto_send}
                onChange={(e) => handleSettingsChange('auto_send', e.target.checked)}
                color="primary"
                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: 'success.main' } }}
              />
            </Box>
            
            {/* Secțiunea pentru setarea orei */}
            <Box sx={{ 
              p: 2, 
              borderRadius: 2, 
              border: '1px solid',
              borderColor: settings.auto_send ? 'primary.light' : 'grey.300',
              opacity: settings.auto_send ? 1 : 0.7,
              transition: 'all 0.3s'
            }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                Ora de trimitere automată
              </Typography>
              
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ro}>
                <TimePicker
                  label="Selectează ora"
                  value={settings.send_time}
                  onChange={(newTime) => handleSettingsChange('send_time', newTime)}
                  disabled={!settings.auto_send}
                  slotProps={{ 
                    textField: { 
                      fullWidth: true, 
                      variant: "outlined",
                      InputProps: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <ScheduleIcon color={settings.auto_send ? "primary" : "disabled"} />
                          </InputAdornment>
                        ),
                      }
                    } 
                  }}
                />
              </LocalizationProvider>
              
              {settings.auto_send && settings.send_time && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Mesajele vor fi trimise automat în fiecare zi la ora <strong>{format(new Date(settings.send_time), 'HH:mm')}</strong> pentru toate rezervările cu check-in în ziua respectivă.
                </Alert>
              )}
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, py: 2, bgcolor: 'grey.50' }}>
          <Button 
            onClick={handleCloseSettings} 
            variant="outlined"
            startIcon={<DeleteIcon />}
          >
            Anulează
          </Button>
          <Button 
            onClick={handleSaveSettings} 
            variant="contained" 
            color="primary"
            startIcon={<CheckCircleIcon />}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Salvează setările'}
          </Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={5000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

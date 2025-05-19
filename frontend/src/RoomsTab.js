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
      const response = await getRooms(hotelId);
      setRooms(response);
    } catch (error) {
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
      
      // Setează valorile implicite dacă nu există setări
      setSettings({
        auto_send: roomSettings?.auto_send ?? true,
        send_time: roomSettings?.send_time ? new Date(roomSettings.send_time) : new Date(new Date().setHours(11, 0, 0, 0)),
        room_id: room.id
      });
      
      setSettingsOpen(true);
    } catch (error) {
      // Dacă nu există setări, setează valorile implicite
      setSettings({
        auto_send: true,
        send_time: new Date(new Date().setHours(11, 0, 0, 0)),
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
      // Formatează ora pentru a fi trimisă la server
      const formattedSettings = {
        ...settings,
        send_time: format(settings.send_time, 'HH:mm:ss')
      };
      
      await updateRoomSettings(settings.room_id, formattedSettings);
      
      setSnackbar({ 
        open: true, 
        message: "Setările au fost salvate cu succes!", 
        severity: "success" 
      });
      
      handleCloseSettings();
    } catch (error) {
      setSnackbar({ 
        open: true, 
        message: "Eroare la salvarea setărilor: " + (error.response?.data?.detail || error.message), 
        severity: "error" 
      });
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
                    <WhatsAppIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {room.whatsapp_number || "WhatsApp nespecificat"}
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
      <Dialog open={settingsOpen} onClose={handleCloseSettings} maxWidth="sm" fullWidth>
        <DialogTitle>Setări de automatizare mesaje</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.auto_send}
                  onChange={(e) => handleSettingsChange('auto_send', e.target.checked)}
                  color="primary"
                />
              }
              label="Trimite mesaje automat"
            />
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              Dacă este activat, sistemul va trimite automat mesaje de check-in la ora specificată pentru rezervările din ziua curentă.
            </Typography>
            
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ro}>
              <TimePicker
                label="Ora de trimitere mesaje"
                value={settings.send_time}
                onChange={(newTime) => handleSettingsChange('send_time', newTime)}
                disabled={!settings.auto_send}
                slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
              />
            </LocalizationProvider>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Mesajele vor fi trimise automat la ora {format(settings.send_time, 'HH:mm')} pentru toate rezervările din ziua curentă.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSettings}>Anulează</Button>
          <Button 
            onClick={handleSaveSettings} 
            variant="contained" 
            color="primary"
          >
            Salvează setările
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

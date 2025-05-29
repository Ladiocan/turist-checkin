import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getHotels, getRooms, sendManualMessage, sendBulkMessages, searchAndSendMessages, getRoomSettings } from "./api";
import { 
  Box, Typography, Button, Paper, Snackbar, Select, MenuItem, TextField,
  Divider, CircularProgress, Alert, Card, CardContent, Grid, FormControl,
  InputLabel, Chip, List, ListItem, ListItemText, ListItemIcon, Tab, Tabs,
  Radio, RadioGroup, FormControlLabel, IconButton, Tooltip, Badge, Checkbox,
  LinearProgress
} from "@mui/material";
import ScheduleIcon from '@mui/icons-material/Schedule';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
import HotelIcon from '@mui/icons-material/Hotel';
import BedIcon from '@mui/icons-material/Bed';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PhoneIcon from '@mui/icons-material/Phone';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import { format } from 'date-fns';

export default function SendMessageTab() {
  const { t } = useTranslation();
  // State pentru selecție camere și hotel
  const [hotels, setHotels] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState("");
  const [rooms, setRooms] = useState([]);
  const [roomsWithSettings, setRoomsWithSettings] = useState([]);
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [roomSettings, setRoomSettings] = useState({});
  const [customTemplateName, setCustomTemplateName] = useState("oberth");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  
  // State pentru trimitere automată
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [result, setResult] = useState("");
  
  // State pentru trimitere bulk
  const [bulkPhoneNumbers, setBulkPhoneNumbers] = useState("");
  const [parsedPhoneNumbers, setParsedPhoneNumbers] = useState([]);
  const [language, setLanguage] = useState("ro");
  const [inputType, setInputType] = useState("manual");
  const fileInputRef = useRef(null);
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkSuccess, setBulkSuccess] = useState(0);
  const [bulkFailed, setBulkFailed] = useState(0);
  const [uploading, setUploading] = useState(false);
  
  // State pentru parametrii header
  const [headerType, setHeaderType] = useState("image");
  const [headerText, setHeaderText] = useState("Turist");
  const [headerContent, setHeaderContent] = useState("");
  const [usePublicUrlForTesting, setUsePublicUrlForTesting] = useState(false);
  
  // Efect pentru a încărca hotelurile și camerele la încărcarea componentei
  useEffect(() => { 
    fetchHotels(); 
    
    // Adaugăm un event listener pentru a reîmprospăta setările camerelor când tab-ul devine activ
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab-ul a devenit vizibil, reîmprospătăm setările camerelor');
        if (selectedHotel) {
          fetchRooms(selectedHotel);
        }
      }
    };
    
    // Adaugăm un event listener pentru a asculta modificările de setări din alte componente
    const handleRoomSettingsChanged = (event) => {
      console.log('Setările camerei au fost modificate în alt tab:', event.detail);
      if (selectedHotel) {
        fetchRooms(selectedHotel);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('roomSettingsChanged', handleRoomSettingsChanged);
    
    // Curățăm event listener-urile la demontarea componentei
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('roomSettingsChanged', handleRoomSettingsChanged);
    };
  }, []);
  
  // Încarcă camerele când se schimbă hotelul selectat
  useEffect(() => {
    if (selectedHotel) {
      fetchRooms(selectedHotel);
    } else {
      setRooms([]);
    }
  }, [selectedHotel]);
  
  // Încarcă setările pentru camerele selectate
  useEffect(() => {
    if (selectedRooms.length > 0) {
      selectedRooms.forEach(roomId => {
        fetchRoomSettings(roomId);
      });
    }
  }, [selectedRooms]);
  
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
      console.log(`Încărcăm camerele pentru hotelul ${hotelId}`);
      
      // Obținem lista de camere
      const response = await getRooms(hotelId);
      setRooms(response);
      
      if (response.length > 0) {
        // Obținem setările pentru toate camerele direct de la server
        // pentru a ne asigura că avem cele mai recente setări
        const roomsWithSettingsPromises = response.map(async (room) => {
          try {
            console.log(`Încărcăm setările pentru camera ${room.name} (ID: ${room.id})`);
            const settings = await getRoomSettings(room.id);
            
            // Formatăm timpul pentru afișare
            let formattedTime = '11:00';
            let autoSend = settings?.auto_send ?? false;
            
            if (settings?.send_time) {
              try {
                // Verificăm dacă e string de tipul HH:MM:SS
                if (typeof settings.send_time === 'string' && settings.send_time.includes(':')) {
                  // Extragem doar HH:MM din HH:MM:SS
                  formattedTime = settings.send_time.split(':').slice(0, 2).join(':');
                } else {
                  // Încearcăm să formatăm ca dată
                  const timeDate = new Date(settings.send_time);
                  if (!isNaN(timeDate.getTime())) {
                    formattedTime = timeDate.getHours().toString().padStart(2, '0') + ':' + 
                                  timeDate.getMinutes().toString().padStart(2, '0');
                  }
                }
              } catch (e) {
                console.error("Eroare la formatarea orei:", e);
              }
            }
            
            console.log(`Camera ${room.name} are setările: auto_send=${autoSend}, ora=${formattedTime}`);
            
            // Actualizăm și roomSettings pentru afișare
            setRoomSettings(prevSettings => ({
              ...prevSettings,
              [room.id]: {
                auto_send: autoSend,
                formattedTime: formattedTime,
                send_time: settings?.send_time || '11:00:00',
                room_id: room.id
              }
            }));
            
            return {
              ...room,
              settings: {
                ...settings,
                auto_send: autoSend,
                formattedTime: formattedTime
              }
            };
          } catch (error) {
            console.error(`Eroare la obținerea setărilor pentru camera ${room.name}:`, error);
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
      } else {
        setRoomsWithSettings([]);
      }
    } catch (error) {
      console.error(`Eroare la încărcarea camerelor pentru hotelul ${hotelId}:`, error);
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
          let formattedTime = '11:00';
          let autoSend = settings?.auto_send ?? false;
          
          if (settings?.send_time) {
            try {
              // Verificăm dacă e string de tipul HH:MM:SS
              if (typeof settings.send_time === 'string' && settings.send_time.includes(':')) {
                // Extragem doar HH:MM din HH:MM:SS
                formattedTime = settings.send_time.split(':').slice(0, 2).join(':');
              } else {
                // Încearcăm să formatăm ca dată
                const timeDate = new Date(settings.send_time);
                if (!isNaN(timeDate.getTime())) {
                  formattedTime = timeDate.getHours().toString().padStart(2, '0') + ':' + 
                                timeDate.getMinutes().toString().padStart(2, '0');
                }
              }
            } catch (e) {
              console.error("Eroare la formatarea orei:", e);
            }
          }
          
          console.log(`Camera ${room.name} are setările: auto_send=${autoSend}, ora=${formattedTime}`);
          
          return {
            ...room,
            settings: {
              ...settings,
              auto_send: autoSend,
              formattedTime: formattedTime
            }
          };
        } catch (error) {
          console.error(`Eroare la obținerea setărilor pentru camera ${room.name}:`, error);
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
      
      // Formatăm ora pentru afișare
      if (response.auto_send_time) {
        const timeParts = response.auto_send_time.split(':');
        if (timeParts.length >= 2) {
          const formattedTime = `${timeParts[0]}:${timeParts[1]}`;
          response.formattedTime = formattedTime;
        }
      }
      
      // Actualizăm setările pentru camera curentă
      setRoomSettings(prevSettings => ({
        ...prevSettings,
        [roomId]: response
      }));
      
      // Actualizăm și lista de camere cu setări
      setRoomsWithSettings(prevRooms => {
        const updatedRooms = [...prevRooms];
        const roomIndex = updatedRooms.findIndex(r => r.id === roomId);
        
        if (roomIndex !== -1) {
          updatedRooms[roomIndex] = {
            ...updatedRooms[roomIndex],
            settings: response
          };
        }
        
        return updatedRooms;
      });
    } catch (error) {
      console.error("Eroare la obținerea setărilor camerei:", error);
    }
  };

  // Funcție pentru trimitere către camerele selectate
  const handleSendToSelectedRooms = async () => {
    if (selectedRooms.length === 0) {
      setSnackbar({ 
        open: true, 
        message: "Selectează cel puțin o cameră pentru a trimite mesajul!", 
        severity: "error" 
      });
      return;
    }

    try {
      setLoading(true);
      let successCount = 0;
      let failedCount = 0;
      const results = [];
      
      // Trimitem mesaje către toate camerele selectate
      for (const roomId of selectedRooms) {
        try {
          // Find the room's configured template
          const roomData = rooms.find(room => room.id === roomId);
          const roomSetting = roomSettings[roomId];
          const templateName = roomData?.template_name || roomSetting?.template_name || "oberth";
          
          const response = await sendManualMessage({
            room_id: roomId,
            template_name: templateName
          });
          
          // Verificăm dacă este un răspuns de tip "no_reservation"
          if (response.status === "no_reservation") {
            // Nu incrementăm successCount pentru că nu s-a trimis niciun mesaj
            results.push({
              status: 'warning',
              room: roomData?.name || roomId,
              message: response.message || "Nu există check-in astăzi pentru această cameră"
            });
          } else {
            // Mesaj trimis cu succes
            successCount++;
            results.push({
              status: 'success',
              room: roomData?.name || roomId,
              message: `Mesaj trimis cu succes către ${response.to || 'destinatar'}`
            });
          }
        } catch (error) {
          failedCount++;
          results.push({
            status: 'error',
            room: roomData?.name || roomId,
            message: error.response?.data?.detail || error.message || 'Eroare la trimitere'
          });
        }
      }
      
      setBulkResults(results);
      setBulkSuccess(successCount);
      setBulkFailed(failedCount);
      
      setSnackbar({ 
        open: true, 
        message: `Mesaje trimise: ${successCount} cu succes, ${failedCount} eșuate`, 
        severity: successCount > 0 ? "success" : "error" 
      });
      
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
  
  // Funcție pentru a gestiona selecția camerelor
  const handleRoomSelection = (roomId) => {
    setSelectedRooms(prev => {
      if (prev.includes(roomId)) {
        return prev.filter(id => id !== roomId);
      } else {
        return [...prev, roomId];
      }
    });
  };
  
  // Funcție pentru a gestiona schimbarea tipului de input
  const handleInputTypeChange = (event) => {
    setInputType(event.target.value);
    // Resetăm valorile când schimbăm tipul de input
    setBulkPhoneNumbers("");
    setParsedPhoneNumbers([]);
    setBulkResults([]);
    setBulkSuccess(0);
    setBulkFailed(0);
  };
  
  // Funcție pentru a procesa numerele de telefon introduse manual
  const processManualPhoneNumbers = () => {
    if (!bulkPhoneNumbers.trim()) {
      setSnackbar({
        open: true,
        message: "Introduceți cel puțin un număr de telefon!",
        severity: "error"
      });
      return;
    }
    
    // Separăm numerele de telefon (pot fi separate prin virgulă, spațiu, linie nouă)
    const numbers = bulkPhoneNumbers
      .split(/[,\s\n]+/)
      .map(num => num.trim())
      .filter(num => num.length > 0);
    
    if (numbers.length === 0) {
      setSnackbar({
        open: true,
        message: "Nu s-a găsit niciun număr de telefon valid!",
        severity: "error"
      });
      return;
    }
    
    setParsedPhoneNumbers(numbers);
    setSnackbar({
      open: true,
      message: `${numbers.length} numere de telefon procesate cu succes!`,
      severity: "success"
    });
  };
  
  // Funcție pentru a procesa fișierul CSV/TXT cu numere de telefon
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      // Separăm numerele de telefon (pot fi separate prin virgulă, spațiu, linie nouă)
      const numbers = content
        .split(/[,\s\n]+/)
        .map(num => num.trim())
        .filter(num => num.length > 0);
      
      if (numbers.length === 0) {
        setSnackbar({
          open: true,
          message: "Nu s-a găsit niciun număr de telefon valid în fișier!",
          severity: "error"
        });
        return;
      }
      
      setParsedPhoneNumbers(numbers);
      setSnackbar({
        open: true,
        message: `${numbers.length} numere de telefon încărcate din fișier!`,
        severity: "success"
      });
    };
    reader.readAsText(file);
  };
  
  // Funcție pentru a șterge un număr de telefon din listă
  const handleRemovePhoneNumber = (index) => {
    const updatedNumbers = [...parsedPhoneNumbers];
    updatedNumbers.splice(index, 1);
    setParsedPhoneNumbers(updatedNumbers);
  };
  
  // Funcție pentru a trimite mesaje în bulk
  const handleBulkSend = async () => {
    if (parsedPhoneNumbers.length === 0) {
      setSnackbar({
        open: true,
        message: "Nu există numere de telefon pentru trimitere!",
        severity: "error"
      });
      return;
    }
    
    if (!customTemplateName) {
      setSnackbar({
        open: true,
        message: "Introduceți un nume de template pentru trimitere!",
        severity: "error"
      });
      return;
    }
    
    try {
      setLoading(true);
      setBulkResults([]);
      setBulkSuccess(0);
      setBulkFailed(0);
      
      // Pregătim parametrul pentru header
      let headerParameter = null;
      
      if (headerType === "text") {
        headerParameter = {
          type: "text",
          content: headerText
        };
      } else if (headerType === "image") {
        headerParameter = {
          type: "image",
          content: headerContent
        };
      } else if (headerType === "video") {
        headerParameter = {
          type: "video",
          content: headerContent
        };
      } else if (headerType === "document") {
        headerParameter = {
          type: "document",
          content: headerContent
        };
      } else if (headerType === "location") {
        headerParameter = {
          type: "location",
          content: headerContent
        };
      }
      
      const response = await sendBulkMessages({
        phone_numbers: parsedPhoneNumbers,
        template_name: customTemplateName,
        language: language,
        header_parameter: headerParameter,
        use_public_url_for_testing: usePublicUrlForTesting
      });
      
      setBulkResults(response.results || []);
      setBulkSuccess(response.sent || 0);
      setBulkFailed(response.failed || 0);
      
      setSnackbar({
        open: true,
        message: `Procesare completă: ${response.sent || 0} mesaje trimise, ${response.failed || 0} eșuate.`,
        severity: response.failed > 0 ? "warning" : "success"
      });
    } catch (e) {
      console.error("Eroare la trimiterea în bulk:", e);
      setSnackbar({
        open: true,
        message: `Eroare: ${e.response?.data?.detail || e.message || 'Eroare la trimitere în bulk'}`,
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
                Selectează hotel și camere
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Bifează camerele pentru care dorești să trimiți mesaje
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
              
              {rooms.length > 0 ? (
                <Box sx={{ mb: 3, border: '1px solid #eee', borderRadius: 1, maxHeight: '300px', overflow: 'auto' }}>
                  <List dense>
                    {rooms.map((room) => {
                      const isSelected = selectedRooms.includes(room.id);
                      const roomSetting = roomSettings[room.id];
                      return (
                        <ListItem 
                          key={room.id}
                          dense
                          onClick={() => handleRoomSelection(room.id)}
                          sx={{ 
                            cursor: 'pointer',
                            bgcolor: isSelected ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                            '&:hover': { bgcolor: isSelected ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0, 0, 0, 0.04)' },
                            borderLeft: isSelected ? '3px solid #1976d2' : '3px solid transparent'
                          }}
                        >
                          <ListItemIcon>
                            {isSelected ? (
                              <CheckCircleIcon color="primary" />
                            ) : (
                              <BedIcon color="disabled" />
                            )}
                          </ListItemIcon>
                          <ListItemText 
                            primary={room.name}
                            secondary={
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Box 
                                  sx={{ 
                                    width: 8, 
                                    height: 8, 
                                    borderRadius: '50%', 
                                    bgcolor: roomSetting?.auto_send ? 'success.main' : 'error.main',
                                    mr: 1,
                                    display: 'inline-block',
                                    boxShadow: '0 0 3px rgba(0,0,0,0.2)'
                                  }} 
                                />
                                <ScheduleIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: '0.9rem' }} />
                                {roomSetting?.auto_send ? 
                                  `Trimitere automată la ora ${roomSetting?.formattedTime || '11:00'}` : 
                                  'Fără trimitere automată'}
                              </Box>
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontStyle: 'italic' }}>
                  Nu există camere disponibile pentru acest hotel
                </Typography>
              )}
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Fiecare cameră va folosi template-ul configurat în secțiunea "Camere".
              </Typography>
              
              {selectedRooms.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Camere selectate ({selectedRooms.length}):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {selectedRooms.map(roomId => {
                      const room = rooms.find(r => r.id === roomId);
                      return (
                        <Chip 
                          key={roomId}
                          label={room?.name || roomId}
                          onDelete={() => handleRoomSelection(roomId)}
                          color="primary"
                          variant="outlined"
                          disabled={loading}
                        />
                      );
                    })}
                  </Box>
                </Box>
              )}
              
              <Button 
                variant="contained" 
                color="primary"
                startIcon={<SendIcon />}
                onClick={handleSendToSelectedRooms} 
                disabled={loading || selectedRooms.length === 0}
                fullWidth
                size="large"
                sx={{ py: 1.2 }}
              >
                {loading ? 
                  <CircularProgress size={24} /> : 
                  `Trimite mesaje către ${selectedRooms.length} camere`
                }
              </Button>
              
              {bulkResults.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                    Rezultate trimitere
                    <Chip 
                      label={`Trimise: ${bulkSuccess}`} 
                      color="success" 
                      size="small" 
                      sx={{ ml: 1 }} 
                    />
                    {bulkFailed > 0 && (
                      <Chip 
                        label={`Eșuate: ${bulkFailed}`} 
                        color="error" 
                        size="small" 
                        sx={{ ml: 1 }} 
                      />
                    )}
                  </Typography>
                  
                  <Box sx={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #eee', borderRadius: 1 }}>
                    <List dense>
                      {bulkResults.map((result, index) => (
                        <ListItem key={index} sx={{ 
                          borderLeft: result.status === 'success' ? '3px solid #4caf50' : 
                                     result.status === 'warning' ? '3px solid #ff9800' : 
                                     '3px solid #f44336' 
                        }}>
                          <ListItemIcon>
                            {result.status === 'success' ? (
                              <CheckCircleIcon fontSize="small" color="success" />
                            ) : result.status === 'warning' ? (
                              <InfoIcon fontSize="small" color="warning" />
                            ) : (
                              <ErrorIcon fontSize="small" color="error" />
                            )}
                          </ListItemIcon>
                          <ListItemText 
                            primary={result.room} 
                            secondary={result.message}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  <PhoneIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Trimite mesaje bulk
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Trimite mesaje către mai multe numere de telefon
                </Typography>
                
                <FormControl component="fieldset" sx={{ mb: 2 }}>
                  <RadioGroup
                    value={inputType}
                    onChange={handleInputTypeChange}
                    row
                  >
                    <FormControlLabel 
                      value="manual" 
                      control={<Radio />} 
                      label={t('sendMessage.bulkTab.manualInput')} 
                    />
                    <FormControlLabel 
                      value="file" 
                      control={<Radio />} 
                      label={t('sendMessage.bulkTab.fileUpload')} 
                    />
                  </RadioGroup>
                </FormControl>
                
                {inputType === "manual" ? (
                  <Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label={t('sendMessage.bulkTab.phoneNumbers')}
                      placeholder={t('sendMessage.bulkTab.phoneNumbersPlaceholder')}
                      value={bulkPhoneNumbers}
                      onChange={(e) => setBulkPhoneNumbers(e.target.value)}
                      sx={{ mb: 2 }}
                      helperText={t('sendMessage.bulkTab.phoneNumbersExample')}
                    />
                    <Button
                      variant="outlined"
                      onClick={processManualPhoneNumbers}
                      disabled={!bulkPhoneNumbers.trim() || loading}
                      sx={{ mb: 2 }}
                      startIcon={<CheckCircleIcon />}
                    >
                      {t('sendMessage.bulkTab.processNumbers')}
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<UploadFileIcon />}
                      sx={{ mb: 2 }}
                      disabled={loading}
                    >
                      {t('sendMessage.bulkTab.uploadFile')}
                      <input
                        type="file"
                        hidden
                        accept=".txt,.csv"
                        onChange={handleFileUpload}
                        ref={fileInputRef}
                      />
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      {t('sendMessage.bulkTab.fileTypes')}
                    </Typography>
                  </Box>
                )}
                
                <FormControl fullWidth sx={{ mt: 3, mb: 2 }}>
                  <TextField
                    label="Nume template"
                    value={customTemplateName}
                    onChange={(e) => setCustomTemplateName(e.target.value)}
                    disabled={loading}
                    helperText="Introdu numele template-ului pe care dorești să-l folosești"
                  />
                </FormControl>
                
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>{t('sendMessage.bulkTab.language')}</InputLabel>
                  <Select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    label={t('sendMessage.bulkTab.language')}
                    disabled={loading}
                  >
                    <MenuItem value="ro">{t('sendMessage.bulkTab.languages.ro')}</MenuItem>
                    <MenuItem value="en">{t('sendMessage.bulkTab.languages.en')}</MenuItem>
                    <MenuItem value="de">{t('sendMessage.bulkTab.languages.de')}</MenuItem>
                    <MenuItem value="hu">{t('sendMessage.bulkTab.languages.hu')}</MenuItem>
                    <MenuItem value="pl">{t('sendMessage.bulkTab.languages.pl')}</MenuItem>
                  </Select>
                </FormControl>
                
                {/* Header Type Selection */}
                <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 'bold' }}>
                  Parametri Header Template
                </Typography>
                
                <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Notă importantă:</strong> Asigurați-vă că tipul de header selectat corespunde cu template-ul WhatsApp configurat în contul Meta Business. 
                    Fiecare template are un anumit tip de header (text, imagine, video, document sau locație) care trebuie să se potrivească cu ce selectați aici.
                  </Typography>
                </Box>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Tip Header</InputLabel>
                  <Select
                    value={headerType}
                    onChange={(e) => setHeaderType(e.target.value)}
                    label="Tip Header"
                    disabled={loading}
                  >
                    <MenuItem value="text">Text</MenuItem>
                    <MenuItem value="image">Imagine</MenuItem>
                    <MenuItem value="video">Video</MenuItem>
                    <MenuItem value="document">Document</MenuItem>
                    <MenuItem value="location">Locație</MenuItem>
                  </Select>
                </FormControl>
                
                {headerType === "text" ? (
                  <TextField
                    fullWidth
                    label="Text Header"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    disabled={loading}
                    sx={{ mb: 3 }}
                    helperText="Introduceți textul care va apărea în header-ul mesajului"
                  />
                ) : headerType === "location" ? (
                  <TextField
                    fullWidth
                    label="Coordonate Locație (JSON)"
                    value={headerContent}
                    onChange={(e) => setHeaderContent(e.target.value)}
                    disabled={loading}
                    sx={{ mb: 3 }}
                    helperText="Introduceți coordonatele în format JSON: {'latitude': 44.4268, 'longitude': 26.1025}"
                    multiline
                    rows={3}
                  />
                ) : (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {headerType === "image" ? "Imaginea pentru header" : 
                       headerType === "video" ? "Video pentru header" : 
                       "Document pentru header"}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <TextField
                        fullWidth
                        label={headerType === "image" ? "URL Imagine" : 
                               headerType === "video" ? "URL Video" : 
                               "URL Document"}
                        value={headerContent}
                        onChange={(e) => setHeaderContent(e.target.value)}
                        disabled={loading || uploading}
                        placeholder={headerType === "image" ? "https://example.com/image.jpg" : 
                                    headerType === "video" ? "https://example.com/video.mp4" : 
                                    "https://example.com/document.pdf"}
                        sx={{ mr: 2 }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mx: 1 }}>sau</Typography>
                      <Button
                        variant="outlined"
                        component="label"
                        disabled={loading || uploading}
                        startIcon={uploading ? <CircularProgress size={16} /> : null}
                        color={uploading ? "secondary" : "primary"}
                      >
                        {uploading ? "Se încărca..." : "Încărcați fișier"}
                        <input
                          type={headerType === "image" ? "file" : 
                                headerType === "video" ? "file" : 
                                "file"}
                          hidden
                          accept={headerType === "image" ? "image/*" : 
                                  headerType === "video" ? "video/*" : 
                                  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (file) {
                              try {
                                // Afișăm indicatorul de încărcare specific pentru upload
                                setUploading(true);
                                
                                // Creăm un obiect FormData pentru a trimite fișierul
                                const formData = new FormData();
                                formData.append('file', file);
                                
                                // Trimitem fișierul la server
                                const response = await fetch('http://localhost:8000/upload-media', {
                                  method: 'POST',
                                  body: formData,
                                });
                                
                                if (!response.ok) {
                                  throw new Error(`Eroare la încărcarea fișierului: ${response.statusText}`);
                                }
                                
                                const data = await response.json();
                                
                                // Actualizăm headerContent cu URL-ul returnat de server
                                setHeaderContent(data.file_url);
                                
                                // Afișăm un mesaj de succes
                                setSnackbar({
                                  open: true,
                                  message: `Fișierul a fost încărcat cu succes!`,
                                  severity: "success"
                                });
                              } catch (error) {
                                console.error('Eroare la încărcarea fișierului:', error);
                                setSnackbar({
                                  open: true,
                                  message: `Eroare la încărcarea fișierului: ${error.message}`,
                                  severity: "error"
                                });
                              } finally {
                                setUploading(false);
                              }
                            }
                          }}
                        />
                      </Button>
                    </Box>
                    {headerType === "image" && headerContent && (
                      <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          Previzualizare imagine:
                        </Typography>
                        <img 
                          src={headerContent} 
                          alt="Header Preview" 
                          style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', border: '1px solid #eee', borderRadius: '4px', padding: '4px' }} 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://via.placeholder.com/400x200?text=Imagine+nevalid%C4%83';
                          }}
                        />
                      </Box>
                    )}
                    {headerType === "video" && headerContent && (
                      <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          Previzualizare video:
                        </Typography>
                        <video 
                          src={headerContent} 
                          controls 
                          style={{ maxWidth: '100%', maxHeight: '200px', border: '1px solid #eee', borderRadius: '4px', padding: '4px' }} 
                        />
                      </Box>
                    )}
                    {headerType === "document" && headerContent && (
                      <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          Document încărcat: {headerContent.split('/').pop()}
                        </Typography>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          onClick={() => window.open(headerContent, '_blank')}
                        >
                          Vizualizează documentul
                        </Button>
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      {headerType === "image" ? "Introduceți URL-ul imaginii sau încărcați o imagine" : 
                       headerType === "video" ? "Introduceți URL-ul video-ului sau încărcați un video" : 
                       "Introduceți URL-ul documentului sau încărcați un document"}
                    </Typography>
                  </Box>
                )}
                

                
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SendIcon />}
                  onClick={handleBulkSend}
                  disabled={loading || parsedPhoneNumbers.length === 0 || !customTemplateName}
                  fullWidth
                  size="large"
                  sx={{ py: 1.2, mt: 2 }}
                >
                  {loading ? 
                    <CircularProgress size={24} /> : 
                    `Trimite mesaje către ${parsedPhoneNumbers.length} numere`
                  }
                </Button>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                  <WhatsAppIcon sx={{ mr: 1 }} />
                  {t('sendMessage.bulkTab.processedNumbers')}
                  {parsedPhoneNumbers.length > 0 && (
                    <Badge 
                      badgeContent={parsedPhoneNumbers.length} 
                      color="primary" 
                      sx={{ ml: 2 }}
                    />
                  )}
                </Typography>
                
                {parsedPhoneNumbers.length > 0 ? (
                  <Box sx={{ maxHeight: '300px', overflow: 'auto', mb: 3, border: '1px solid #eee', borderRadius: 1 }}>
                    <List dense>
                      {parsedPhoneNumbers.map((phone, index) => (
                        <ListItem
                          key={index}
                          secondaryAction={
                            <IconButton 
                              edge="end" 
                              onClick={() => handleRemovePhoneNumber(index)}
                              disabled={loading}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          }
                        >
                          <ListItemIcon>
                            <PhoneIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText primary={phone} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontStyle: 'italic' }}>
                    {t('sendMessage.bulkTab.noProcessedNumbers')}
                  </Typography>
                )}
                
                {bulkResults.length > 0 && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, display: 'flex', alignItems: 'center' }}>
                      {t('sendMessage.bulkTab.sendResults')}
                      <Chip 
                        label={`${t('sendMessage.bulkTab.sentCount')}: ${bulkSuccess}`} 
                        color="success" 
                        size="small" 
                        sx={{ ml: 1 }} 
                      />
                      {bulkFailed > 0 && (
                        <Chip 
                          label={`${t('sendMessage.bulkTab.failedCount')}: ${bulkFailed}`} 
                          color="error" 
                          size="small" 
                          sx={{ ml: 1 }} 
                        />
                      )}
                    </Typography>
                    
                    <Box sx={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #eee', borderRadius: 1 }}>
                      <List dense>
                        {bulkResults.map((result, index) => (
                          <ListItem key={index} sx={{ borderLeft: result.status === 'success' ? '3px solid #4caf50' : '3px solid #f44336' }}>
                            <ListItemIcon>
                              {result.status === 'success' ? (
                                <CheckCircleIcon fontSize="small" color="success" />
                              ) : (
                                <ErrorIcon fontSize="small" color="error" />
                              )}
                            </ListItemIcon>
                            <ListItemText 
                              primary={result.phone} 
                              secondary={result.message}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  </Box>
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


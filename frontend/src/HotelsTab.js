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
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  Alert,
  CircularProgress
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import HotelIcon from '@mui/icons-material/Hotel';
import { useTranslation } from 'react-i18next';

import { getHotels, createHotel, updateHotel } from "./api";

export default function HotelsTab() {
  const { t } = useTranslation();
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editHotel, setEditHotel] = useState(null);
  const [form, setForm] = useState({ 
    name: "", 
    address: "", 
    phone: "", 
    email: "", 
    description: ""
  });
  const [snackbar, setSnackbar] = useState({ 
    open: false, 
    message: "", 
    severity: "success" 
  });

  useEffect(() => { 
    fetchHotels(); 
  }, []);
  
  const fetchHotels = async () => {
    setLoading(true);
    try {
      const response = await getHotels();
      setHotels(response);
    } catch (error) {
      setSnackbar({ 
        open: true, 
        message: t('common.error') + ": " + (error.response?.data?.detail || error.message), 
        severity: "error" 
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpen = (hotel = null) => {
    setEditHotel(hotel);
    setForm(hotel ? { 
      name: hotel.name || "", 
      address: hotel.address || "", 
      phone: hotel.phone || "", 
      email: hotel.email || "", 
      description: hotel.description || ""
    } : { 
      name: "", 
      address: "", 
      phone: "", 
      email: "", 
      description: "" 
    });
    setOpen(true);
  };
  
  const handleClose = () => { 
    setOpen(false); 
    setEditHotel(null); 
  };
  
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async () => {
    // Validare de bază
    if (!form.name.trim()) {
      setSnackbar({ 
        open: true, 
        message: t('hotels.nameRequired') || "Numele hotelului este obligatoriu", 
        severity: "error" 
      });
      return;
    }
    
    try {
      if (editHotel) {
        await updateHotel(editHotel.id, form);
        setSnackbar({ 
          open: true, 
          message: t('hotels.updateSuccess') || "Hotel actualizat cu succes!", 
          severity: "success" 
        });
      } else {
        await createHotel(form);
        setSnackbar({ 
          open: true, 
          message: t('hotels.addSuccess') || "Hotel adăugat cu succes!", 
          severity: "success" 
        });
      }
      fetchHotels();
      handleClose();
    } catch (error) { 
      setSnackbar({ 
        open: true, 
        message: t('common.error') + ": " + (error.response?.data?.detail || error.message), 
        severity: "error" 
      }); 
    }
  };
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5">{t('hotels.title')}</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />} 
          onClick={() => handleOpen()}
        >
          {t('hotels.addButton')}
        </Button>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : hotels.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', my: 4 }}>
          <HotelIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('hotels.noHotels') || "Nu ai adăugat încă niciun hotel"}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {t('hotels.addFirstHotel')}
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => handleOpen()}
          >
            Adaugă primul hotel
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {hotels.map(hotel => (
            <Grid item xs={12} md={6} key={hotel.id}>
              <Card elevation={3}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{hotel.name}</Typography>
                  <Divider sx={{ my: 1 }} />
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <LocationOnIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {hotel.address || "Adresă nespecificată"}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <PhoneIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {hotel.phone || t('hotels.phoneNotSpecified') || "Telefon nespecificat"}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <EmailIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {hotel.email || t('hotels.emailNotSpecified') || "Email nespecificat"}
                    </Typography>
                  </Box>
                  
                  {hotel.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      {hotel.description}
                    </Typography>
                  )}
                </CardContent>
                
                <CardActions sx={{ justifyContent: 'flex-end' }}>
                  <Button 
                    size="small" 
                    startIcon={<EditIcon />} 
                    onClick={() => handleOpen(hotel)}
                  >
                    {t('hotels.editButton')}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editHotel ? t('hotels.editTitle') || "Editează hotel" : t('hotels.addTitle') || "Adaugă hotel nou"}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TextField 
              label={t('hotels.name')} 
              name="name" 
              value={form.name} 
              onChange={handleChange} 
              fullWidth 
              margin="normal"
              required
              helperText={t('hotels.nameHelp') || "Numele hotelului sau proprietății"}
            />
            
            <TextField 
              label={t('hotels.address')} 
              name="address" 
              value={form.address} 
              onChange={handleChange} 
              fullWidth 
              margin="normal"
              helperText={t('hotels.addressHelp') || "Adresa completă a hotelului"}
            />
            
            <TextField 
              label={t('hotels.phone')} 
              name="phone" 
              value={form.phone} 
              onChange={handleChange} 
              fullWidth 
              margin="normal"
              helperText={t('hotels.phoneHelp') || "Numărul de telefon de contact"}
            />
            
            <TextField 
              label={t('hotels.email')} 
              name="email" 
              type="email"
              value={form.email} 
              onChange={handleChange} 
              fullWidth 
              margin="normal"
              helperText={t('hotels.emailHelp') || "Adresa de email de contact"}
            />
            
            <TextField 
              label={t('hotels.description')} 
              name="description" 
              value={form.description} 
              onChange={handleChange} 
              fullWidth 
              margin="normal"
              multiline
              rows={3}
              helperText={t('hotels.descriptionHelp') || "O scurtă descriere a hotelului (opțional)"}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            color="primary"
          >
            {editHotel ? t('common.update') || "Actualizează" : t('common.add')}
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

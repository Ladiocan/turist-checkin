import React, { useState } from 'react';
import { Container, Paper, Typography, TextField, Button, Box, CircularProgress, Divider } from '@mui/material';
import axios from 'axios';

const AITestPage = () => {
  const [message, setMessage] = useState('');
  const [guestName, setGuestName] = useState('Turist');
  const [phone, setPhone] = useState('+40123456789');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await axios.post('/test-ai-response', {
        message,
        guest_name: guestName,
        phone
      });
      setResponse(result.data);
    } catch (err) {
      console.error('Error testing AI response:', err);
      setError(err.response?.data?.detail || 'A apărut o eroare la comunicarea cu serverul');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Testare Răspuns AI pentru WhatsApp
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Această pagină vă permite să testați răspunsurile generate de AI pentru mesajele primite de la turiști.
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Nume Turist"
            fullWidth
            margin="normal"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
          />
          <TextField
            label="Număr Telefon"
            fullWidth
            margin="normal"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <TextField
            label="Mesaj de la Turist"
            fullWidth
            multiline
            rows={4}
            margin="normal"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Introduceți mesajul primit de la turist..."
            required
          />
          <Box sx={{ mt: 2 }}>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              disabled={loading || !message.trim()}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {loading ? 'Se procesează...' : 'Testează Răspunsul AI'}
            </Button>
          </Box>
        </form>

        {error && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography color="error.dark">{error}</Typography>
          </Box>
        )}

        {response && (
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Rezultat
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Mesaj de la turist:
              </Typography>
              <Typography paragraph sx={{ whiteSpace: 'pre-wrap' }}>
                {response.input_message}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#e3f2fd' }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Răspuns generat de AI:
              </Typography>
              <Typography paragraph sx={{ whiteSpace: 'pre-wrap' }}>
                {response.ai_response}
              </Typography>
            </Paper>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default AITestPage;

import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Alert } from '@mui/material';
import axios from 'axios';

export default function ForgotPasswordForm({ t, setAuthTab }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await axios.post('/forgot-password', { email });
      setSuccess(t.checkEmailConfirm || "Check your email for reset link!");
    } catch (err) {
      setError(err?.response?.data?.detail || "Eroare la resetare parolă");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>{t.forgotPasswordQ || "Forgot password?"}</Typography>
      <TextField
        fullWidth
        label={t.email || "Email"}
        value={email}
        onChange={e => setEmail(e.target.value)}
        sx={{ mb: 2 }}
        InputLabelProps={{ style: { color: '#222' } }}
      />
      <Button type="submit" fullWidth variant="contained" disabled={loading}>{t.forgotPasswordQ || "Reset password"}</Button>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
      <Button fullWidth sx={{ mt: 2 }} onClick={() => setAuthTab(0)}>{t.login || "Back to login"}</Button>
    </Box>
  );
}

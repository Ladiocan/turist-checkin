import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper, 
  Container,
  Grid,
  Link,
  Snackbar,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import { loginUser, registerUser, confirmEmail, forgotPassword } from './api';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function LoginPage({ onLogin }) {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchParams] = useSearchParams();
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  
  // Verifică dacă există un token de confirmare în URL
  React.useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      handleConfirmEmail(token);
    }
  }, [searchParams]);

  // Funcție pentru a extrage mesajul de eroare ca string
  const getErrorMessage = (error) => {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error.response?.data?.detail) {
      return typeof error.response.data.detail === 'string'
        ? error.response.data.detail
        : JSON.stringify(error.response.data.detail);
    }
    
    if (error.message) {
      return typeof error.message === 'string'
        ? error.message
        : JSON.stringify(error.message);
    }
    
    return t('common.error');
  };

  const handleConfirmEmail = async (token) => {
    try {
      const response = await confirmEmail(token);
      setSuccess(t('login.confirmationSuccess'));
    } catch (error) {
      setError(t('common.error') + ': ' + getErrorMessage(error));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (isLogin) {
        // Procesează autentificarea
        const response = await loginUser(email, password);
        localStorage.setItem('token', response.access_token);
        localStorage.setItem('user', JSON.stringify({
          email: email,
          name: response.name || email.split('@')[0]
        }));
        onLogin();
      } else {
        // Verifică dacă parolele coincid
        if (password !== confirmPassword) {
          setError(t('register.passwordMismatch') || 'Parolele nu coincid');
          return;
        }
        
        // Procesează înregistrarea
        await registerUser(email, password, name);
        setSuccess(t('register.success'));
        setIsLogin(true);
      }
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };
  
  const handleForgotPassword = async () => {
    setError('');
    setSuccess('');
    
    if (!forgotPasswordEmail) {
      setError(t('forgotPassword.emailRequired') || 'Te rugăm să introduci adresa de email');
      return;
    }
    
    try {
      await forgotPassword(forgotPasswordEmail);
      setSuccess(t('forgotPassword.success'));
      setForgotPasswordOpen(false);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Typography component="h1" variant="h4" align="center" color="primary" gutterBottom>
          {t('app.title')}
        </Typography>
        <Typography variant="h6" align="center" gutterBottom>
          {isLogin ? t('login.title') : t('register.title')}
        </Typography>
        
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <Grid container spacing={2}>
            {!isLogin && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('register.name')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('login.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('login.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Grid>
            {!isLogin && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('register.confirmPassword')}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </Grid>
            )}
          </Grid>
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            {isLogin ? t('login.loginButton') : t('register.registerButton')}
          </Button>
          
          <Grid container justifyContent="space-between">
            <Grid item>
              <Link 
                href="#" 
                variant="body2" 
                onClick={(e) => {
                  e.preventDefault();
                  setIsLogin(!isLogin);
                  setError('');
                  setSuccess('');
                }}
              >
                {isLogin ? t('login.registerLink') : t('register.loginLink')}
              </Link>
            </Grid>
            {isLogin && (
              <Grid item>
                <Link 
                  href="#" 
                  variant="body2" 
                  onClick={(e) => {
                    e.preventDefault();
                    setForgotPasswordEmail(email);
                    setForgotPasswordOpen(true);
                  }}
                >
                  {t('login.forgotPassword')}
                </Link>
              </Grid>
            )}
          </Grid>
        </Box>
      </Paper>
      
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
      
      <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess('')}>
        <Alert onClose={() => setSuccess('')} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
      
      {/* Dialog pentru resetarea parolei */}
      <Dialog open={forgotPasswordOpen} onClose={() => setForgotPasswordOpen(false)}>
        <DialogTitle>{t('forgotPassword.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('forgotPassword.description')}
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label={t('forgotPassword.email')}
            type="email"
            fullWidth
            value={forgotPasswordEmail}
            onChange={(e) => setForgotPasswordEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForgotPasswordOpen(false)}>{t('forgotPassword.cancelButton')}</Button>
          <Button onClick={handleForgotPassword}>{t('forgotPassword.submitButton')}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default LoginPage;

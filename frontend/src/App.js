import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { 
  Box, 
  Tabs, 
  Tab, 
  Typography, 
  AppBar, 
  Toolbar, 
  Button, 
  IconButton, 
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Container,
  Snackbar,
  Alert,
  Divider
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";

import HotelsTab from "./HotelsTab";
import RoomsTab from "./RoomsTab";
import SendMessageTab from "./SendMessageTab";
import MessagesTab from "./MessagesTab";
import SearchAndSendButton from "./SearchAndSendButton";
import LoginPage from "./LoginPage";
import { getUserProfile } from "./api";
import LanguageSelector from "./components/LanguageSelector";
import AITestPage from "./components/AITestPage";

// Import i18n instance
import "./i18n";
import { useTranslation } from "react-i18next";

function MainApp() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [user, setUser] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: "", severity: "info" });
  
  useEffect(() => {
    // Încarcă informațiile utilizatorului din localStorage
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Eroare la parsarea datelor utilizatorului:", error);
        // Dacă avem eroare la parsare, ștergem datele corupte
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    } else if (!token) {
      // Dacă nu avem token, ne asigurăm că utilizatorul este deconectat
      setUser(null);
      localStorage.removeItem('user');
    }
  }, []);
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setNotification({
      open: true,
      message: t('common.success') + ": " + t('common.logout'),
      severity: "success"
    });
  };
  
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {t('app.title')}
          </Typography>
          
          {/* Language Selector - always visible */}
          <LanguageSelector />
          
          {user && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 1, my: 1, display: { xs: 'none', sm: 'block' } }} />
              <SearchAndSendButton variant="contained" color="secondary" />
              
              <Tooltip title={t('common.profile')}>
                <IconButton onClick={handleMenuOpen} color="inherit">
                  <Avatar sx={{ bgcolor: 'secondary.main' }}>
                    {user.name ? user.name.charAt(0).toUpperCase() : <AccountCircleIcon />}
                  </Avatar>
                </IconButton>
              </Tooltip>
              
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem disabled>
                  <Typography variant="body2">{user.email}</Typography>
                </MenuItem>
                <MenuItem onClick={() => window.location.href = '/ai-test'}>
                  <Typography variant="body2">Testare AI WhatsApp</Typography>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                  {t('common.logout')}
                </MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>
      
      <Container sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        {user ? (
          <>
            <Tabs value={tab} onChange={(e, v) => setTab(v)} centered sx={{ mb: 4 }}>
              <Tab label={t('tabs.hotels')} />
              <Tab label={t('tabs.rooms')} />
              <Tab label={t('tabs.sendMessage')} />
              <Tab label={t('tabs.messages')} />
            </Tabs>
            
            {tab === 0 && <HotelsTab />}
            {tab === 1 && <RoomsTab />}
            {tab === 2 && <SendMessageTab />}
            {tab === 3 && <MessagesTab />}
          </>
        ) : (
          <LoginPage onLogin={() => window.location.reload()} />
        )}
      </Container>
      
      <Box component="footer" sx={{ py: 3, bgcolor: 'background.paper', mt: 'auto' }}>
        <Typography variant="body2" color="text.secondary" align="center">
          © {new Date().getFullYear()} {t('app.title')} - {t('app.subtitle')}
        </Typography>
      </Box>
      
      <Snackbar 
        open={notification.open} 
        autoHideDuration={6000} 
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/ai-test" element={<AITestPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;

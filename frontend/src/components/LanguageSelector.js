import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Button, 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText,
  Typography
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

// Flag icons for languages
const flags = {
  ro: '🇷🇴',
  en: '🇬🇧',
  de: '🇩🇪',
  hu: '🇭🇺',
  pl: '🇵🇱'
};

// Language names in their native language
const nativeNames = {
  ro: 'Română',
  en: 'English',
  de: 'Deutsch',
  hu: 'Magyar',
  pl: 'Polski'
};

const LanguageSelector = () => {
  const { t, i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'ro');
  const open = Boolean(anchorEl);
  
  useEffect(() => {
    // Update current language when i18n.language changes
    setCurrentLanguage(i18n.language.substring(0, 2) || 'ro');
  }, [i18n.language]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setCurrentLanguage(lng);
    handleClose();
  };

  return (
    <>
      <Button
        color="inherit"
        onClick={handleClick}
        startIcon={<LanguageIcon />}
        endIcon={<KeyboardArrowDownIcon />}
        sx={{ textTransform: 'none' }}
      >
        <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
          {flags[currentLanguage]} {nativeNames[currentLanguage] || t(`languages.${currentLanguage}`)}
        </Typography>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'language-button',
        }}
      >
        {Object.keys(flags).map((lng) => (
          <MenuItem 
            key={lng} 
            onClick={() => changeLanguage(lng)}
            selected={currentLanguage === lng}
          >
            <ListItemIcon sx={{ minWidth: '30px' }}>
              {flags[lng]}
            </ListItemIcon>
            <ListItemText>{t(`languages.${lng}`)}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageSelector;

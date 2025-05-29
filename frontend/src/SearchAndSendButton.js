import React from "react";
import { useTranslation } from "react-i18next";

// Utility to get today's date in YYYY-MM-DD
function getTodayISO() {
  const today = new Date();
  return today.toISOString().slice(0, 10);
}

export default function SearchAndSendButton() {
  const { t } = useTranslation();
  
  // Component is now just a placeholder since the app is always active
  return null;
}

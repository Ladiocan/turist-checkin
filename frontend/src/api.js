import axios from "axios";

// Configurare axios pentru a include URL-ul de bază
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";
axios.defaults.baseURL = API_BASE_URL;

// Funcție pentru a obține header-ul de autentificare
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// API pentru hoteluri
export const getHotels = async () => {
  const response = await axios.get("/hotels", {
    headers: getAuthHeader()
  });
  return response.data;
};

export const createHotel = async (data) => {
  const response = await axios.post("/hotels", data, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const updateHotel = async (id, data) => {
  const response = await axios.patch(`/hotels/${id}`, data, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const deleteHotel = async (id) => {
  const response = await axios.delete(`/hotels/${id}`, {
    headers: getAuthHeader()
  });
  return response.data;
};

// API pentru camere
export const getRooms = async (hotelId) => {
  const response = await axios.get(`/hotels/${hotelId}/rooms`, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const createRoom = async (hotelId, data) => {
  const response = await axios.post(`/hotels/${hotelId}/rooms`, data, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const updateRoom = async (roomId, data) => {
  const response = await axios.patch(`/rooms/${roomId}`, data, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const deleteRoom = async (roomId) => {
  const response = await axios.delete(`/rooms/${roomId}`, {
    headers: getAuthHeader()
  });
  return response.data;
};

// API pentru setări de automatizare pentru camere
export const getRoomSettings = async (roomId) => {
  const response = await axios.get(`/rooms/${roomId}/settings`, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const updateRoomSettings = async (roomId, data) => {
  const response = await axios.post(`/rooms/${roomId}/settings`, data, {
    headers: getAuthHeader()
  });
  return response.data;
};

// API pentru mesaje
export const sendMessage = async (data) => {
  const response = await axios.post("/messages", data, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const sendManualMessage = async (data) => {
  // Acum primim room_id în loc de calendar_url și room_name
  const response = await axios.post("/messages/manual", data, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const sendBulkMessages = async (data) => {
  // Trimite mesaje în bulk către o listă de numere de telefon
  const response = await axios.post("/messages/bulk", data, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const getMessages = async (params) => {
  const response = await axios.get("/messages", {
    params,
    headers: getAuthHeader()
  });
  return response.data;
};

export const getMessageStats = async (params) => {
  const response = await axios.get("/messages/stats", {
    params,
    headers: getAuthHeader()
  });
  return response.data;
};

// API pentru căutarea și trimiterea automată a mesajelor
export const searchAndSendMessages = async () => {
  const response = await axios.post("/messages/search-and-send", {}, {
    headers: getAuthHeader()
  });
  return response.data;
};

// API pentru a obține rezervările de astăzi
export const getTodayReservations = async (roomId) => {
  const response = await axios.get(`/rooms/${roomId}/reservations/today`, {
    headers: getAuthHeader()
  });
  return response.data;
};

// API pentru a obține toate rezervările pentru o cameră
export const getRoomReservations = async (roomId, params) => {
  const response = await axios.get(`/rooms/${roomId}/reservations`, {
    params,
    headers: getAuthHeader()
  });
  return response.data;
};

// Funcții pentru autentificare și gestionarea utilizatorilor
export const loginUser = async (email, password) => {
  // Creăm un obiect FormData pentru a trimite datele în format form-urlencoded
  const formData = new URLSearchParams();
  formData.append('username', email);  // FastAPI OAuth2 folosește 'username' pentru email
  formData.append('password', password);
  
  const response = await axios.post("/login", formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  return response.data;
};

export const registerUser = async (email, password, name) => {
  const response = await axios.post("/register", {
    email,
    password,
    name
  });
  return response.data;
};

export const confirmEmail = async (token) => {
  const response = await axios.get(`/confirm-email/${token}`);
  return response.data;
};

export const getUserProfile = async () => {
  // Obținem datele utilizatorului din localStorage deoarece nu avem un endpoint /users/me
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const forgotPassword = async (email) => {
  const response = await axios.post("/forgot-password", { email });
  return response.data;
};

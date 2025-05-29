from fastapi import FastAPI, Request, Depends, HTTPException, status, BackgroundTasks, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Tuple
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
import sqlite3
import json
import os
import secrets
from datetime import datetime, timedelta
from langdetect import detect, LangDetectException

# --- SQLAlchemy imports for hotel/room management ---
from database import SessionLocal, init_db as sqlalchemy_init_db
import models
import schemas
import crud
from sqlalchemy.orm import Session

load_dotenv()

app = FastAPI()

# Create uploads directory if it doesn't exist
os.makedirs("uploads", exist_ok=True)

# Mount the uploads directory as a static files directory
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Configurare CORS pentru a permite conexiuni de la frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT config
SECRET_KEY = os.getenv("JWT_SECRET", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

# SMTP config
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)

# DB init
DB_FILE = "users.db"
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        confirmed INTEGER DEFAULT 0,
        confirmation_token TEXT,
        created_at TEXT
    )''')
    conn.commit()
    conn.close()
init_db()
# Init SQLAlchemy DB for hotels/rooms
sqlalchemy_init_db()

SETTINGS_FILE = "settings.json"

# Global settings for controlling application state
APP_ACTIVE = True  # Aplicația este întotdeauna activă

# User model
class User(BaseModel):
    email: EmailStr
    password: str

# Token model
class Token(BaseModel):
    access_token: str
    token_type: str

# Utility functions

def send_confirmation_email(email: str, token: str):
    confirm_url = f"http://localhost:3000/confirm-email?token={token}"
    msg = MIMEText(f"Click the following link to confirm your account: {confirm_url}")
    msg["Subject"] = "Confirmă-ți contul la Check-in App"
    msg["From"] = SMTP_FROM
    msg["To"] = email
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, [email], msg.as_string())

def get_user(email: str):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT email, password, confirmed, confirmation_token FROM users WHERE email = ?", (email,))
    row = c.fetchone()
    conn.close()
    if row:
        return {"email": row[0], "password": row[1], "confirmed": row[2], "confirmation_token": row[3]}
    return None

def create_user(email: str, password: str, token: str):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("INSERT INTO users (email, password, confirmation_token, created_at) VALUES (?, ?, ?, ?)",
              (email, pwd_context.hash(password), token, datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

def confirm_user(token: str):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    # Verifică dacă token-ul există în baza de date
    c.execute("SELECT email FROM users WHERE confirmation_token = ?", (token,))
    user = c.fetchone()
    if not user:
        print(f"DEBUG: Token-ul {token} nu a fost găsit în baza de date")
        conn.close()
        return False
    
    # Actualizează statusul de confirmare
    c.execute("UPDATE users SET confirmed = 1 WHERE confirmation_token = ?", (token,))
    rows_affected = c.rowcount
    conn.commit()
    
    # Verifică dacă actualizarea a avut succes
    c.execute("SELECT confirmed FROM users WHERE confirmation_token = ?", (token,))
    confirmed_status = c.fetchone()
    print(f"DEBUG: Confirmare utilizator {user[0]} - Rânduri afectate: {rows_affected}, Status confirmare: {confirmed_status}")
    
    conn.close()
    return rows_affected > 0

def authenticate_user(email: str, password: str):
    user = get_user(email)
    if not user or not pwd_context.verify(password, user["password"]):
        return False
    return user

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user(email)
    if user is None or not user["confirmed"]:
        raise credentials_exception
    return user

class CalendarConfig(BaseModel):
    calendars: list[str]
    camera_messages: dict
    hotel_phone: str
    whatsapp_api_number: str
    send_time: str

@app.get("/api/settings")
def get_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE) as f:
            return json.load(f)
    return {}

@app.post("/api/settings")
def save_settings(config: CalendarConfig):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(config.dict(), f, indent=2)
    return {"ok": True}

# --- User Management Endpoints ---

@app.post("/forgot-password")
def forgot_password(data: dict):
    email = data.get("email")
    user = get_user(email)
    if not user:
        # Pentru securitate, răspunde mereu la fel
        return {"msg": "Dacă există un cont cu acest email, vei primi un link de resetare."}
    # Generează token JWT scurt (30 min)
    token = create_access_token({"sub": email, "pwreset": True}, expires_delta=timedelta(minutes=30))
    reset_url = f"http://localhost:3000/reset-password?token={token}"
    msg = MIMEText(f"Click aici pentru a reseta parola: {reset_url}")
    msg["Subject"] = "Resetare parolă Check-in App"
    msg["From"] = SMTP_FROM
    msg["To"] = email
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, [email], msg.as_string())
    return {"msg": "Dacă există un cont cu acest email, vei primi un link de resetare."}

@app.post("/reset-password")
def reset_password(data: dict):
    token = data.get("token")
    new_password = data.get("password")
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token și parolă nouă necesare.")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        pwreset = payload.get("pwreset")
        if not email or not pwreset:
            raise HTTPException(status_code=400, detail="Token invalid.")
    except JWTError:
        raise HTTPException(status_code=400, detail="Token invalid sau expirat.")
    # Setează parola nouă hash-uită
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("UPDATE users SET password = ? WHERE email = ?", (pwd_context.hash(new_password), email))
    conn.commit()
    conn.close()
    return {"msg": "Parolă resetată cu succes. Poți face login cu noua parolă."}

@app.post("/register")
def register(user: User, background_tasks: BackgroundTasks):
    if get_user(user.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    # generate confirmation token
    token = secrets.token_urlsafe(32)
    create_user(user.email, user.password, token)
    # send confirmation email
    background_tasks.add_task(send_confirmation_email, user.email, token)
    return {"msg": "Registration successful. Please check your email to confirm your account."}

@app.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user["confirmed"]:
        raise HTTPException(status_code=400, detail="Email not confirmed")
    access_token = create_access_token(data={"sub": user["email"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/confirm-email/{token}")
def confirm_email(token: str):
    user = None
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT email FROM users WHERE confirmation_token = ?", (token,))
    row = c.fetchone()
    if row:
        user = row[0]
    conn.close()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    # Confirmă utilizatorul și verifică rezultatul
    success = confirm_user(token)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to confirm account. Please try again.")
    
    # Verifică dacă utilizatorul a fost confirmat cu succes
    user_data = get_user(user)
    if not user_data or not user_data["confirmed"]:
        raise HTTPException(status_code=500, detail="Account confirmation failed. Please contact support.")
    
    return {"msg": "Account confirmed. You can now log in."}

# --- Protected endpoints ---

@app.get("/api/settings")
def get_settings(current_user: dict = Depends(get_current_user)):
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE) as f:
            return json.load(f)
    return {}

@app.post("/api/settings")
def save_settings(config: CalendarConfig, current_user: dict = Depends(get_current_user)):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(config.dict(), f, indent=2)
    return {"ok": True}

# --- Hotel & Room Management Endpoints (SQLAlchemy) ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/hotels", response_model=schemas.Hotel)
def create_hotel(hotel: schemas.HotelCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_hotel(db, hotel)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

from sqlalchemy.orm import joinedload

@app.get("/hotels", response_model=list[schemas.Hotel])
def list_hotels(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    hotels = db.query(models.Hotel).options(joinedload(models.Hotel.rooms)).offset(skip).limit(limit).all()
    return hotels

@app.get("/hotels/{hotel_id}", response_model=schemas.Hotel)
def get_hotel(hotel_id: int, db: Session = Depends(get_db)):
    hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    return hotel

@app.post("/hotels/{hotel_id}/rooms", response_model=schemas.Room)
def create_room(hotel_id: int, room: schemas.RoomCreate, db: Session = Depends(get_db)):
    # Ensure hotel exists
    hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    return crud.create_room(db, room, hotel_id)

@app.get("/hotels/{hotel_id}/rooms", response_model=list[schemas.Room])
def list_rooms(hotel_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_rooms(db, hotel_id, skip=skip, limit=limit)

# Endpointuri pentru preluare rezervări, generare mesaje și trimitere WhatsApp vor fi adăugate după ce finalizăm UI-ul.

# --- Hotel PATCH/DELETE ---
@app.patch("/hotels/{hotel_id}", response_model=schemas.Hotel)
def update_hotel(hotel_id: int, hotel_update: schemas.HotelUpdate, db: Session = Depends(get_db)):
    db_hotel = crud.update_hotel(db, hotel_id, hotel_update)
    if not db_hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    return db_hotel

@app.get("/hotels/{hotel_id}", response_model=schemas.Hotel)
def get_hotel_by_id(hotel_id: int, db: Session = Depends(get_db)):
    db_hotel = crud.get_hotel_by_id(db, hotel_id)
    if not db_hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    return db_hotel

@app.delete("/hotels/{hotel_id}")
def delete_hotel(hotel_id: int, db: Session = Depends(get_db)):
    ok = crud.delete_hotel(db, hotel_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Hotel not found")
    return {"ok": True}

# --- Room PATCH/DELETE ---
@app.patch("/rooms/{room_id}", response_model=schemas.Room)
def update_room(room_id: int, room_update: schemas.RoomUpdate, db: Session = Depends(get_db)):
    db_room = crud.update_room(db, room_id, room_update)
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")
    return db_room

@app.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db)):
    success = crud.delete_room(db, room_id)
    if not success:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"detail": "Room deleted"}

@app.get("/rooms/{room_id}", response_model=schemas.Room)
def get_room(room_id: int, db: Session = Depends(get_db)):
    db_room = crud.get_room(db, room_id)
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")
    return db_room

# --- Room Settings ---
@app.get("/rooms/{room_id}/settings", response_model=schemas.RoomSettings)
def get_room_settings(room_id: int, db: Session = Depends(get_db)):
    db_settings = crud.get_room_settings(db, room_id)
    if not db_settings:
        # Dacă nu există setări, creăm unele implicite
        db_room = crud.get_room(db, room_id)
        if not db_room:
            raise HTTPException(status_code=404, detail="Room not found")
        db_settings = crud.create_room_settings(db, schemas.RoomSettingsCreate(), room_id)
    return db_settings

@app.post("/rooms/{room_id}/settings", response_model=schemas.RoomSettings)
def update_room_settings(room_id: int, settings: schemas.RoomSettingsUpdate, db: Session = Depends(get_db)):
    db_room = crud.get_room(db, room_id)
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    db_settings = crud.update_room_settings(db, room_id, settings)
    return db_settings

# --- Reservations ---
@app.get("/rooms/{room_id}/reservations/today", response_model=list[schemas.Reservation])
def get_today_reservations(room_id: int, db: Session = Depends(get_db)):
    db_room = crud.get_room(db, room_id)
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Obținem rezervările de astăzi
    reservations = crud.get_today_reservations(db, room_id)
    return reservations

# --- MessageSent POST/GET ---

from fastapi import Body
import requests
import logging

# Configurare logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("tourist_assistant.log")
    ]
)

# Funcție pentru a procesa rezervările și a trimite mesaje
def process_reservations_and_send_messages(db: Session = None):
    """Procesează toate camerele, găsește rezervările de azi și trimite mesaje WhatsApp"""
    from sqlalchemy.orm import Session
    import database
    import models
    from datetime import datetime
    import re
    import json
    import requests
    
    if db is None:
        db = database.SessionLocal()
        should_close_db = True
    else:
        should_close_db = False
    
    try:
        rooms = db.query(models.Room).all()
        today = datetime.utcnow().date()
        today_iso = today.isoformat()
        
        total_found = 0
        total_sent = 0
        results = []
        
        for room in rooms:
            calendar_url = room.calendar_url
            room_name = room.name or "Unknown Room"
            
            # Verifică dacă URL-ul calendarului este valid
            if not calendar_url or not calendar_url.startswith("http"):
                logging.warning(f"[SEARCH] Camera {room_name} (ID: {room.id}) are URL calendar invalid sau gol: '{calendar_url}'")
                results.append({
                    "room": room_name,
                    "room_id": room.id,
                    "status": "error",
                    "message": f"URL calendar invalid: '{calendar_url}'"
                })
                continue
                
            # Gestionează cazul în care template_name nu există în model
            template_name = "oberth"  # Valoare implicită
            try:
                if hasattr(room, 'template_name') and room.template_name:
                    template_name = room.template_name
            except Exception:
                pass  # Folosim valoarea implicită
                
            whatsapp_number = room.whatsapp_number
            hotel = db.query(models.Hotel).filter(models.Hotel.id == room.hotel_id).first()
            
            if not hotel:
                logging.warning(f"[SEARCH] Camera {room_name} nu are hotel asociat")
                continue
                
            # 1. Preia rezervarea de azi din calendar
            try:
                logging.info(f"[SEARCH] Verificare rezervări pentru camera {room_name} din hotelul {hotel.name}")
                resp = requests.get(calendar_url, timeout=10)
                resp.raise_for_status()
                calendar_data = resp.text
                
                # Procesare calendar ICS
                import re
                from datetime import datetime
                
                # Extrage evenimentele din ICS
                events = []
                current_event = {}
                in_event = False
                
                for line in calendar_data.splitlines():
                    if line.startswith("BEGIN:VEVENT"):
                        in_event = True
                        current_event = {}
                    elif line.startswith("END:VEVENT"):
                        in_event = False
                        if current_event:
                            events.append(current_event)
                    elif in_event:
                        if line.startswith("DTSTART"):
                            date_str = line.split(":")[1].strip()
                            # Extrage data din format ICS (20250501T000000Z)
                            try:
                                if "T" in date_str:
                                    date_str = date_str.split("T")[0]
                                # Format YYYYMMDD
                                year = int(date_str[0:4])
                                month = int(date_str[4:6])
                                day = int(date_str[6:8])
                                current_event['start'] = datetime(year, month, day).date()
                            except Exception as e:
                                logging.warning(f"Eroare la parsarea datei: {date_str} - {str(e)}")
                        elif line.startswith("SUMMARY"):
                            current_event['summary'] = line.split(":", 1)[1].strip()
                        elif line.startswith("DESCRIPTION"):
                            description = line.split(":", 1)[1].strip()
                            current_event['description'] = description
                            
                            # Extrage telefonul din descriere
                            phone_match = re.search(r'Phone:\s*([+0-9 ]+)', description)
                            if phone_match:
                                current_event['phone'] = phone_match.group(1).strip()
                                
                            # Extrage numele din descriere
                            name_match = re.search(r'First Name:\s*([^\n]+)\nLast Name:\s*([^\n]+)', description)
                            if name_match:
                                first_name = name_match.group(1).strip()
                                last_name = name_match.group(2).strip()
                                if first_name and last_name:
                                    current_event['guest_name'] = f"{first_name} {last_name}"
                        
                # Convertește în format similar cu cel așteptat
                data = {'events': events}
                
                if not events:
                    error_msg = f"[SEARCH] {room_name}: Nu s-au găsit evenimente în calendarul ICS"
                    logging.warning(error_msg)
                    results.append({
                        "room": room_name,
                        "hotel": hotel.name if hotel else "Unknown",
                        "status": "error",
                        "message": error_msg
                    })
                    continue
            except Exception as e:
                error_msg = f"[SEARCH] {room_name}: Calendar fetch failed: {str(e)}"
                logging.warning(error_msg)
                results.append({
                    "room": room_name,
                    "hotel": hotel.name if hotel else "Unknown",
                    "status": "error",
                    "message": error_msg
                })
                continue
                
            rezervare = None
            for event in data.get('events', []):
                start = event.get('start')
                if not start:
                    continue
                    
                # Verificăm tipul datei
                try:
                    # Dacă start este deja un obiect date, îl folosim direct
                    if hasattr(start, 'year') and hasattr(start, 'month') and hasattr(start, 'day'):
                        event_date = start
                    else:
                        # Altfel, încercăm să-l convertim din string
                        event_date = datetime.fromisoformat(str(start)[:10]).date()
                except Exception as e:
                    logging.warning(f"Nu pot converti data: {start} - {str(e)}")
                    continue
                        
                # Comparăm datele
                if event_date == today:
                    rezervare = event
                    logging.info(f"[SEARCH] Am găsit rezervare pentru {event_date}: {event.get('summary', '')}")
                    total_found += 1
                    break
                    
            if not rezervare:
                logging.info(f"[SEARCH] {room_name}: No reservation with check-in today")
                results.append({
                    "room": room_name,
                    "hotel": hotel.name if hotel else "Unknown",
                    "status": "not_found",
                    "message": "No reservation with check-in today"
                })
                continue
                    
            # Folosește numele oaspetelui extras din descriere sau din summary
            guest_name = rezervare.get('guest_name', '')
            
            # Dacă nu avem nume din descriere, îl extragem din summary
            if not guest_name:
                summary = rezervare.get('summary', '')
                if 'CLOSED - [' in summary:
                    # Extrage numele din formatul "CLOSED - [7788] Ladislau Ciocan TiT srl"
                    parts = summary.split('] ')
                    if len(parts) > 1:
                        guest_name = parts[1].split(' ')[0] + ' ' + parts[1].split(' ')[1]
                        
            # Extragem prenumele pentru template-ul WhatsApp
            first_name = ""
            if guest_name:
                first_name = guest_name.split(' ')[0]  # Primul cuvânt din nume
            logging.info(f"[SEARCH] Prenume extras pentru template: {first_name}")
            rezervare['first_name'] = first_name  # Salvez prenumele în rezervare pentru a-l folosi la trimiterea mesajului
            
            # Extrage telefonul direct din eveniment (a fost extras anterior din descriere)
            phone = rezervare.get('phone', '')
            
            # Dacă nu avem telefon, verificăm din nou descrierea
            if not phone:
                desc = rezervare.get('description', '')
                phone_match = re.search(r'Phone:\s*([+0-9 ]+)', desc)
                if phone_match:
                    phone = phone_match.group(1).strip().replace(' ', '')
                    
            if not phone:
                warning_msg = f"[SEARCH] {room_name}: No phone found in reservation"
                logging.warning(warning_msg)
                results.append({
                    "room": room_name,
                    "hotel": hotel.name if hotel else "Unknown",
                    "status": "no_phone",
                    "message": warning_msg
                })
                continue
                
            # Extragem prenumele pentru template-ul WhatsApp
            first_name = rezervare.get('first_name', '')
            
            # Trimite mesajul pe WhatsApp
            try:
                # Implementare reală a trimiterii către WhatsApp API
                import os
                
                # Folosim ID-ul numărului de telefon din variabilele de mediu
                phone_number_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID', '639183785947357')
                whatsapp_url = f"https://graph.facebook.com/v19.0/{phone_number_id}/messages"
                
                # Curățăm numărul de telefon (eliminăm spații, paranteze etc.)
                clean_phone = phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
                # Asigurăm-ne că numărul începe cu +
                if not clean_phone.startswith('+'):
                    clean_phone = '+' + clean_phone
                
                # Determinăm limba în funcție de prefixul țării
                try:
                    # Implementăm funcția direct aici pentru a evita eroarea
                    def get_language_from_phone(phone):
                        # Eliminăm + din număr pentru a extrage prefixul
                        if phone.startswith('+'):
                            phone_without_plus = phone[1:]
                        else:
                            phone_without_plus = phone
                            
                        # Determinăm țara și limba în funcție de prefix
                        if phone_without_plus.startswith('40') or phone_without_plus.startswith('4'):
                            return 'ro', 'Romania'
                        elif phone_without_plus.startswith('49') or phone_without_plus.startswith('1'):
                            return 'de', 'Germany'
                        elif phone_without_plus.startswith('44'):
                            return 'en', 'UK'
                        elif phone_without_plus.startswith('1'):
                            return 'en', 'USA'
                        else:
                            return 'en', 'International'
                    
                    def get_whatsapp_language_code(language):
                        # Mapare de la codul nostru de limbă la codul WhatsApp
                        language_map = {
                            'ro': 'ro',  # Română
                            'de': 'de',  # Germană
                            'en': 'en'   # Engleză
                        }
                        return language_map.get(language, 'en')
                    
                    language, country = get_language_from_phone(clean_phone)
                    whatsapp_language = get_whatsapp_language_code(language)
                except Exception as e:
                    logging.error(f"[SEARCH] Eroare la determinarea limbii: {str(e)}")
                    language = 'ro'  # Default la română
                    country = 'Romania'
                    whatsapp_language = 'ro'
                
                logging.info(f"[SEARCH] Număr de telefon: {clean_phone}, Țară: {country}, Limbă: {language} (WhatsApp: {whatsapp_language})")
                
                # Construim payload-ul pentru WhatsApp
                whatsapp_payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": clean_phone,
                    "type": "template",
                    "template": {
                        "name": template_name,  # Folosim numele template-ului așa cum este definit în room
                        "language": {"code": whatsapp_language},
                        "components": [
                            {
                                "type": "header",
                                "parameters": [
                                    {"type": "text", "text": first_name}
                                ]
                            },
                            {
                                "type": "body",
                                "parameters": []
                            }
                        ]
                    }
                }
                
                # Log pentru depanare
                logging.info(f"[SEARCH] Șablon selectat: {template_name}, Limbă: {whatsapp_language}")
                
                whatsapp_headers = {
                    "Authorization": f"Bearer {os.getenv('WHATSAPP_API_KEY')}",
                    "Content-Type": "application/json"
                }
                
                logging.info(f"[SEARCH] Trimit cerere către WhatsApp API: {whatsapp_url}")
                logging.info(f"[SEARCH] Payload: {whatsapp_payload}")
                
                whatsapp_response = requests.post(whatsapp_url, json=whatsapp_payload, headers=whatsapp_headers)
                
                # Verificăm răspunsul
                response_text = whatsapp_response.text
                logging.info(f"[SEARCH] Răspuns WhatsApp API: Status {whatsapp_response.status_code}, Body: {response_text}")
                
                if whatsapp_response.status_code >= 400:
                    logging.error(f"[SEARCH] Eroare la trimiterea mesajului WhatsApp: {response_text}")
                    raise Exception(f"WhatsApp API error: {response_text}")
                    
                logging.info(f"[SEARCH] Mesaj trimis cu succes prin WhatsApp API către {clean_phone} pentru {guest_name} cu parametrul prenume: {first_name}")
                
                # Salvează mesajul în baza de date
                message_sent = models.MessageSent(
                    hotel_id=hotel.id,
                    room_id=room.id,
                    sent_date=today_iso,
                    template_name=template_name,
                    status="sent",
                    content=f"Template WhatsApp: {template_name}, Prenume: {first_name}"
                )
                db.add(message_sent)
                db.commit()
                
                total_sent += 1
                results.append({
                    "room": room_name,
                    "hotel": hotel.name,
                    "status": "sent",
                    "message": f"Mesaj trimis către {phone}",
                    "guest": guest_name,
                    "phone": phone
                })
            except Exception as e:
                error_msg = f"[SEARCH] Eroare la trimiterea mesajului: {str(e)}"
                logging.error(error_msg)
                results.append({
                    "room": room_name,
                    "hotel": hotel.name,
                    "status": "send_error",
                    "message": error_msg
                })
        
        return {
            "found": total_found,
            "sent": total_sent,
            "results": results
        }
    finally:
        if should_close_db:
            db.close()

@app.on_event('startup')
def send_messages_for_today():
    """Trimite mesaje automat la pornirea aplicației"""
    try:
        logging.info("[STARTUP] Inițierea trimiterii automate de mesaje la pornire")
        result = process_reservations_and_send_messages()
        logging.info(f"[STARTUP] Procesare completă: {result['found']} găsite, {result['sent']} trimise")
    except Exception as e:
        logging.error(f"[STARTUP] Eroare la trimiterea automată: {str(e)}")

@app.post("/messages/search-and-send")
def search_and_send_messages(db: Session = Depends(get_db)):
    """Endpoint pentru căutarea și trimiterea manuală a mesajelor pentru toate camerele"""
    try:
        result = process_reservations_and_send_messages(db)
        return {
            "message": "Procesare completă!",
            "found": result["found"],
            "sent": result["sent"],
            "details": result["results"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eroare la procesare: {str(e)}")

from pydantic import BaseModel

class HeaderParameter(BaseModel):
    type: str  # "text", "image", "video", "document", "location"
    content: str  # Text content, URL for image/video/document, or JSON for location

class BulkMessageRequest(BaseModel):
    phone_numbers: list[str]
    template_name: str
    language: str = Field(default="ro")
    header_parameter: Optional[HeaderParameter] = None
    use_public_url_for_testing: bool = Field(default=False)

class UploadResponse(BaseModel):
    file_url: str
    file_type: str
    file_name: str

@app.post("/upload-media", response_model=UploadResponse)
async def upload_media(file: UploadFile = File(...)):
    """Upload a media file for WhatsApp message headers"""
    try:
        # Validate file type
        content_type = file.content_type
        file_type = ""
        
        if content_type.startswith("image/"):
            file_type = "image"
        elif content_type.startswith("video/"):
            file_type = "video"
        elif content_type.startswith("application/"):
            file_type = "document"
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        # Generate a unique filename
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{file_type}_{timestamp}{file_extension}"
        
        # Save the file
        file_path = os.path.join("uploads", unique_filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Generate the URL for the file
        base_url = os.getenv("BASE_URL", "http://localhost:8000")
        file_url = f"{base_url}/uploads/{unique_filename}"
        
        logging.info(f"[UPLOAD] File uploaded successfully: {file_url}")
        
        return {
            "file_url": file_url,
            "file_type": file_type,
            "file_name": unique_filename
        }
    except Exception as e:
        logging.error(f"[UPLOAD] Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@app.post("/test-whatsapp-delivery")
async def test_whatsapp_delivery():
    """Test endpoint to diagnose WhatsApp delivery issues"""
    try:
        import requests
        from datetime import datetime
        
        # Get WhatsApp token
        whatsapp_token = os.getenv("WHATSAPP_API_KEY")
        phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
        
        # Test with a public image URL instead of localhost
        public_image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png"
        
        # Prepare test phone number (use the same one you've been testing with)
        test_phone = "+40749680770"  # Replace with your test number if different
        
        # Construct payload with public image URL
        payload = {
            "messaging_product": "whatsapp",
            "to": test_phone,
            "type": "template",
            "template": {
                "name": "oferta1",  # Use your approved template name
                "language": {"code": "ro"},
                "components": [
                    {
                        "type": "header",
                        "parameters": [
                            {
                                "type": "image",
                                "image": {"link": public_image_url}
                            }
                        ]
                    },
                    {"type": "body", "parameters": []}
                ]
            }
        }
        
        # Log the test payload
        logging.info(f"[TEST] Testing WhatsApp delivery with public image URL: {public_image_url}")
        logging.info(f"[TEST] Payload: {payload}")
        
        # Send the test message
        headers = {
            "Authorization": f"Bearer {whatsapp_token}",
            "Content-Type": "application/json"
        }
        
        url = f"https://graph.facebook.com/v17.0/{phone_number_id}/messages"
        response = requests.post(url, json=payload, headers=headers)
        
        # Log the response
        logging.info(f"[TEST] WhatsApp API response: Status {response.status_code}, Body: {response.text}")
        
        return {
            "status": "test_sent",
            "response_code": response.status_code,
            "response_body": response.json(),
            "message": "Test message sent with public image URL. Check your phone and the logs."
        }
    except Exception as e:
        logging.error(f"[TEST] Error in test endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

@app.post("/messages/bulk")
async def send_bulk_messages(request: BulkMessageRequest, db: Session = Depends(get_db)):
    """Trimite mesaje în bulk către o listă de numere de telefon"""
    
    # Importăm modulele necesare
    import requests
    from datetime import datetime
    
    # Obținem token-ul WhatsApp
    WHATSAPP_TOKEN = os.getenv("WHATSAPP_API_KEY")
    if not WHATSAPP_TOKEN:
        raise HTTPException(status_code=500, detail="WhatsApp API key not configured")
    
    # Obținem phone number ID
    PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    if not PHONE_NUMBER_ID:
        raise HTTPException(status_code=500, detail="WhatsApp phone number ID not configured")
    
    # Verificăm template-ul
    template_name = request.template_name
    if not template_name:
        raise HTTPException(status_code=400, detail="Template name is required")
    
    # Verificăm limba
    language = request.language
    if not language:
        language = "ro"  # Default to Romanian
    
    # Verificăm numerele de telefon
    phone_numbers = request.phone_numbers
    if not phone_numbers or len(phone_numbers) == 0:
        raise HTTPException(status_code=400, detail="At least one phone number is required")
    
    # Inițializăm contoarele
    sent_count = 0
    failed_count = 0
    results = []
    
    # Trimitem mesaje către fiecare număr de telefon
    for phone_number in phone_numbers:
        try:
            # Formatăm numărul de telefon pentru WhatsApp
            # Curățăm numărul de telefon (eliminăm spații, paranteze etc.)
            formatted_phone = phone_number.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
            
            # Detectăm prefixul țării și adăugăm dacă lipsește
            if not formatted_phone.startswith("+"):
                # Dacă începe cu 0, presupunem că e număr românesc și adăugăm +40
                if formatted_phone.startswith("0"):
                    formatted_phone = "+4" + formatted_phone
                # Dacă începe cu 01, presupunem că e număr german și adăugăm +49
                elif formatted_phone.startswith("01"):
                    formatted_phone = "+49" + formatted_phone[1:]
                # Altfel, adăugăm doar +
                else:
                    formatted_phone = "+" + formatted_phone
                    
            logging.info(f"[BULK] Număr de telefon formatat: {formatted_phone}")
            
            # Construim URL-ul pentru trimiterea mesajului
            url = f"https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages"
            logging.info(f"[BULK] URL WhatsApp API: {url}")
            
            # Construim payload-ul pentru WhatsApp API
            components = [
                # Adăugăm întotdeauna un component de tip body
                {"type": "body", "parameters": []}
            ]
        
            # Adăugăm parametrul pentru header dacă există
            if request.header_parameter:
                header_component = {
                    "type": "header",
                    "parameters": []
                }
                
                if request.header_parameter.type == "text":
                    header_component["parameters"].append({
                        "type": "text",
                        "text": request.header_parameter.content
                    })
                elif request.header_parameter.type == "image":
                    # Verificăm dacă URL-ul este localhost și afișăm un avertisment
                    content_url = request.header_parameter.content
                    if "localhost" in content_url or "127.0.0.1" in content_url:
                        logging.warning(f"[BULK] WARNING: Using localhost URL for image which may not be accessible by WhatsApp: {content_url}")
                        # Pentru testare, înlocuim cu o imagine publică dacă utilizatorul a selectat opțiunea
                        if request.use_public_url_for_testing:
                            content_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png"
                            logging.info(f"[BULK] Replacing localhost URL with public URL for testing: {content_url}")
                    
                    header_component["parameters"].append({
                        "type": "image",
                        "image": {"link": content_url}
                    })
                elif request.header_parameter.type == "video":
                    # Verificăm dacă URL-ul este localhost și afișăm un avertisment
                    content_url = request.header_parameter.content
                    if "localhost" in content_url or "127.0.0.1" in content_url:
                        logging.warning(f"[BULK] WARNING: Using localhost URL for video which may not be accessible by WhatsApp: {content_url}")
                        if request.use_public_url_for_testing:
                            content_url = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                            logging.info(f"[BULK] Replacing localhost URL with public URL for testing: {content_url}")
                    
                    header_component["parameters"].append({
                        "type": "video",
                        "video": {"link": content_url}
                    })
                elif request.header_parameter.type == "document":
                    # Verificăm dacă URL-ul este localhost și afișăm un avertisment
                    content_url = request.header_parameter.content
                    if "localhost" in content_url or "127.0.0.1" in content_url:
                        logging.warning(f"[BULK] WARNING: Using localhost URL for document which may not be accessible by WhatsApp: {content_url}")
                        if request.use_public_url_for_testing:
                            content_url = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
                            logging.info(f"[BULK] Replacing localhost URL with public URL for testing: {content_url}")
                    
                    header_component["parameters"].append({
                        "type": "document",
                        "document": {"link": content_url}
                    })
                elif request.header_parameter.type == "location":
                    # Pentru locație, conținutul ar trebui să fie un JSON cu latitude și longitude
                    try:
                        # Încercăm să parsăm JSON-ul, înlocuind apostrofurile cu ghilimele dacă este necesar
                        content = request.header_parameter.content
                        if "'" in content and not '"' in content:
                            content = content.replace("'", "\"")
                        
                        location_data = json.loads(content)
                        header_component["parameters"].append({
                            "type": "location",
                            "location": {
                                "latitude": location_data.get("latitude"),
                                "longitude": location_data.get("longitude")
                            }
                        })
                    except Exception as e:
                        logging.error(f"[BULK] Error parsing location data: {str(e)}")
                        return {"error": f"Invalid location data: {str(e)}", "content": request.header_parameter.content}
                
                # Adăugăm header-ul la începutul listei de componente
                components.insert(0, header_component)
            
            payload = {
                "messaging_product": "whatsapp",
                "to": formatted_phone,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {
                        "code": language
                    },
                    "components": components
                }
            }
            logging.info(f"[BULK] Payload WhatsApp: {payload}")
            
            # Trimitem mesajul
            headers = {
                "Authorization": f"Bearer {WHATSAPP_TOKEN}",
                "Content-Type": "application/json"
            }
            logging.info(f"[BULK] Headers WhatsApp: Authorization Bearer {WHATSAPP_TOKEN[:5]}...")
            
            logging.info(f"[BULK] Trimitere mesaj WhatsApp către {formatted_phone}")
            response = requests.post(url, json=payload, headers=headers)
            
            # Verificăm răspunsul
            logging.info(f"[BULK] Răspuns WhatsApp API: Status {response.status_code}, Body: {response.text}")
            if response.status_code == 200:
                sent_count += 1
                logging.info(f"[BULK] Mesaj trimis cu succes către {formatted_phone} folosind template: {template_name}")
                # Salvăm mesajul în baza de date
                message_data = {
                    "phone": formatted_phone,
                    "sent_date": datetime.now().strftime("%Y-%m-%d"),
                    "sent_time": datetime.now().strftime("%H:%M:%S"),
                    "hotel_id": 1,  # Folosim un ID de hotel default
                    "room_id": 1,   # Folosim un ID de cameră default
                    "template_name": template_name,
                    "status": "sent",
                    "content": f"Template: {template_name}",
                    "is_ai_response": False
                }
                crud.create_message_sent(db, schemas.MessageSentCreate(**message_data))
                
                results.append({
                    "phone": formatted_phone,
                    "status": "success",
                    "message": "Message sent successfully"
                })
            else:
                failed_count += 1
                error_msg = f"Failed to send message: {response.text}"
                logging.error(f"[BULK] {error_msg}")
                
                # Salvăm mesajul eșuat în baza de date
                message_data = {
                    "phone": formatted_phone,
                    "sent_date": datetime.now().strftime("%Y-%m-%d"),
                    "sent_time": datetime.now().strftime("%H:%M:%S"),
                    "hotel_id": 1,  # Folosim un ID de hotel default
                    "room_id": 1,   # Folosim un ID de cameră default
                    "template_name": template_name,
                    "status": "failed",
                    "content": f"Failed to send template: {template_name}",
                    "is_ai_response": False
                }
                crud.create_message_sent(db, schemas.MessageSentCreate(**message_data))
                
                results.append({
                    "phone": formatted_phone,
                    "status": "error",
                    "message": error_msg
                })
        except Exception as e:
            failed_count += 1
            error_msg = f"Exception sending message: {str(e)}"
            logging.error(f"[BULK] {error_msg}")
            
            try:
                # Salvăm mesajul eșuat în baza de date
                message_data = {
                    "phone": formatted_phone if 'formatted_phone' in locals() else phone_number,
                    "sent_date": datetime.now().strftime("%Y-%m-%d"),
                    "sent_time": datetime.now().strftime("%H:%M:%S"),
                    "hotel_id": 1,  # Folosim un ID de hotel default
                    "room_id": 1,   # Folosim un ID de cameră default
                    "template_name": template_name,
                    "status": "failed",
                    "content": f"Exception: {str(e)}",
                    "is_ai_response": False
                }
                crud.create_message_sent(db, schemas.MessageSentCreate(**message_data))
            except Exception as db_error:
                logging.error(f"[BULK] Failed to save error message to database: {str(db_error)}")
            
            results.append({
                "phone": phone_number,
                "status": "error",
                "message": error_msg
            })
    
    # Logăm rezultatele finale
    logging.info(f"[BULK] Rezultate finale: {sent_count} mesaje trimise, {failed_count} mesaje eșuate")
    
    # Returnăm rezultatele
    return {
        "sent": sent_count,
        "failed": failed_count,
        "results": results
    }

@app.post("/messages/manual")
def send_manual_message(
    room_id: int = Body(...),
    template_name: str = Body(...),
    db: Session = Depends(get_db)
):
    """Endpoint pentru trimiterea manuală a mesajelor"""
    # Importăm modulele necesare
    from datetime import datetime, timedelta
    import re
    import json
    import requests
    
    # Obținem camera din baza de date
    room = crud.get_room(db, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Camera nu a fost găsită")
        
    calendar_url = room.calendar_url
    room_name = room.name
    
    logging.info(f"[MANUAL] Procesare mesaj manual pentru camera {room_name} (ID: {room_id}) cu calendar {calendar_url}")
    
    # 1. Preia rezervarea de azi din calendar
    today = datetime.utcnow().date()
    today_iso = today.isoformat()
    
    try:
        # Verifică dacă URL-ul calendarului este valid
        if not calendar_url or not calendar_url.startswith("http"):
            return {"status": "error", "detail": "URL calendar invalid"}
            
        # Preia datele din calendar
        try:
            resp = requests.get(calendar_url, timeout=10)
            resp.raise_for_status()
            calendar_data = resp.text
            
            # Procesare calendar ICS
            import re
            from datetime import datetime
            
            # Extrage evenimentele din ICS
            events = []
            current_event = {}
            in_event = False
            
            for line in calendar_data.splitlines():
                if line.startswith("BEGIN:VEVENT"):
                    in_event = True
                    current_event = {}
                elif line.startswith("END:VEVENT"):
                    in_event = False
                    if current_event:
                        events.append(current_event)
                elif in_event:
                    if line.startswith("DTSTART"):
                        date_str = line.split(":")[1].strip()
                        # Extrage data din format ICS (20250501T000000Z)
                        try:
                            if "T" in date_str:
                                date_str = date_str.split("T")[0]
                            # Format YYYYMMDD
                            year = int(date_str[0:4])
                            month = int(date_str[4:6])
                            day = int(date_str[6:8])
                            current_event['start'] = datetime(year, month, day).date()
                        except Exception as e:
                            logging.warning(f"Eroare la parsarea datei: {date_str} - {str(e)}")
                    elif line.startswith("SUMMARY"):
                        current_event['summary'] = line.split(":", 1)[1].strip()
                    elif line.startswith("DESCRIPTION"):
                        description = line.split(":", 1)[1].strip()
                        current_event['description'] = description
                        
                        # Extrage telefonul din descriere
                        phone_match = re.search(r'Phone:\s*([+0-9 ]+)', description)
                        if phone_match:
                            current_event['phone'] = phone_match.group(1).strip()
                            
                        # Extrage numele din descriere
                        name_match = re.search(r'First Name:\s*([^\n]+)\nLast Name:\s*([^\n]+)', description)
                        if name_match:
                            first_name = name_match.group(1).strip()
                            last_name = name_match.group(2).strip()
                            if first_name and last_name:
                                current_event['guest_name'] = f"{first_name} {last_name}"
                        
            # Convertește în format similar cu cel așteptat
            data = {'events': events}
            
            if not events:
                logging.warning(f"[MANUAL] Nu s-au găsit evenimente în calendarul ICS")
                return {"status": "error", "detail": "No events found in calendar"}
                
        except requests.exceptions.RequestException as e:
            logging.error(f"[MANUAL] Eroare la preluarea calendarului: {str(e)}")
            return {"status": "error", "detail": f"Calendar fetch failed: {str(e)}"}
        except Exception as e:
            logging.error(f"[MANUAL] Eroare la procesarea calendarului: {str(e)}")
            return {"status": "error", "detail": f"Error processing calendar: {str(e)}"}
            
        # Caută rezervarea cu check-in azi
        rezervare = None
        for event in data.get('events', []):
            start = event.get('start')
            if not start:
                continue
                
            # Verificăm tipul datei
            try:
                # Dacă start este deja un obiect date, îl folosim direct
                if hasattr(start, 'year') and hasattr(start, 'month') and hasattr(start, 'day'):
                    event_date = start
                else:
                    # Altfel, încercăm să-l convertim din string
                    event_date = datetime.fromisoformat(str(start)[:10]).date()
            except Exception as e:
                logging.warning(f"Nu pot converti data: {start} - {str(e)}")
                continue
                    
            # Comparăm datele
            if event_date == today:
                rezervare = event
                logging.info(f"[MANUAL] Am găsit rezervare pentru {event_date}: {event.get('summary', '')}")
                break
                
        if not rezervare:
            logging.info(f"[MANUAL] Nu s-a găsit nicio rezervare pentru astăzi în camera {room_name}")
            
            # Nu trimitem mesaj WhatsApp, doar returnam un mesaj pentru frontend
            return {
                "status": "no_reservation", 
                "message": "Nu există check-in astăzi pentru această cameră",
                "room_name": room_name,
                "detail": "No reservation with check-in today"
            }
            
        # Folosește numele oaspetelui extras din descriere sau din summary
        guest_name = rezervare.get('guest_name', '')
        
        # Dacă nu avem nume din descriere, îl extragem din summary
        if not guest_name:
            summary = rezervare.get('summary', '')
            if 'CLOSED - [' in summary:
                # Extrage numele din formatul "CLOSED - [7788] Ladislau Ciocan TiT srl"
                parts = summary.split('] ')
                if len(parts) > 1:
                    guest_name = parts[1].split(' ')[0] + ' ' + parts[1].split(' ')[1]
                    
        # Extragem prenumele pentru template-ul WhatsApp
        first_name = ""
        if guest_name:
            first_name = guest_name.split(' ')[0]  # Primul cuvânt din nume
        logging.info(f"[MANUAL] Prenume extras pentru template: {first_name}")
        rezervare['first_name'] = first_name  # Salvez prenumele în rezervare pentru a-l folosi la trimiterea mesajului
        
        # Extrage telefonul direct din eveniment (a fost extras anterior din descriere)
        phone = rezervare.get('phone', '')
        
        # Dacă nu avem telefon, verificăm din nou descrierea
        if not phone:
            desc = rezervare.get('description', '')
            phone_match = re.search(r'Phone:\s*([+0-9 ]+)', desc)
            if phone_match:
                phone = phone_match.group(1).strip().replace(' ', '')
                
        if not phone:
            logging.warning(f"[MANUAL] Nu s-a găsit telefon în rezervare pentru camera {room_name}")
            return {"status": "error", "detail": "No phone found in reservation"}
            
        # Trimite mesajul pe WhatsApp
        # Implementare reală a trimiterii către WhatsApp API
        import os
        
        # Extragem prenumele pentru template-ul WhatsApp
        first_name = rezervare.get('first_name', '')
        
        # Folosim ID-ul numărului de telefon din variabilele de mediu
        phone_number_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID', '639183785947357')
        whatsapp_url = f"https://graph.facebook.com/v19.0/{phone_number_id}/messages"
        
        # Curățăm numărul de telefon (eliminăm spații, paranteze etc.)
        clean_phone = phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        # Asigurăm-ne că numărul începe cu +
        if not clean_phone.startswith('+'):
            clean_phone = '+' + clean_phone
            
        logging.info(f"[MANUAL] Număr de telefon curat pentru WhatsApp: {clean_phone}")
        
        whatsapp_payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": "ro"},
                "components": [
                    {
                        "type": "header",
                        "parameters": [
                            {"type": "text", "text": first_name}
                        ]
                    },
                    {
                        "type": "body",
                        "parameters": []
                    }
                ]
            }
        }
        
        whatsapp_headers = {
            "Authorization": f"Bearer {os.getenv('WHATSAPP_API_KEY')}",
            "Content-Type": "application/json"
        }
        
        logging.info(f"[MANUAL] Trimit cerere către WhatsApp API: {whatsapp_url}")
        logging.info(f"[MANUAL] Payload: {whatsapp_payload}")
        
        whatsapp_response = requests.post(whatsapp_url, json=whatsapp_payload, headers=whatsapp_headers)
        
        # Verificăm răspunsul
        response_text = whatsapp_response.text
        logging.info(f"[MANUAL] Răspuns WhatsApp API: Status {whatsapp_response.status_code}, Body: {response_text}")
        
        if whatsapp_response.status_code >= 400:
            logging.error(f"[MANUAL] Eroare la trimiterea mesajului WhatsApp: {response_text}")
            raise Exception(f"WhatsApp API error: {response_text}")
            
        logging.info(f"[MANUAL] Mesaj trimis cu succes prin WhatsApp API către {clean_phone} pentru {guest_name} cu parametrul prenume: {first_name}")
        return {
            "status": "success", 
            "message": "Mesaj trimis cu succes",
            "to": clean_phone,  # Adăugăm numărul de telefon pentru frontend
            "template": template_name  # Adăugăm numele template-ului pentru frontend
        }
            
    except Exception as e:
        logging.error(f"[MANUAL] Eroare neașteptată: {str(e)}")
        return {"status": "error", "detail": f"Unexpected error: {str(e)}"}

@app.post("/messages", response_model=schemas.MessageSent)
def create_message_sent(msg: schemas.MessageSentCreate, db: Session = Depends(get_db)):
    return crud.create_message_sent(db, msg)

@app.get("/messages", response_model=list[schemas.MessageSent])
def list_messages_sent(hotel_id: int = None, room_id: int = None, start_date: str = None, end_date: str = None, db: Session = Depends(get_db)):
    return crud.list_messages_sent(db, hotel_id, room_id, start_date, end_date)

# --- MessageSent Stats ---
@app.get("/messages/stats")
def messages_stats(hotel_id: int = None, start_date: str = None, end_date: str = None, db: Session = Depends(get_db)):
    # Get hotel-level statistics
    hotel_stats = crud.messages_stats(db, hotel_id, start_date, end_date)
    
    # Get room-level statistics
    room_stats = crud.messages_stats_by_room(db, hotel_id, start_date, end_date)
    
    # Combine the results
    result = []
    
    # Process hotel-level stats
    for hotel_id_val, total in hotel_stats:
        hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id_val).first()
        if hotel:
            result.append({
                "hotel_id": hotel_id_val,
                "hotel_name": hotel.name,
                "room_id": None,  # None indicates hotel-wide stats
                "room_name": "Toate camerele",  # "All rooms" in Romanian
                "total_messages": total,
                "start_date": start_date,
                "end_date": end_date
            })
    
    # Process room-level stats
    for room_id_val, hotel_id_val, total in room_stats:
        room = db.query(models.Room).filter(models.Room.id == room_id_val).first()
        hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id_val).first()
        if room and hotel:
            result.append({
                "hotel_id": hotel_id_val,
                "hotel_name": hotel.name,
                "room_id": room_id_val,
                "room_name": room.name,
                "total_messages": total,
                "start_date": start_date,
                "end_date": end_date
            })
    
    # Sort by hotel name and then by room name (with hotel-wide stats first)
    result.sort(key=lambda x: (x["hotel_name"], x["room_id"] is not None, x.get("room_name", "")))
    
    return result

# --- Application Control ---

# App is always active now, no need for state management endpoints

# --- AI Response pentru mesaje WhatsApp ---
class AITestRequest(BaseModel):
    message: str
    phone: str = Field(default="+40123456789")
    guest_name: Optional[str] = Field(default="Turist")

class AIResponse(BaseModel):
    input_message: str
    ai_response: str
    detected_language: Optional[str] = None

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = "gpt-3.5-turbo"

def detect_message_language(text: str) -> str:
    """
    Detectează limba unui text și returnează codul de limbă.
    Returnează 'ro' (română) ca valoare implicită dacă detectarea eșuează.
    """
    try:
        # Detectăm limba textului
        lang = detect(text)
        logging.info(f"[AI] Detected language: {lang}")
        return lang
    except LangDetectException as e:
        logging.warning(f"[AI] Language detection failed, defaulting to Romanian: {str(e)}")
        return 'ro'

def get_system_prompt(language_code: str) -> str:
    """
    Returnează promptul de sistem în limba corespunzătoare.
    """
    prompts = {
        'ro': "Ești Ana, un asistent virtual pentru comunicări cu turiștii. Răspunde scurt, prietenos și profesionist. Evită să presupui facilități sau servicii specifice (cum ar fi parcări, restaurante, etc). Nu menționa 'hotel de lux'. Îndrumă mereu turistul să contacteze direct recepția pentru informații specifice. Mulțumește pentru mesaj și oferă ajutor general. Răspunsurile trebuie să fie scurte, de maxim 3-4 propoziții.",
        
        'en': "You are Ana, a virtual assistant for tourist communications. Respond briefly, friendly and professionally. Avoid assuming specific facilities or services (such as parking, restaurants, etc). Don't mention 'luxury hotel'. Always guide the tourist to contact the reception directly for specific information. Thank them for their message and offer general assistance. Responses should be short, maximum 3-4 sentences.",
        
        'de': "Sie sind Ana, eine virtuelle Assistentin für Touristenkommunikation. Antworten Sie kurz, freundlich und professionell. Vermeiden Sie es, bestimmte Einrichtungen oder Dienstleistungen anzunehmen (wie Parkplätze, Restaurants usw.). Erwähnen Sie nicht 'Luxushotel'. Leiten Sie den Touristen immer an, sich für spezifische Informationen direkt an die Rezeption zu wenden. Danken Sie für die Nachricht und bieten Sie allgemeine Hilfe an. Antworten sollten kurz sein, maximal 3-4 Sätze.",
        
        'fr': "Vous êtes Ana, une assistante virtuelle pour les communications touristiques. Répondez brièvement, amicalement et professionnellement. Évitez de supposer des installations ou services spécifiques (comme le stationnement, les restaurants, etc). Ne mentionnez pas 'hôtel de luxe'. Guidez toujours le touriste à contacter directement la réception pour des informations spécifiques. Remerciez-les pour leur message et offrez une assistance générale. Les réponses doivent être courtes, maximum 3-4 phrases.",
        
        'es': "Eres Ana, una asistente virtual para comunicaciones turísticas. Responde brevemente, amigable y profesionalmente. Evita suponer instalaciones o servicios específicos (como estacionamiento, restaurantes, etc). No menciones 'hotel de lujo'. Siempre guía al turista a contactar directamente con la recepción para información específica. Agradece su mensaje y ofrece asistencia general. Las respuestas deben ser cortas, máximo 3-4 oraciones.",
        
        'it': "Sei Ana, un'assistente virtuale per le comunicazioni turistiche. Rispondi brevemente, in modo amichevole e professionale. Evita di presumere strutture o servizi specifici (come parcheggi, ristoranti, ecc). Non menzionare 'hotel di lusso'. Guida sempre il turista a contattare direttamente la reception per informazioni specifiche. Ringrazia per il messaggio e offri assistenza generale. Le risposte devono essere brevi, massimo 3-4 frasi."
    }
    
    # Returnăm promptul pentru limba detectată sau română ca limbă implicită
    return prompts.get(language_code, prompts.get('en', prompts['ro']))

def get_contact_message(language_code: str, phone: str) -> str:
    """
    Returnează mesajul de contact în limba corespunzătoare.
    """
    messages = {
        'ro': f"Pentru informații specifice, vă rugăm să contactați direct recepția la {phone}.",
        'en': f"For specific information, please contact the reception directly at {phone}.",
        'de': f"Für spezifische Informationen kontaktieren Sie bitte direkt die Rezeption unter {phone}.",
        'fr': f"Pour des informations spécifiques, veuillez contacter directement la réception au {phone}.",
        'es': f"Para información específica, por favor contacte directamente con la recepción al {phone}.",
        'it': f"Per informazioni specifiche, si prega di contattare direttamente la reception al {phone}."
    }
    
    # Returnăm mesajul pentru limba detectată sau engleză ca limbă implicită
    return messages.get(language_code, messages.get('en', messages['ro']))

def generate_ai_response(message: str, guest_name: str = "Turist"):
    """
    Generează un răspuns AI folosind OpenAI GPT-3.5 Turbo.
    Detectează automat limba mesajului și răspunde în aceeași limbă.
    """
    # Definim un număr de telefon al hotelului pentru contact
    hotel_phone = "0722 123 456"
    
    try:
        # Obținem numărul de telefon al hotelului din setări
        settings_data = {}
        try:
            with open(SETTINGS_FILE, "r") as f:
                settings_data = json.load(f)
            hotel_phone = settings_data.get("hotel_phone", "0722 123 456")
            if not hotel_phone:
                hotel_phone = "0722 123 456"
        except (FileNotFoundError, json.JSONDecodeError):
            pass
        
        if not OPENAI_API_KEY:
            logging.error("OPENAI_API_KEY nu este setat în environment!")
            return "[Eroare: cheia OpenAI lipsă]"
        
        # Detectăm limba mesajului primit
        detected_lang = detect_message_language(message)
        logging.info(f"[AI] Detected language for message: {detected_lang}")
        
        # Obținem promptul specific limbii detectate
        system_prompt = get_system_prompt(detected_lang)
        
        # Construim un prompt pentru asistentul hotelier în limba detectată
        user_prompt = f"Un turist pe nume {guest_name} a răspuns la mesajul de check-in cu următorul text: \"{message}\". "
        user_prompt += f"Răspunde-i într-un mod foarte prietenos, personal și profesionist. "
        user_prompt += get_contact_message(detected_lang, hotel_phone)
        
        # Construim mesajele pentru OpenAI
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": OPENAI_MODEL,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 500
        }
        
        logging.info(f"[AI] Sending request to OpenAI API")
        logging.info(f"[AI] Using model: {OPENAI_MODEL}")
        logging.info(f"[AI] Using language: {detected_lang}")
        logging.info(f"[AI] Payload: {json.dumps(payload, ensure_ascii=False)}")
        
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        logging.info(f"[AI] Response status code: {response.status_code}")
        
        if response.status_code == 200:
            # Procesăm răspunsul de la OpenAI
            try:
                response_json = response.json()
                logging.info(f"[AI] Parsed JSON response: {response_json}")
                
                # Extragem răspunsul din formatul OpenAI
                if "choices" in response_json and len(response_json["choices"]) > 0:
                    ai_response = response_json["choices"][0]["message"]["content"].strip()
                    logging.info(f"[AI] Extracted response: {ai_response}")
                    return ai_response
                else:
                    logging.error(f"[AI] No choices in response: {response_json}")
                    # Răspuns de rezervă în limba detectată
                    fallback = get_contact_message(detected_lang, hotel_phone)
                    if detected_lang == 'ro':
                        return f"Bună ziua {guest_name}! Vă mulțumim pentru mesajul dumneavoastră. {fallback}"
                    elif detected_lang == 'en':
                        return f"Hello {guest_name}! Thank you for your message. {fallback}"
                    elif detected_lang == 'de':
                        return f"Hallo {guest_name}! Vielen Dank für Ihre Nachricht. {fallback}"
                    else:
                        return f"Hello {guest_name}! Thank you for your message. {fallback}"
            except Exception as e:
                logging.error(f"[AI] Error parsing response: {str(e)}")
                # Răspuns de rezervă în limba detectată
                fallback = get_contact_message(detected_lang, hotel_phone)
                if detected_lang == 'ro':
                    return f"Bună ziua {guest_name}! Vă mulțumim pentru mesajul dumneavoastră. {fallback}"
                elif detected_lang == 'en':
                    return f"Hello {guest_name}! Thank you for your message. {fallback}"
                elif detected_lang == 'de':
                    return f"Hallo {guest_name}! Vielen Dank für Ihre Nachricht. {fallback}"
                else:
                    return f"Hello {guest_name}! Thank you for your message. {fallback}"
        else:
            logging.error(f"[AI] API error: {response.status_code}, {response.text}")
            # Răspuns de rezervă în limba detectată
            fallback = get_contact_message(detected_lang, hotel_phone)
            if detected_lang == 'ro':
                return f"Bună ziua {guest_name}! Vă mulțumim pentru mesajul dumneavoastră. {fallback}"
            elif detected_lang == 'en':
                return f"Hello {guest_name}! Thank you for your message. {fallback}"
            elif detected_lang == 'de':
                return f"Hallo {guest_name}! Vielen Dank für Ihre Nachricht. {fallback}"
            else:
                return f"Hello {guest_name}! Thank you for your message. {fallback}"
    except Exception as e:
        logging.error(f"[AI] Exception: {str(e)}")
        # Răspuns de rezervă politicos și neutru în caz de excepție
        try:
            # Încercăm să detectăm limba chiar și în caz de eroare
            detected_lang = detect_message_language(message)
            if detected_lang == 'ro':
                return f"Bună ziua {guest_name}!\n\nVă mulțumim pentru mesajul dumneavoastră. Pentru orice informații suplimentare sau asistență directă, vă rugăm să contactați recepția hotelului.\n\nCu stimă,\nEchipa Hotelului"
            elif detected_lang == 'en':
                return f"Hello {guest_name}!\n\nThank you for your message. For any additional information or direct assistance, please contact the hotel reception.\n\nBest regards,\nThe Hotel Team"
            elif detected_lang == 'de':
                return f"Hallo {guest_name}!\n\nVielen Dank für Ihre Nachricht. Für weitere Informationen oder direkte Unterstützung wenden Sie sich bitte an die Hotelrezeption.\n\nMit freundlichen Grüßen,\nDas Hotelteam"
            else:
                return f"Hello {guest_name}!\n\nThank you for your message. For any additional information or direct assistance, please contact the hotel reception.\n\nBest regards,\nThe Hotel Team"
        except:
            # Dacă totul eșuează, răspundem în engleză
            return f"Hello {guest_name}!\n\nThank you for your message. For any additional information or direct assistance, please contact the hotel reception.\n\nBest regards,\nThe Hotel Team"

# Endpoint pentru testarea răspunsului AI
@app.post("/test-ai-response", response_model=AIResponse)
def test_ai_response(data: AITestRequest):
    try:
        # Detectăm limba mesajului
        detected_lang = detect_message_language(data.message)
        
        # Generează răspunsul în limba detectată
        ai_response = generate_ai_response(data.message, data.guest_name)
        
        # Returnăm răspunsul și limba detectată
        return {
            "input_message": data.message,
            "ai_response": ai_response,
            "detected_language": detected_lang
        }
    except Exception as e:
        logging.error(f"[AI-TEST] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Eroare la generarea răspunsului AI: {str(e)}")
        
@app.post("/whatsapp-webhook")
async def whatsapp_webhook(request: Request):
    """Webhook pentru notificări WhatsApp"""
    try:
        # Primim datele de la webhook
        body = await request.json()
        logging.info(f"[WEBHOOK] Received webhook data: {body}")
        
        # Verificăm dacă este un mesaj WhatsApp valid
        if 'object' in body and body['object'] == 'whatsapp_business_account':
            # Procesăm fiecare intrare
            for entry in body.get('entry', []):
                # Procesăm fiecare mesaj
                for change in entry.get('changes', []):
                    value = change.get('value', {})
                    
                    # Verificăm dacă avem mesaje
                    for message in value.get('messages', []):
                        # Verificăm dacă este un mesaj text
                        if message.get('type') == 'text':
                            # Extragem numărul de telefon și textul mesajului
                            phone_number = message.get('from', '')
                            message_body = message.get('text', {}).get('body', '')
                            
                            # Încercăm să extragem numele oaspetelui din metadate sau folosim "Oaspete" ca valoare implicită
                            guest_name = "Oaspete"
                            try:
                                # Verificăm dacă avem informații despre contact
                                contacts = value.get('contacts', [])
                                if contacts and len(contacts) > 0:
                                    profile = contacts[0].get('profile', {})
                                    if 'name' in profile:
                                        guest_name = profile.get('name')
                            except Exception as e:
                                logging.warning(f"[WEBHOOK] Could not extract guest name: {str(e)}")
                            
                            # Detectăm limba mesajului
                            detected_lang = detect_message_language(message_body)
                            logging.info(f"[WEBHOOK] Detected language for message: {detected_lang}")
                            
                            # Generăm un răspuns folosind AI în limba detectată
                            ai_response = generate_ai_response(message_body, guest_name)
                            
                            # Trimitem răspunsul înapoi prin WhatsApp
                            send_result = send_whatsapp_message(phone_number, ai_response)
                            
                            # Salvăm mesajul primit și răspunsul AI în baza de date
                            try:
                                # Căutăm camera după numărul de telefon
                                db = database.SessionLocal()
                                room = db.query(models.Room).filter(models.Room.whatsapp_number == phone_number).first()
                                
                                if room:
                                    # Salvăm mesajul primit de la utilizator
                                    today = datetime.datetime.now().date().isoformat()
                                    
                                    # Mesajul primit
                                    user_message = models.MessageSent(
                                        hotel_id=room.hotel_id,
                                        room_id=room.id,
                                        sent_date=today,
                                        template_name="RECEIVED_MESSAGE",
                                        status="received",
                                        content=message_body
                                    )
                                    db.add(user_message)
                                    
                                    # Răspunsul AI
                                    ai_message = models.MessageSent(
                                        hotel_id=room.hotel_id,
                                        room_id=room.id,
                                        sent_date=today,
                                        template_name="AI_RESPONSE",
                                        status="sent" if send_result else "failed",
                                        content=ai_response
                                    )
                                    db.add(ai_message)
                                    db.commit()
                                    
                                    logging.info(f"[WEBHOOK] Saved message and AI response to database for room {room.id}")
                                else:
                                    logging.warning(f"[WEBHOOK] Could not find room for phone number {phone_number}")
                            except Exception as e:
                                logging.error(f"[WEBHOOK] Error saving message to database: {str(e)}")
                            finally:
                                db.close()
                            
                            logging.info(f"[WEBHOOK] Sent AI response to {phone_number} in language: {detected_lang}")
        
        return {"status": "success"}
    except Exception as e:
        logging.error(f"[WEBHOOK] Error processing webhook: {str(e)}")
        return {"status": "error", "message": str(e)}

# Funcție pentru trimiterea mesajului WhatsApp
def send_whatsapp_message(phone_number: str, message: str):
    try:
        # Folosim ID-ul numărului de telefon din variabilele de mediu
        phone_number_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID', '')
        whatsapp_url = f"https://graph.facebook.com/v19.0/{phone_number_id}/messages"
        
        whatsapp_payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": phone_number,
            "type": "text",
            "text": {
                "body": message
            }
        }
        
        whatsapp_headers = {
            "Authorization": f"Bearer {os.getenv('WHATSAPP_API_KEY')}",
            "Content-Type": "application/json"
        }
        
        logging.info(f"[WHATSAPP] Sending message to {phone_number}")
        
        whatsapp_response = requests.post(whatsapp_url, json=whatsapp_payload, headers=whatsapp_headers)
        
        # Verificăm răspunsul
        response_text = whatsapp_response.text
        logging.info(f"[WHATSAPP] API response: Status {whatsapp_response.status_code}, Body: {response_text}")
        
        if whatsapp_response.status_code >= 400:
            logging.error(f"[WHATSAPP] Error sending message: {response_text}")
            return False
            
        logging.info(f"[WHATSAPP] Message sent successfully to {phone_number}")
        return True
            
    except Exception as e:
        logging.error(f"[WHATSAPP] Error sending message: {str(e)}")
        return False

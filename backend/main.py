from fastapi import FastAPI, Request, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
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

# --- SQLAlchemy imports for hotel/room management ---
from database import SessionLocal, init_db as sqlalchemy_init_db
import models
import schemas
import crud
from sqlalchemy.orm import Session

load_dotenv()

app = FastAPI()

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
                whatsapp_api_url = f"https://graph.facebook.com/v19.0/{phone_number_id}/messages"
                
                # Curățăm numărul de telefon (eliminăm spații, paranteze etc.)
                clean_phone = phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
                # Asigurăm-ne că numărul începe cu +
                if not clean_phone.startswith('+'):
                    clean_phone = '+' + clean_phone
                    
                logging.info(f"[SEARCH] Număr de telefon curat pentru WhatsApp: {clean_phone}")
                
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
                
                logging.info(f"[SEARCH] Trimit cerere către WhatsApp API: {whatsapp_api_url}")
                logging.info(f"[SEARCH] Payload: {whatsapp_payload}")
                
                whatsapp_response = requests.post(whatsapp_api_url, json=whatsapp_payload, headers=whatsapp_headers)
                
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
            return {"status": "not_found", "detail": "No reservation with check-in today"}
            
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
        whatsapp_api_url = f"https://graph.facebook.com/v19.0/{phone_number_id}/messages"
        
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
        
        logging.info(f"[MANUAL] Trimit cerere către WhatsApp API: {whatsapp_api_url}")
        logging.info(f"[MANUAL] Payload: {whatsapp_payload}")
        
        whatsapp_response = requests.post(whatsapp_api_url, json=whatsapp_payload, headers=whatsapp_headers)
        
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
    stats = crud.messages_stats(db, hotel_id, start_date, end_date)
    # Completez cu nume hotel pentru fiecare id
    result = []
    for hotel_id_val, total in stats:
        hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id_val).first()
        result.append({
            "hotel_id": hotel_id_val,
            "hotel_name": hotel.name if hotel else "(unknown)",
            "total_messages": total,
            "start_date": start_date,
            "end_date": end_date
        })
    return result

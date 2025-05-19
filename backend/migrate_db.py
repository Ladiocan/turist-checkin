import sqlite3
import os
import logging
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from models import Base, Hotel, Room, RoomSettings

# Configurare logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Calea către baza de date
DB_PATH = "sqlite:///./hotels.db"

def migrate_database():
    """
    Migrează baza de date pentru a reflecta noile modele.
    Adaugă coloanele noi și modifică structura tabelelor existente.
    """
    logger.info("Începere migrare bază de date...")
    
    # Creează engine-ul SQLAlchemy
    engine = create_engine(DB_PATH)
    
    # Verifică dacă baza de date există
    if not os.path.exists("./hotels.db"):
        logger.info("Baza de date nu există. Se creează una nouă.")
        Base.metadata.create_all(engine)
        logger.info("Baza de date a fost creată cu succes.")
        return
    
    # Conectare la baza de date SQLite direct pentru operații de migrare
    conn = sqlite3.connect("./hotels.db")
    cursor = conn.cursor()
    
    # Verifică structura tabelului hotels
    try:
        cursor.execute("PRAGMA table_info(hotels)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        # Verifică și adaugă coloanele noi pentru tabelul hotels
        if "api_key" in column_names and "address" not in column_names:
            logger.info("Migrare tabel hotels: adăugare coloane noi și redenumire coloane existente")
            
            # Creează un tabel temporar cu noua structură
            cursor.execute("""
            CREATE TABLE hotels_new (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                address TEXT,
                phone TEXT,
                email TEXT,
                description TEXT
            )
            """)
            
            # Copiază datele din tabelul vechi în cel nou
            cursor.execute("""
            INSERT INTO hotels_new (id, name, address, phone, email)
            SELECT id, name, '', contact_phone, contact_email FROM hotels
            """)
            
            # Șterge tabelul vechi și redenumește pe cel nou
            cursor.execute("DROP TABLE hotels")
            cursor.execute("ALTER TABLE hotels_new RENAME TO hotels")
            
            logger.info("Tabelul hotels a fost migrat cu succes.")
        else:
            logger.info("Tabelul hotels are deja structura corectă sau nu necesită migrare.")
        
        # Verifică structura tabelului rooms
        cursor.execute("PRAGMA table_info(rooms)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if "phone_button" in column_names:
            logger.info("Migrare tabel rooms: eliminare coloană phone_button")
            
            # Creează un tabel temporar cu noua structură
            cursor.execute("""
            CREATE TABLE rooms_new (
                id INTEGER PRIMARY KEY,
                hotel_id INTEGER,
                name TEXT NOT NULL,
                calendar_url TEXT NOT NULL,
                whatsapp_number TEXT NOT NULL,
                template_name TEXT,
                FOREIGN KEY (hotel_id) REFERENCES hotels (id)
            )
            """)
            
            # Copiază datele din tabelul vechi în cel nou
            cursor.execute("""
            INSERT INTO rooms_new (id, hotel_id, name, calendar_url, whatsapp_number, template_name)
            SELECT id, hotel_id, name, calendar_url, whatsapp_number, template_name FROM rooms
            """)
            
            # Șterge tabelul vechi și redenumește pe cel nou
            cursor.execute("DROP TABLE rooms")
            cursor.execute("ALTER TABLE rooms_new RENAME TO rooms")
            
            logger.info("Tabelul rooms a fost migrat cu succes.")
        else:
            logger.info("Tabelul rooms are deja structura corectă sau nu necesită migrare.")
        
        # Verifică dacă tabelul room_settings există și creează-l dacă nu
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='room_settings'")
        if not cursor.fetchone():
            logger.info("Creare tabel room_settings")
            
            cursor.execute("""
            CREATE TABLE room_settings (
                id INTEGER PRIMARY KEY,
                room_id INTEGER UNIQUE,
                auto_send BOOLEAN DEFAULT 1,
                send_time TEXT DEFAULT '11:00:00',
                FOREIGN KEY (room_id) REFERENCES rooms (id)
            )
            """)
            
            # Adaugă setări implicite pentru toate camerele existente
            cursor.execute("SELECT id FROM rooms")
            room_ids = cursor.fetchall()
            
            for room_id in room_ids:
                cursor.execute("""
                INSERT INTO room_settings (room_id, auto_send, send_time)
                VALUES (?, 1, '11:00:00')
                """, (room_id[0],))
            
            logger.info(f"Tabelul room_settings a fost creat și populat cu {len(room_ids)} înregistrări.")
        else:
            logger.info("Tabelul room_settings există deja.")
        
        # Salvează modificările
        conn.commit()
        logger.info("Migrarea bazei de date a fost finalizată cu succes.")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Eroare la migrarea bazei de date: {str(e)}")
    finally:
        conn.close()
    
    # Verifică dacă toate tabelele au structura corectă folosind SQLAlchemy
    try:
        inspector = inspect(engine)
        
        # Verifică dacă toate tabelele există
        existing_tables = inspector.get_table_names()
        required_tables = ['hotels', 'rooms', 'room_settings', 'messages_sent']
        
        for table in required_tables:
            if table not in existing_tables:
                logger.warning(f"Tabelul {table} nu există în baza de date!")
        
        # Creează sesiunea SQLAlchemy
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Verifică dacă există înregistrări în tabelele principale
        hotel_count = session.query(Hotel).count()
        room_count = session.query(Room).count()
        settings_count = session.query(RoomSettings).count()
        
        logger.info(f"Statistici bază de date: {hotel_count} hoteluri, {room_count} camere, {settings_count} setări")
        
        session.close()
        
    except Exception as e:
        logger.error(f"Eroare la verificarea bazei de date: {str(e)}")

if __name__ == "__main__":
    migrate_database()

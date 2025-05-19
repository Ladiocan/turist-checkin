import sqlite3
import os
import logging
import sys

# Configurare logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('migration')

def migrate_database():
    """Migrează baza de date pentru a reflecta noile modele.
    Adaugă coloanele noi și modifică structura tabelelor existente.
    """
    # Verifică dacă suntem în directorul backend sau în directorul principal
    if os.path.exists('backend'):
        # Suntem în directorul principal, execută scriptul din backend
        logger.info("Executare script de migrare din directorul backend...")
        sys.path.append('backend')
        try:
            from backend.migrate_db import migrate_database as backend_migrate
            backend_migrate()
            return True
        except ImportError:
            logger.error("Nu s-a putut importa scriptul de migrare din backend.")
            return False
    
    # Verifică dacă există baza de date hotels.db (noua bază de date)
    hotels_db_path = os.path.join(os.getcwd(), 'hotels.db')
    old_db_path = os.path.join(os.getcwd(), 'hotel.db')
    
    # Dacă există vechea bază de date dar nu există cea nouă, migrează datele
    if os.path.exists(old_db_path) and not os.path.exists(hotels_db_path):
        logger.info(f"Se migrează datele din {old_db_path} în {hotels_db_path}")
        try:
            # Importă modelele și creează noua bază de date
            from backend.models import Base, Hotel, Room, RoomSettings, MessageSent
            from sqlalchemy import create_engine
            from sqlalchemy.orm import sessionmaker
            
            # Creează noua bază de date cu modelele actualizate
            engine = create_engine(f"sqlite:///{hotels_db_path}")
            Base.metadata.create_all(engine)
            
            # Deschide conexiunea la vechea bază de date
            old_conn = sqlite3.connect(old_db_path)
            old_cursor = old_conn.cursor()
            
            # Creează sesiunea pentru noua bază de date
            Session = sessionmaker(bind=engine)
            session = Session()
            
            # Migrează hotelurile
            old_cursor.execute("SELECT id, name, api_key, contact_phone, contact_email FROM hotels")
            hotels = old_cursor.fetchall()
            
            for hotel_data in hotels:
                hotel_id, name, api_key, phone, email = hotel_data
                hotel = Hotel(
                    id=hotel_id,
                    name=name,
                    address="",
                    phone=phone or "",
                    email=email or "",
                    description=""
                )
                session.add(hotel)
            
            # Migrează camerele
            old_cursor.execute("SELECT id, hotel_id, name, calendar_url, whatsapp_number, phone_button, template_name FROM rooms")
            rooms = old_cursor.fetchall()
            
            for room_data in rooms:
                room_id, hotel_id, name, calendar_url, whatsapp_number, phone_button, template_name = room_data
                room = Room(
                    id=room_id,
                    hotel_id=hotel_id,
                    name=name,
                    calendar_url=calendar_url,
                    whatsapp_number=whatsapp_number,
                    template_name=template_name or "oberth"
                )
                session.add(room)
                
                # Adaugă setări implicite pentru cameră
                settings = RoomSettings(
                    room_id=room_id,
                    auto_send=True,
                    send_time="11:00:00"
                )
                session.add(settings)
            
            # Salvează modificările
            session.commit()
            session.close()
            old_conn.close()
            
            logger.info(f"Migrarea datelor din {old_db_path} în {hotels_db_path} a fost finalizată cu succes!")
            return True
            
        except Exception as e:
            logger.error(f"Eroare la migrarea datelor: {str(e)}")
            return False
    
    # Dacă nu există nicio bază de date, creează una nouă
    if not os.path.exists(hotels_db_path) and not os.path.exists(old_db_path):
        logger.info("Nu există nicio bază de date. Se creează una nouă...")
        try:
            from backend.models import Base
            from sqlalchemy import create_engine
            
            engine = create_engine(f"sqlite:///{hotels_db_path}")
            Base.metadata.create_all(engine)
            
            logger.info(f"Baza de date {hotels_db_path} a fost creată cu succes!")
            return True
        except Exception as e:
            logger.error(f"Eroare la crearea bazei de date: {str(e)}")
            return False
    
    # Dacă există deja noua bază de date, verifică și actualizează structura
    if os.path.exists(hotels_db_path):
        logger.info(f"Baza de date {hotels_db_path} există deja. Se verifică structura...")
        try:
            # Execută scriptul din backend pentru a actualiza structura
            from backend.migrate_db import migrate_database as backend_migrate
            backend_migrate()
            return True
        except ImportError:
            logger.warning("Nu s-a putut importa scriptul de migrare din backend.")
            logger.info("Se încearcă actualizarea structurii direct...")
            
            try:
                # Actualizează structura direct
                conn = sqlite3.connect(hotels_db_path)
                cursor = conn.cursor()
                
                # Verifică dacă există tabelul room_settings
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
                conn.close()
                
                logger.info("Actualizarea structurii bazei de date a fost finalizată cu succes!")
                return True
            except Exception as e:
                logger.error(f"Eroare la actualizarea structurii bazei de date: {str(e)}")
                return False
    
    logger.error("Nu s-a putut determina acțiunea de migrare potrivită.")
    return False

if __name__ == "__main__":
    success = migrate_database()
    if success:
        logger.info("Migrarea bazei de date s-a încheiat cu succes.")
    else:
        logger.error("Migrarea bazei de date a eșuat.")

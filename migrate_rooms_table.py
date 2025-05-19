import sqlite3
import logging
import os

# Configurare logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def migrate_database():
    """
    Migrează baza de date pentru a face câmpul whatsapp_number opțional și template_name obligatoriu
    """
    try:
        # Calea către baza de date
        db_path = os.path.join('backend', 'hotel.db')
        logging.info(f"Utilizare bază de date: {db_path}")
        
        # Conectare la baza de date
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        logging.info("Începere migrare pentru tabelul rooms...")
        
        # Creăm un tabel temporar cu noua structură
        cursor.execute('''
        CREATE TABLE rooms_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hotel_id INTEGER,
            name TEXT NOT NULL,
            calendar_url TEXT NOT NULL,
            whatsapp_number TEXT,
            template_name TEXT NOT NULL,
            FOREIGN KEY (hotel_id) REFERENCES hotels (id)
        )
        ''')
        
        # Copiem datele din tabelul vechi în cel nou
        # Pentru template_name, dacă este NULL, setăm valoarea implicită 'oberth'
        cursor.execute('''
        INSERT INTO rooms_new (id, hotel_id, name, calendar_url, whatsapp_number, template_name)
        SELECT id, hotel_id, name, calendar_url, whatsapp_number, 
               CASE WHEN template_name IS NULL THEN 'oberth' ELSE template_name END
        FROM rooms
        ''')
        
        # Ștergem tabelul vechi
        cursor.execute('DROP TABLE rooms')
        
        # Redenumim tabelul nou
        cursor.execute('ALTER TABLE rooms_new RENAME TO rooms')
        
        # Salvăm modificările
        conn.commit()
        logging.info("Migrare finalizată cu succes!")
        
    except Exception as e:
        logging.error(f"Eroare la migrare: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()

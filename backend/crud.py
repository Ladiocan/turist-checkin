from sqlalchemy.orm import Session
import models
import schemas
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

def get_hotel_by_id(db: Session, hotel_id: int):
    return db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()

def get_hotels(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Hotel).offset(skip).limit(limit).all()

def create_hotel(db: Session, hotel: schemas.HotelCreate):
    db_hotel = models.Hotel(**hotel.dict())
    db.add(db_hotel)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(db_hotel)
    return db_hotel

def update_hotel(db: Session, hotel_id: int, hotel_update: schemas.HotelUpdate):
    db_hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()
    if not db_hotel:
        return None
    for field, value in hotel_update.dict(exclude_unset=True).items():
        setattr(db_hotel, field, value)
    db.commit()
    db.refresh(db_hotel)
    return db_hotel

def delete_hotel(db: Session, hotel_id: int):
    db_hotel = db.query(models.Hotel).filter(models.Hotel.id == hotel_id).first()
    if not db_hotel:
        return False
    db.delete(db_hotel)
    db.commit()
    return True

def get_rooms(db: Session, hotel_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Room).filter(models.Room.hotel_id == hotel_id).options(
        joinedload(models.Room.settings)
    ).offset(skip).limit(limit).all()

def get_room(db: Session, room_id: int):
    return db.query(models.Room).filter(models.Room.id == room_id).options(
        joinedload(models.Room.settings)
    ).first()

def create_room(db: Session, room: schemas.RoomCreate, hotel_id: int):
    db_room = models.Room(**room.dict(), hotel_id=hotel_id)
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    
    # Creăm setări implicite pentru cameră
    default_settings = models.RoomSettings(room_id=db_room.id)
    db.add(default_settings)
    db.commit()
    
    return db_room

def update_room(db: Session, room_id: int, room_update: schemas.RoomUpdate):
    db_room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not db_room:
        return None
    for field, value in room_update.dict(exclude_unset=True).items():
        setattr(db_room, field, value)
    db.commit()
    db.refresh(db_room)
    return db_room

def delete_room(db: Session, room_id: int):
    db_room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not db_room:
        return False
    db.delete(db_room)
    db.commit()
    return True

def create_message_sent(db: Session, msg: schemas.MessageSentCreate):
    db_msg = models.MessageSent(**msg.dict())
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    return db_msg

def list_messages_sent(db: Session, hotel_id: int = None, room_id: int = None, start_date: str = None, end_date: str = None):
    query = db.query(models.MessageSent)
    if hotel_id:
        query = query.filter(models.MessageSent.hotel_id == hotel_id)
    if room_id:
        query = query.filter(models.MessageSent.room_id == room_id)
    if start_date:
        query = query.filter(models.MessageSent.sent_date >= start_date)
    if end_date:
        query = query.filter(models.MessageSent.sent_date <= end_date)
    return query.order_by(models.MessageSent.sent_date.desc()).all()

def messages_stats(db: Session, hotel_id: int = None, start_date: str = None, end_date: str = None):
    from sqlalchemy import func
    query = db.query(models.MessageSent.hotel_id, func.count(models.MessageSent.id).label('total_messages'))
    if hotel_id:
        query = query.filter(models.MessageSent.hotel_id == hotel_id)
    if start_date:
        query = query.filter(models.MessageSent.sent_date >= start_date)
    if end_date:
        query = query.filter(models.MessageSent.sent_date <= end_date)
    query = query.group_by(models.MessageSent.hotel_id)
    return query.all()

# --- Room Settings CRUD ---
def get_room_settings(db: Session, room_id: int):
    return db.query(models.RoomSettings).filter(models.RoomSettings.room_id == room_id).first()

def create_room_settings(db: Session, settings: schemas.RoomSettingsCreate, room_id: int):
    db_settings = models.RoomSettings(**settings.dict(), room_id=room_id)
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings

def update_room_settings(db: Session, room_id: int, settings_update: schemas.RoomSettingsUpdate):
    db_settings = get_room_settings(db, room_id)
    
    if not db_settings:
        # Dacă nu există setări, le creăm
        settings_dict = settings_update.dict(exclude_unset=True)
        return create_room_settings(db, schemas.RoomSettingsCreate(**settings_dict), room_id)
    
    # Actualizăm setările existente
    for field, value in settings_update.dict(exclude_unset=True).items():
        setattr(db_settings, field, value)
    
    db.commit()
    db.refresh(db_settings)
    return db_settings

# --- Reservations ---
def get_today_reservations(db: Session, room_id: int):
    # Această funcție va fi implementată pentru a obține rezervările de astăzi din calendar
    # În prezent, este doar un stub
    return []

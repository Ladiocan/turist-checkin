from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class MessageSent(Base):
    __tablename__ = 'messages_sent'
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey('hotels.id'), nullable=False)
    room_id = Column(Integer, ForeignKey('rooms.id'), nullable=False)
    sent_date = Column(String, nullable=False)  # ISO date string
    template_name = Column(String, nullable=False)
    status = Column(String, nullable=False)  # ex: 'sent', 'failed'
    content = Column(String, nullable=False)  # mesajul efectiv

class Hotel(Base):
    __tablename__ = 'hotels'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    rooms = relationship('Room', back_populates='hotel')

class Room(Base):
    __tablename__ = 'rooms'
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey('hotels.id'))
    name = Column(String, nullable=False)
    calendar_url = Column(String, nullable=False)
    whatsapp_number = Column(String, nullable=True)  # Acum este opțional, se va prelua din API
    template_name = Column(String, nullable=False)  # Template pentru mesaje WhatsApp - acum obligatoriu
    hotel = relationship('Hotel', back_populates='rooms')
    settings = relationship('RoomSettings', back_populates='room', uselist=False)

class RoomSettings(Base):
    __tablename__ = 'room_settings'
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey('rooms.id'), unique=True)
    auto_send = Column(Boolean, default=True)  # Dacă se trimit mesaje automat
    send_time = Column(String, default='11:00:00')  # Ora la care se trimit mesajele (format HH:MM:SS)
    room = relationship('Room', back_populates='settings')

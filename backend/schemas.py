from pydantic import BaseModel, Field
from typing import Optional, List, Union

class RoomBase(BaseModel):
    name: str
    calendar_url: str
    whatsapp_number: Optional[str] = None  # Acum este opțional, se va prelua din API
    template_name: str  # Template pentru mesaje WhatsApp - acum obligatoriu

class RoomCreate(RoomBase):
    pass

class RoomUpdate(BaseModel):
    name: Optional[str] = None
    calendar_url: Optional[str] = None
    whatsapp_number: Optional[str] = None
    template_name: Optional[str] = None

class Room(RoomBase):
    id: int
    hotel_id: int
    settings: Optional['RoomSettings'] = None
    
    class Config:
        from_attributes = True

class RoomSettingsBase(BaseModel):
    auto_send: bool = True
    send_time: str = '11:00:00'  # Format HH:MM:SS

class RoomSettingsCreate(RoomSettingsBase):
    pass

class RoomSettingsUpdate(BaseModel):
    auto_send: Optional[bool] = None
    send_time: Optional[str] = None

class RoomSettings(RoomSettingsBase):
    id: int
    room_id: int
    
    class Config:
        from_attributes = True

class HotelBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    description: Optional[str] = None

class HotelCreate(HotelBase):
    pass

class HotelUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    description: Optional[str] = None

class Hotel(HotelBase):
    id: int
    rooms: Optional[List[Room]] = []
    class Config:
        from_attributes = True

class MessageSentBase(BaseModel):
    hotel_id: int
    room_id: int
    sent_date: str  # ISO date string
    template_name: str
    status: str
    content: str

class MessageSentCreate(MessageSentBase):
    pass

class MessageSent(MessageSentBase):
    id: int
    class Config:
        from_attributes = True

class MessageSentStats(BaseModel):
    hotel_id: int
    hotel_name: str
    room_id: Optional[int] = None
    room_name: Optional[str] = None
    total_messages: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    
    class Config:
        from_attributes = True

class ReservationBase(BaseModel):
    guest_name: str
    check_in_date: str
    check_out_date: str
    phone: str
    email: Optional[str] = None

class Reservation(ReservationBase):
    id: str  # ID-ul rezervării din calendar
    room_id: int
    
    class Config:
        from_attributes = True

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
import models
from models import Base
import os

# Pentru testare locală folosește SQLite, pentru producție setează MYSQL_URL în .env
MYSQL_URL = os.getenv('MYSQL_URL')
if MYSQL_URL:
    SQLALCHEMY_DATABASE_URL = MYSQL_URL
else:
    SQLALCHEMY_DATABASE_URL = 'sqlite:///./hotel.db'

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith('sqlite') else {}, poolclass=NullPool
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

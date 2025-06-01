from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
import models
from models import Base
import os

# Pentru producție folosește DATABASE_URL de la Render
# Pentru testare locală folosește SQLite
DATABASE_URL = os.getenv('DATABASE_URL')
MYSQL_URL = os.getenv('MYSQL_URL')

if DATABASE_URL:
    # Adaptare URL PostgreSQL pentru SQLAlchemy (Render folosește PostgreSQL)
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URL = DATABASE_URL
    print(f"Using DATABASE_URL from environment")
elif MYSQL_URL:
    SQLALCHEMY_DATABASE_URL = MYSQL_URL
    print(f"Using MYSQL_URL from environment")
else:
    SQLALCHEMY_DATABASE_URL = 'sqlite:///./hotel.db'
    print(f"Using SQLite database")

print(f"Database type: {'SQLite' if SQLALCHEMY_DATABASE_URL.startswith('sqlite') else 'PostgreSQL/MySQL'}")

# Configurare engine SQLAlchemy
connect_args = {}
if SQLALCHEMY_DATABASE_URL.startswith('sqlite'):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args=connect_args, 
    poolclass=NullPool
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

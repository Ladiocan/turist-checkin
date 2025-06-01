#!/bin/bash
# Script de pornire pentru aplicația FastAPI pe Render

# Afișează versiunea Python
echo "Python version:"
python --version

# Afișează directorul curent
echo "Current directory: $(pwd)"

# Afișează conținutul directorului
echo "Directory contents:"
ls -la

# Adaugă directorul curent la PYTHONPATH
export PYTHONPATH=$PYTHONPATH:$(pwd)
echo "PYTHONPATH: $PYTHONPATH"

# Schimbă directorul în backend
cd backend

# Afișează conținutul directorului backend
echo "Backend directory contents:"
ls -la

# Verifică dacă există fișierul __init__.py
if [ ! -f "__init__.py" ]; then
    echo "Creating __init__.py file"
    touch __init__.py
fi

# Verifică variabilele de mediu pentru baza de date
if [ -z "$DATABASE_URL" ]; then
    echo "WARNING: DATABASE_URL is not set. Using SQLite database."
else
    echo "Database URL is configured."
fi

# Pornește aplicația FastAPI
echo "Starting FastAPI application..."
PORT="${PORT:-8000}"
echo "Using port: $PORT"
exec uvicorn main:app --host 0.0.0.0 --port $PORT

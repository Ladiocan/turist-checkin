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

# Schimbă directorul în backend
cd backend

# Afișează conținutul directorului backend
echo "Backend directory contents:"
ls -la

# Pornește aplicația FastAPI
echo "Starting FastAPI application..."
PORT="${PORT:-8000}"
echo "Using port: $PORT"
exec uvicorn main:app --host 0.0.0.0 --port $PORT

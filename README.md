# AI Auto WhatsApp Tourist Assistant

Automatizează mesajele de întâmpinare pentru turiști prin WhatsApp folosind AI.

## Instalare locală

1. Clonează proiectul și intră în director:
   ```bash
   git clone <repo> && cd turist-checkin
   ```

2. **Backend**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # Pe Windows: .\venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

4. Configurare variabile de mediu:
   - Creează un fișier `.env` în directorul `backend/` cu următoarele variabile:
     ```
     SECRET_KEY=your-secret-key
     ALGORITHM=HS256
     ACCESS_TOKEN_EXPIRE_MINUTES=30
     DATABASE_URL=sqlite:///./test.db
     ```
   - Pentru frontend, creează un fișier `.env.local` în directorul `frontend/` cu:
     ```
     REACT_APP_API_BASE_URL=http://localhost:8000
     ```

5. Pornește aplicația:
   - Într-un terminal, din directorul `backend/`:
     ```bash
     uvicorn main:app --reload
     ```
   - Într-un alt terminal, din directorul `frontend/`:
     ```bash
     npm start
     ```

## Deploy pe producție

### Backend (Render.com)
1. Creează un cont pe [Render.com](https://render.com/)
2. Conectează-ți contul GitHub
3. Selectează repository-ul tău
4. Alege "Web Service"
5. Configurează:
   - Nume: `turist-checkin-backend`
   - Regiune: cel mai apropiat de tine
   - Ram: cel mai mic plan (Free)
   - Build Command: `pip install -r backend/requirements.txt`
   - Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
6. Adaugă variabilele de mediu necesare (vezi secțiunea de configurare)
7. Creează un serviciu PostgreSQL în Render și adaugă variabila `DATABASE_URL`

### Frontend (Vercel)
1. Creează un cont pe [Vercel](https://vercel.com/)
2. Conectează-ți contul GitHub
3. Selectează repository-ul tău
4. Configurează:
   - Framework Preset: Create React App
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `build`
5. Adaugă variabilele de mediu:
   - `REACT_APP_API_BASE_URL`: URL-ul backend-ului tău de pe Render (ex: `https://turist-checkin-backend.onrender.com`)
6. Dă click pe Deploy

## Configurare

### Variabile de mediu necesare (Backend)
- `SECRET_KEY`: Cheie secretă pentru semnarea token-urilor JWT
- `ALGORITHM`: Algoritmul pentru JWT (default: HS256)
- `ACCESS_TOKEN_EXMPIRE_MINUTES`: Durata de viață a token-urilor (default: 30)
- `DATABASE_URL`: URL-ul către baza de date (ex: `postgresql://user:password@host:port/dbname`)
- `HUGGINGFACE_API_KEY`: Cheia API de la Hugging Face (pentru răspunsurile AI)

### Variabile de mediu necesare (Frontend)
- `REACT_APP_API_BASE_URL`: URL-ul către backend (ex: `http://localhost:8000` pentru dezvoltare)

## Tehnologii utilizate
- **Backend**: Python, FastAPI, SQLAlchemy, PostgreSQL
- **Frontend**: React, Material-UI, React Router
- **Deploy**: Render.com (Backend), Vercel (Frontend)

## Dezvoltare viitoare
- [ ] Integrare completă WhatsApp Business API
- [ ] Dashboard avansat cu statistici
- [ ] Sisteme de notificări în timp real
- [ ] Integrare cu alte platforme de booking

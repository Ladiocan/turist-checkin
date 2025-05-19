# AI Auto WhatsApp Tourist Assistant

Automatizează mesajele de întâmpinare pentru turiști prin WhatsApp folosind AI.

## Instalare

1. Clonează proiectul și intră în director:
   ```bash
   git clone <repo> && cd touristintransilvania-ai-agent
   ```
2. Creează un mediu virtual și activează-l:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Instalează dependențele:
   ```bash
   pip install -r requirements.txt
   ```
4. Copiază `.env.example` ca `.env` și completează cheile necesare.
   ```bash
   cp .env.example .env
   ```
5. Rulează aplicația:
   ```bash
   python main.py
   ```

## Configurare
- Completează variabilele din `.env` cu URL-urile calendarului și cheia OpenAI.
- Integrează cheia și URL-ul WhatsApp dacă folosești API real.

## Extensii viitoare
- Integrare WhatsApp reală
- Dashboard web pentru monitorizare
- Follow-up review după check-out

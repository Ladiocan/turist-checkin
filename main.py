#import requests
#import openai
#
#
#import os
#import re
#from dotenv import load_dotenv
#from datetime import datetime, timedelta
#import logging
import os
import re
import requests
import openai


import logging
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from icalendar import Calendar

# Configurare logging
logging.basicConfig(
    filename="tourist_assistant.log",
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s: %(message)s"
)

# Load .env
load_dotenv()
hf_token = os.getenv("HUGGINGFACE_API_KEY")
print(f"[DEBUG] HUGGINGFACE_API_KEY loaded: {'SET' if hf_token and len(hf_token) > 10 else 'NOT SET'}")
if not hf_token or len(hf_token) < 10:
    print("[FATAL] HUGGINGFACE_API_KEY lipsă sau invalidă! Oprește execuția.")
    exit(1)

# URL-urile calendar (adaugă câte camere ai nevoie în .env)
calendar_urls = [
    os.getenv("CALENDAR_URL_CAMERA_1"),
    os.getenv("CALENDAR_URL_CAMERA_2"),
]

WHATSAPP_API_KEY = os.getenv("WHATSAPP_API_KEY")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")

# --- Parsare calendar ---
def get_reservations(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        cal = Calendar.from_ical(response.text)
        events = []
        for component in cal.walk():
            if component.name == "VEVENT":
                start = component.get('dtstart').dt
                end = component.get('dtend').dt
                summary = str(component.get('summary'))
                description = str(component.get('description', ''))
                uid = str(component.get('uid'))
                events.append({
                    "start": start,
                    "end": end,
                    "summary": summary,
                    "description": description,
                    "uid": uid
                })
        return events
    except Exception as e:
        logging.error(f"[API] Eroare la accesarea {url}: {str(e)}")
        return []

# --- Normalizează numerele de telefon în format internațional WhatsApp ---
def normalize_phone(phone):
    """
    Normalizează numărul de telefon în format internațional pentru WhatsApp (+CC NNN NNN NNN).
    Acceptă variante cu 0, 0040, +40, spații, liniuțe, etc. și detectează Germania (+49) sau alte țări.
    """
    import re
    if not phone:
        return None
    # Elimină spații, liniuțe, paranteze
    phone = re.sub(r"[\s\-()]+", "", phone)
    # România
    if phone.startswith("+40"):
        return "+40" + phone[3:]
    if phone.startswith("0040"):
        return "+40" + phone[4:]
    if phone.startswith("0") and len(phone) == 10:
        # 07xxxxxxxx
        return "+40" + phone[1:]
    # Germania
    if phone.startswith("+49"):
        return "+49" + phone[3:]
    if phone.startswith("0049"):
        return "+49" + phone[4:]
    if phone.startswith("01") and len(phone) >= 10:
        # 0167xxxxxxx
        return "+49" + phone[1:]
    # Dacă deja începe cu + și are minim 10 cifre, returnează ca atare
    if phone.startswith("+") and len(re.sub(r'\D', '', phone)) >= 10:
        return phone
    # Dacă nu recunoaște formatul, returnează None
    return None

# --- Găsește rezervările pentru mâine ---
def find_upcoming_reservations():
    """
    Găsește toate rezervările viitoare (inclusiv azi) din toate calendarele definite.
    """
    found = []
    now_utc = datetime.now(timezone.utc).date()
    for url in calendar_urls:
        if not url:
            continue
        events = get_reservations(url)
        for event in events:
            desc = event.get('description', '')
            logging.debug(f"[DEBUG] Eveniment brut: {event}")
            print(f"[DEBUG] Eveniment brut: {event}")
            phone_match = re.search(r'Phone:\s*([+\d\s-]+)', desc)
            phone = phone_match.group(1).strip() if phone_match else None
            phone = normalize_phone(phone) if phone else None
            first_name = re.search(r'First Name:\s*(.+)', desc)
            last_name = re.search(r'Last Name:\s*(.+)', desc)
            name = f"{first_name.group(1).strip()} {last_name.group(1).strip()}" if first_name and last_name else "Necunoscut"
            email = re.search(r'Email:\s*(.+)', desc)
            company = re.search(r'Company Name:\s*(.+)', desc)
            notes = re.search(r'Notes:\s*(.+)', desc)
            start_dt = event['start']
            if isinstance(start_dt, datetime):
                if start_dt.tzinfo is None:
                    start_dt = start_dt.replace(tzinfo=timezone.utc)
                start_date = start_dt.date()
            else:
                start_date = start_dt
            logging.debug(f"[DEBUG] Extrase: start={start_date}, name={name}, phone={phone}, email={email.group(1).strip() if email else None}, company={company.group(1).strip() if company else None}, notes={notes.group(1).strip() if notes else None}")
            print(f"[DEBUG] Extrase: start={start_date}, name={name}, phone={phone}, email={email.group(1).strip() if email else None}, company={company.group(1).strip() if company else None}, notes={notes.group(1).strip() if notes else None}")
            if start_date == now_utc and phone:
                found.append({
                    "phone": phone,
                    "name": name,
                    "date": start_date.strftime("%Y-%m-%d"),
                    "email": email.group(1).strip() if email else None,
                    "company": company.group(1).strip() if company else None,
                    "notes": notes.group(1).strip() if notes else None,
                    "raw": event
                })
    logging.info(f"[REZERVARE] Găsite {len(found)} rezervări viitoare")
    return found

# --- Generează mesaj cu HuggingFace Inference API ---
def compose_message(reservation):
    # Compose WhatsApp template parameters for 'schuster' template with header variable
    first_name = reservation['name'].split()[0] if reservation['name'] else ''
    return {
        "name": "oberth",  # WhatsApp template name
        "language": {"code": "ro"},
        "components": [
            {
                "type": "header",
                "parameters": [
                    {"type": "text", "text": first_name}
                ]
            }
        ]
    }

# --- Trimite mesaj pe WhatsApp ---
def send_whatsapp_message(phone, template_payload):
    token = os.getenv("WHATSAPP_API_KEY")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    if not token or not phone_number_id:
        logging.error("Lipsește WHATSAPP_API_KEY sau WHATSAPP_PHONE_NUMBER_ID în .env!")
        print(f"[EROARE] Lipsesc datele WhatsApp API!")
        return
    if not phone:
        logging.warning(f"Număr de telefon lipsă: nu pot trimite mesaj.")
        print(f"[EROARE] Număr de telefon lipsă!")
        return
    url = f"https://graph.facebook.com/v19.0/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": template_payload
    }
    try:
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 200:
            logging.info(f"[WhatsApp] Trimite template 'schuster' către {phone} cu parametri: {template_payload}")
            print(f"[WhatsApp] Trimite template 'schuster' către {phone} cu parametri: {template_payload}")
        else:
            logging.error(f"[WhatsApp] Eroare {response.status_code}: {response.text}")
            print(f"[WhatsApp] Eroare {response.status_code}: {response.text}")
            if response.status_code == 400 and 'Recipient phone number not in allowed list' in response.text:
                print("[WhatsApp] Numărul nu este în lista de destinatari aprobați pe WhatsApp Cloud API.")
    except Exception as e:
        logging.error(f"[WhatsApp] Eroare la request: {e}")
        print(f"[WhatsApp] Eroare la request: {e}")

# --- Flow principal ---
def run_agents():
    print("\n[START] Pornire AI WhatsApp Tourist Assistant")
    print("Configurație:")
    print("\n")

    reservations = find_upcoming_reservations()
    if not reservations:
        print("Nu există rezervări viitoare.")
        return 0
    count = 0
    for res in reservations:
        phone = res['phone']
        template_payload = compose_message(res)
        print(f"[INFO] Trimit mesaj template 'schuster' către {phone} cu parametri: {template_payload}")
        send_whatsapp_message(phone, template_payload)
        count += 1
    return count

def main():
    numar = run_agents()
    print(f"Procesare finalizată. Au fost trimise mesaje pentru {numar} rezervări viitoare.")

if __name__ == "__main__":
    main()

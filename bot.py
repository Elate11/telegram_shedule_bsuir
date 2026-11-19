import os
import sys
import json
import urllib.request
import urllib.parse
import time

TOKEN = "9043821711:AAGqFCyZ5HE-Ccax0Ufn-9zbwW1C4yFAfRM"
WEBAPP_URL = "https://adaptor-trademark-johnston-defines.trycloudflare.com"

def send_message(chat_id, text, reply_markup=None):
    url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"Error sending message: {e}")
        return None

def poll_updates():
    offset = 0
    print("Bot polling started...")
    while True:
        try:
            url = f"https://api.telegram.org/bot{TOKEN}/getUpdates?offset={offset}&timeout=25"
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                for update in data.get("result", []):
                    offset = update["update_id"] + 1
                    msg = update.get("message")
                    if not msg:
                        continue
                    chat_id = msg["chat"]["id"]
                    text = msg.get("text", "")

                    if text.startswith("/start"):
                        keyboard = {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": "📅 Открыть расписание БГУИР",
                                        "web_app": {"url": WEBAPP_URL}
                                    }
                                ]
                            ]
                        }
                        send_message(
                            chat_id,
                            "<b>Расписание занятий БГУИР</b>\n\n"
                            "Нажмите на кнопку ниже, чтобы открыть полноэкранное расписание, зачётку и заметки:",
                            keyboard
                        )
        except Exception as e:
            time.sleep(2)

if __name__ == "__main__":
    poll_updates()

import json
import os
import threading
import time
from datetime import datetime, date, timedelta
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from store import Store
from sync_client import SyncClient
from fingerprint import FingerprintReader

BASE = Path(__file__).resolve().parent
CONFIG = json.loads((BASE / 'config.json').read_text(encoding='utf-8'))
TZ = ZoneInfo(CONFIG.get('timezone', 'America/Mexico_City'))
STORE = Store(BASE / 'checador.db', CONFIG.get('timezone', 'America/Mexico_City'))
SYNC = SyncClient(STORE, CONFIG)
FINGER = FingerprintReader(CONFIG.get('fingerprint') or {})

HTML = (BASE / 'templates' / 'index.html').read_text(encoding='utf-8')

def payload_event(row):
    return {k: row.get(k) for k in ('event_uuid','employee_number','type','timestamp','local_date','method','biometric_ref','confidence','synced','sync_error')}

def json_body(handler):
    length = int(handler.headers.get('content-length') or 0)
    raw = handler.rfile.read(length) if length else b'{}'
    return json.loads(raw.decode('utf-8') or '{}')

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def send_json(self, body, status=200):
        raw = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/':
            raw = HTML.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if path == '/api/status':
            pending = STORE.pending(5000)
            self.send_json({'ok': True, 'device': CONFIG.get('device_name'), 'pending': len(pending), 'recent': [payload_event(x) for x in STORE.recent(20)], 'time': datetime.now(TZ).isoformat()})
            return
        self.send_json({'ok': False, 'error': 'No encontrado'}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = json_body(self)
            if path == '/api/punch':
                row = STORE.record(body.get('employee_number'), body.get('type') or 'auto', body.get('method') or 'numero_empleado', body.get('biometric_ref'), body.get('confidence'), body.get('notes'))
                self.send_json({'ok': True, 'event': payload_event(row)})
                return
            if path == '/api/biometric':
                method = str(body.get('method') or '').strip()
                reference = str(body.get('reference') or '').strip()
                employee = STORE.resolve_biometric(method, reference)
                if not employee:
                    raise ValueError('Biometría no asociada a un trabajador.')
                row = STORE.record(employee, body.get('type') or 'auto', method, reference, body.get('confidence'))
                self.send_json({'ok': True, 'event': payload_event(row)})
                return
            if path == '/api/map-biometric':
                if str(body.get('admin_pin') or '') != str(CONFIG.get('admin_pin') or ''):
                    self.send_json({'ok': False, 'error': 'PIN administrativo no válido.'}, 403)
                    return
                STORE.map_biometric(body.get('method'), body.get('reference'), body.get('employee_number'))
                self.send_json({'ok': True})
                return
            if path == '/api/sync':
                if str(body.get('admin_pin') or '') != str(CONFIG.get('admin_pin') or ''):
                    self.send_json({'ok': False, 'error': 'PIN administrativo no válido.'}, 403)
                    return
                data = SYNC.sync(body.get('sync_type') or 'manual', body.get('finalize_week') is True, body.get('reference_date'))
                self.send_json(data)
                return
            self.send_json({'ok': False, 'error': 'No encontrado'}, 404)
        except Exception as error:
            self.send_json({'ok': False, 'error': str(error)}, 400)

def periodic_sync():
    continuous = bool(CONFIG.get('sync_continuous', True))
    interval = max(60, int(CONFIG.get('sync_interval_seconds', 300)))
    while True:
        try:
            if continuous:
                if STORE.pending(1):
                    SYNC.sync('incremental')
                else:
                    SYNC.ping()
        except Exception:
            pass
        time.sleep(interval)

def payroll_end_for_date(day):
    return day + timedelta(days=(7 - day.weekday()) % 7)

def latest_eligible_payroll_end(now, target_h, target_m):
    monday = now.date() - timedelta(days=now.weekday())
    due = datetime(monday.year, monday.month, monday.day, target_h, target_m, tzinfo=TZ) + timedelta(days=2)
    return monday if now >= due else monday - timedelta(days=7)

def weekly_close():
    clock = str(CONFIG.get('weekly_sync_time', '18:00'))
    target_h, target_m = [int(x) for x in clock.split(':')[:2]]
    while True:
        try:
            now = datetime.now(TZ)
            latest_end = latest_eligible_payroll_end(now, target_h, target_m)
            last_raw = STORE.state_get('last-payroll-closed-end')
            if last_raw:
                next_end = date.fromisoformat(last_raw) + timedelta(days=7)
            else:
                earliest = STORE.earliest_event_date()
                next_end = payroll_end_for_date(date.fromisoformat(earliest)) if earliest else latest_end
            processed = 0
            while next_end <= latest_end and processed < 16:
                key = f'payroll-close-{next_end.isoformat()}'
                if STORE.state_get(key) != '1':
                    reference = next_end + timedelta(days=2)
                    SYNC.sync('cierre_semanal', True, reference.isoformat())
                    STORE.state_set(key, '1')
                STORE.state_set('last-payroll-closed-end', next_end.isoformat())
                next_end += timedelta(days=7)
                processed += 1
        except Exception:
            pass
        time.sleep(60)

def fingerprint_loop():
    try:
        if not FINGER.start():
            return
    except Exception:
        return
    while True:
        try:
            hit = FINGER.identify()
            if hit:
                employee = STORE.resolve_biometric('huella', hit['reference'])
                if employee:
                    STORE.record(employee, 'auto', 'huella', hit['reference'], hit.get('confidence'))
                    FINGER.wait_release()
        except Exception:
            time.sleep(1)
        time.sleep(.15)

def main():
    threading.Thread(target=periodic_sync, daemon=True).start()
    threading.Thread(target=weekly_close, daemon=True).start()
    threading.Thread(target=fingerprint_loop, daemon=True).start()
    server = ThreadingHTTPServer((str(CONFIG.get('bind_host', '127.0.0.1')), int(CONFIG.get('port', 8787))), Handler)
    server.serve_forever()

if __name__ == '__main__':
    main()

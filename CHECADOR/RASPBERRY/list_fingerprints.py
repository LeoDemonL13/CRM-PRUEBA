import json
from pathlib import Path

import serial
import adafruit_fingerprint

from store import Store

BASE = Path(__file__).resolve().parent
CONFIG = json.loads((BASE / 'config.json').read_text(encoding='utf-8'))
FP = CONFIG.get('fingerprint') or {}
STORE = Store(BASE / 'checador.db', CONFIG.get('timezone', 'America/Mexico_City'))


def main():
    uart = serial.Serial(FP.get('serial_port', '/dev/serial0'), baudrate=int(FP.get('baudrate', 57600)), timeout=1)
    sensor = adafruit_fingerprint.Adafruit_Fingerprint(uart)
    if sensor.read_templates() != adafruit_fingerprint.OK:
        raise SystemExit('No se pudo leer el sensor de huella.')
    sensor_ids = {str(value) for value in (sensor.templates or [])}
    rows = STORE.list_biometrics('huella', True)
    mapped = {str(row['reference']): row for row in rows}
    ids = sorted(sensor_ids | set(mapped), key=lambda value: int(value) if value.isdigit() else 999999)
    if not ids:
        print('No hay huellas registradas.')
        return
    print('POSICION | EMPLEADO | SENSOR | MAPEO LOCAL')
    for value in ids:
        employee = mapped.get(value, {}).get('employee_number', '—')
        print(f'{value:>8} | {employee:<16} | {"SI" if value in sensor_ids else "NO":<6} | {"SI" if value in mapped else "NO"}')


if __name__ == '__main__':
    main()

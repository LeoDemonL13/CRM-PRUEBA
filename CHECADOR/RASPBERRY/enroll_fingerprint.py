import json
import sys
import time
from pathlib import Path

import serial
import adafruit_fingerprint

from store import Store

BASE = Path(__file__).resolve().parent
CONFIG = json.loads((BASE / 'config.json').read_text(encoding='utf-8'))
FP = CONFIG.get('fingerprint') or {}
STORE = Store(BASE / 'checador.db', CONFIG.get('timezone', 'America/Mexico_City'))


def wait_image(sensor, remove=False):
    target = adafruit_fingerprint.NOFINGER if remove else adafruit_fingerprint.OK
    while True:
        result = sensor.get_image()
        if result == target:
            return
        time.sleep(0.15)


def capture(sensor, slot):
    print('Coloca el dedo en el sensor...')
    while sensor.get_image() != adafruit_fingerprint.OK:
        time.sleep(0.15)
    if sensor.image_2_tz(slot) != adafruit_fingerprint.OK:
        raise RuntimeError('No se pudo convertir la huella a plantilla.')


def main():
    employee = (sys.argv[1] if len(sys.argv) > 1 else input('Número de empleado: ')).strip()
    position = int(sys.argv[2] if len(sys.argv) > 2 else input('Posición de huella en el sensor (1-127): '))
    if not employee:
        raise SystemExit('Falta número de empleado.')
    if position < 1 or position > 127:
        raise SystemExit('La posición debe estar entre 1 y 127 para este flujo.')
    uart = serial.Serial(FP.get('serial_port', '/dev/serial0'), baudrate=int(FP.get('baudrate', 57600)), timeout=1)
    sensor = adafruit_fingerprint.Adafruit_Fingerprint(uart)
    if sensor.read_templates() != adafruit_fingerprint.OK:
        raise SystemExit('No se pudo leer el sensor de huella.')
    if position in (sensor.templates or []):
        answer = input(f'La posición {position} ya tiene una huella. ¿Reemplazar? [s/N]: ').strip().lower()
        if answer != 's':
            raise SystemExit('Cancelado.')
        sensor.delete_model(position)
    capture(sensor, 1)
    print('Retira el dedo...')
    while sensor.get_image() != adafruit_fingerprint.NOFINGER:
        time.sleep(0.15)
    time.sleep(0.6)
    print('Coloca el mismo dedo nuevamente...')
    capture(sensor, 2)
    if sensor.create_model() != adafruit_fingerprint.OK:
        raise SystemExit('Las dos lecturas no coinciden; vuelve a intentarlo.')
    if sensor.store_model(position) != adafruit_fingerprint.OK:
        raise SystemExit('No se pudo guardar la plantilla dentro del sensor.')
    STORE.map_biometric('huella', str(position), employee)
    print(f'Huella registrada localmente: empleado {employee} → posición {position}.')
    print('La plantilla permanece en el sensor; el CRM solo recibirá la referencia de posición y la checada.')


if __name__ == '__main__':
    main()

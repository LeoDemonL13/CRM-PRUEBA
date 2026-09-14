import json
import sys
from pathlib import Path

import serial
import adafruit_fingerprint

from store import Store

BASE = Path(__file__).resolve().parent
CONFIG = json.loads((BASE / 'config.json').read_text(encoding='utf-8'))
FP = CONFIG.get('fingerprint') or {}
STORE = Store(BASE / 'checador.db', CONFIG.get('timezone', 'America/Mexico_City'))


def main():
    position = int(sys.argv[1] if len(sys.argv) > 1 else input('Posición de huella a eliminar: '))
    if position < 1 or position > 127:
        raise SystemExit('La posición debe estar entre 1 y 127 para este flujo.')
    uart = serial.Serial(FP.get('serial_port', '/dev/serial0'), baudrate=int(FP.get('baudrate', 57600)), timeout=1)
    sensor = adafruit_fingerprint.Adafruit_Fingerprint(uart)
    if sensor.delete_model(position) != adafruit_fingerprint.OK:
        raise SystemExit('No se pudo eliminar la plantilla del sensor.')
    STORE.unmap_biometric('huella', str(position))
    print(f'Huella eliminada: posición {position}. La asociación local quedó desactivada.')


if __name__ == '__main__':
    main()

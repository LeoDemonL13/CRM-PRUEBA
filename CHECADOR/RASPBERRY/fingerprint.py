import time

class FingerprintReader:
    def __init__(self, config):
        self.config = config
        self.sensor = None

    def start(self):
        if not self.config.get('enabled'):
            return False
        import serial
        import adafruit_fingerprint
        uart = serial.Serial(self.config.get('serial_port', '/dev/serial0'), baudrate=int(self.config.get('baudrate', 57600)), timeout=1)
        self.sensor = adafruit_fingerprint.Adafruit_Fingerprint(uart)
        return True

    def identify(self):
        if not self.sensor:
            return None
        import adafruit_fingerprint
        if self.sensor.get_image() != adafruit_fingerprint.OK:
            return None
        if self.sensor.image_2_tz(1) != adafruit_fingerprint.OK:
            return None
        if self.sensor.finger_search() != adafruit_fingerprint.OK:
            return None
        confidence = min(max(float(self.sensor.confidence or 0) / 250.0, 0.0), 1.0)
        return {'reference': str(self.sensor.finger_id), 'confidence': confidence}

    def wait_release(self, seconds=8):
        if not self.sensor:
            return
        import adafruit_fingerprint
        end = time.time() + seconds
        while time.time() < end:
            if self.sensor.get_image() == adafruit_fingerprint.NOFINGER:
                return
            time.sleep(.12)

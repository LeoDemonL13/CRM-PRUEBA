import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

class Store:
    def __init__(self, path, timezone='America/Mexico_City'):
        self.path = str(Path(path))
        self.tz = ZoneInfo(timezone)
        self._init()

    def db(self):
        conn = sqlite3.connect(self.path, timeout=15)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self):
        with self.db() as conn:
            conn.executescript('''
            pragma journal_mode=WAL;
            create table if not exists events(
              event_uuid text primary key,
              employee_number text not null,
              type text not null,
              timestamp text not null,
              local_date text not null,
              method text not null,
              biometric_ref text,
              confidence real,
              notes text,
              synced integer not null default 0,
              sync_error text,
              created_at text not null
            );
            create index if not exists events_pending_idx on events(synced, timestamp);
            create index if not exists events_employee_date_idx on events(employee_number, local_date, timestamp);
            create table if not exists biometrics(
              method text not null,
              reference text not null,
              employee_number text not null,
              active integer not null default 1,
              created_at text not null,
              primary key(method, reference)
            );
            create table if not exists state(key text primary key, value text);
            create table if not exists sync_history(
              id integer primary key autoincrement,
              batch_uuid text not null,
              sync_type text not null,
              sent integer not null default 0,
              accepted integer not null default 0,
              rejected integer not null default 0,
              response text,
              created_at text not null
            );
            ''')

    def now(self):
        return datetime.now(self.tz)

    def record(self, employee_number, kind='auto', method='numero_empleado', biometric_ref=None, confidence=None, notes=None):
        employee_number = str(employee_number or '').strip()
        if not employee_number:
            raise ValueError('Falta número de empleado.')
        now = self.now()
        day = now.date().isoformat()
        with self.db() as conn:
            last = conn.execute('select type,timestamp from events where employee_number=? and local_date=? order by timestamp desc limit 1', (employee_number, day)).fetchone()
            if last and last['timestamp']:
                try:
                    previous = datetime.fromisoformat(str(last['timestamp']))
                    if (now - previous).total_seconds() < 10:
                        raise ValueError('Espera unos segundos antes de volver a checar.')
                except ValueError as error:
                    if 'Espera unos segundos' in str(error):
                        raise
                except Exception:
                    pass
            if kind == 'auto':
                kind = 'entrada' if not last or last['type'] == 'salida' else 'salida'
            if kind not in ('entrada', 'salida'):
                raise ValueError('Tipo de checada no válido.')
            if last and last['type'] == kind:
                raise ValueError(f'La última checada de hoy ya es {kind}.')
            if kind == 'salida' and not last:
                raise ValueError('Primero debe registrarse una entrada.')
            event_uuid = str(uuid.uuid4())
            conn.execute('insert into events(event_uuid,employee_number,type,timestamp,local_date,method,biometric_ref,confidence,notes,created_at) values(?,?,?,?,?,?,?,?,?,?)', (
                event_uuid, employee_number, kind, now.isoformat(), day, method, biometric_ref, confidence, notes, now.isoformat()
            ))
        return self.get_event(event_uuid)

    def get_event(self, event_uuid):
        with self.db() as conn:
            row = conn.execute('select * from events where event_uuid=?', (event_uuid,)).fetchone()
            return dict(row) if row else None

    def recent(self, limit=50):
        with self.db() as conn:
            return [dict(x) for x in conn.execute('select * from events order by timestamp desc limit ?', (int(limit),)).fetchall()]

    def pending(self, limit=2000):
        with self.db() as conn:
            return [dict(x) for x in conn.execute('select * from events where synced=0 order by timestamp asc limit ?', (int(limit),)).fetchall()]

    def earliest_event_date(self):
        with self.db() as conn:
            row = conn.execute('select min(local_date) as day from events').fetchone()
            return row['day'] if row and row['day'] else None

    def pending_count(self):
        with self.db() as conn:
            row = conn.execute('select count(*) as total from events where synced=0').fetchone()
            return int(row['total'] if row else 0)

    def mark_synced(self, event_uuids):
        if not event_uuids:
            return
        with self.db() as conn:
            conn.executemany('update events set synced=1,sync_error=null where event_uuid=?', [(x,) for x in event_uuids])

    def mark_error(self, event_uuid, message):
        with self.db() as conn:
            conn.execute('update events set sync_error=? where event_uuid=?', (str(message)[:500], event_uuid))

    def map_biometric(self, method, reference, employee_number):
        with self.db() as conn:
            conn.execute('insert into biometrics(method,reference,employee_number,active,created_at) values(?,?,?,?,?) on conflict(method,reference) do update set employee_number=excluded.employee_number,active=1', (
                str(method), str(reference), str(employee_number).strip(), 1, self.now().isoformat()
            ))

    def resolve_biometric(self, method, reference):
        with self.db() as conn:
            row = conn.execute('select employee_number from biometrics where method=? and reference=? and active=1', (str(method), str(reference))).fetchone()
            return row['employee_number'] if row else None

    def list_biometrics(self, method=None, active_only=True):
        sql = 'select method,reference,employee_number,active,created_at from biometrics'
        values = []
        filters = []
        if method:
            filters.append('method=?')
            values.append(str(method))
        if active_only:
            filters.append('active=1')
        if filters:
            sql += ' where ' + ' and '.join(filters)
        sql += ' order by method, cast(reference as integer), reference'
        with self.db() as conn:
            return [dict(row) for row in conn.execute(sql, values).fetchall()]

    def unmap_biometric(self, method, reference):
        with self.db() as conn:
            conn.execute('update biometrics set active=0 where method=? and reference=?', (str(method), str(reference)))

    def state_get(self, key, default=None):
        with self.db() as conn:
            row = conn.execute('select value from state where key=?', (key,)).fetchone()
            return row['value'] if row else default

    def state_set(self, key, value):
        with self.db() as conn:
            conn.execute('insert into state(key,value) values(?,?) on conflict(key) do update set value=excluded.value', (key, str(value)))

    def log_sync(self, batch_uuid, sync_type, sent, accepted, rejected, response):
        with self.db() as conn:
            conn.execute('insert into sync_history(batch_uuid,sync_type,sent,accepted,rejected,response,created_at) values(?,?,?,?,?,?,?)', (
                batch_uuid, sync_type, sent, accepted, rejected, str(response)[:8000], self.now().isoformat()
            ))

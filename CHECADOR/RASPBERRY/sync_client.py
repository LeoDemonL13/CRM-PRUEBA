import json
import uuid
import urllib.request
import urllib.error

class SyncClient:
    def __init__(self, store, config):
        self.store = store
        self.config = config

    def _post(self, payload, timeout=30):
        body = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(self.config['sync_url'], data=body, method='POST', headers={
            'Content-Type': 'application/json',
            'x-device-code': self.config['device_code'],
            'x-device-token': self.config['device_token']
        })
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.status, json.loads(response.read().decode('utf-8') or '{}')
        except urllib.error.HTTPError as error:
            raw = error.read().decode('utf-8', errors='replace')
            try:
                data = json.loads(raw)
            except Exception:
                data = {'error': raw or str(error)}
            return error.code, data

    def ping(self):
        return self._post({'ping': True, 'firmware': '75.0-raspberry', 'pending_count': self.store.pending_count(), 'source': 'raspberry-local-first'})

    def _send_rows(self, rows, sync_type='incremental', finalize_week=False, reference_date=None):
        batch_uuid = str(uuid.uuid4())
        events = [{
            'event_uuid': row['event_uuid'],
            'employee_number': row['employee_number'],
            'type': row['type'],
            'timestamp': row['timestamp'],
            'method': row['method'],
            'biometric_ref': row['biometric_ref'],
            'confidence': row['confidence'],
            'notes': row['notes']
        } for row in rows]
        payload = {
            'batch_uuid': batch_uuid,
            'sync_type': sync_type,
            'finalize_week': bool(finalize_week),
            'reference_date': reference_date,
            'firmware': '75.0-raspberry',
            'source': 'raspberry-local-first',
            'pending_count': self.store.pending_count(),
            'events': events
        }
        status, data = self._post(payload, timeout=60)
        error_by_uuid = {str(x.get('event_uuid')): str(x.get('error')) for x in data.get('errors', []) if x.get('event_uuid')}
        if status in (200, 207) and data.get('ok'):
            accepted = []
            for row in rows:
                if row['event_uuid'] in error_by_uuid:
                    self.store.mark_error(row['event_uuid'], error_by_uuid[row['event_uuid']])
                else:
                    accepted.append(row['event_uuid'])
            self.store.mark_synced(accepted)
            self.store.log_sync(batch_uuid, sync_type, len(rows), len(accepted), len(error_by_uuid), data)
            return data
        self.store.log_sync(batch_uuid, sync_type, len(rows), 0, len(rows), data)
        raise RuntimeError(data.get('error') or f'HTTP {status}')

    def sync(self, sync_type='incremental', finalize_week=False, reference_date=None):
        if not finalize_week:
            return self._send_rows(self.store.pending(2000), sync_type, False, reference_date)

        total_inserted = total_duplicates = 0
        while True:
            rows = self.store.pending(2000)
            if not rows:
                break
            data = self._send_rows(rows, 'incremental', False, reference_date)
            total_inserted += int(data.get('inserted') or 0)
            total_duplicates += int(data.get('duplicates') or 0)
            if int(data.get('rejected') or 0) > 0:
                raise RuntimeError('Hay checadas rechazadas pendientes. Corrige los trabajadores o la identificación antes de cerrar la semana.')
            if len(rows) < 2000:
                break

        closure = self._send_rows([], sync_type, True, reference_date)
        closure['flushed_inserted'] = total_inserted
        closure['flushed_duplicates'] = total_duplicates
        return closure

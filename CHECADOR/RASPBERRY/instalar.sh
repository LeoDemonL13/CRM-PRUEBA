#!/bin/sh
set -eu
sudo apt-get update
sudo apt-get install -y python3 python3-venv
sudo useradd -r -m -s /usr/sbin/nologin skilled 2>/dev/null || true
sudo usermod -a -G dialout,video skilled 2>/dev/null || true
sudo mkdir -p /opt/skilled-checador
sudo cp -R ./* /opt/skilled-checador/
sudo python3 -m venv /opt/skilled-checador/.venv
sudo /opt/skilled-checador/.venv/bin/pip install --upgrade pip
sudo /opt/skilled-checador/.venv/bin/pip install -r /opt/skilled-checador/requirements.txt
sudo chown -R skilled:skilled /opt/skilled-checador
sudo chmod 600 /opt/skilled-checador/config.json
sudo cp /opt/skilled-checador/skilled-checador.service /etc/systemd/system/skilled-checador.service
sudo systemctl daemon-reload
sudo systemctl enable skilled-checador.service
sudo systemctl restart skilled-checador.service
printf '%s\n' 'Checador instalado en /opt/skilled-checador.'
printf '%s\n' 'Edita config.json con código/token/URL y reinicia: sudo systemctl restart skilled-checador'
printf '%s\n' 'Para registrar huella: sudo -u skilled /opt/skilled-checador/.venv/bin/python /opt/skilled-checador/enroll_fingerprint.py EMPLEADO POSICION'
printf '%s\n' 'Para listar huellas: sudo -u skilled /opt/skilled-checador/.venv/bin/python /opt/skilled-checador/list_fingerprints.py'
printf '%s\n' 'Para eliminar huella: sudo -u skilled /opt/skilled-checador/.venv/bin/python /opt/skilled-checador/delete_fingerprint.py POSICION'

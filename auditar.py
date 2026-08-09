from pathlib import Path
from bs4 import BeautifulSoup
from collections import Counter
import subprocess
import tempfile
import os

root = Path(__file__).resolve().parent
missing = []
duplicates = []
inline_errors = []

for page in root.glob('*.html'):
    soup = BeautifulSoup(page.read_text(encoding='utf-8', errors='ignore'), 'html.parser')
    ids = [node.get('id') for node in soup.find_all(attrs={'id': True})]
    repeated = [value for value, count in Counter(ids).items() if count > 1]
    if repeated:
        duplicates.append((page.name, repeated))

    for tag, attribute in [('script', 'src'), ('link', 'href'), ('img', 'src'), ('a', 'href')]:
        for node in soup.find_all(tag):
            value = node.get(attribute)
            if not value or value.startswith(('http://', 'https://', 'data:', '#', 'mailto:', 'javascript:')):
                continue
            relative = value.split('?')[0].split('#')[0]
            if relative and not (root / relative).exists():
                missing.append((page.name, value))

    for index, script in enumerate(soup.find_all('script')):
        if script.get('src'):
            continue
        script_type = (script.get('type') or '').lower()
        if script_type and 'javascript' not in script_type and script_type != 'module':
            continue
        code = script.string if script.string is not None else script.get_text()
        if not code.strip():
            continue
        descriptor, temporary = tempfile.mkstemp(suffix='.js')
        os.close(descriptor)
        Path(temporary).write_text(code, encoding='utf-8')
        result = subprocess.run(['node', '--check', temporary], capture_output=True, text=True)
        os.unlink(temporary)
        if result.returncode:
            inline_errors.append((page.name, index, result.stderr))

external_errors = []
for script in root.glob('*.js'):
    result = subprocess.run(['node', '--check', str(script)], capture_output=True, text=True)
    if result.returncode:
        external_errors.append((script.name, result.stderr))

print(f'HTML: {len(list(root.glob("*.html")))}')
print(f'JavaScript externos con error: {len(external_errors)}')
print(f'JavaScript internos con error: {len(inline_errors)}')
print(f'Referencias locales faltantes: {len(missing)}')
print(f'Páginas con IDs duplicados: {len(duplicates)}')

for group in (external_errors, inline_errors, missing, duplicates):
    for item in group:
        print(item)

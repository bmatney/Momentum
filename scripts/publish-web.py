"""Publish the built web app without changing the app-source branch."""
import base64
import json
import subprocess
from pathlib import Path

REPO = 'repos/bmatney/Momentum'

def api(path, payload=None, method=None):
    command = ['gh', 'api', path]
    if payload is not None:
        command += ['--method', method or 'POST', '--input', '-']
    result = subprocess.run(command, input=json.dumps(payload) if payload is not None else None,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout)

head = api(REPO + '/git/ref/heads/gh-pages')['object']['sha']
base = api(REPO + '/git/commits/' + head)['tree']['sha']
entries = []
root = Path('work/web-dist')
assert (root / 'sw.js').is_file(), 'Run npm run build:web first'
for path in sorted(root.rglob('*')):
    if path.is_file():
        blob = api(REPO + '/git/blobs', {'content': base64.b64encode(path.read_bytes()).decode(), 'encoding': 'base64'})
        entries.append({'path': path.relative_to(root).as_posix(), 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
play = api(REPO + '/git/trees', {'tree': entries})
tree = api(REPO + '/git/trees', {'base_tree': base, 'tree': [{'path': 'play', 'mode': '040000', 'type': 'tree', 'sha': play['sha']}]})
commit = api(REPO + '/git/commits', {'message': 'Publish installable offline web app', 'tree': tree['sha'], 'parents': [head], 'author': {'name': 'Momentum', 'email': 'momentumuvs@gmail.com'}})
api(REPO + '/git/refs/heads/gh-pages', {'sha': commit['sha'], 'force': False}, 'PATCH')
print('Published commit ' + commit['sha'])

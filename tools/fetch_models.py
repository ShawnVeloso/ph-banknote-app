"""Download the model files that this repository does not include.

Some models in web/models/models.json cannot be shared in this repository because their
license does not allow it. Their entries have a "download" block with the official URL and
the SHA-256 of the file. This script downloads each missing file and checks its hash.

Usage (from the repository root):  python tools/fetch_models.py
Needs Python 3 only. Files that are already present and match their hash are skipped.
"""
import hashlib
import json
import os
import sys
import urllib.request

MODELS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'models')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def main():
    with open(os.path.join(MODELS, 'models.json'), encoding='utf-8') as f:
        models = json.load(f)['models']
    failed = 0
    for m in models:
        dl = m.get('download')
        if not dl:
            continue
        path = os.path.join(MODELS, m['file'])
        if os.path.exists(path) and sha256(path) == dl['sha256']:
            print('ok      %s (already here)' % m['file'])
            continue
        print('fetch   %s\n        from %s' % (m['file'], dl['url']))
        if dl.get('license'):
            print('        license: %s' % dl['license'])
        tmp = path + '.part'
        try:
            urllib.request.urlretrieve(dl['url'], tmp)
        except OSError as e:
            print('FAIL    download failed: %s' % e)
            failed += 1
            continue
        got = sha256(tmp)
        if got != dl['sha256']:
            os.remove(tmp)
            print('FAIL    SHA-256 is %s, expected %s. The file at that URL has changed.' % (got, dl['sha256']))
            failed += 1
            continue
        os.replace(tmp, path)
        print('ok      %s' % m['file'])
    if failed:
        sys.exit('%d model(s) could not be fetched.' % failed)


if __name__ == '__main__':
    main()

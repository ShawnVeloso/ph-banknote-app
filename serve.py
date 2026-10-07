"""Run Php Scanner on this PC.

Serves the web/ folder at http://127.0.0.1:8080 (this PC only) and opens it in the
default browser. The camera works there because browsers treat 127.0.0.1 as secure.

Usage:  python serve.py [port] [--no-browser]     or double-click start.bat
Stop:   Ctrl+C, or close the window.
"""
import functools
import http.server
import os
import sys
import threading
import webbrowser

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.wasm': 'application/wasm',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
        '.woff2': 'font/woff2',
        '.svg': 'image/svg+xml',
        '.tflite': 'application/octet-stream',
    }

    def end_headers(self):
        # Always check for a newer file, so an edit shows after a reload.
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        if len(args) > 1 and str(args[1])[:1] in '45':
            sys.stderr.write('  %s\n' % (fmt % args))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    port = int(args[0]) if args else 8080
    handler = functools.partial(Handler, directory=ROOT)
    httpd = None
    for p in range(port, port + 20):
        try:
            httpd = http.server.ThreadingHTTPServer(('127.0.0.1', p), handler)
            break
        except OSError:
            continue
    if httpd is None:
        sys.exit('No free port between %d and %d.' % (port, port + 19))
    url = 'http://127.0.0.1:%d/' % httpd.server_address[1]
    print('Php Scanner is running at %s' % url)
    print('Open it in Chrome or Edge. Keep this window open; press Ctrl+C to stop.')
    if '--no-browser' not in sys.argv:
        threading.Timer(0.6, webbrowser.open, [url]).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')


if __name__ == '__main__':
    main()

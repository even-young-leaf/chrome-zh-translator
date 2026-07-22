#!/usr/bin/env python3
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


HOST = "127.0.0.1"
PORT = 11888
SOURCE = "en"
TARGET = "zh"


def ensure_translation():
    import argostranslate.package
    import argostranslate.translate

    installed = argostranslate.translate.get_installed_languages()
    source = next((lang for lang in installed if lang.code == SOURCE), None)
    target = next((lang for lang in installed if lang.code == TARGET), None)
    if source and target and source.get_translation(target):
        return source.get_translation(target)

    print("Preparing Argos en->zh translation package...", file=sys.stderr, flush=True)
    argostranslate.package.update_package_index()
    packages = argostranslate.package.get_available_packages()
    package = next((pkg for pkg in packages if pkg.from_code == SOURCE and pkg.to_code == TARGET), None)
    if not package:
        raise RuntimeError("No Argos en->zh package is available")

    path = package.download()
    argostranslate.package.install_from_path(path)

    installed = argostranslate.translate.get_installed_languages()
    source = next((lang for lang in installed if lang.code == SOURCE), None)
    target = next((lang for lang in installed if lang.code == TARGET), None)
    if not source or not target:
        raise RuntimeError("Argos en->zh package installed but language lookup failed")
    return source.get_translation(target)


TRANSLATION = ensure_translation()


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path != "/health":
            self.send_json({"ok": False, "error": "not found"}, status=404)
            return
        self.send_json({"ok": True, "engine": "argos", "source": SOURCE, "target": TARGET})

    def do_POST(self):
        if self.path != "/translate":
            self.send_json({"ok": False, "error": "not found"}, status=404)
            return

        try:
            length = int(self.headers.get("content-length", "0"))
            body = self.rfile.read(length)
            payload = json.loads(body.decode("utf-8"))
            texts = payload.get("texts", [])
            if not isinstance(texts, list):
                raise ValueError("texts must be a list")

            translations = [TRANSLATION.translate(str(text or "")) for text in texts]
            self.send_json({"ok": True, "translations": translations})
        except Exception as error:
            self.send_json({"ok": False, "error": str(error)}, status=500)

    def send_json(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_cors_headers(self):
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
        self.send_header("access-control-allow-headers", "content-type")

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), file=sys.stderr)


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Argos NMT service listening on http://{HOST}:{PORT}", file=sys.stderr, flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Serve the report locally, including byte ranges for video seeking."""
import argparse
import os
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


MEDIA = (".mp4", ".webp", ".jpg", ".png", ".glb", ".ttf", ".svg")


class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)
        self._remaining, self._etag = None, None
        if not os.path.isfile(path):
            return super().send_head()
        st = os.stat(path)
        self._etag = f'"{st.st_size:x}-{st.st_mtime_ns:x}"'  # a rebuilt file is a new resource
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        if self.headers.get("If-None-Match") == self._etag:
            self.send_response(304)
            self.end_headers()
            return None
        if not match or self.headers.get("If-Range", self._etag) != self._etag:
            return super().send_head()
        size = st.st_size
        if match.group(1):
            start, end = int(match.group(1)), int(match.group(2) or size - 1)
        else:
            start, end = max(0, size - int(match.group(2) or 0)), size - 1
        if start >= size or start > end:
            self.send_error(416, headers={"Content-Range": f"bytes */{size}"})
            return None
        end = min(end, size - 1)
        source = open(path, "rb")
        source.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._remaining = end - start + 1
        return source

    def copyfile(self, source, outputfile):
        if self._remaining is None:
            return super().copyfile(source, outputfile)
        while self._remaining > 0:
            chunk = source.read(min(1024 * 1024, self._remaining))
            if not chunk:
                break
            try:
                outputfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                break
            self._remaining -= len(chunk)

    def end_headers(self):
        # Page code and data are never reused; media are revalidated against their ETag.
        media = getattr(self, "path", "").split("?")[0].endswith(MEDIA)
        self.send_header("Cache-Control", "no-cache" if media else "no-store")
        if getattr(self, "_etag", None):
            self.send_header("ETag", self._etag)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    handler = partial(RangeHandler, directory=str(root))
    while True:
        try:
            server = ThreadingHTTPServer((args.host, args.port), handler)
            break
        except OSError as error:
            if error.errno != 98 or args.port == 0:
                raise
            print(f"Port {args.port} is occupied; trying {args.port + 1}. Open the URL printed below.", flush=True)
            args.port += 1
    print(f"BoschDreams report → http://localhost:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()

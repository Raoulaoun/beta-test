"""Production entry point: `python -m manager_test.serve`.

Listens on $PORT on one dual-stack socket: IPv6 for Railway's private network and IPv4
for the health check. IPV6_V6ONLY is cleared explicitly, so a host whose default is
IPv6-only still accepts IPv4. Falls back to 0.0.0.0 where IPv6 is unavailable.
Access logs stay off: request lines are not needed and bodies are never logged.
"""

import os
import socket

import uvicorn


def listening_socket(port: int) -> socket.socket:
    if socket.has_ipv6:
        s = None
        try:
            s = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
            s.bind(("::", port))
            return s
        except OSError:
            if s is not None:
                s.close()
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", port))
    return s


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    sock = listening_socket(port)
    family = "IPv6 + IPv4" if sock.family == socket.AF_INET6 else "IPv4"
    print(f"Listening on port {port} ({family})", flush=True)
    config = uvicorn.Config("manager_test.api:app", access_log=False, proxy_headers=True, forwarded_allow_ips="*")
    uvicorn.Server(config).run(sockets=[sock])


if __name__ == "__main__":
    main()

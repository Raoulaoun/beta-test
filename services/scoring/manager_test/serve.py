"""Production entry point: `python -m manager_test.serve`.

Listens on $PORT. Binds :: (IPv6, which also accepts IPv4 on Linux) so Railway's
private network can reach it, and falls back to 0.0.0.0 where IPv6 is unavailable.
Access logs stay off: request lines are not needed and bodies are never logged.
"""

import os
import socket

import uvicorn


def pick_host() -> str:
    if not socket.has_ipv6:
        return "0.0.0.0"
    try:
        with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as s:
            s.bind(("::", 0))
        return "::"
    except OSError:
        return "0.0.0.0"


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("manager_test.api:app", host=pick_host(), port=port, access_log=False,
                proxy_headers=True, forwarded_allow_ips="*")


if __name__ == "__main__":
    main()

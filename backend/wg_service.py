import os
import re
import subprocess
import sqlite3
import time
from datetime import datetime

DB_PATH = os.getenv("DB_PATH", "data/kweek.db")
WG_INTERFACE = os.getenv("WG_INTERFACE", "wg0")
WG_CONFIG = f"/etc/wireguard/{WG_INTERFACE}.conf"
SERVER_ENDPOINT = os.getenv("SERVER_ENDPOINT", "127.0.0.1:51820")

HARDWARE_SENTINEL = "HARDWARE_ROUTER_EXTERNAL_KEY"

def _conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    with _conn() as c:
        c.execute("""
        CREATE TABLE IF NOT EXISTS wg_peers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            public_key TEXT UNIQUE NOT NULL,
            private_key TEXT,
            preshared_key TEXT,
            allocated_ips TEXT NOT NULL,
            expiry_date TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        )""")
        c.commit()

def sync_kernel():
    if not os.path.exists(WG_CONFIG):
        return

    with open(WG_CONFIG, "r") as f:
        current_conf = f.read()

    iface_match = re.search(r'(\[Interface\].*?)(?=\n\[Peer\]|$)', current_conf, re.DOTALL)
    iface_block = iface_match.group(1).strip() if iface_match else ""

    with _conn() as c:
        rows = c.execute("SELECT * FROM wg_peers WHERE enabled=1").fetchall()

    peers_block = ""
    for r in rows:
        if not r['allocated_ips'] or r['allocated_ips'].strip() == '(none)': continue
        peers_block += f"\n# {r['name']}\n[Peer]\nPublicKey = {r['public_key']}\n"
        peers_block += f"AllowedIPs = {r['allocated_ips'].replace(' ', '')}\n"

    with open(WG_CONFIG, "w") as f:
        f.write(iface_block + "\n\n" + peers_block.strip() + "\n")
    os.chmod(WG_CONFIG, 0o600)

    subprocess.run(f"wg-quick strip {WG_CONFIG} > /tmp/wg0.stripped && wg syncconf {WG_INTERFACE} /tmp/wg0.stripped && rm /tmp/wg0.stripped", shell=True, capture_output=True)

def list_peers():
    with _conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM wg_peers ORDER BY id DESC").fetchall()]

def get_peer_status():
    status = {}
    try:
        output = subprocess.check_output(["wg", "show", WG_INTERFACE, "dump"], stderr=subprocess.DEVNULL, text=True)
        for line in output.strip().split("\n")[1:]:
            parts = line.split()
            if len(parts) < 8: continue
            is_online = (int(parts[4]) > 0 and (time.time() - int(parts[4])) < 180)
            status[parts[0]] = {
                "latest_handshake": int(parts[4]), "is_online": is_online
            }
    except Exception: pass
    return status

def generate_client_config(peer_id) -> str:
    with _conn() as c:
        r = c.execute("SELECT * FROM wg_peers WHERE id=?", (peer_id,)).fetchone()
    if not r: raise ValueError("peer not found")

    server_priv = ""
    if os.path.exists(WG_CONFIG):
        m = re.search(r"PrivateKey\s*=\s*(\S+)", open(WG_CONFIG).read())
        if m: server_priv = m.group(1)
    if not server_priv: raise ValueError("Server Private Key not found")

    server_pub = subprocess.run(["wg", "pubkey"], input=server_priv.encode(), capture_output=True).stdout.decode().strip()
    
    allowed_ips = "0.0.0.0/0" if r["private_key"] != HARDWARE_SENTINEL else "10.0.0.0/24"
    private_key_display = r['private_key'] if r['private_key'] != HARDWARE_SENTINEL else '<PASTE_ROUTER_PRIVATE_KEY_HERE>'

    return (
        f"[Interface]\nPrivateKey = {private_key_display}\nAddress = {r['allocated_ips'].split(',')[0].strip()}\nDNS = 1.1.1.1\n\n"
        f"[Peer]\nPublicKey = {server_pub}\nEndpoint = {SERVER_ENDPOINT}\nAllowedIPs = {allowed_ips}\nPersistentKeepalive = 25\n"
    )
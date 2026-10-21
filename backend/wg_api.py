from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
import wg_service
import subprocess

router = APIRouter()
wg_service.init_db()

class PeerCreate(BaseModel):
    name: str
    allocated_ips: str
    custom_public_key: Optional[str] = None

@router.get("/peers")
def list_peers():
    db_peers = wg_service.list_peers()
    kernel_status = wg_service.get_peer_status()
    for peer in db_peers:
        peer.update(kernel_status.get(peer['public_key'], {"latest_handshake": 0, "is_online": False}))
    return db_peers

@router.post("/peers")
def create_peer(payload: PeerCreate):
    with wg_service._conn() as c:
        if payload.custom_public_key:
            pub = payload.custom_public_key.strip()
            priv = wg_service.HARDWARE_SENTINEL
        else:
            priv = subprocess.check_output(["wg", "genkey"]).decode().strip()
            pub = subprocess.run(["wg", "pubkey"], input=priv.encode(), capture_output=True).stdout.decode().strip()

        cur = c.execute("""
            INSERT INTO wg_peers (name, public_key, private_key, allocated_ips, expiry_date)
            VALUES (?,?,?,?,'31-Dec-2026')
        """, (payload.name, pub, priv, payload.allocated_ips))
        c.commit()
        peer_id = cur.lastrowid
    wg_service.sync_kernel()
    return {"id": peer_id, "status": "created"}

@router.get("/peers/{peer_id}/config")
def download_config(peer_id: int):
    try:
        body = wg_service.generate_client_config(peer_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return PlainTextResponse(body, media_type="text/plain")
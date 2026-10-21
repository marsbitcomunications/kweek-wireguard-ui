import wg_service
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [Expiry] %(message)s")

def run():
    logging.info("Starting WireGuard expiry check...")
    with wg_service._conn() as c:
        rows = c.execute("SELECT id, name, expiry_date FROM wg_peers WHERE enabled=1").fetchall()
        count = 0
        for r in rows:
            try:
                exp_date = datetime.strptime(r["expiry_date"], "%d-%b-%Y")
                if exp_date < datetime.now():
                    c.execute("UPDATE wg_peers SET enabled=0 WHERE id=?", (r["id"],))
                    count += 1
            except ValueError:
                pass
        c.commit()
    if count > 0:
        wg_service.sync_kernel()
        logging.info(f"Revoked {count} expired peers.")
    else:
        logging.info("No expired peers found.")

if __name__ == "__main__":
    run()
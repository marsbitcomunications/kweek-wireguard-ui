import os
import sys
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from wg_api import router

app = FastAPI(title="kweek_Wireguard-UI")

# Register API routes
app.include_router(router, prefix="/api")

# Determine base path for PyInstaller bundle vs local execution
if getattr(sys, 'frozen', False):
    # Running in a PyInstaller bundle
    base_path = sys._MEIPASS
else:
    # Running in a normal Python environment
    base_path = os.path.abspath(".")

# Mount the frontend
frontend_dir = os.path.join(base_path, "frontend_dist")

if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")
    print(f"✅ Successfully mounted frontend from {frontend_dir}")
else:
    print(f"⚠️ Warning: frontend_dist not found at {frontend_dir}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

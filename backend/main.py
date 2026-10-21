import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from wg_api import router

app = FastAPI(title="kweek_Wireguard-UI")

# Register API routes
app.include_router(router, prefix="/api")

# Serve the React static files if they exist (for the single binary)
if os.path.exists("frontend_dist"):
    app.mount("/", StaticFiles(directory="frontend_dist", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
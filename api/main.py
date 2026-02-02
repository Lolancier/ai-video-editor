from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api.routers import video, tasks
from api.config import get_settings
import os

app = FastAPI(title="AI Video Editor API", version="1.0.0")

settings = get_settings()

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware to ensure CORS headers are present on all responses (especially static files)
@app.middleware("http")
async def add_cors_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    # Fix for ORB (Opaque Response Blocking)
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin" 
    return response

# Mount static files for uploads
# This allows accessing uploaded videos via http://localhost:8000/uploads/filename
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
app.mount("/outputs", StaticFiles(directory=settings.OUTPUT_DIR), name="outputs")

@app.get("/")
async def root():
    return {"message": "Welcome to AI Video Editor API"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Include routers
app.include_router(video.router)
app.include_router(tasks.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

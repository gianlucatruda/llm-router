"""Main FastAPI application for LLM Router."""

import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db
from routers import chat, conversations, usage


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="LLM Router",
    description="Self-hosted chat interface for multiple LLM providers",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(usage.router)

@app.middleware("http")
async def device_id_middleware(request: Request, call_next):
    device_id = request.cookies.get("device_id")
    if not device_id:
        device_id = str(uuid.uuid4())
    request.state.device_id = device_id
    response = await call_next(request)
    if "device_id" not in request.cookies:
        response.set_cookie("device_id", device_id, samesite="lax")
    return response


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# Serve static files (frontend) - only when static directory exists
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    # Mount static files and serve index.html for SPA routes
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

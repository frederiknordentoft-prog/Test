"""Live frame streaming over WebSocket (coalesced, latest frame wins)."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.runner import REGISTRY

router = APIRouter()


@router.websocket("/api/runs/{run_id}/ws")
async def run_ws(websocket: WebSocket, run_id: str):
    try:
        handle = REGISTRY.get(run_id)
    except KeyError:
        await websocket.close(code=4404)
        return
    await websocket.accept()
    loop = asyncio.get_running_loop()
    sub = handle.subscribe(loop)
    try:
        await websocket.send_json(handle.frame())
        while True:
            try:
                frame = await asyncio.wait_for(sub.queue.get(), timeout=5.0)
                await websocket.send_json(frame)
            except asyncio.TimeoutError:
                # keepalive + status refresh while paused
                await websocket.send_json(handle.frame())
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        handle.unsubscribe(sub)

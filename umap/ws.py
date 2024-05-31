#!/usr/bin/env python

import asyncio
from collections import defaultdict
from typing import Literal, Optional

import websockets
from django.conf import settings
from django.core.signing import TimestampSigner
from pydantic import BaseModel, ValidationError
from websockets import WebSocketClientProtocol
from websockets.server import serve

from umap.models import Map, User  # NOQA

# Contains the list of websocket connections handled by this process.
# It's a mapping of map_id to a set of the active websocket connections
CONNECTIONS = defaultdict(set)


class JoinMessage(BaseModel):
    kind: str = "join"
    token: str


class OperationMessage(BaseModel):
    kind: str = "operation"
    verb: str = Literal["upsert", "update", "delete"]
    subject: str = Literal["map", "layer", "feature"]
    metadata: Optional[dict] = None
    key: Optional[str] = None


async def join_and_listen(
    map_id: int, permissions: list, user: str | int, websocket: WebSocketClientProtocol
):
    """Join a "room" whith other connected peers.

    New messages will be broadcasted to other connected peers.
    """
    print(f"{user} joined room #{map_id}")
    CONNECTIONS[map_id].add(websocket)
    try:
        async for raw_message in websocket:
            # recompute the peers-list at the time of message-sending.
            # as doing so beforehand would miss new connections
            peers = CONNECTIONS[map_id] - {websocket}
            # Only relay valid "operation" messages
            try:
                OperationMessage.model_validate_json(raw_message)
                websockets.broadcast(peers, raw_message)
            except ValidationError as e:
                error = f"An error occurred when receiving this message: {raw_message}"
                print(error, e)
    finally:
        CONNECTIONS[map_id].remove(websocket)


async def handler(websocket):
    """Main WebSocket handler.

    If permissions are granted, let the peer enter a room.
    """
    raw_message = await websocket.recv()

    # The first event should always be 'join'
    message: JoinMessage = JoinMessage.model_validate_json(raw_message)
    signed = TimestampSigner().unsign_object(message.token, max_age=30)
    user, map_id, permissions = signed.values()

    # Check if permissions for this map have been granted by the server
    if "edit" in signed["permissions"]:
        await join_and_listen(map_id, permissions, user, websocket)


def run(host, port):
    if not settings.WEBSOCKET_ENABLED:
        msg = (
            "WEBSOCKET_ENABLED should be set to True to run the WebSocket Server. "
            "See the documentation at "
            "https://docs.umap-project.org/en/stable/config/settings/#websocket_enabled "
            "for more information."
        )
        print(msg)
        exit(1)

    async def _serve():
        async with serve(handler, host, port):
            print(f"Waiting for connections on {host}:{port}")
            await asyncio.Future()  # run forever

    asyncio.run(_serve())

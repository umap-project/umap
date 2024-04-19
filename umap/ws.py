#!/usr/bin/env python

import asyncio
from collections import defaultdict
from typing import Literal

import django
import websockets
from django.conf import settings
from django.core.signing import TimestampSigner
from pydantic import BaseModel
from websockets import WebSocketClientProtocol
from websockets.server import serve

# This needs to run before the django-specific imports
# See https://docs.djangoproject.com/en/5.0/topics/settings/#calling-django-setup-is-required-for-standalone-django-usage
from umap.settings import settings_as_dict

settings.configure(**settings_as_dict)
django.setup()

from sesame.utils import get_user  # NOQA
from umap.models import Map, User  # NOQA

# Contains the list of websocket connections handled by this process.
# It's a mapping of map_id to a set of the active websocket connections
CONNECTIONS = defaultdict(set)


class JoinMessage(BaseModel):
    kind: str = "join"
    token: str


class OperationMessage(BaseModel):
    kind: str = "operation"
    subject: str = Literal["map", "layer", "feature"]
    metadata: dict
    data: dict


async def join_and_listen(
    map_id: int, permissions: list, user: str | int, websocket: WebSocketClientProtocol
):
    """Join a "room" whith other connected peers.

    New messages will be broadcasted to other connected peers.
    """
    print(f"{user} joined room #{map_id}")
    # FIXME: Persist permissions and user info.
    CONNECTIONS[map_id].add(websocket)
    try:
        async for raw_message in websocket:
            # recompute the peers-list at the time of message-sending.
            # as doing so beforehand would miss new connections
            peers = CONNECTIONS[map_id] - {websocket}

            # Only relay valid "operation" messages
            OperationMessage.model_validate_json(raw_message)
            websockets.broadcast(peers, raw_message)
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

    # We trust the signed info from the server to give access
    # If the user can edit the map, let her in
    if "edit" in signed["permissions"]:
        await join_and_listen(map_id, permissions, user, websocket)


async def main():
    print("WebSocket server waiting for connections")
    async with serve(handler, "localhost", 8001):
        await asyncio.Future()  # run forever


asyncio.run(main())

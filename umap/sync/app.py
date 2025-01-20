import asyncio
import logging

import redis.asyncio as redis
from django.conf import settings
from django.core.signing import TimestampSigner
from django.urls import path
from pydantic import ValidationError

from .payloads import (
    JoinRequest,
    JoinResponse,
    ListPeersResponse,
    OperationMessage,
    PeerMessage,
    Request,
)


async def application(scope, receive, send):
    path = scope["path"].lstrip("/")
    for pattern in urlpatterns:
        if matched := pattern.resolve(path):
            await matched.func(scope, receive, send, **matched.kwargs)
            break
    else:
        await send({"type": "websocket.close"})


async def sync(scope, receive, send, **kwargs):
    room_id = f"umap:{kwargs['map_id']}"
    peer = Peer(room_id)
    peer._send = send
    while True:
        event = await receive()

        if event["type"] == "websocket.connect":
            try:
                await peer.connect()
                await send({"type": "websocket.accept"})
            except ValueError:
                await send({"type": "websocket.close"})

        if event["type"] == "websocket.disconnect":
            await peer.disconnect()
            break

        if event["type"] == "websocket.receive":
            if event["text"] == "ping":
                await send({"type": "websocket.send", "text": "pong"})
            else:
                await peer.receive(event["text"])


class Peer:
    def __init__(self, room_id, username=None):
        self.username = username or ""
        self.room_id = room_id
        self.is_authenticated = False
        self._subscriptions = []

    async def get_peers(self):
        peers = await self.client.hgetall(self.room_id)
        # Send only ids for now (values are client names).
        return peers.keys()

    async def listen_to_channel(self, channel_name):
        async def reader(pubsub):
            await pubsub.subscribe(channel_name)
            while True:
                if pubsub.connection is None:
                    # It has been unsubscribed/closed.
                    break
                try:
                    message = await pubsub.get_message(ignore_subscribe_messages=True)
                except Exception as err:
                    print(err)
                    break
                if message is not None:
                    await self.send(message["data"].decode())
                await asyncio.sleep(0.001)  # Be nice with the server

        async with self.client.pubsub() as pubsub:
            self._subscriptions.append(pubsub)
            asyncio.create_task(reader(pubsub))

    async def listen(self):
        await self.listen_to_channel(self.room_id)
        await self.listen_to_channel(self.peer_id)

    async def connect(self):
        self.client = redis.from_url(settings.REDIS_URL)

    async def disconnect(self):
        await self.client.hdel(self.room_id, self.peer_id)
        for pubsub in self._subscriptions:
            await pubsub.unsubscribe()
            await pubsub.close()
        await self.send_peers_list()
        await self.client.aclose()

    async def send_peers_list(self):
        message = ListPeersResponse(peers=await self.get_peers())
        await self.broadcast(message.model_dump_json())

    async def broadcast(self, message):
        print("BROADCASTING", message)
        # Send to all channels (including sender!)
        await self.client.publish(self.room_id, message)

    async def send_to(self, peer_id, message):
        print("SEND TO", peer_id, message)
        # Send to one given channel
        await self.client.publish(peer_id, message)

    async def receive(self, text_data):
        if not self.is_authenticated:
            print("AUTHENTICATING", text_data)
            message = JoinRequest.model_validate_json(text_data)
            signed = TimestampSigner().unsign_object(message.token, max_age=30)
            user, room_id, permissions = signed.values()
            if "edit" not in permissions:
                return await self.disconnect()
            self.peer_id = message.peer
            print("AUTHENTICATED", self.peer_id)
            await self.client.hset(self.room_id, self.peer_id, self.username)
            await self.listen()
            response = JoinResponse(peer=self.peer_id, peers=await self.get_peers())
            await self.send(response.model_dump_json())
            await self.send_peers_list()
            self.is_authenticated = True
            return

        try:
            incoming = Request.model_validate_json(text_data)
        except ValidationError as error:
            message = (
                f"An error occurred when receiving the following message: {text_data!r}"
            )
            logging.error(message, error)
        else:
            match incoming.root:
                # Broadcast all operation messages to connected peers
                case OperationMessage():
                    await self.broadcast(text_data)

                # Send peer messages to the proper peer
                case PeerMessage():
                    await self.send_to(incoming.root.recipient, text_data)

    async def send(self, text):
        print("  FORWARDING TO", self.peer_id, text)
        try:
            await self._send({"type": "websocket.send", "text": text})
        except Exception as err:
            print("Error sending message:", text)
            print(err)


urlpatterns = [path("ws/sync/<str:map_id>", name="ws_sync", view=sync)]

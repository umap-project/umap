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
        print("EVENT", event)

        if event["type"] == "websocket.connect":
            try:
                print("Let's accept")
                await peer.connect()
                print("After connect")
                await send({"type": "websocket.accept"})
                print("After accept")
            except ValueError:
                await send({"type": "websocket.close"})

        if event["type"] == "websocket.disconnect":
            print("Closing", event)
            await peer.disconnect()
            print("Closed")
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

    async def get_peers(self):
        peers = await self.client.hgetall(self.room_id)
        # Send only ids for now (values are client names).
        return peers.keys()

    async def listen_to_channel(self, channel_name):
        async def reader(pubsub):
            await pubsub.subscribe(channel_name)
            while True:
                try:
                    message = await pubsub.get_message(ignore_subscribe_messages=True)
                except Exception as err:
                    print(err)
                    break
                if message is not None:
                    if message["data"].decode() == "STOP":
                        break
                    await self.send(message["data"].decode())

        async with self.client.pubsub() as pubsub:
            asyncio.create_task(reader(pubsub))

    async def listen(self):
        await self.listen_to_channel(self.room_id)
        await self.listen_to_channel(self.peer_id)

    async def connect(self):
        self.client = redis.from_url(settings.REDIS_URL)

    async def disconnect(self):
        await self.client.hdel(self.room_id, self.peer_id)
        await self.send_peers_list()
        await self.client.aclose()
        await self.client.publish(self.room_id, "STOP")
        await self.client.publish(self.peer_id, "STOP")

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
            print("AUTHENTICATING", self.uuid)
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
        print("SEND", text)
        await self._send({"type": "websocket.send", "text": text})


urlpatterns = [path("ws/sync/<str:map_id>", name="ws_sync", view=sync)]

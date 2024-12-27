import asyncio
import logging

import psycopg
from django.core.signing import TimestampSigner
from django.db import connection, models
from psycopg import sql
from pydantic import ValidationError

from .payloads import (
    JoinRequest,
    JoinResponse,
    ListPeersResponse,
    OperationMessage,
    PeerMessage,
    Request,
)


class Peer(models.Model):
    uuid = models.UUIDField(unique=True, primary_key=True)
    name = models.CharField(max_length=200)
    room_id = models.CharField(max_length=200)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.is_authenticated = False

    async def get_peers(self):
        qs = Peer.objects.filter(room_id=self.room_id).values_list("uuid", flat=True)
        peers = []
        async for peer in qs:
            peers.append(peer)
        return peers

    async def listen_public(self):
        # We need a dedicated connection for the LISTEN
        aconn = await psycopg.AsyncConnection.connect(
            **self.connection_params,
            autocommit=True,
        )
        async with aconn:
            async with aconn.cursor() as acursor:
                await acursor.execute(
                    sql.SQL("LISTEN {chan}").format(
                        chan=sql.Identifier(str(self.room_id))
                    )
                )
                print("LISTEN", self.room_id)
            gen = aconn.notifies()
            async for notify in gen:
                await self.send(notify.payload)

    async def listen_private(self):
        aconn = await psycopg.AsyncConnection.connect(
            **self.connection_params,
            autocommit=True,
        )
        async with aconn:
            async with aconn.cursor() as acursor:
                await acursor.execute(
                    sql.SQL("LISTEN {chan}").format(chan=sql.Identifier(str(self.uuid)))
                )
                print("LISTEN", self.uuid)
            gen = aconn.notifies()
            async for notify in gen:
                await self.send(notify.payload)

    async def connect(self):
        # Join room for this map
        connection_params = connection.get_connection_params()
        connection_params.pop("cursor_factory")
        self.connection_params = connection_params
        self.connection = await psycopg.AsyncConnection.connect(
            **connection_params,
            autocommit=True,
        )
        asyncio.create_task(self.listen_public())
        asyncio.create_task(self.listen_private())

    async def disconnect(self):
        await self.adelete()
        await self.send_peers_list()

    async def send_peers_list(self):
        message = ListPeersResponse(peers=await self.get_peers())
        await self.broadcast(message.model_dump_json())

    async def broadcast(self, message):
        print("BROADCASTING", message)
        # Send to all channels (including sender!)
        async with self.connection.cursor() as cursor:
            await cursor.execute(
                sql.SQL("NOTIFY {chan}, {message}").format(
                    chan=sql.Identifier(str(self.room_id)),
                    message=message,
                )
            )

    async def send_to(self, peer_id, message):
        print("SEND TO", peer_id, message)
        # Send to one given channel
        async with self.connection.cursor() as cursor:
            await cursor.execute(
                sql.SQL("NOTIFY {chan}, {message}").format(
                    chan=sql.Identifier(str(peer_id)), message=message
                )
            )

    async def receive(self, text_data):
        if not self.is_authenticated:
            print("AUTHENTICATING", self.uuid)
            message = JoinRequest.model_validate_json(text_data)
            signed = TimestampSigner().unsign_object(message.token, max_age=30)
            user, map_id, permissions = signed.values()
            if "edit" not in permissions:
                return await self.disconnect()
            await Peer.asave()
            response = JoinResponse(uuid=str(self.uuid), peers=await self.get_peers())
            await self.send(response.model_dump_json())
            await self.send_peers_list()
            self.is_authenticated = True
            return

        if text_data == "ping":
            return await self.send("pong")

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

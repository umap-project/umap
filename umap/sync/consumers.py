import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.signing import TimestampSigner
from pydantic import ValidationError

from .payloads import (
    JoinRequest,
    JoinResponse,
    ListPeersResponse,
    OperationMessage,
    PeerMessage,
    Request,
)


class SyncConsumer(AsyncWebsocketConsumer):
    @property
    def peers(self):
        return self.channel_layer.groups[self.map_id].keys()

    async def connect(self):
        self.map_id = self.scope["url_route"]["kwargs"]["map_id"]

        # Join room group
        await self.channel_layer.group_add(self.map_id, self.channel_name)

        self.is_authenticated = False
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.map_id, self.channel_name)
        await self.send_peers_list()

    async def send_peers_list(self):
        message = ListPeersResponse(peers=self.peers)
        await self.broadcast(message.model_dump_json())

    async def broadcast(self, message):
        # Send to all channels (including sender!)
        await self.channel_layer.group_send(
            self.map_id, {"message": message, "type": "on_message"}
        )

    async def send_to(self, channel, message):
        # Send to one given channel
        await self.channel_layer.send(
            channel, {"message": message, "type": "on_message"}
        )

    async def on_message(self, event):
        # Send to self channel
        await self.send(event["message"])

    async def receive(self, text_data):
        if not self.is_authenticated:
            message = JoinRequest.model_validate_json(text_data)
            signed = TimestampSigner().unsign_object(message.token, max_age=30)
            user, map_id, permissions = signed.values()
            if "edit" not in permissions:
                return await self.disconnect()
            response = JoinResponse(uuid=self.channel_name, peers=self.peers)
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

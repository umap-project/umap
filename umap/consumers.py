from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.signing import TimestampSigner

from .websocket_server import (
    JoinRequest,
    JoinResponse,
    OperationMessage,
    Request,
    ValidationError,
    PeerMessage,
    ListPeersResponse,
)


class TokenMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        signed = TimestampSigner().unsign_object(
            scope["query_string"].decode(), max_age=30
        )
        user, map_id, permissions = signed.values()
        if "edit" not in permissions:
            raise ValueError("Invalid Token")
        scope["user"] = user
        return await self.app(scope, receive, send)


class SyncConsumer(AsyncWebsocketConsumer):
    @property
    def peers(self):
        return self.channel_layer.groups[self.map_id].keys()

    async def connect(self):
        print("connect")
        self.map_id = self.scope["url_route"]["kwargs"]["map_id"]

        # Join room group
        await self.channel_layer.group_add(self.map_id, self.channel_name)

        await self.accept()
        await self.send_peers_list()

    async def disconnect(self, close_code):
        print("disconnect")
        await self.channel_layer.group_discard(self.map_id, self.channel_name)
        await self.send_peers_list()

    async def send_peers_list(self):
        message = ListPeersResponse(peers=self.peers)
        await self.broadcast(message.model_dump_json())

    async def broadcast(self, message):
        print("broadcast", message)
        await self.channel_layer.group_send(
            self.map_id, {"message": message, "type": "on_message"}
        )

    async def send_to(self, channel, message):
        print("pair to pair", channel, message)
        await self.channel_layer.send(
            channel, {"message": message, "type": "on_message"}
        )

    async def on_message(self, event):
        # This is what the consummers does for a single channel
        await self.send(event["message"])

    async def receive(self, text_data):
        print("receive")
        print(text_data)
        if text_data == "ping":
            return await self.send("pong")

        # recompute the peers list at the time of message-sending.
        # as doing so beforehand would miss new connections
        # other_peers = connections.get_other_peers(websocket)
        # await self.send("pong" + self.channel_name)
        # await self.channel_layer.group_send(
        #     self.map_id,
        #     {"message": "pouet " + self.channel_name, "type": "broadcast"},
        # )
        try:
            incoming = Request.model_validate_json(text_data)
        except ValidationError:
            error = (
                f"An error occurred when receiving the following message: {text_data!r}"
            )
            print(error)
            # logging.error(error, e)
        else:
            match incoming.root:
                # Broadcast all operation messages to connected peers
                case JoinRequest():
                    response = JoinResponse(uuid=self.channel_name, peers=self.peers)
                    await self.send(response.model_dump_json())
                case OperationMessage():
                    await self.broadcast(text_data)

                # Send peer messages to the proper peer
                case PeerMessage():
                    print("Received peermessage", incoming.root)
                    await self.send_to(incoming.root.recipient, text_data)

        # Send peer messages to the proper peer
        # case PeerMessage(recipient=_id):
        #     peer = connections.get(_id)
        #     if peer:
        #         await peer.send(text_data)

        # message = JoinRequest.model_validate_json(text_data)
        # signed = TimestampSigner().unsign_object(message.token, max_age=30)
        # user, map_id, permissions = signed.values()

        # # Check if permissions for this map have been granted by the server
        # if "edit" in signed["permissions"]:
        #     connections = CONNECTIONS[map_id]
        #     _id = connections.join(self)

        #     # Assign an ID to the joining peer and return it the list of connected peers.
        #     peers: list[WebSocketClientProtocol] = [
        #         connections.get_id(p) for p in connections.get_all_peers()
        #     ]
        #     response = JoinResponse(uuid=_id, peers=peers)
        #     await self.send(response.model_dump_json())

        #     # await join_and_listen(map_id, permissions, user, websocket)

        # # text_data_json = json.loads(text_data)
        # # message = text_data_json["message"]

        # # self.send(text_data=json.dumps({"message": message}))

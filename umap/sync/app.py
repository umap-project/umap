import uuid

from django.urls.resolvers import RoutePattern

ws_pattern = RoutePattern("/ws/sync/<str:map_id>")


async def application(scope, receive, send):
    from .models import Peer

    matched = ws_pattern.match(scope["path"])
    print(matched)
    if not matched:
        print("Wrong path")
        return
    _, _, kwargs = matched

    map_id = kwargs["map_id"]
    room_id = f"room{map_id}"
    peer = await Peer.objects.acreate(uuid=uuid.uuid4(), name="FooBar", room_id=room_id)
    print(peer)
    peer._send = send
    while True:
        event = await receive()
        print("EVENT", event)

        if event["type"] == "websocket.connect":
            try:
                print("Let's accept")
                await send({"type": "websocket.accept"})
                await peer.connect()
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

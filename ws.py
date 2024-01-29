import asyncio
import websockets
from websockets.server import serve
import json

# Just relay all messages to other connected peers for now

CONNECTIONS = set()

async def join_and_listen(websocket):
    print(f"Someone joined: {id(websocket)}")
    CONNECTIONS.add(websocket)
    try:
        async for message in websocket:
            # recompute the peers-list at the time of message-sending.
            # doing so beforehand would miss new connections
            peers = CONNECTIONS - {websocket}
            print(message)
            print(peers)
            websockets.broadcast(peers, message)
    finally:
        CONNECTIONS.remove(websocket)


async def handler(websocket):
    message = await websocket.recv()
    event = json.loads(message)

    # The first event should always be 'join'
    assert event["type"] == "join"
    await join_and_listen(websocket)

async def main():
    async with serve(handler, "localhost", 8001):
        await asyncio.Future()  # run forever

asyncio.run(main())

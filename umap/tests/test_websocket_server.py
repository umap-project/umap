from umap.websocket_server import OperationMessage, PeerMessage, Request, ServerRequest


def test_messages_are_parsed_correctly():
    server = Request.model_validate(dict(kind="Server", action="list-peers")).root
    assert type(server) is ServerRequest

    operation = Request.model_validate(
        dict(
            kind="OperationMessage",
            verb="upsert",
            subject="map",
            metadata={},
            key="key",
        )
    ).root
    assert type(operation) is OperationMessage

    peer_message = Request.model_validate(
        dict(kind="PeerMessage", sender="Alice", recipient="Bob", message={})
    ).root
    assert type(peer_message) is PeerMessage

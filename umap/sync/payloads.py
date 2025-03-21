from typing import List, Literal, Optional, Union

from pydantic import BaseModel, Field, RootModel


class JoinRequest(BaseModel):
    kind: Literal["JoinRequest"] = "JoinRequest"
    token: str
    peer: str
    username: Optional[str] = ""


class OperationMessage(BaseModel):
    """Message sent from one peer to all the others"""

    kind: Literal["OperationMessage"] = "OperationMessage"
    verb: Literal["upsert", "update", "delete", "batch"]
    subject: Literal["map", "datalayer", "feature"]
    metadata: Optional[dict] = None
    key: Optional[str] = None
    operations: Optional[List] = None


class PeerMessage(BaseModel):
    """Message sent from a specific peer to another one"""

    kind: Literal["PeerMessage"] = "PeerMessage"
    sender: str
    recipient: str
    # The message can be whatever the peers want. It's not checked by the server.
    message: dict


class SavedMessage(BaseModel):
    kind: Literal["SavedMessage"] = "SavedMessage"
    lastKnownHLC: str


class Request(RootModel):
    """Any message coming from the websocket should be one of these, and will be rejected otherwise."""

    root: Union[PeerMessage, OperationMessage, SavedMessage] = Field(
        discriminator="kind"
    )


class JoinResponse(BaseModel):
    """Server response containing the list of peers"""

    kind: Literal["JoinResponse"] = "JoinResponse"
    peers: dict
    peer: str


class ListPeersResponse(BaseModel):
    kind: Literal["ListPeersResponse"] = "ListPeersResponse"
    peers: dict

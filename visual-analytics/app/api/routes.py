from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import List
import asyncio

from sse_starlette.sse import EventSourceResponse
from typing import Dict, Any


from app.core.security import verify_internal_api_key
from app.services.node_pipeline import run_node_pipeline

router = APIRouter()



# REQUEST MODELS


class NodePayload(BaseModel):
    nodeId: int
    role: str


class VisualReanalyzeRequest(BaseModel):
    trigger: str
    transactionId: str
    nodes: List[NodePayload]



# BACKGROUND RUNNER


def _run_pipeline_sync(nodes: List[NodePayload]):
    asyncio.run(run_node_pipeline(nodes))



# NODE-BASED ENTRY POINT


@router.post(
    "/visual/reanalyze/nodes",
    dependencies=[Depends(verify_internal_api_key)]
)
def reanalyze_nodes(
    request: VisualReanalyzeRequest,
    background_tasks: BackgroundTasks
):
    background_tasks.add_task(_run_pipeline_sync, request.nodes)

    return {
        "status": "started",
        "transactionId": request.transactionId,
        "nodes": [n.nodeId for n in request.nodes]
    }


@router.get(
    "/visual/stream/unsupervised",
    dependencies=[Depends(verify_internal_api_key)]
)
async def stream_unsupervised(
    transactionId: str,
    nodeId: int
):
    """
    Streams EIF + SHAP analysis steps live to frontend.
    """

    event_queue: asyncio.Queue = asyncio.Queue()

    async def runner():
        # Reuse the SAME pipeline
        await run_node_pipeline(
            nodes=[NodePayload(nodeId=nodeId, role="source")],
            event_queue=event_queue
        )

    # Run ML asynchronously
    asyncio.create_task(runner())

    async def event_generator():
        while True:
            event = await event_queue.get()
            yield {
                "event": event["stage"],
                "data": event["data"]
            }

            # Stop stream when pipeline finishes
            if event["stage"] == "unsupervised_completed":
                break

    return EventSourceResponse(event_generator())

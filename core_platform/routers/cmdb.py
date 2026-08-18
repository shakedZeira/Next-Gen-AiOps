from fastapi import APIRouter

router = APIRouter()


@router.get("/ci")
async def list_cis():
    return {"cis": []}


@router.get("/ci/{ci_id}")
async def get_ci(ci_id: str):
    return {"ci_id": ci_id}

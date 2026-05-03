from fastapi import APIRouter, File, UploadFile

from app.dependencies import CurrentUser, DbConn
from app.schemas.receipts import ReceiptScanOut

router = APIRouter(prefix="/api/v1/receipts", tags=["receipts"])


@router.post("/scan", response_model=ReceiptScanOut)
async def scan_receipt(
    current_user: CurrentUser,
    db: DbConn,
    image: UploadFile = File(...),
) -> ReceiptScanOut:
    raise NotImplementedError

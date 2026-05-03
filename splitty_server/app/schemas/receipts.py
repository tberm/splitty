from typing import Optional

from pydantic import BaseModel


class ScannedItemOut(BaseModel):
    name: str
    unit_price: int
    quantity: int


class ReceiptScanOut(BaseModel):
    receipt_image_key: str
    currency: Optional[str]
    suggested_total: Optional[int]
    items: list[ScannedItemOut]

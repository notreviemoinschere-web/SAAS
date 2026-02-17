import random
import uuid
import string
from datetime import datetime, timezone, timedelta


def weighted_draw(prizes: list) -> dict:
    """Server-side deterministic weighted draw. Returns selected prize or None."""
    available = [p for p in prizes if p.get('stock_remaining', 0) > 0]
    if not available:
        return None
    weights = [p.get('weight', 1) for p in available]
    total = sum(weights)
    if total == 0:
        return None
    selected = random.choices(available, weights=weights, k=1)[0]
    return selected


def generate_reward_code(is_test: bool = False) -> str:
    """Generate unique reward code. TEST- prefix for test mode."""
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    if is_test:
        return f"TEST-{code}"
    return code


def calculate_prize_index(prizes: list, winning_prize_id: str) -> int:
    """Find the index of the winning prize in the full list."""
    for i, p in enumerate(prizes):
        if p['id'] == winning_prize_id:
            return i
    return 0


def validate_campaign_for_publish(campaign: dict, prizes: list) -> list:
    """Validate campaign before publishing. Returns list of errors."""
    errors = []
    if not campaign.get('start_date'):
        errors.append('Start date is required')
    if not campaign.get('end_date'):
        errors.append('End date is required')
    if not prizes or len(prizes) == 0:
        errors.append('At least 1 prize is required')
    has_stock = any(p.get('stock_remaining', 0) > 0 for p in prizes)
    if not has_stock:
        errors.append('At least 1 prize must have stock > 0')
    if not campaign.get('legal_text'):
        errors.append('Legal text is required')
    return errors

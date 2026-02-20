"""
Tenant Analytics & Players Routes
Provides analytics data and player management for tenant dashboard
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta, timezone
from typing import Optional
import csv
import io
from bson import ObjectId

from database import db
from auth import get_current_user

router = APIRouter(prefix="/tenant", tags=["tenant-analytics"])


@router.get("/players")
async def get_players(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    campaign_id: Optional[str] = None,
    marketing_consent: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Get list of players for tenant with filters"""
    if user.get('role') not in ['tenant_owner', 'super_admin']:
        raise HTTPException(403, "Access denied")
    
    tenant_id = user.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "No tenant associated")

    # Build query
    query = {"tenant_id": tenant_id}
    
    if campaign_id:
        query["campaign_id"] = campaign_id
    
    if marketing_consent:
        query["marketing_consent"] = marketing_consent == "true"
    
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}}
        ]
    
    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from)
            query["played_at"] = {"$gte": from_date}
        except:
            pass
    
    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to) + timedelta(days=1)
            if "played_at" in query:
                query["played_at"]["$lte"] = to_date
            else:
                query["played_at"] = {"$lte": to_date}
        except:
            pass

    # Get total count
    total = await db.plays.count_documents(query)
    pages = (total + limit - 1) // limit
    skip = (page - 1) * limit

    # Get players with campaign info
    pipeline = [
        {"$match": query},
        {"$sort": {"played_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$lookup": {
            "from": "games",
            "localField": "campaign_id",
            "foreignField": "id",
            "as": "campaign"
        }},
        {"$lookup": {
            "from": "reward_codes",
            "localField": "reward_code_id",
            "foreignField": "id",
            "as": "reward"
        }},
        {"$project": {
            "_id": 0,
            "id": "$play_id",
            "email": 1,
            "phone": 1,
            "first_name": 1,
            "campaign_id": 1,
            "campaign_title": {"$arrayElemAt": ["$campaign.title", 0]},
            "played_at": 1,
            "won": {"$gt": ["$prize_id", None]},
            "prize_label": 1,
            "marketing_consent": {"$ifNull": ["$marketing_consent", False]}
        }}
    ]

    players = await db.plays.aggregate(pipeline).to_list(None)

    # Get stats
    stats_pipeline = [
        {"$match": {"tenant_id": tenant_id}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "with_email": {"$sum": {"$cond": [{"$gt": ["$email", None]}, 1, 0]}},
            "with_phone": {"$sum": {"$cond": [{"$gt": ["$phone", None]}, 1, 0]}},
            "marketing_consent": {"$sum": {"$cond": ["$marketing_consent", 1, 0]}}
        }}
    ]
    stats_result = await db.plays.aggregate(stats_pipeline).to_list(1)
    stats = stats_result[0] if stats_result else {
        "total": 0, "with_email": 0, "with_phone": 0, "marketing_consent": 0
    }
    del stats["_id"]

    return {
        "players": players,
        "total": total,
        "pages": pages,
        "page": page,
        "stats": stats
    }


@router.get("/players/export")
async def export_players(
    campaign_id: Optional[str] = None,
    marketing_consent: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Export players to CSV (requires Pro plan)"""
    if user.get('role') not in ['tenant_owner', 'super_admin']:
        raise HTTPException(403, "Access denied")
    
    tenant_id = user.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "No tenant associated")

    # Check plan allows export
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    plan = await db.plans.find_one({"id": tenant.get("plan", "free")}, {"_id": 0})
    
    if not plan or not plan.get("limits", {}).get("export", False):
        raise HTTPException(403, "L'export n'est pas disponible avec votre plan actuel. Passez au plan Pro pour débloquer cette fonctionnalité.")

    # Build query
    query = {"tenant_id": tenant_id}
    
    if campaign_id:
        query["campaign_id"] = campaign_id
    
    if marketing_consent:
        query["marketing_consent"] = marketing_consent == "true"
    
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]

    # Only export players with marketing consent for GDPR compliance
    query["marketing_consent"] = True

    # Get players
    pipeline = [
        {"$match": query},
        {"$sort": {"played_at": -1}},
        {"$limit": 10000},
        {"$lookup": {
            "from": "games",
            "localField": "campaign_id",
            "foreignField": "id",
            "as": "campaign"
        }},
        {"$project": {
            "_id": 0,
            "email": 1,
            "phone": 1,
            "first_name": 1,
            "campaign_title": {"$arrayElemAt": ["$campaign.title", 0]},
            "played_at": 1,
            "won": {"$gt": ["$prize_id", None]},
            "prize_label": 1
        }}
    ]

    players = await db.plays.aggregate(pipeline).to_list(None)

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Email", "Téléphone", "Prénom", "Campagne", "Date", "Gagné", "Lot"])
    
    for player in players:
        writer.writerow([
            player.get("email", ""),
            player.get("phone", ""),
            player.get("first_name", ""),
            player.get("campaign_title", ""),
            player.get("played_at", ""),
            "Oui" if player.get("won") else "Non",
            player.get("prize_label", "")
        ])

    output.seek(0)
    
    # Log export
    await db.audit_logs.insert_one({
        "tenant_id": tenant_id,
        "user_id": user.get("sub"),
        "action": "players_exported",
        "category": "data",
        "details": {"count": len(players)},
        "created_at": datetime.now(timezone.utc)
    })

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=players_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@router.get("/analytics")
async def get_analytics(
    period: str = Query("30d", regex="^(7d|30d|90d|365d)$"),
    campaign_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Get analytics data for tenant dashboard"""
    if user.get('role') not in ['tenant_owner', 'super_admin']:
        raise HTTPException(403, "Access denied")
    
    tenant_id = user.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "No tenant associated")

    # Calculate date range
    days_map = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}
    days = days_map.get(period, 30)
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    prev_start = start_date - timedelta(days=days)

    # Base query
    query = {
        "tenant_id": tenant_id,
        "played_at": {"$gte": start_date, "$lte": end_date}
    }
    prev_query = {
        "tenant_id": tenant_id,
        "played_at": {"$gte": prev_start, "$lt": start_date}
    }
    
    if campaign_id:
        query["campaign_id"] = campaign_id
        prev_query["campaign_id"] = campaign_id

    # Current period stats
    total_plays = await db.plays.count_documents(query)
    total_wins = await db.plays.count_documents({**query, "prize_id": {"$ne": None}})
    
    unique_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$email"}},
        {"$count": "count"}
    ]
    unique_result = await db.plays.aggregate(unique_pipeline).to_list(1)
    unique_players = unique_result[0]["count"] if unique_result else 0

    # Previous period for comparison
    prev_plays = await db.plays.count_documents(prev_query)
    prev_wins = await db.plays.count_documents({**prev_query, "prize_id": {"$ne": None}})
    
    prev_unique_result = await db.plays.aggregate([
        {"$match": prev_query},
        {"$group": {"_id": "$email"}},
        {"$count": "count"}
    ]).to_list(1)
    prev_unique = prev_unique_result[0]["count"] if prev_unique_result else 0

    # Calculate changes
    def calc_change(current, previous):
        if previous == 0:
            return 100 if current > 0 else 0
        return round(((current - previous) / previous) * 100, 1)

    # Codes redeemed
    redeemed_query = {
        "tenant_id": tenant_id,
        "status": "redeemed",
        "redeemed_at": {"$gte": start_date, "$lte": end_date}
    }
    if campaign_id:
        redeemed_query["campaign_id"] = campaign_id
    codes_redeemed = await db.reward_codes.count_documents(redeemed_query)

    # Plays over time
    time_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$played_at"}},
            "plays": {"$sum": 1},
            "wins": {"$sum": {"$cond": [{"$gt": ["$prize_id", None]}, 1, 0]}}
        }},
        {"$sort": {"_id": 1}},
        {"$project": {"_id": 0, "date": "$_id", "plays": 1, "wins": 1}}
    ]
    plays_over_time = await db.plays.aggregate(time_pipeline).to_list(None)

    # Prize distribution
    prize_pipeline = [
        {"$match": {**query, "prize_id": {"$ne": None}}},
        {"$group": {
            "_id": "$prize_label",
            "count": {"$sum": 1}
        }},
        {"$project": {"_id": 0, "label": "$_id", "count": 1}}
    ]
    prize_distribution = await db.plays.aggregate(prize_pipeline).to_list(None)

    # Hourly distribution
    hourly_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {"$hour": "$played_at"},
            "plays": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}},
        {"$project": {"_id": 0, "hour": {"$concat": [{"$toString": "$_id"}, "h"]}, "plays": 1}}
    ]
    hourly_distribution = await db.plays.aggregate(hourly_pipeline).to_list(None)

    # Top campaigns
    top_campaigns_pipeline = [
        {"$match": {"tenant_id": tenant_id, "played_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$campaign_id",
            "plays": {"$sum": 1},
            "wins": {"$sum": {"$cond": [{"$gt": ["$prize_id", None]}, 1, 0]}}
        }},
        {"$lookup": {
            "from": "games",
            "localField": "_id",
            "foreignField": "id",
            "as": "campaign"
        }},
        {"$sort": {"plays": -1}},
        {"$limit": 5},
        {"$project": {
            "_id": 0,
            "id": "$_id",
            "title": {"$arrayElemAt": ["$campaign.title", 0]},
            "plays": 1,
            "wins": 1
        }}
    ]
    top_campaigns = await db.plays.aggregate(top_campaigns_pipeline).to_list(None)

    # Recent activity
    recent_pipeline = [
        {"$match": {"tenant_id": tenant_id}},
        {"$sort": {"played_at": -1}},
        {"$limit": 10},
        {"$project": {
            "_id": 0,
            "email": 1,
            "played_at": 1,
            "won": {"$gt": ["$prize_id", None]}
        }}
    ]
    recent_activity = await db.plays.aggregate(recent_pipeline).to_list(None)

    return {
        "total_plays": total_plays,
        "total_wins": total_wins,
        "unique_players": unique_players,
        "conversion_rate": total_wins / total_plays if total_plays > 0 else 0,
        "codes_redeemed": codes_redeemed,
        "redemption_rate": codes_redeemed / total_wins if total_wins > 0 else 0,
        "plays_change": calc_change(total_plays, prev_plays),
        "wins_change": calc_change(total_wins, prev_wins),
        "players_change": calc_change(unique_players, prev_unique),
        "plays_over_time": plays_over_time,
        "prize_distribution": prize_distribution,
        "hourly_distribution": hourly_distribution,
        "top_campaigns": top_campaigns,
        "recent_activity": recent_activity
    }

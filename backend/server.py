from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import socketio

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Google OAuth Config
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Socket.IO setup for real-time chat
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# MODELS
# ============================================================================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    trust_score: int = 100
    created_at: datetime

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

class Listing(BaseModel):
    listing_id: str
    title: str
    description: Optional[str] = None
    price: int
    unit: Literal["hourly", "daily"]
    owner_user_id: str
    owner_name: str
    owner_email: str
    available: bool = True
    image_base64: Optional[str] = None
    created_at: datetime

class RentRequest(BaseModel):
    request_id: str
    listing_id: str
    listing_title: str
    listing_price: int
    listing_unit: str
    owner_user_id: str
    owner_name: str
    owner_email: str
    renter_user_id: str
    renter_name: str
    renter_email: str
    status: Literal["pending", "accepted", "rejected"]
    created_at: datetime

class ActiveRental(BaseModel):
    rental_id: str
    request_id: str
    listing_id: str
    listing_title: str
    listing_price: int
    listing_unit: str
    owner_user_id: str
    owner_name: str
    renter_user_id: str
    renter_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    status: Literal["accepted", "active", "returned", "settled"]
    base_duration_hours: int
    penalty_amount: int = 0
    created_at: datetime

class Notification(BaseModel):
    notification_id: str
    recipient_user_id: str
    message: str
    icon: str
    is_read: bool = False
    created_at: datetime

class ChatMessage(BaseModel):
    message_id: str
    rental_id: str
    sender_user_id: str
    sender_name: str
    message: str
    timestamp: datetime

# Request/Response Models
class SessionRequest(BaseModel):
    session_id: str

class GoogleAuthRequest(BaseModel):
    id_token: str

class ListingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    price: int
    unit: Literal["hourly", "daily"]
    image_base64: Optional[str] = None

class RentRequestCreate(BaseModel):
    listing_id: str

class ChatMessageCreate(BaseModel):
    message: str

class SimpleLoginRequest(BaseModel):
    name: str
    email: str

@api_router.post("/auth/simple-login")
async def simple_login(login_req: SimpleLoginRequest, response: Response):
    """Simple login with just name and email - no password needed"""
    try:
        email = login_req.email.lower().strip()
        name = login_req.name.strip()
        
        # Create or update user
        user_doc = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user_doc:
            await db.users.update_one(
                {"email": email},
                {"$set": {"name": name}}
            )
            user_id = user_doc["user_id"]
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user_data = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": None,
                "trust_score": 100,
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(user_data)
        
        # Create session
        session_token = f"session_{uuid.uuid4().hex}"
        session_data = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
            "created_at": datetime.now(timezone.utc)
        }
        await db.user_sessions.insert_one(session_data)
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=30 * 24 * 60 * 60
        )
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        return {**user, "session_token": session_token}
        
    except Exception as e:
        logger.error(f"Simple login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# AUTH HELPERS
# ============================================================================

async def get_current_user(request: Request) -> User:
    """Get current user from session token (cookie or Authorization header)"""
    session_token = None
    
    # Try cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session in database
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user_doc)

# ============================================================================
# AUTH ROUTES
# ============================================================================

@api_router.post("/auth/session")
async def create_session(session_req: SessionRequest, response: Response):
    """Exchange session_id for user data and create session"""
    try:
        # Call Emergent Auth API
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_req.session_id}
            )
            auth_response.raise_for_status()
            auth_data = auth_response.json()
        
        # Create or update user
        user_id = auth_data.get("id")
        if not user_id:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
        
        user_doc = await db.users.find_one({"email": auth_data["email"]}, {"_id": 0})
        
        if user_doc:
            # Update existing user
            await db.users.update_one(
                {"email": auth_data["email"]},
                {"$set": {
                    "name": auth_data["name"],
                    "picture": auth_data.get("picture")
                }}
            )
            user_id = user_doc["user_id"]
        else:
            # Create new user
            user_data = {
                "user_id": user_id,
                "email": auth_data["email"],
                "name": auth_data["name"],
                "picture": auth_data.get("picture"),
                "trust_score": 100,
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(user_data)
        
        # Create session
        session_token = auth_data.get("session_token", f"session_{uuid.uuid4().hex}")
        session_data = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        }
        await db.user_sessions.insert_one(session_data)
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
        
        # Get fresh user data
          user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        
        return {**user, "session_token": session_token}
        
    except httpx.HTTPStatusError as e:
        logger.error(f"Auth API error: {e}")
        raise HTTPException(status_code=401, detail="Invalid session_id")
    except Exception as e:
        logger.error(f"Session creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/google")
async def google_auth(auth_req: GoogleAuthRequest, response: Response):
    """Authenticate with Google ID token"""
    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            auth_req.id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        # Get user info from token
        email = idinfo['email']
        name = idinfo.get('name', email.split('@')[0])
        picture = idinfo.get('picture')
        google_id = idinfo['sub']
        
        # Create or update user
        user_doc = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user_doc:
            # Update existing user
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "name": name,
                    "picture": picture
                }}
            )
            user_id = user_doc["user_id"]
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user_data = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "trust_score": 100,
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(user_data)
        
        # Create session
        session_token = f"session_{uuid.uuid4().hex}"
        session_data = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        }
        await db.user_sessions.insert_one(session_data)
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
        
        # Get fresh user data
         user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        
        return {**user, "session_token": session_token}
        
    except ValueError as e:
        logger.error(f"Invalid Google ID token: {e}")
        raise HTTPException(status_code=401, detail="Invalid Google ID token")
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============================================================================
# LISTING ROUTES
# ============================================================================

@api_router.get("/listings", response_model=List[Listing])
async def get_listings(
    available_only: bool = False,
    current_user: User = Depends(get_current_user)
):
    """Get all marketplace listings"""
    query = {}
    if available_only:
        query["available"] = True
    
    listings = await db.listings.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Listing(**listing) for listing in listings]

@api_router.get("/listings/{listing_id}", response_model=Listing)
async def get_listing(
    listing_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get specific listing"""
    listing = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return Listing(**listing)

@api_router.post("/listings", response_model=Listing)
async def create_listing(
    listing_data: ListingCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new listing"""
    listing = {
        "listing_id": f"listing_{uuid.uuid4().hex[:12]}",
        "title": listing_data.title,
        "description": listing_data.description,
        "price": listing_data.price,
        "unit": listing_data.unit,
        "owner_user_id": current_user.user_id,
        "owner_name": current_user.name,
        "owner_email": current_user.email,
        "available": True,
        "image_base64": listing_data.image_base64,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.listings.insert_one(listing)
    return Listing(**listing)

@api_router.get("/listings/my/all", response_model=List[Listing])
async def get_my_listings(current_user: User = Depends(get_current_user)):
    """Get current user's listings"""
    listings = await db.listings.find(
        {"owner_user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return [Listing(**listing) for listing in listings]

# ============================================================================
# RENT REQUEST ROUTES
# ============================================================================

@api_router.post("/requests", response_model=RentRequest)
async def create_rent_request(
    request_data: RentRequestCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a rent request"""
    # Get listing
    listing = await db.listings.find_one({"listing_id": request_data.listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Check if user already has a pending/accepted request for this listing
    existing = await db.rent_requests.find_one({
        "listing_id": request_data.listing_id,
        "renter_user_id": current_user.user_id,
        "status": {"$in": ["pending", "accepted"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active request for this item")
    
    # Create request
    rent_request = {
        "request_id": f"request_{uuid.uuid4().hex[:12]}",
        "listing_id": listing["listing_id"],
        "listing_title": listing["title"],
        "listing_price": listing["price"],
        "listing_unit": listing["unit"],
        "owner_user_id": listing["owner_user_id"],
        "owner_name": listing["owner_name"],
        "owner_email": listing["owner_email"],
        "renter_user_id": current_user.user_id,
        "renter_name": current_user.name,
        "renter_email": current_user.email,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.rent_requests.insert_one(rent_request)
    
    # Create notification for owner
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "recipient_user_id": listing["owner_user_id"],
        "message": f"New rent request for \"{listing['title']}\" from {current_user.name}",
        "icon": "inbox",
        "is_read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    return RentRequest(**rent_request)

@api_router.get("/requests/renter", response_model=List[RentRequest])
async def get_renter_requests(current_user: User = Depends(get_current_user)):
    """Get requests made by current user"""
    requests = await db.rent_requests.find(
        {"renter_user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return [RentRequest(**req) for req in requests]

@api_router.get("/requests/owner", response_model=List[RentRequest])
async def get_owner_requests(current_user: User = Depends(get_current_user)):
    """Get requests for current user's listings"""
    requests = await db.rent_requests.find(
        {"owner_user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return [RentRequest(**req) for req in requests]

@api_router.put("/requests/{request_id}/accept", response_model=ActiveRental)
async def accept_request(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """Accept a rent request"""
    # Get request
    request = await db.rent_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["owner_user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    # Update request status
    await db.rent_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "accepted"}}
    )
    
    # Mark listing as unavailable
    await db.listings.update_one(
        {"listing_id": request["listing_id"]},
        {"$set": {"available": False}}
    )
    
    # Create active rental
    base_hours = 24 if request["listing_unit"] == "daily" else 1
    rental = {
        "rental_id": f"rental_{uuid.uuid4().hex[:12]}",
        "request_id": request_id,
        "listing_id": request["listing_id"],
        "listing_title": request["listing_title"],
        "listing_price": request["listing_price"],
        "listing_unit": request["listing_unit"],
        "owner_user_id": request["owner_user_id"],
        "owner_name": request["owner_name"],
        "renter_user_id": request["renter_user_id"],
        "renter_name": request["renter_name"],
        "start_time": datetime.now(timezone.utc),
        "end_time": None,
        "status": "accepted",
        "base_duration_hours": base_hours,
        "penalty_amount": 0,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.active_rentals.insert_one(rental)
    
    # Notify renter
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "recipient_user_id": request["renter_user_id"],
        "message": f"Your request for \"{request['listing_title']}\" was accepted! Go to My Rentals to pick it up.",
        "icon": "check-circle",
        "is_read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    return ActiveRental(**rental)

@api_router.put("/requests/{request_id}/reject")
async def reject_request(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """Reject a rent request"""
    request = await db.rent_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["owner_user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    # Update request status
    await db.rent_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "rejected"}}
    )
    
    # Notify renter
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "recipient_user_id": request["renter_user_id"],
        "message": f"Your request for \"{request['listing_title']}\" was rejected.",
        "icon": "x-circle",
        "is_read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Request rejected"}

# ============================================================================
# RENTAL ROUTES
# ============================================================================

@api_router.get("/rentals/renter", response_model=List[ActiveRental])
async def get_renter_rentals(current_user: User = Depends(get_current_user)):
    """Get rentals where current user is the renter"""
    rentals = await db.active_rentals.find(
        {"renter_user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return [ActiveRental(**rental) for rental in rentals]

@api_router.get("/rentals/owner", response_model=List[ActiveRental])
async def get_owner_rentals(current_user: User = Depends(get_current_user)):
    """Get rentals where current user is the owner"""
    rentals = await db.active_rentals.find(
        {"owner_user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return [ActiveRental(**rental) for rental in rentals]

@api_router.put("/rentals/{rental_id}/pickup", response_model=ActiveRental)
async def pickup_rental(
    rental_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark rental as picked up (start timer)"""
    rental = await db.active_rentals.find_one({"rental_id": rental_id}, {"_id": 0})
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    
    if rental["renter_user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if rental["status"] != "accepted":
        raise HTTPException(status_code=400, detail="Rental not in accepted state")
    
    # Update status to active
    await db.active_rentals.update_one(
        {"rental_id": rental_id},
        {"$set": {"status": "active"}}
    )
    
    # Notify owner
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "recipient_user_id": rental["owner_user_id"],
        "message": f"{rental['renter_name']} picked up \"{rental['listing_title']}\". Timer started.",
        "icon": "clock",
        "is_read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    rental["status"] = "active"
    return ActiveRental(**rental)

@api_router.put("/rentals/{rental_id}/return", response_model=ActiveRental)
async def return_rental(
    rental_id: str,
    current_user: User = Depends(get_current_user)
):
    """Return rental and calculate penalty"""
    rental = await db.active_rentals.find_one({"rental_id": rental_id}, {"_id": 0})
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    
    if rental["renter_user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if rental["status"] != "active":
        raise HTTPException(status_code=400, detail="Rental not active")
    
    # Calculate penalty
    end_time = datetime.now(timezone.utc)
    start_time = rental["start_time"]
    if isinstance(start_time, str):
        start_time = datetime.fromisoformat(start_time)
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    
    elapsed_hours = (end_time - start_time).total_seconds() / 3600
    base_hours = rental["base_duration_hours"]
    
    penalty = 0
    if elapsed_hours > base_hours:
        overtime_hours = elapsed_hours - base_hours
        price = rental["listing_price"]
        if rental["listing_unit"] == "daily":
            # Penalty per hour = price / 24
            penalty = int((price / 24) * overtime_hours)
        else:
            # Penalty per minute
            overtime_minutes = overtime_hours * 60
            penalty = int((price / 60) * overtime_minutes)
    
    # Update trust score
    trust_delta = 2 if penalty == 0 else -5
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$inc": {"trust_score": trust_delta}}
    )
    
    # Clamp trust score between 0 and 100
    user_doc = await db.users.find_one({"user_id": current_user.user_id})
    if user_doc["trust_score"] < 0:
        await db.users.update_one({"user_id": current_user.user_id}, {"$set": {"trust_score": 0}})
    elif user_doc["trust_score"] > 100:
        await db.users.update_one({"user_id": current_user.user_id}, {"$set": {"trust_score": 100}})
    
    # Update rental
    await db.active_rentals.update_one(
        {"rental_id": rental_id},
        {
            "$set": {
                "end_time": end_time,
                "status": "settled",
                "penalty_amount": penalty
            }
        }
    )
    
    # Mark listing as available again
    await db.listings.update_one(
        {"listing_id": rental["listing_id"]},
        {"$set": {"available": True}}
    )
    
    # Notify both parties
    on_time = penalty == 0
    renter_msg = f"You returned \"{rental['listing_title']}\" {'on time! +2 trust score.' if on_time else f'late. Penalty: ₹{penalty}. -5 trust score.'}"
    owner_msg = f"\"{rental['listing_title']}\" was returned by {rental['renter_name']}. {'On time!' if on_time else f'Late — penalty ₹{penalty} charged.'}"
    
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "recipient_user_id": rental["renter_user_id"],
        "message": renter_msg,
        "icon": "star" if on_time else "alert-triangle",
        "is_read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "recipient_user_id": rental["owner_user_id"],
        "message": owner_msg,
        "icon": "package",
        "is_read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Get updated rental
    rental = await db.active_rentals.find_one({"rental_id": rental_id}, {"_id": 0})
    return ActiveRental(**rental)

# ============================================================================
# NOTIFICATION ROUTES
# ============================================================================

@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(current_user: User = Depends(get_current_user)):
    """Get notifications for current user"""
    notifications = await db.notifications.find(
        {"recipient_user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return [Notification(**notif) for notif in notifications]

@api_router.put("/notifications/mark-read")
async def mark_notifications_read(current_user: User = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"recipient_user_id": current_user.user_id},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: User = Depends(get_current_user)):
    """Get unread notification count"""
    count = await db.notifications.count_documents({
        "recipient_user_id": current_user.user_id,
        "is_read": False
    })
    return {"count": count}

# ============================================================================
# CHAT ROUTES
# ============================================================================

@api_router.get("/chat/{rental_id}", response_model=List[ChatMessage])
async def get_chat_messages(
    rental_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get chat messages for a rental"""
    # Verify user is part of this rental
    rental = await db.active_rentals.find_one({"rental_id": rental_id}, {"_id": 0})
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    
    if rental["renter_user_id"] != current_user.user_id and rental["owner_user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get messages
    messages = await db.chat_messages.find(
        {"rental_id": rental_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(1000)
    
    return [ChatMessage(**msg) for msg in messages]

@api_router.post("/chat/{rental_id}", response_model=ChatMessage)
async def send_chat_message(
    rental_id: str,
    message_data: ChatMessageCreate,
    current_user: User = Depends(get_current_user)
):
    """Send a chat message"""
    # Verify user is part of this rental
    rental = await db.active_rentals.find_one({"rental_id": rental_id}, {"_id": 0})
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
    
    if rental["renter_user_id"] != current_user.user_id and rental["owner_user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create message
    message = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "rental_id": rental_id,
        "sender_user_id": current_user.user_id,
        "sender_name": current_user.name,
        "message": message_data.message,
        "timestamp": datetime.now(timezone.utc)
    }
    
    await db.chat_messages.insert_one(message)
    
    # Emit to Socket.IO room
    await sio.emit('new_message', ChatMessage(**message).dict(), room=rental_id)
    
    return ChatMessage(**message)

# ============================================================================
# SOCKET.IO HANDLERS
# ============================================================================

@sio.event
async def connect(sid, environ):
    logger.info(f"Socket.IO client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Socket.IO client disconnected: {sid}")

@sio.event
async def join_rental(sid, data):
    """Join a rental chat room"""
    rental_id = data.get('rental_id')
    if rental_id:
        sio.enter_room(sid, rental_id)
        logger.info(f"Client {sid} joined rental room {rental_id}")

@sio.event
async def leave_rental(sid, data):
    """Leave a rental chat room"""
    rental_id = data.get('rental_id')
    if rental_id:
        sio.leave_room(sid, rental_id)
        logger.info(f"Client {sid} left rental room {rental_id}")

# ============================================================================
# APP SETUP
# ============================================================================

# Include the API router
app.include_router(api_router)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# For running with uvicorn, we need to export socket_app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(socket_app, host="0.0.0.0", port=8001)

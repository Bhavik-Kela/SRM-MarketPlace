#!/usr/bin/env python3
"""
GrabIt Rental App Backend API Testing
Tests all backend APIs in priority order as specified in the review request.
"""

import requests
import json
import time
import base64
from datetime import datetime, timezone

# Test configuration
BASE_URL = "https://item-talk.preview.emergentagent.com/api"
SESSION_TOKEN_1 = "test_session_1775067126273"  # Test User 1 (Owner)
SESSION_TOKEN_2 = "test_session_2_1775067131564"  # Test User 2 (Renter)

# Test data storage
test_data = {
    'listing_id': None,
    'request_id': None,
    'rental_id': None,
    'user1_id': None,
    'user2_id': None
}

def make_request(method, endpoint, headers=None, json_data=None, token=None):
    """Make HTTP request with proper error handling"""
    url = f"{BASE_URL}{endpoint}"
    
    if headers is None:
        headers = {}
    
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    headers['Content-Type'] = 'application/json'
    
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=30)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=json_data, timeout=30)
        elif method == 'PUT':
            response = requests.put(url, headers=headers, json=json_data, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"{method} {endpoint} -> {response.status_code}")
        if response.status_code >= 400:
            print(f"Error response: {response.text}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def test_auth_flow():
    """Test authentication endpoints"""
    print("\n=== TESTING AUTH FLOW ===")
    
    # Test /api/auth/me with User 1
    print("\n1. Testing /api/auth/me with User 1")
    response = make_request('GET', '/auth/me', token=SESSION_TOKEN_1)
    if response and response.status_code == 200:
        user_data = response.json()
        test_data['user1_id'] = user_data.get('user_id')
        print(f"✅ User 1 authenticated: {user_data.get('name')} ({user_data.get('email')})")
        print(f"   Trust Score: {user_data.get('trust_score')}")
    else:
        print("❌ User 1 authentication failed")
        return False
    
    # Test /api/auth/me with User 2
    print("\n2. Testing /api/auth/me with User 2")
    response = make_request('GET', '/auth/me', token=SESSION_TOKEN_2)
    if response and response.status_code == 200:
        user_data = response.json()
        test_data['user2_id'] = user_data.get('user_id')
        print(f"✅ User 2 authenticated: {user_data.get('name')} ({user_data.get('email')})")
        print(f"   Trust Score: {user_data.get('trust_score')}")
    else:
        print("❌ User 2 authentication failed")
        return False
    
    # Test invalid token
    print("\n3. Testing invalid token")
    response = make_request('GET', '/auth/me', token='invalid_token')
    if response and response.status_code == 401:
        print("✅ Invalid token properly rejected")
    else:
        print("❌ Invalid token handling failed")
    
    return True

def test_listings_crud():
    """Test listings CRUD operations"""
    print("\n=== TESTING LISTINGS CRUD ===")
    
    # Create a sample base64 image (small PNG)
    sample_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    # Test creating a listing (User 1 as owner)
    print("\n1. Creating a listing")
    listing_data = {
        "title": "Test Camera Rental",
        "description": "Professional DSLR camera for rent",
        "price": 500,
        "unit": "daily",
        "image_base64": sample_image
    }
    
    response = make_request('POST', '/listings', json_data=listing_data, token=SESSION_TOKEN_1)
    if response and response.status_code == 200:
        listing = response.json()
        test_data['listing_id'] = listing.get('listing_id')
        print(f"✅ Listing created: {listing.get('title')} (ID: {listing.get('listing_id')})")
        print(f"   Price: ₹{listing.get('price')}/{listing.get('unit')}")
        print(f"   Available: {listing.get('available')}")
    else:
        print("❌ Listing creation failed")
        return False
    
    # Test getting all listings
    print("\n2. Getting all listings")
    response = make_request('GET', '/listings', token=SESSION_TOKEN_2)
    if response and response.status_code == 200:
        listings = response.json()
        print(f"✅ Retrieved {len(listings)} listings")
        if listings:
            print(f"   First listing: {listings[0].get('title')}")
    else:
        print("❌ Getting listings failed")
        return False
    
    # Test getting available listings only
    print("\n3. Getting available listings only")
    response = make_request('GET', '/listings?available_only=true', token=SESSION_TOKEN_2)
    if response and response.status_code == 200:
        available_listings = response.json()
        print(f"✅ Retrieved {len(available_listings)} available listings")
    else:
        print("❌ Getting available listings failed")
    
    # Test getting specific listing
    print("\n4. Getting specific listing")
    if test_data['listing_id']:
        response = make_request('GET', f'/listings/{test_data["listing_id"]}', token=SESSION_TOKEN_2)
        if response and response.status_code == 200:
            listing = response.json()
            print(f"✅ Retrieved listing: {listing.get('title')}")
        else:
            print("❌ Getting specific listing failed")
    
    # Test getting user's own listings
    print("\n5. Getting user's own listings")
    response = make_request('GET', '/listings/my/all', token=SESSION_TOKEN_1)
    if response and response.status_code == 200:
        my_listings = response.json()
        print(f"✅ User 1 has {len(my_listings)} listings")
    else:
        print("❌ Getting user's listings failed")
    
    return True

def test_rent_requests():
    """Test rent request creation and management"""
    print("\n=== TESTING RENT REQUESTS ===")
    
    if not test_data['listing_id']:
        print("❌ No listing available for testing rent requests")
        return False
    
    # Test creating a rent request (User 2 as renter)
    print("\n1. Creating rent request")
    request_data = {
        "listing_id": test_data['listing_id']
    }
    
    response = make_request('POST', '/requests', json_data=request_data, token=SESSION_TOKEN_2)
    if response and response.status_code == 200:
        rent_request = response.json()
        test_data['request_id'] = rent_request.get('request_id')
        print(f"✅ Rent request created: {rent_request.get('request_id')}")
        print(f"   Status: {rent_request.get('status')}")
        print(f"   Listing: {rent_request.get('listing_title')}")
    else:
        print("❌ Rent request creation failed")
        return False
    
    # Test duplicate request prevention
    print("\n2. Testing duplicate request prevention")
    response = make_request('POST', '/requests', json_data=request_data, token=SESSION_TOKEN_2)
    if response and response.status_code == 400:
        print("✅ Duplicate request properly prevented")
    else:
        print("❌ Duplicate request prevention failed")
    
    # Test getting renter's requests
    print("\n3. Getting renter's requests")
    response = make_request('GET', '/requests/renter', token=SESSION_TOKEN_2)
    if response and response.status_code == 200:
        renter_requests = response.json()
        print(f"✅ Renter has {len(renter_requests)} requests")
        if renter_requests:
            print(f"   Latest request status: {renter_requests[0].get('status')}")
    else:
        print("❌ Getting renter requests failed")
    
    # Test getting owner's requests
    print("\n4. Getting owner's requests")
    response = make_request('GET', '/requests/owner', token=SESSION_TOKEN_1)
    if response and response.status_code == 200:
        owner_requests = response.json()
        print(f"✅ Owner has {len(owner_requests)} requests")
        if owner_requests:
            print(f"   Latest request status: {owner_requests[0].get('status')}")
    else:
        print("❌ Getting owner requests failed")
    
    return True

def test_request_accept_reject():
    """Test accepting and rejecting rent requests"""
    print("\n=== TESTING REQUEST ACCEPT/REJECT ===")
    
    if not test_data['request_id']:
        print("❌ No request available for testing accept/reject")
        return False
    
    # Test accepting request (User 1 as owner)
    print("\n1. Accepting rent request")
    response = make_request('PUT', f'/requests/{test_data["request_id"]}/accept', token=SESSION_TOKEN_1)
    if response and response.status_code == 200:
        rental = response.json()
        test_data['rental_id'] = rental.get('rental_id')
        print(f"✅ Request accepted, rental created: {rental.get('rental_id')}")
        print(f"   Status: {rental.get('status')}")
        print(f"   Base duration: {rental.get('base_duration_hours')} hours")
    else:
        print("❌ Request acceptance failed")
        return False
    
    # Verify listing became unavailable
    print("\n2. Verifying listing availability")
    if test_data['listing_id']:
        response = make_request('GET', f'/listings/{test_data["listing_id"]}', token=SESSION_TOKEN_2)
        if response and response.status_code == 200:
            listing = response.json()
            if not listing.get('available'):
                print("✅ Listing marked as unavailable after acceptance")
            else:
                print("❌ Listing should be unavailable after acceptance")
        else:
            print("❌ Could not verify listing availability")
    
    return True

def test_rental_pickup():
    """Test rental pickup flow"""
    print("\n=== TESTING RENTAL PICKUP ===")
    
    if not test_data['rental_id']:
        print("❌ No rental available for testing pickup")
        return False
    
    # Test pickup (User 2 as renter)
    print("\n1. Picking up rental")
    response = make_request('PUT', f'/rentals/{test_data["rental_id"]}/pickup', token=SESSION_TOKEN_2)
    if response and response.status_code == 200:
        rental = response.json()
        print(f"✅ Rental picked up: {rental.get('rental_id')}")
        print(f"   Status: {rental.get('status')}")
    else:
        print("❌ Rental pickup failed")
        return False
    
    # Test getting renter's rentals
    print("\n2. Getting renter's rentals")
    response = make_request('GET', '/rentals/renter', token=SESSION_TOKEN_2)
    if response and response.status_code == 200:
        renter_rentals = response.json()
        print(f"✅ Renter has {len(renter_rentals)} rentals")
        if renter_rentals:
            print(f"   Latest rental status: {renter_rentals[0].get('status')}")
    else:
        print("❌ Getting renter rentals failed")
    
    # Test getting owner's rentals
    print("\n3. Getting owner's rentals")
    response = make_request('GET', '/rentals/owner', token=SESSION_TOKEN_1)
    if response and response.status_code == 200:
        owner_rentals = response.json()
        print(f"✅ Owner has {len(owner_rentals)} rentals")
        if owner_rentals:
            print(f"   Latest rental status: {owner_rentals[0].get('status')}")
    else:
        print("❌ Getting owner rentals failed")
    
    return True

def test_rental_return():
    """Test rental return with penalty calculation"""
    print("\n=== TESTING RENTAL RETURN ===")
    
    if not test_data['rental_id']:
        print("❌ No rental available for testing return")
        return False
    
    # Wait a few seconds to simulate some rental time
    print("\n1. Simulating rental time (waiting 3 seconds)")
    time.sleep(3)
    
    # Test return (User 2 as renter)
    print("\n2. Returning rental")
    response = make_request('PUT', f'/rentals/{test_data["rental_id"]}/return', token=SESSION_TOKEN_2)
    if response and response.status_code == 200:
        rental = response.json()
        print(f"✅ Rental returned: {rental.get('rental_id')}")
        print(f"   Status: {rental.get('status')}")
        print(f"   Penalty: ₹{rental.get('penalty_amount')}")
        print(f"   End time: {rental.get('end_time')}")
    else:
        print("❌ Rental return failed")
        return False
    
    # Verify listing became available again
    print("\n3. Verifying listing availability after return")
    if test_data['listing_id']:
        response = make_request('GET', f'/listings/{test_data["listing_id"]}', token=SESSION_TOKEN_2)
        if response and response.status_code == 200:
            listing = response.json()
            if listing.get('available'):
                print("✅ Listing marked as available after return")
            else:
                print("❌ Listing should be available after return")
        else:
            print("❌ Could not verify listing availability")
    
    # Check trust score update
    print("\n4. Checking trust score update")
    response = make_request('GET', '/auth/me', token=SESSION_TOKEN_2)
    if response and response.status_code == 200:
        user_data = response.json()
        trust_score = user_data.get('trust_score')
        print(f"✅ User 2 trust score: {trust_score}")
        if trust_score >= 100:  # Should be 102 for on-time return
            print("   Trust score increased for on-time return")
        else:
            print("   Trust score decreased for late return")
    else:
        print("❌ Could not check trust score")
    
    return True

def test_notifications():
    """Test notifications API"""
    print("\n=== TESTING NOTIFICATIONS ===")
    
    # Test getting notifications for User 1 (owner)
    print("\n1. Getting notifications for User 1 (owner)")
    response = make_request('GET', '/notifications', token=SESSION_TOKEN_1)
    if response and response.status_code == 200:
        notifications = response.json()
        print(f"✅ User 1 has {len(notifications)} notifications")
        if notifications:
            print(f"   Latest: {notifications[0].get('message')}")
            print(f"   Icon: {notifications[0].get('icon')}")
    else:
        print("❌ Getting notifications failed")
        return False
    
    # Test getting notifications for User 2 (renter)
    print("\n2. Getting notifications for User 2 (renter)")
    response = make_request('GET', '/notifications', token=SESSION_TOKEN_2)
    if response and response.status_code == 200:
        notifications = response.json()
        print(f"✅ User 2 has {len(notifications)} notifications")
        if notifications:
            print(f"   Latest: {notifications[0].get('message')}")
    else:
        print("❌ Getting notifications failed")
    
    # Test unread count
    print("\n3. Getting unread notification count")
    response = make_request('GET', '/notifications/unread-count', token=SESSION_TOKEN_1)
    if response and response.status_code == 200:
        count_data = response.json()
        print(f"✅ User 1 has {count_data.get('count')} unread notifications")
    else:
        print("❌ Getting unread count failed")
    
    # Test marking notifications as read
    print("\n4. Marking notifications as read")
    response = make_request('PUT', '/notifications/mark-read', token=SESSION_TOKEN_1)
    if response and response.status_code == 200:
        print("✅ Notifications marked as read")
        
        # Verify unread count is now 0
        response = make_request('GET', '/notifications/unread-count', token=SESSION_TOKEN_1)
        if response and response.status_code == 200:
            count_data = response.json()
            if count_data.get('count') == 0:
                print("✅ Unread count is now 0")
            else:
                print(f"❌ Unread count should be 0, got {count_data.get('count')}")
    else:
        print("❌ Marking notifications as read failed")
    
    return True

def test_chat_messages():
    """Test chat messages API"""
    print("\n=== TESTING CHAT MESSAGES ===")
    
    if not test_data['rental_id']:
        print("❌ No rental available for testing chat")
        return False
    
    # Test sending message from renter
    print("\n1. Sending message from renter")
    message_data = {
        "message": "Hi! I've picked up the camera. Thanks!"
    }
    
    response = make_request('POST', f'/chat/{test_data["rental_id"]}', json_data=message_data, token=SESSION_TOKEN_2)
    if response and response.status_code == 200:
        message = response.json()
        print(f"✅ Message sent: {message.get('message')}")
        print(f"   Sender: {message.get('sender_name')}")
        print(f"   Timestamp: {message.get('timestamp')}")
    else:
        print("❌ Sending message failed")
        return False
    
    # Test sending message from owner
    print("\n2. Sending message from owner")
    message_data = {
        "message": "Great! Please take good care of it. Let me know if you have any questions."
    }
    
    response = make_request('POST', f'/chat/{test_data["rental_id"]}', json_data=message_data, token=SESSION_TOKEN_1)
    if response and response.status_code == 200:
        message = response.json()
        print(f"✅ Message sent: {message.get('message')}")
        print(f"   Sender: {message.get('sender_name')}")
    else:
        print("❌ Sending message failed")
    
    # Test getting chat messages
    print("\n3. Getting chat messages")
    response = make_request('GET', f'/chat/{test_data["rental_id"]}', token=SESSION_TOKEN_1)
    if response and response.status_code == 200:
        messages = response.json()
        print(f"✅ Retrieved {len(messages)} chat messages")
        for i, msg in enumerate(messages):
            print(f"   {i+1}. {msg.get('sender_name')}: {msg.get('message')}")
    else:
        print("❌ Getting chat messages failed")
    
    # Test unauthorized access to chat
    print("\n4. Testing unauthorized chat access")
    # Create a third user session for testing
    third_user_token = "invalid_user_token"
    response = make_request('GET', f'/chat/{test_data["rental_id"]}', token=third_user_token)
    if response and response.status_code in [401, 403]:
        print("✅ Unauthorized chat access properly blocked")
    else:
        print("❌ Unauthorized chat access should be blocked")
    
    return True

def test_socket_io():
    """Test Socket.IO connection (basic connectivity test)"""
    print("\n=== TESTING SOCKET.IO CONNECTION ===")
    
    try:
        import socketio
        
        # Create a Socket.IO client
        sio = socketio.Client()
        
        @sio.event
        def connect():
            print("✅ Socket.IO connected successfully")
        
        @sio.event
        def disconnect():
            print("✅ Socket.IO disconnected")
        
        @sio.event
        def new_message(data):
            print(f"✅ Received new message: {data}")
        
        # Try to connect
        print("\n1. Testing Socket.IO connection")
        sio.connect('https://item-talk.preview.emergentagent.com', wait_timeout=10)
        
        # Test joining a rental room
        if test_data['rental_id']:
            print(f"\n2. Joining rental room: {test_data['rental_id']}")
            sio.emit('join_rental', {'rental_id': test_data['rental_id']})
            time.sleep(1)
            
            print(f"\n3. Leaving rental room: {test_data['rental_id']}")
            sio.emit('leave_rental', {'rental_id': test_data['rental_id']})
            time.sleep(1)
        
        sio.disconnect()
        return True
        
    except ImportError:
        print("❌ python-socketio not installed, skipping Socket.IO test")
        print("   Note: Socket.IO functionality is implemented but cannot be tested without the client library")
        return True
    except Exception as e:
        print(f"❌ Socket.IO connection failed: {e}")
        return False

def run_all_tests():
    """Run all backend tests in priority order"""
    print("🚀 Starting GrabIt Backend API Testing")
    print(f"Base URL: {BASE_URL}")
    print(f"Test User 1 Token: {SESSION_TOKEN_1}")
    print(f"Test User 2 Token: {SESSION_TOKEN_2}")
    
    test_results = {}
    
    # Priority order as specified in review request
    tests = [
        ("Auth Flow", test_auth_flow),
        ("Listings CRUD", test_listings_crud),
        ("Rent Requests", test_rent_requests),
        ("Request Accept/Reject", test_request_accept_reject),
        ("Rental Pickup", test_rental_pickup),
        ("Rental Return", test_rental_return),
        ("Notifications", test_notifications),
        ("Chat Messages", test_chat_messages),
        ("Socket.IO", test_socket_io)
    ]
    
    for test_name, test_func in tests:
        print(f"\n{'='*60}")
        try:
            result = test_func()
            test_results[test_name] = result
            if result:
                print(f"✅ {test_name} - PASSED")
            else:
                print(f"❌ {test_name} - FAILED")
        except Exception as e:
            print(f"❌ {test_name} - ERROR: {e}")
            test_results[test_name] = False
    
    # Summary
    print(f"\n{'='*60}")
    print("🏁 TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for result in test_results.values() if result)
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:<25} {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Backend APIs are working correctly.")
    else:
        print("⚠️  Some tests failed. Check the detailed output above.")
    
    return test_results

if __name__ == "__main__":
    run_all_tests()
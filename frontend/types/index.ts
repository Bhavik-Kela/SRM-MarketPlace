export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  trust_score: number;
  created_at: string;
}

export interface Listing {
  listing_id: string;
  title: string;
  description?: string;
  price: number;
  unit: 'hourly' | 'daily';
  owner_user_id: string;
  owner_name: string;
  owner_email: string;
  available: boolean;
  image_base64?: string;
  created_at: string;
}

export interface RentRequest {
  request_id: string;
  listing_id: string;
  listing_title: string;
  listing_price: number;
  listing_unit: string;
  owner_user_id: string;
  owner_name: string;
  owner_email: string;
  renter_user_id: string;
  renter_name: string;
  renter_email: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface ActiveRental {
  rental_id: string;
  request_id: string;
  listing_id: string;
  listing_title: string;
  listing_price: number;
  listing_unit: string;
  owner_user_id: string;
  owner_name: string;
  renter_user_id: string;
  renter_name: string;
  start_time: string;
  end_time?: string;
  status: 'accepted' | 'active' | 'returned' | 'settled';
  base_duration_hours: number;
  penalty_amount: number;
  created_at: string;
}

export interface Notification {
  notification_id: string;
  recipient_user_id: string;
  message: string;
  icon: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatMessage {
  message_id: string;
  rental_id: string;
  sender_user_id: string;
  sender_name: string;
  message: string;
  timestamp: string;
}

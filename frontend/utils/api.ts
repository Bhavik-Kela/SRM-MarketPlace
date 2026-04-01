import Constants from 'expo-constants';
import { User, Listing, RentRequest, ActiveRental, Notification, ChatMessage } from '../types';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = `${API_URL}/api`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async createSession(sessionId: string): Promise<User> {
    return this.request<User>('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  }

  async googleAuth(idToken: string): Promise<User> {
    return this.request<User>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  // Listings
  async getListings(availableOnly: boolean = false): Promise<Listing[]> {
    return this.request<Listing[]>(
      `/listings?available_only=${availableOnly}`
    );
  }

  async getListing(id: string): Promise<Listing> {
    return this.request<Listing>(`/listings/${id}`);
  }

  async createListing(data: {
    title: string;
    description?: string;
    price: number;
    unit: 'hourly' | 'daily';
    image_base64?: string;
  }): Promise<Listing> {
    return this.request<Listing>('/listings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyListings(): Promise<Listing[]> {
    return this.request<Listing[]>('/listings/my/all');
  }

  // Rent Requests
  async createRentRequest(listingId: string): Promise<RentRequest> {
    return this.request<RentRequest>('/requests', {
      method: 'POST',
      body: JSON.stringify({ listing_id: listingId }),
    });
  }

  async getRenterRequests(): Promise<RentRequest[]> {
    return this.request<RentRequest[]>('/requests/renter');
  }

  async getOwnerRequests(): Promise<RentRequest[]> {
    return this.request<RentRequest[]>('/requests/owner');
  }

  async acceptRequest(requestId: string): Promise<ActiveRental> {
    return this.request<ActiveRental>(`/requests/${requestId}/accept`, {
      method: 'PUT',
    });
  }

  async rejectRequest(requestId: string): Promise<void> {
    await this.request(`/requests/${requestId}/reject`, { method: 'PUT' });
  }

  // Rentals
  async getRenterRentals(): Promise<ActiveRental[]> {
    return this.request<ActiveRental[]>('/rentals/renter');
  }

  async getOwnerRentals(): Promise<ActiveRental[]> {
    return this.request<ActiveRental[]>('/rentals/owner');
  }

  async pickupRental(rentalId: string): Promise<ActiveRental> {
    return this.request<ActiveRental>(`/rentals/${rentalId}/pickup`, {
      method: 'PUT',
    });
  }

  async returnRental(rentalId: string): Promise<ActiveRental> {
    return this.request<ActiveRental>(`/rentals/${rentalId}/return`, {
      method: 'PUT',
    });
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    return this.request<Notification[]>('/notifications');
  }

  async markNotificationsRead(): Promise<void> {
    await this.request('/notifications/mark-read', { method: 'PUT' });
  }

  async getUnreadCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>('/notifications/unread-count');
  }

  // Chat
  async getChatMessages(rentalId: string): Promise<ChatMessage[]> {
    return this.request<ChatMessage[]>(`/chat/${rentalId}`);
  }

  async sendChatMessage(
    rentalId: string,
    message: string
  ): Promise<ChatMessage> {
    return this.request<ChatMessage>(`/chat/${rentalId}`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }
}

export const api = new ApiClient();

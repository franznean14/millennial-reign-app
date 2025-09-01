// Simple event system for business updates
export type BusinessEventType = 
  | 'establishment-added'
  | 'establishment-updated'
  | 'householder-added'
  | 'visit-added';

interface BusinessEvent {
  type: BusinessEventType;
  data: any;
}

class BusinessEventBus {
  private listeners: Map<BusinessEventType, ((data: any) => void)[]> = new Map();

  subscribe(eventType: BusinessEventType, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  unsubscribe(eventType: BusinessEventType, callback: (data: any) => void) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(eventType: BusinessEventType, data: any) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}

export const businessEventBus = new BusinessEventBus();

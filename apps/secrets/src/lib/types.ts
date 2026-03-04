export interface Secret {
  name: string;
  createdAt: string;
}

export interface Variable {
  name: string;
  value: string;
  createdAt: string;
}

export interface AuthState {
  status: 'disconnected' | 'connecting' | 'connected' | 'unlocking' | 'ready' | 'error';
  error?: string;
  address?: string;
  keyId?: string;
}

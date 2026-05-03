import { API_URL, DEV_USER_ID } from '@/constants/config';

// Thrown when the server returns a non-2xx status.
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': String(DEV_USER_ID),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => response.statusText);
    throw new ApiError(response.status, body);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get:    <T>(path: string)                   => request<T>(path),
  post:   <T>(path: string, body: unknown)    => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)    => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                   => request<T>(path, { method: 'DELETE' }),
};

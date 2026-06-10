export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details: unknown = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();

    if (!text) {
      throw new ApiError(response.status, "Unable to complete the request");
    }

    let body: { error?: string } | null = null;
    try {
      body = JSON.parse(text) as { error?: string };
    } catch {
      body = null;
    }

    throw new ApiError(
      response.status,
      body?.error ?? text ?? "Unable to complete the request",
      body,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export interface D1Result<T = unknown> {
  success: boolean;
  results?: T[];
  meta?: { changes?: number; last_row_id?: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<Array<D1Result<T>>>;
}

export interface R2ObjectBody {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  writeHttpMetadata(headers: Headers): void;
}

export interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface ImageTransformer {
  input(stream: ReadableStream): {
    transform(options: Record<string, unknown>): {
      output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
    };
  };
}

export interface Env {
  ASSETS: AssetFetcher;
  IMAGES: ImageTransformer;
  DB: D1Database;
  VEHICLE_IMAGES: R2Bucket;
  HALOVIA_LOCAL_USER_EMAIL?: string;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

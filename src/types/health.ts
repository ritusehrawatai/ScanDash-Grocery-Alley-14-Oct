export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface DatabaseHealth {
  status: string;
  databaseProductName: string;
  url: string;
}

export interface SystemMemory {
  totalMemoryMb: number;
  freeMemoryMb: number;
  maxMemoryMb: number;
}

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  database: DatabaseHealth;
  memory: SystemMemory;
  modules: Record<string, string>;
  timestamp: string;
}

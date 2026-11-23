/** Envelope returned by every NegoMarket API endpoint (see backend App\Http\Responses\ApiResponse). */
export interface ApiSuccess<T> {
  success: true
  message: string | null
  data: T
  meta?: Record<string, unknown>
  links?: Record<string, string | null>
}

export interface ApiErrorBody {
  success: false
  message: string
  errors?: Record<string, string[]>
}

/** Normalised error thrown by the API client for every failed request. */
export class ApiError extends Error {
  readonly status: number
  readonly errors: Record<string, string[]>

  constructor(message: string, status: number, errors: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  get isValidationError(): boolean {
    return this.status === 422
  }
}

import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { http, toApiError } from './client'
import { ApiError } from './types'

describe('API client', () => {
  it('is configured for Sanctum cookie auth', () => {
    expect(http.defaults.withCredentials).toBe(true)
    expect(http.defaults.withXSRFToken).toBe(true)
    expect(http.defaults.baseURL).toMatch(/^https?:\/\//)
  })

  it('normalises API error envelopes into ApiError', () => {
    const err = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 422,
      statusText: 'Unprocessable',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { success: false, message: 'The given data was invalid.', errors: { email: ['Required'] } },
    })
    const apiError = toApiError(err)
    expect(apiError).toBeInstanceOf(ApiError)
    expect(apiError.status).toBe(422)
    expect(apiError.isValidationError).toBe(true)
    expect(apiError.errors.email).toEqual(['Required'])
  })

  it('reports network failures with status 0', () => {
    const apiError = toApiError(new AxiosError('Network Error', 'ERR_NETWORK'))
    expect(apiError.isNetworkError).toBe(true)
    expect(apiError.message).toMatch(/Unable to reach/)
  })
})

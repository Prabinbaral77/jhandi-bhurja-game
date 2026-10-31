import type { NextFunction, Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { sameOriginOnly } from '#lib/security'

const run = (method: string, origin?: string) => {
  const req = {
    method,
    header: (name: string) => (name === 'origin' ? origin : undefined),
  } as unknown as Request
  const status = vi.fn().mockReturnThis()
  const json = vi.fn()
  const res = { status, json } as unknown as Response
  const next = vi.fn() as unknown as NextFunction
  sameOriginOnly(req, res, next)
  return { next: next as ReturnType<typeof vi.fn>, status }
}

describe('sameOriginOnly (CSRF defence in depth)', () => {
  it('lets same-origin and origin-less mutations through', () => {
    expect(run('POST', 'http://localhost:5173').next).toHaveBeenCalled()
    expect(run('POST').next).toHaveBeenCalled()
  })

  it('refuses mutations from any other origin', () => {
    const r = run('POST', 'https://evil.example')
    expect(r.next).not.toHaveBeenCalled()
    expect(r.status).toHaveBeenCalledWith(403)
  })

  it('never blocks reads (they carry no state change)', () => {
    expect(run('GET', 'https://evil.example').next).toHaveBeenCalled()
  })
})

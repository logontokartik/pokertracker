'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authToken, isCorrectPassword } from '@/lib/auth-core'
import { AUTH_COOKIE } from '@/lib/auth'

export async function login(
  _prev: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string }> {
  const password = String(formData.get('password') ?? '')
  if (!isCorrectPassword(password)) return { error: 'Wrong password' }
  const store = await cookies()
  store.set(AUTH_COOKIE, authToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  redirect('/')
}

export async function logout(): Promise<void> {
  const store = await cookies()
  store.delete(AUTH_COOKIE)
  redirect('/login')
}

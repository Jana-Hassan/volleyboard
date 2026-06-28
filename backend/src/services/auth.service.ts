import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { RegisterBody, LoginBody, AuthPayload } from '../types'

const SALT_ROUNDS = 10
const JWT_EXPIRES_IN = '7d'

export const registerUser = async (body: RegisterBody) => {
  const { name, email, password } = body

  const existing = await prisma.user.findUnique({
    where: { email }
  })

  if (existing) {
    throw new Error('EMAIL_TAKEN')
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  const user = await prisma.user.create({
    data: { name, email, passwordHash }
  })

  const token = generateToken({ userId: user.id, email: user.email })

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  }
}

export const loginUser = async (body: LoginBody) => {
  const { email, password } = body

  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    throw new Error('INVALID_CREDENTIALS')
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash)

  if (!passwordMatch) {
    throw new Error('INVALID_CREDENTIALS')
  }

  const token = generateToken({ userId: user.id, email: user.email })

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  }
}

const generateToken = (payload: AuthPayload): string => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN })
}
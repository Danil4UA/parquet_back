import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
}

interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Access denied. No token provided.', code: 'NO_TOKEN' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not configured');
    res.status(500).json({ message: 'Server error' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    (req as AuthRequest).user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: 'Token expired.', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ message: 'Invalid token.', code: 'INVALID_TOKEN' });
  }
}

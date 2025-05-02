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
    res.status(401).json({ message: 'Access denied. No token provided.' });
    return; 
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as JwtPayload;
    (req as AuthRequest).user = decoded; 
    next();
  } catch (error) {
    console.error('JWT Error:', error);
    res.status(403).json({ message: 'Invalid token.'});
    return;
    }
}

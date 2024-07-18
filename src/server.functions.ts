import {NextFunction, Request, Response} from 'express';
import jwt from 'jsonwebtoken';
import {jwtSecret} from './database.model.js';

interface DecodedToken {
    user_id: string;
    email: string;
}

export function verifyToken(req: Request, res: Response, next: NextFunction) {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Brak tokena autoryzacyjnego' });
    }

    try {
        res.locals.token = jwt.verify(token, jwtSecret) as DecodedToken; // Przechowywanie zdekodowanego tokena w res.locals
        next();
    } catch (err) {
        return res.status(400).json({ message: 'Niepoprawny token.' });
    }
}
export function checkToken (req: Request, res: Response, next: NextFunction){
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        res.locals.token = { user_id: null };
        return next();
    }

    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
            res.locals.token = { user_id: null };
            return next();
        }

        res.locals.token = decoded;
        next();
    });
}

export function validatePassword(password: string): boolean {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
}

export function validateUsername(username: string): boolean {
    const usernamePattern = /^[^\s]{3,20}$/; // No spaces, between 3 and 20 characters
    return usernamePattern.test(username);
}

export function validateEmail(email: string): boolean {
    const regex = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
}
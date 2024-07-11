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
        return res.status(401).json({ success: false, message: 'Brak tokena autoryzacyjnego' });
    }

    try {
        res.locals.token = jwt.verify(token, jwtSecret) as DecodedToken; // Przechowywanie zdekodowanego tokena w res.locals
        next();
    } catch (err) {
        return res.status(400).json({ success: false, message: 'Niepoprawny token.' });
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
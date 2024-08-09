import pool from './database.model.js';

import {Request, Response} from 'express';
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";

import {jwtSecret} from "./database.model.js";
import {validateEmail, validatePassword, validateUsername} from "./server.functions.js";
import {User} from "./interfaces.js";

export const getUser = async (req: Request, res: Response) => {
    const {user_id} = res.locals.token;

    const client = await pool.connect();

    try {
        const userResult = await client.query(
            'SELECT * FROM users WHERE user_id = $1',
            [user_id]
        );

        if (userResult.rowCount === 0) {
            return res.status(404).json({message: 'Użytkownik nie został znaleziony'});
        }

        const user: User = userResult.rows[0];

        // Generowanie nowego tokena
        const newToken = jwt.sign({user_id: user.user_id, email: user.email}, jwtSecret as string, {
            expiresIn: '48h',
        });

        return res.status(200).json({
            token: newToken,
            user: user
        });
    } catch (err) {
        console.error('Błąd podczas pobierania danych użytkownika:', err);
        return res.status(500).json({message: 'Wystąpił błąd podczas pobierania danych użytkownika'});
    } finally {
        client.release();
    }
};

export async function patchUserData(req: Request, res: Response) {
    const {street, apartment, city} = req.body;
    const {user_id} = res.locals.token;

    const client= await pool.connect();
    try {
        await client.query('BEGIN');

        const updateQuery = `
            UPDATE users
            SET street = $1, apartment = $2, city = $3
            WHERE user_id = $4
        `;
        await client.query(updateQuery, [street, apartment, city, user_id]);

        await client.query('COMMIT');
        return res.status(200).json({message: 'Dane użytkownika zostały zaktualizowane'});
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Błąd podczas aktualizacji danych użytkownika:', err);
        return res.status(500).json({message: 'Wystąpił błąd podczas aktualizacji danych użytkownika'});
    } finally {
        client.release();
    }
}

export async function patchUserPassword(req: Request, res: Response) {
    const {oldPassword, newPassword} = req.body;
    const {user_id} = res.locals.token; // Dostęp do zdekodowanego tokena z res.locals

    if (!validatePassword(newPassword)) {
        return res.status(400).json({message: 'Nowe hasło musi zawierać przynajmniej jedną wielką literę, jedną małą literę, jedną cyfrę i jeden znak specjalny.'});
    }

    const client = await pool.connect();

    try {
        const userResult = await client.query(
            'SELECT password FROM users WHERE user_id = $1',
            [user_id]
        );

        if (userResult.rowCount === 0) {
            return res.status(404).json({message: 'Użytkownik nie został znaleziony'});
        }

        const user = userResult.rows[0];

        const isOldPasswordCorrect = await bcrypt.compare(oldPassword, user.password);
        if (!isOldPasswordCorrect) {
            return res.status(400).json({message: 'Złe hasło.'});
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        await client.query(
            'UPDATE users SET password = $1 WHERE user_id = $2',
            [hashedNewPassword, user_id]
        );

        return res.status(200).json({message: 'Hasło zostało zaktualizowane poprawnie'});
    } catch (err) {
        console.error('Błąd podczas aktualizacji hasła:', err);
        return res.status(500).json({message: 'Błąd bazy danych.'});
    } finally {
        client.release();
    }
}

export async function deleteUser(req: Request, res: Response) {
    const {user_id} = res.locals.token; // Dostęp do zdekodowanego tokena z res.locals

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Rozpoczynamy transakcję

        // Usuwamy recenzje użytkownika
        await client.query('DELETE FROM reviews WHERE user_id = $1', [user_id]);

        // Usuwamy użytkownika
        const deleteResult = await client.query('DELETE FROM users WHERE user_id = $1 RETURNING *', [user_id]);

        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK'); // Anulujemy transakcję w przypadku błędu
            return res.status(404).json({message: 'Użytkownik nie istnieje'});
        }

        await client.query('COMMIT'); // Zatwierdzamy transakcję

        return res.status(200).json({message: 'Użytkownik został usunięty'});
    } catch (err) {
        await client.query('ROLLBACK'); // Anulujemy transakcję w przypadku błędu
        console.error('Błąd podczas usuwania użytkownika:', err);
        return res.status(500).json({message: 'Wystąpił błąd podczas usuwania użytkownika'});
    } finally {
        client.release();
    }
}

export async function registerUser(req: Request, res: Response) {
    const {username, email, password}: { username: string, email: string, password: string } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({message: 'Brakuje danych użytkownika'});
    }
    if (!validateUsername(username)) {
        return res.status(400).json({message: 'Nieprawidłowa nazwa użytkownika'});
    }
    if (!validateEmail(email)) {
        return res.status(400).json({message: 'Nieprawidłowy email'});
    }
    if (!validatePassword(password)) {
        return res.status(400).json({message: 'Nieprawidłowe hasło'});
    }

    const client = await pool.connect();
    try {
        const emailCheckResult = await client.query(
            'SELECT 1 FROM users WHERE email = $1',
            [email]
        );

        if (emailCheckResult.rowCount !== 0) {
            return res.status(400).json({message: 'emailExist'});
        }

        const usernameCheckResult = await client.query(
            'SELECT 1 FROM users WHERE username = $1',
            [username]
        );

        if (usernameCheckResult.rowCount !== 0) {
            return res.status(400).json({message: 'usernameExist'});
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await client.query(
            'INSERT INTO users (username, email, city, street, apartment, password) VALUES ($1, $2, $3, $4, $5, $6)',
            [username, email, '', '', '', hashedPassword]
        );

        return res.status(201).json({message: "Stworzono użytkownika poprawnie"});
    } catch (err) {
        console.error('Błąd podczas dodawania użytkownika:', err);
        return res.status(500).json({message: 'Wystąpił błąd podczas dodawania użytkownika'});
    } finally {
        client.release();
    }
}

export async function loginUser(req: Request, res: Response) {
    const {email, password} = req.body;

    if (!email || !password) {
        return res.status(400).json({message: 'Brakuje danych do logowania'});
    }

    const client = await pool.connect();
    try {
        // Sprawdzenie, czy użytkownik istnieje w bazie danych
        const result = await client.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rowCount === 0) {
            return res.status(400).json({message: 'emailNonExist'});
        }

        const user: User = result.rows[0];

        // Weryfikacja hasła
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({message: 'badPassword'});
        }

        // Generowanie tokenu JWT
        const token = jwt.sign({user_id: user.user_id, email: user.email}, jwtSecret, {expiresIn: '48h'});

        return res.status(200).json({
            success: true,
            token: token,
            user: user
        });

    } catch (err) {
        console.error('Błąd podczas logowania użytkownika:', err);
        return res.status(500).json({message: 'Wystąpił błąd podczas logowania'});
    } finally {
        client.release();
    }
}
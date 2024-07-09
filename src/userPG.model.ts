import pool from './database.model.js';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import {PoolClient, QueryResult} from "pg";
import jwt from "jsonwebtoken";

import { jwtSecret } from "./database.model.js";
interface User {
    user_id: string;
    name: string;
    surname: string;
    email: string;
    city: string;
    street: string;
    apartment: string;
    password: string;
}

function validatePassword(password: string): boolean {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
}

function validateName(name: string): boolean {
    const regex = /^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]*( [A-ZĄĆĘŁŃÓŚŹŻ]([a-ząćęłńóśźż]){2,})?$/;
    return regex.test(name);
}

function validateSurname(surname: string): boolean {
    const regex = /^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]*(-[A-ZĄĆĘŁŃÓŚŹŻ]([a-ząćęłńóśźż]){2,})?$/;
    return regex.test(surname);
}

function validateEmail(email: string): boolean {
    const regex = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
}
export const getUser = async (req: Request, res: Response) => {
    const { user_id } = res.locals.token;

    const client: PoolClient = await pool.connect();

    try {
        const userResult: QueryResult<any> = await client.query(
            'SELECT * FROM users WHERE user_id = $1',
            [user_id]
        );

        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: 'Użytkownik nie został znaleziony' });
        }

        const user = userResult.rows[0];

        // Generowanie nowego tokena
        const newToken = jwt.sign({ user_id: user.user_id, email: user.email }, jwtSecret as string, {
            expiresIn: '48h',
        });

        return res.status(200).json({
            token: newToken,
            user: {
                user_id: user.user_id,
                name: user.name,
                surname: user.surname,
                email: user.email,
                city: user.city,
                street: user.street,
                apartment: user.apartment
            } });
    } catch (err) {
        console.error('Błąd podczas pobierania danych użytkownika:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas pobierania danych użytkownika' });
    } finally {
        client.release();
    }
};
export async function patchUserData(req: Request, res: Response) {
    const { street, apartment, city } = req.body;
    const { user_id } = res.locals.token;

    const client: PoolClient = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateQuery = `
            UPDATE users
            SET street = $1, apartment = $2, city = $3
            WHERE user_id = $4
        `;
        await client.query(updateQuery, [street, apartment, city, user_id]);

        await client.query('COMMIT');
        return res.status(200).json({ success: true, message: 'Dane użytkownika zostały zaktualizowane' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Błąd podczas aktualizacji danych użytkownika:', err);
        return res.status(500).json({ success: false, message: 'Wystąpił błąd podczas aktualizacji danych użytkownika' });
    } finally {
        client.release();
    }
}
export async function patchUserPassword(req: Request, res: Response) {
    const { oldPassword, newPassword } = req.body;
    const { user_id } = res.locals.token; // Dostęp do zdekodowanego tokena z res.locals

    if (!validatePassword(newPassword)) {
        return res.status(400).json({ success: false, message: 'Nowe hasło musi zawierać przynajmniej jedną wielką literę, jedną małą literę, jedną cyfrę i jeden znak specjalny.' });
    }

    const client = await pool.connect();

    try {
        const userResult = await client.query(
            'SELECT password FROM users WHERE user_id = $1',
            [user_id]
        );

        if (userResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Użytkownik nie został znaleziony' });
        }

        const user = userResult.rows[0];

        const isOldPasswordCorrect = await bcrypt.compare(oldPassword, user.password);
        if (!isOldPasswordCorrect) {
            return res.status(400).json({ success: false, message: 'Złe hasło.' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        await client.query(
            'UPDATE users SET password = $1 WHERE user_id = $2',
            [hashedNewPassword, user_id]
        );

        return res.status(200).json({ success: true, message: 'Hasło zostało zaktualizowane poprawnie' });
    } catch (err) {
        console.error('Błąd podczas aktualizacji hasła:', err);
        return res.status(500).json({ success: false, message: 'Błąd bazy danych.' });
    } finally {
        client.release();
    }
}
export async function deleteUser(req: Request, res: Response) {
    const { user_id } = res.locals.token; // Dostęp do zdekodowanego tokena z res.locals

    const client: PoolClient = await pool.connect();
    try {
        await client.query('BEGIN'); // Rozpoczynamy transakcję

        // Usuwamy recenzje użytkownika
        await client.query('DELETE FROM reviews WHERE user_id = $1', [user_id]);

        // Usuwamy użytkownika
        const deleteResult = await client.query('DELETE FROM users WHERE user_id = $1 RETURNING *', [user_id]);

        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK'); // Anulujemy transakcję w przypadku błędu
            return res.status(404).json({ error: 'Użytkownik nie istnieje' });
        }

        await client.query('COMMIT'); // Zatwierdzamy transakcję

        return res.status(200).json({ message: 'Użytkownik został usunięty' });
    } catch (err) {
        await client.query('ROLLBACK'); // Anulujemy transakcję w przypadku błędu
        console.error('Błąd podczas usuwania użytkownika:', err);
        return res.status(500).json({ error: 'Wystąpił błąd podczas usuwania użytkownika' });
    } finally {
        client.release();
    }
}
export async function registerUser(req: Request, res: Response) {
    const { name, surname, email, password }: User = req.body;

    if (!name || !surname || !email || !password) {
        return res.status(400).json({ success: false, message: 'Brakuje danych użytkownika' });
    }
    if (!validateName(name)) {
        return res.status(400).json({ success: false, message: 'Nieprawidłowe imię' });
    }
    if (!validateSurname(surname)) {
        return res.status(400).json({ success: false, message: 'Nieprawidłowe nazwisko' });
    }
    if (!validateEmail(email)) {
        return res.status(400).json({ success: false, message: 'Nieprawidłowy email' });
    }
    if (!validatePassword(password)) {
        return res.status(400).json({ success: false, message: 'Nieprawidłowe hasło' });
    }

    const client = await pool.connect();
    try {

        const emailCheckResult: QueryResult = await client.query(
            `SELECT 1 FROM users WHERE email = $1`,
            [email]
        );

        if (emailCheckResult.rowCount != 0) {
            return res.status(400).json({ success: false ,message: 'emailExist' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result: QueryResult = await client.query(
            `INSERT INTO users (name, surname, email, city, street, apartment, password)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [name, surname, email, '', '', '', hashedPassword]
        );

        return res.status(201).json({ success: true, message: "Stworzono użytkownika poprawnie" });
    } catch (err) {
        console.error('Błąd podczas dodawania użytkownika:', err);
        return res.status(500).json({ success: false, message: 'Wystąpił błąd podczas dodawania użytkownika' });
    } finally {
        client.release();
    }
}
export async function loginUser(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Brakuje danych do logowania' });
    }

    const client = await pool.connect();
    try {
        // Sprawdzenie, czy użytkownik istnieje w bazie danych
        const result: QueryResult = await client.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rowCount === 0) {
            return res.status(400).json({ success: false, message: 'emailNonExist' });
        }

        const user = result.rows[0];

        // Weryfikacja hasła
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ success: false, message: 'badPassword' });
        }

        // Generowanie tokenu JWT
        const token = jwt.sign({ user_id: user.user_id, email: user.email }, jwtSecret, { expiresIn: '48h' });

        return res.status(200).json({
            success: true,
            token: token,
            user: {
                user_id: user.user_id,
                name: user.name,
                surname: user.surname,
                email: user.email,
                city: user.city,
                street: user.street,
                apartment: user.apartment
            }
        });

    } catch (err) {
        console.error('Błąd podczas logowania użytkownika:', err);
        return res.status(500).json({ success: false, message: 'Wystąpił błąd podczas logowania' });
    } finally {
        client.release();
    }
}
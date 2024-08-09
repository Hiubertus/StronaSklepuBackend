import pool from "./database.model.js";

import {Response, Request} from "express";
import { Statuses } from "./interfaces.js";

export async function getStatuses(req: Request, res: Response) {
    const client = await pool.connect();
    const order_id = Number(req.query.order_id);
    const { user_id } = res.locals.token;

    if (!order_id) {
        return res.status(400).json({ message: 'Brakuje identyfikatora zamówienia' });
    }

    try {
        // Sprawdzamy, czy zamówienie należy do użytkownika
        const orderCheckQuery = `SELECT order_id FROM orders WHERE order_id = $1 AND user_id = $2`;
        const orderCheckResult = await client.query(orderCheckQuery, [order_id, user_id]);

        if (orderCheckResult.rows.length === 0) {
            return res.status(404).json({ message: 'Zamówienie nie zostało znalezione lub nie należy do użytkownika' });
        }

        // Pobieramy statusy zamówienia
        const statusQuery = `SELECT * FROM order_status WHERE order_id = $1 ORDER BY date DESC`;
        const statusResult = await client.query(statusQuery, [order_id]);

        const statuses: Statuses[] = statusResult.rows
        res.status(200).json(statuses);
    } catch (err) {
        console.error('Błąd podczas pobierania statusów zamówienia:', err);
        res.status(500).json({ message: 'Wystąpił błąd podczas pobierania statusów zamówienia' });
    } finally {
        client.release();
    }
}
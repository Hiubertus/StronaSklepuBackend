import {Request, Response} from "express";
import {PoolClient, QueryResult} from "pg";
import pool from "./database.model.js";

interface Review {
    review_id: number;
    user_id: number;
    item_id: number;
    text: string;
    rate: number;
    username: string;
    date: string;
}

export async function addReview(req: Request, res: Response) {
    const client: PoolClient = await pool.connect();
    const { item_id, text, rate, date } = req.body;
    const { user_id } = res.locals.token; // Dostęp do zdekodowanego tokena z res.locals

    if (!item_id || !rate || !date ) {
        return res.status(400).json({ message: "Nie ma wszystkich danych" });
    }

    if (text.length > 1500) {
        return res.status(400).json({ message: "Recenzja jest za długa. Maksymalna długość to 1500 znaków." });
    }

    try {
        await client.query('BEGIN');

        const reviewExistsResult: QueryResult = await client.query(
            'SELECT 1 FROM reviews WHERE user_id = $1 AND item_id = $2',
            [user_id, item_id]
        );

        if (reviewExistsResult.rowCount != 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Użytkownik już dodał recenzję dla tego przedmiotu' });
        }

        await client.query(
            `INSERT INTO reviews (user_id, item_id, text, rate, date)
             VALUES ($1, $2, $3, $4, $5)`,
            [user_id, item_id, text, rate, date]
        );

        await client.query(
            `UPDATE items 
             SET rating = (SELECT AVG(rate) FROM reviews WHERE item_id = $1),
                 review_amount = (SELECT COUNT(*) FROM reviews WHERE item_id = $1)
             WHERE item_id = $1`,
            [item_id]
        );

        await client.query('COMMIT');
        return res.status(200).json({ message: "Recenzja została dodana poprawnie" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Błąd podczas dodawania recenzji:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas dodawania recenzji' });
    } finally {
        client.release();
    }
}
export async function patchReview(req: Request, res: Response) {
    const client: PoolClient = await pool.connect();
    const { item_id, text, rate, date } = req.body;
    const { user_id } = res.locals.token; // Dostęp do zdekodowanego tokena z res.locals

    if (!item_id || !rate || !date) {
        return res.status(400).json({ message: "Nie ma wszystkich danych" });
    }

    if (text.length > 1500) {
        return res.status(400).json({ message: "Recenzja jest za długa. Maksymalna długość to 1500 znaków." });
    }

    try {
        await client.query('BEGIN');

        const reviewExistsResult: QueryResult = await client.query(
            'SELECT 1 FROM reviews WHERE user_id = $1 AND item_id = $2',
            [user_id, item_id]
        );

        if (reviewExistsResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Recenzja nie została znaleziona' });
        }

        await client.query(
            `UPDATE reviews 
             SET text = $3, rate = $4, date = $5
             WHERE user_id = $1 AND item_id = $2`,
            [user_id, item_id, text, rate, date]
        );

        await client.query(
            `UPDATE items 
             SET rating = (SELECT AVG(rate) FROM reviews WHERE item_id = $1),
                 review_amount = (SELECT COUNT(*) FROM reviews WHERE item_id = $1)
             WHERE item_id = $1`,
            [item_id]
        );

        await client.query('COMMIT');
        return res.status(200).json({ message: "Recenzja została zaktualizowana poprawnie" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Błąd podczas aktualizowania recenzji:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas aktualizowania recenzji' });
    } finally {
        client.release();
    }
}
export async function deleteReview(req: Request, res: Response) {
    const item_id: number = Number(req.query.item_id);
    const { user_id } = res.locals.token; // Dostęp do zdekodowanego tokena z res.locals

    const client: PoolClient = await pool.connect();
    try {
        await client.query('BEGIN');

        // Sprawdzenie, czy recenzja istnieje
        const reviewResult: QueryResult<any> = await client.query(
            'SELECT rate FROM reviews WHERE user_id = $1 AND item_id = $2',
            [user_id, item_id]
        );

        if (reviewResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Recenzja nie została znaleziona' });
        }

        const { rate } = reviewResult.rows[0];

        await client.query(
            'DELETE FROM reviews WHERE user_id = $1 AND item_id = $2',
            [user_id, item_id]
        );

        // Pobranie aktualnej średniej oceny oraz ilości recenzji dla danego przedmiotu
        const itemResult: QueryResult<any> = await client.query(
            'SELECT rating, review_amount FROM items WHERE item_id = $1',
            [item_id]
        );

        if (itemResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Przedmiot nie został znaleziony' });
        }

        const { rating, review_amount } = itemResult.rows[0];
        const newReviewAmount = review_amount - 1;
        let newRating = 0;

        if (newReviewAmount > 0) {
            newRating = ((rating * review_amount) - rate) / newReviewAmount;
        }

        // Aktualizacja średniej oceny oraz ilości recenzji w tabeli items
        await client.query(
            `UPDATE items
             SET rating = $1, review_amount = $2
             WHERE item_id = $3`,
            [newRating, newReviewAmount, item_id]
        );

        await client.query('COMMIT');
        return res.status(200).json({ message: 'Recenzja została usunięta poprawnie' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Błąd podczas usuwania recenzji:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas usuwania recenzji' });
    } finally {
        client.release();
    }
}
export async function getItemReviews(req: Request, res: Response) {
    const client: PoolClient = await pool.connect();
    const item_id = Number(req.query.item_id);
    const filter = req.query.filter as string || 'date';
    const sortOrder = req.query.sort as string || 'desc';
    const limit = 4;
    const offset = Number(req.query.offset) || 0;
    const { user_id } = res.locals.token;

    if (!item_id) {
        return res.status(400).json({ message: "Nie podano ID przedmiotu" });
    }

    if (filter !== 'rate' && filter !== 'date') {
        return res.status(400).json({ message: "Nieprawidłowy filtr. Użyj 'rate' lub 'date'." });
    }

    if (sortOrder !== 'asc' && sortOrder !== 'desc') {
        return res.status(400).json({ message: "Nieprawidłowy sortOrder. Użyj 'asc' lub 'desc'." });
    }

    try {
        const userReviewQuery = `
            SELECT 
                r.review_id,
                r.user_id,
                r.item_id,
                r.text,
                r.rate,
                r.date,
                u.username
            FROM 
                reviews r
            LEFT JOIN 
                users u ON r.user_id = u.user_id
            WHERE 
                r.item_id = $1 AND r.user_id = $2
            LIMIT 1
        `;

        const itemReviewsQuery = `
            SELECT 
                r.review_id,
                r.user_id,
                r.item_id,
                r.text,
                r.rate,
                r.date,
                u.username
            FROM 
                reviews r
            LEFT JOIN 
                users u ON r.user_id = u.user_id
            WHERE 
                r.item_id = $1
                ${user_id ? 'AND r.user_id != $4' : ''}
            ORDER BY 
                ${filter} ${sortOrder}
            LIMIT $2
            OFFSET $3
        `;

        const userReviewPromise = user_id ? await client.query(userReviewQuery, [item_id, user_id]) : {rows: []};
        const itemReviewsPromise = client.query(itemReviewsQuery, user_id ? [item_id, limit, offset, user_id] : [item_id, limit, offset]);

        const [userReviewResult, itemReviewsResult] = await Promise.all([userReviewPromise, itemReviewsPromise]);

        const userReview: Review | null = userReviewResult.rows.length > 0 ? {
            review_id: userReviewResult.rows[0].review_id,
            user_id: userReviewResult.rows[0].user_id,
            item_id: userReviewResult.rows[0].item_id,
            text: userReviewResult.rows[0].text,
            rate: userReviewResult.rows[0].rate,
            date: userReviewResult.rows[0].date,
            username: userReviewResult.rows[0].username,

        } : null;

        const itemReviews: Review[] = itemReviewsResult.rows.map((row: any) => ({
            review_id: row.review_id,
            user_id: row.user_id,
            item_id: row.item_id,
            text: row.text,
            rate: row.rate,
            date: row.date,
            username: row.username,
        }));

        return res.json({ userReview, itemReviews });
    } catch (err) {
        console.error('Błąd podczas pobierania recenzji:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas pobierania recenzji' });
    } finally {
        client.release();
    }
}
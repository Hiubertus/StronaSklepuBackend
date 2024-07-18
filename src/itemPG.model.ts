import  pool  from "./database.model.js";
import { PoolClient, QueryResult } from "pg";
import { Response, Request } from "express";

interface Item {
    item_id: number;
    name: string;
    cost: number;
    image: string;
    description: string;
    rating: number;
    tags: string[];
    review_amount: number;
}

export async function getItem(req: Request, res: Response) {
    const client: PoolClient = await pool.connect();
    const item_id = Number(req.query.item_id);

    if (!item_id) {
        return res.status(400).json({ message: "Nie podano ID przedmiotu" });
    }

    try {
        const query = 'SELECT * FROM items WHERE item_id = $1';
        const { rows }: { rows: Item[] } = await client.query(query, [item_id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Przedmiot nie został znaleziony' });
        }

        const item: Item = rows[0];
        return res.json(item);
    } catch (err) {
        console.error('Błąd podczas pobierania przedmiotu:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas pobierania przedmiotu' });
    } finally {
        client.release();
    }
}


export async function getItems(req: Request, res: Response) {
    const client: PoolClient = await pool.connect();
    try {
        const { rows }: QueryResult<any> = await client.query(`
            SELECT 
                item_id,
                name,
                cost,
                image,
                description,
                rating,
                tags,
                review_amount
            FROM 
                items
        `);

        const items: Item[] = rows.map((row: any) => ({
            item_id: row.item_id,
            name: row.name,
            cost: row.cost,
            image: row.image,
            description: row.description,
            rating: row.rating,
            tags: row.tags ? [row.tags] : [],
            review_amount: row.review_amount,
        }));

        return res.json(items);
    } catch (err) {
        console.error('Błąd podczas pobierania danych z bazy danych:', err);
        return res.status(500).json({ message: 'Wystąpił błąd podczas pobierania danych' });
    } finally {
        client.release();
    }
}
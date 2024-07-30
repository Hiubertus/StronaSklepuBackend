import pool from "./database.model.js";
import {Response, Request} from "express";
import {Item} from "./interfaces.js";


export async function getItem(req: Request, res: Response) {
    const client= await pool.connect();
    const item_id = Number(req.query.item_id);

    if (!item_id) {
        return res.status(400).json({message: "Nie podano ID przedmiotu"});
    }

    try {
        const query = 'SELECT * FROM items WHERE item_id = $1';
        const {rows}: { rows: Item[] } = await client.query(query, [item_id]);

        if (rows.length === 0) {
            return res.status(404).json({message: 'Przedmiot nie został znaleziony'});
        }

        const item: Item = rows[0];
        return res.json(item);
    } catch (err) {
        console.error('Błąd podczas pobierania przedmiotu:', err);
        return res.status(500).json({message: 'Wystąpił błąd podczas pobierania przedmiotu'});
    } finally {
        client.release();
    }
}


export async function getItems(req: Request, res: Response) {
    const client= await pool.connect();
    try {
        const query = 'SELECT * FROM items';
        const {rows}: { rows: Item[] } = await client.query(query);

        const items: Item[] = rows.map((item: Item) => ({...item}));

        return res.json(items);
    } catch (err) {
        console.error('Błąd podczas pobierania danych z bazy danych:', err);
        return res.status(500).json({message: 'Wystąpił błąd podczas pobierania danych'});
    } finally {
        client.release();
    }
}
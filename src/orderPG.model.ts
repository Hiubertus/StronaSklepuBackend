import pool from "./database.model.js";

import {Response, Request} from "express";
import {Item, Order} from "./interfaces.js";
import {validateCity, validateName, validatePayment, validateStreet, validateSurname} from "./server.functions.js";


export async function getOrder(req: Request, res: Response) {
    const client = await pool.connect();
    const { user_id } = res.locals.token;
    const order_id = Number(req.query.order_id);

    if (!order_id) {
        return res.status(400).json({ message: 'Brakuje identyfikatora zamówienia' });
    }

    try {
        const orderQuery = `SELECT * FROM orders WHERE order_id = $1 AND user_id = $2`;
        const orderResult = await client.query(orderQuery, [order_id, user_id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ message: 'Zamówienie nie zostało znalezione' });
        }

        const order: Order = orderResult.rows[0];

        const itemsResult = await client.query(
            `SELECT oi.item_id, oi.quantity, oi.name, oi.cost, oi.image, i.description, i.rating, i.tags, i.review_amount
             FROM order_items oi
             JOIN items i ON oi.item_id = i.item_id
             WHERE oi.order_id = $1`,
            [order_id]
        );
        order.items = itemsResult.rows.map(item => ({
            item: {
                item_id: item.item_id,
                name: item.name,
                cost: item.cost,
                image: item.image,
                description: item.description,
                rating: item.rating,
                tags: item.tags,
                review_amount: item.review_amount
            },
            quantity: item.quantity
        }));


        res.status(200).json(order);
    } catch (err) {
        console.error('Błąd podczas pobierania zamówienia:', err);
        res.status(500).json({ message: 'Wystąpił błąd podczas pobierania zamówienia' });
    } finally {
        client.release();
    }
}

export async function getOrders(req: Request, res: Response) {
    const client = await pool.connect();
    const { user_id } = res.locals.token;

    try {
        const query = `SELECT * FROM orders WHERE user_id = $1`
        const result  = await client.query(query, [user_id]);
        const orders : Order[]  = result.rows;

        for (const order of orders) {
            const itemsResult = await client.query(
                `SELECT oi.item_id, oi.quantity, oi.name, oi.cost, oi.image, i.description, i.rating, i.tags, i.review_amount 
                 FROM order_items oi
                 JOIN items i ON oi.item_id = i.item_id
                 WHERE oi.order_id = $1`,
                [order.order_id]
            );
            order.items = itemsResult.rows.map(item => ({
                item: {
                    item_id: item.item_id,
                    name: item.name,
                    cost: item.cost,
                    image: item.image,
                    description: item.description,
                    rating: item.rating,
                    tags: item.tags,
                    review_amount: item.review_amount
                },
                quantity: item.quantity
            }));
        }

        res.status(200).json(orders);
    } catch (err) {
        console.error('Błąd podczas pobierania zamówień:', err);
        res.status(500).json({ message: 'Wystąpił błąd podczas pobierania zamówień' });
    } finally {
        client.release();
    }
}

export async function postOrder(req: Request, res: Response) {
    const client = await pool.connect();
    const {items, name, surname, city, street, apartment, payment, cost} = req.body;
    const {user_id} = res.locals.token;

    if (!validateName(name) || !validateSurname(surname) || !validateCity(city) || !validateStreet(street) || !validatePayment(payment)) {
        return res.status(400).json({message: 'Błędne dane wejściowe'});
    }

    if (cost < 0) {
        return res.status(400).json({message: 'Koszt nie może być mniejszy od zera'});
    }

    try {
        await client.query('BEGIN');

        // Generowanie daty na backendzie
        const date = new Date();

        const orderResult = await client.query(
            `INSERT INTO orders (user_id, cost, name, surname, apartment, street, city, payment, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING order_id`,
            [user_id, cost, name, surname, apartment, street, city, payment, date]
        );

        const order_id = orderResult.rows[0].order_id;

        let totalCost = 0;

        for (const itemRequest of items) {
            const item: Item = itemRequest.item;
            const quantity: number = itemRequest.quantity;

            const itemResult = await client.query(
                `SELECT cost FROM items WHERE item_id = $1`,
                [item.item_id]
            );

            if (itemResult.rows.length === 0) {
                return res.status(400).json({message: `Przedmiot o id ${item.item_id} nie istnieje`});
            }

            const dbCost = itemResult.rows[0].cost;

            if (dbCost !== item.cost) {
                return res.status(400).json({message: `Cena przedmiotu o id ${item.item_id} nie jest zgodna`});
            }

            totalCost += dbCost * quantity;

            await client.query(
                `INSERT INTO order_items (order_id, item_id, name, cost, quantity, image)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [order_id, item.item_id, item.name, item.cost, quantity, item.image]
            );
        }

        if (totalCost !== cost) {
            await client.query('ROLLBACK');
            return res.status(400).json({message: 'Całkowity koszt zamówienia nie zgadza się z podanym'});
        }

        await client.query(`INSERT INTO order_status (order_id, date, text)
             VALUES ($1, $2, 'Arrived')`,
            [order_id, date]
        );

        await client.query('COMMIT');
        res.status(201).json({message: 'Zamówienie zostało dodane poprawnie'});
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Błąd podczas dodawania zamówienia:', err);
        res.status(500).json({message: 'Wystąpił błąd podczas dodawania zamówienia'});
    } finally {
        client.release();
    }
}
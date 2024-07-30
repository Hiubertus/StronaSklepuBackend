export interface Item {
    item_id: number;
    name: string;
    cost: number;
    image: string;
    description: string;
    rating: number;
    tags: string[];
    review_amount: number;
}
export interface Order {
    order_id: number
    items: {item: Item , quantity: number}[]
    cost: number;
    apartment: string;
    street: string;
    city: string;
    payment: string;
    date: string;
    status: string;
}

export interface DecodedToken {
    user_id: string;
    email: string;
}

export interface Review {
    review_id: number;
    user_id: number;
    item_id: number;
    text: string;
    rate: number;
    username: string;
    date: string;
}
export interface User {
    user_id: string;
    username: string;
    email: string;
    city: string;
    street: string;
    apartment: string;
    password: string;
}
export interface Statuses {
    status_id: number,
    order_id: number,
    date: string,
    text: string
}
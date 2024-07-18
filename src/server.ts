import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors'

import {
    getItems,
    getItem
} from "./itemPG.model.js";

import {
    addReview,
    deleteReview,
    getItemReviews,
    patchReview
} from "./reviewPG.model.js"

import {
    registerUser,
    loginUser,
    deleteUser,
    patchUserPassword,
    patchUserData,
    getUser
} from "./userPG.model.js";

import {checkToken, verifyToken} from "./server.functions.js";

const appExpress = express()
const port = 3000;

appExpress.use(bodyParser.json());
appExpress.use(cors());

appExpress.get('/Item', getItem);

appExpress.get('/Items', getItems);

appExpress.get('/ItemReviews', checkToken, getItemReviews);

appExpress.get('/User', verifyToken, getUser)

appExpress.post('/registerUser', registerUser);

appExpress.post('/loginUser', loginUser);

appExpress.post('/Review', verifyToken, addReview);

appExpress.delete("/Review", verifyToken, deleteReview)

appExpress.delete('/User', verifyToken, deleteUser);

appExpress.patch('/Review', verifyToken, patchReview);

appExpress.patch('/UserData', verifyToken, patchUserData);

appExpress.patch('/UserPassword', verifyToken, patchUserPassword);

appExpress.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
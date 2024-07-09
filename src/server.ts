import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors'

import {
    getItemReviews,
    getItems,
    addReview,
    deleteReview, getUserReview
} from "./itemPG.model.js";

import {
    registerUser,
    loginUser,
    deleteUser,
    patchUserPassword,
    patchUserData, getUser
} from "./userPG.model.js";

import {verifyToken} from "./server.functions.js";

const appExpress = express()
const port = 3000;

appExpress.use(bodyParser.json());
appExpress.use(cors());

appExpress.get('/Items', getItems);

appExpress.get('/ItemReviews', getItemReviews);

appExpress.get('/UserReview', verifyToken ,getUserReview);

appExpress.post('/registerUser', registerUser);

appExpress.post('/loginUser', loginUser);

appExpress.post('/Review', verifyToken, addReview);

appExpress.delete("/Review", verifyToken, deleteReview)

appExpress.get('/User', verifyToken, getUser)

appExpress.delete('/User', verifyToken, deleteUser);

appExpress.patch('/UserData', verifyToken, patchUserData);

appExpress.patch('/UserPassword', verifyToken, patchUserPassword);

appExpress.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
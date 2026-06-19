const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3001;
const MONGO_URL = process.env.MONGO_URL;

const ProductSchema = new mongoose.Schema({
    name: String,
    price: Number,
    quantity: Number,
});
const Product = mongoose.model('Product', ProductSchema);

mongoose.connect(MONGO_URL).then(() => console.log('Stats MongoDB ga ulandi'));

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: process.env.APP_NAME || 'STATS' });
});

app.get('/stats', async (req, res) => {
    const totalProducts = await Product.countDocuments();
    const [agg] = await Product.aggregate([
        {
            $group: {
                _id: null,
                totalQuantity: { $sum: '$quantity' },
                totalValue: { $sum: { $multiply: ['$price', '$quantity'] } },
            },
        },
    ]);
    res.json({
        totalProducts,
        totalQuantity: agg?.totalQuantity ?? 0,
        totalValue: agg?.totalValue ?? 0,
    });
});

app.listen(PORT, () => console.log(`Stats ${PORT} portda`));

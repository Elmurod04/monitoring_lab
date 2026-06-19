const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');

const app = express();
const PORT = 3000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/products';

app.use(cors());
app.use(express.json());

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', ProductSchema);

const SEED_PRODUCTS = [
    { name: 'Olma', price: 8000, quantity: 120 },
    { name: 'Banan', price: 15000, quantity: 80 },
    { name: 'Sut 1L', price: 12000, quantity: 50 },
    { name: 'Non', price: 4000, quantity: 200 },
    { name: 'Laptop', price: 8500000, quantity: 10 },
];

async function seedProducts() {
    const count = await Product.countDocuments();
    if (count > 0) {
        console.log(`Bazada allaqachon ${count} ta mahsulot bor — seed o'tkazib yuborildi`);
        return;
    }

    await Product.insertMany(SEED_PRODUCTS);
    console.log('5 ta boshlang\'ich mahsulot MongoDB ga yozildi');
}

mongoose.connect(MONGO_URL)
    .then(async () => {
        console.log('MongoDB ga ulandi');
        await seedProducts();
    })
    .catch(err => console.error('MongoDB xato:', err));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: process.env.APP_NAME || 'backend' });
});

app.get('/api/products', async (req, res) => {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({
        server: process.env.APP_NAME || 'backend',
        products: products
    });
});

app.post('/api/products', async (req, res) => {
    const { name, price, quantity } = req.body;
    if (!name || !price || !quantity) {
        return res.status(400).json({ error: 'Barcha maydonlar kerak' });
    }
    const product = new Product({ name, price, quantity });
    await product.save();
    res.status(201).json(product);
});

app.delete('/api/products/:id', async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "O'chirildi" });
});

function fetchStats(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (statsRes) => {
            let body = '';
            statsRes.on('data', (chunk) => { body += chunk; });
            statsRes.on('end', () => {
                resolve({ ok: statsRes.statusCode >= 200 && statsRes.statusCode < 300, body });
            });
        }).on('error', reject);
    });
}

app.get('/api/stats', async (req, res) => {
    try {
        const { ok, body } = await fetchStats(`${process.env.STATS_URL}/stats`);
        if (!ok) {
            return res.status(502).json({ error: 'Stats servisi javob bermadi' });
        }
        const stats = JSON.parse(body);
        res.json({
            server: process.env.APP_NAME || 'backend',
            stats
        });
    } catch (err) {
        console.error('Stats xato:', err);
        res.status(502).json({ error: 'Stats servisiga ulanib bo\'lmadi' });
    }
});

// sekinlashtiruvchi endpoint
app.get('/api/slow', async (req, res) => {
    const delayMs = Number(req.query.ms) || 2000; // default 2 soniya
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    res.json({ ok: true, delayed: delayMs });
});

// xato endpoint
app.get('/api/error', (req, res) => {
    const code = Number(req.query.code) || 500;
    res.status(code).json({ error: 'Test xato', code });
});


app.listen(PORT, () => {
    console.log(`Backend ${PORT} portda ishlamoqda`);

});





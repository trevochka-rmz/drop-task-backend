const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001;

// Middleware для логирования
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.body) console.log('Body:', req.body);
    if (req.query) console.log('Query:', req.query);
    next();
});

app.use(cors());
app.use(express.json());

let items = Array.from({ length: 1000000 }, (_, i) => ({
    id: i + 1,
    text: `Item ${i + 1}`,
    selected: false,
}));

let state = {
    order: null,
    selected: [],
};

// Получение текущего состояния
app.get('/api/state', (req, res) => {
    try {
        console.log('Fetching current state');
        res.json({
            order: state.order,
            selected: state.selected,
        });
    } catch (error) {
        console.error('Error in /api/state:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Обновление порядка элементов
app.post('/api/update-order', (req, res) => {
    try {
        state.order = req.body.order;
        console.log('Order updated:', state.order);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// Обновление выбранных элементов
app.post('/api/update-selection', (req, res) => {
    try {
        const { id, selected } = req.body;

        if (selected) {
            if (!state.selected.includes(id)) {
                state.selected.push(id);
            }
        } else {
            state.selected = state.selected.filter((itemId) => itemId !== id);
        }

        console.log('Selection updated:', state.selected);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating selection:', error);
        res.status(500).json({ error: 'Failed to update selection' });
    }
});

// Получение элементов с пагинацией и поиском
app.get('/api/items', async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        console.log(
            `Fetching items: page=${page}, limit=${limit}, search="${search}"`
        );

        let filteredItems = [...items];

        if (search) {
            filteredItems = filteredItems.filter((item) =>
                item.text.toLowerCase().includes(search.toLowerCase())
            );
        }

        if (state.order) {
            filteredItems.sort((a, b) => {
                const aIndex = state.order.indexOf(a.id);
                const bIndex = state.order.indexOf(b.id);

                if (aIndex === -1 && bIndex === -1) return 0;
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;

                return aIndex - bIndex;
            });
        }

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        filteredItems = filteredItems.map((item) => ({
            ...item,
            selected: state.selected.includes(item.id),
        }));

        console.log(
            `Returning items ${startIndex}-${endIndex} of ${filteredItems.length}`
        );

        res.json({
            items: filteredItems.slice(startIndex, endIndex),
            total: filteredItems.length,
            hasMore: endIndex < filteredItems.length,
        });
    } catch (error) {
        console.error('Error in /api/items:', error);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});

// Обработчик 404
app.use((req, res) => {
    console.warn(`Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Not found' });
});

// Обработчик ошибок сервера
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3001;

// Improved CORS setup
app.use(
    cors({
        origin: 'https://drop-task.vercel.app',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type'],
    })
);

app.use(express.json());

// In-memory storage for application state
const state = {
    // Stores custom order of IDs (null means original order)
    customOrder: null,
    // Stores selected item IDs
    selectedItems: new Set(),
    // Cache for search results { searchTerm: { ids: [], total: number }}
    searchCache: new Map(),
};

// Generate item data on demand
const generateItem = (id) => ({
    id,
    text: `Item ${id}`,
    selected: state.selectedItems.has(id),
});

// Apply custom ordering to IDs
const applyCustomOrder = (ids) => {
    if (!state.customOrder) return ids;

    const orderedIds = [];
    const remainingIds = new Set(ids);

    // 1. Add items from custom order first
    for (const id of state.customOrder) {
        if (remainingIds.has(id)) {
            orderedIds.push(id);
            remainingIds.delete(id);
        }
    }

    // 2. Add remaining items in original order
    for (const id of ids) {
        if (remainingIds.has(id)) {
            orderedIds.push(id);
        }
    }

    return orderedIds;
};

// API Endpoints

// Get paginated items with search and sorting
app.get('/api/items', (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
        const searchTerm = search.toLowerCase().trim();

        let itemIds = [];
        let total = 1000000;

        if (searchTerm) {
            if (state.searchCache.has(searchTerm)) {
                console.log(`Cache hit for search: ${searchTerm}`);
                const cache = state.searchCache.get(searchTerm);
                itemIds = cache.ids;
                total = cache.total;
            } else {
                console.log(`Computing search for: ${searchTerm}`);
                const matchIds = [];
                for (let id = 1; id <= 1000000; id++) {
                    if (`${id}`.includes(searchTerm)) {
                        matchIds.push(id);
                    }
                    if (matchIds.length >= 1000) break;
                }
                itemIds = matchIds;
                total = matchIds.length;
                state.searchCache.set(searchTerm, { ids: itemIds, total });
            }
        } else if (
            state.customOrder &&
            Array.isArray(state.customOrder) &&
            state.customOrder.length > 0
        ) {
            itemIds = state.customOrder;
            total = state.customOrder.length;
        } else {
            itemIds = Array.from({ length: 1000000 }, (_, i) => i + 1);
            total = 1000000;
        }

        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const resultIds = itemIds.slice(startIndex, endIndex);

        const items = resultIds.map(generateItem);

        console.log('API /items:', {
            pageNum,
            limitNum,
            total,
            hasMore: endIndex < total,
            items: resultIds.length,
        });
        res.json({
            items,
            total,
            hasMore: endIndex < total,
            page: pageNum,
            limit: items.length,
        });
    } catch (error) {
        console.error('Error in /api/items:', error.stack);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});
// Save custom item order
app.post('/api/update-order', (req, res) => {
    try {
        const { order } = req.body;

        if (!Array.isArray(order)) {
            return res.status(400).json({ error: 'Order must be an array' });
        }

        // Validate all IDs are unique and within range
        const idSet = new Set();
        for (const id of order) {
            if (typeof id !== 'number' || id < 1 || id > 1000000) {
                return res.status(400).json({ error: `Invalid ID: ${id}` });
            }
            if (idSet.has(id)) {
                return res.status(400).json({ error: `Duplicate ID: ${id}` });
            }
            idSet.add(id);
        }

        state.customOrder = order;
        state.searchCache.clear(); // Invalidate search cache

        res.json({
            success: true,
            message: `Order updated with ${order.length} items`,
        });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// Update item selection
app.post('/api/update-selection', (req, res) => {
    try {
        const { id, selected } = req.body;

        if (typeof id !== 'number' || id < 1 || id > 1000000) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }

        if (selected) {
            state.selectedItems.add(id);
        } else {
            state.selectedItems.delete(id);
        }

        res.json({
            success: true,
            selected: selected,
            selectedCount: state.selectedItems.size,
        });
    } catch (error) {
        console.error('Error updating selection:', error);
        res.status(500).json({ error: 'Failed to update selection' });
    }
});

// Get current application state
app.get('/api/state', (req, res) => {
    res.json({
        selected: Array.from(state.selectedItems),
        selectedCount: state.selectedItems.size,
        hasCustomOrder: !!state.customOrder,
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log('Initialized with 1,000,000 items');
});

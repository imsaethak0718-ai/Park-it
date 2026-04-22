const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite explicitly substituting MongoDB for native zero-config running
const db = new sqlite3.Database('./owner_db.sqlite');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS parking (id TEXT PRIMARY KEY, owner_id TEXT, name TEXT, location TEXT, total_slots INTEGER, available_slots INTEGER, price_per_hour REAL, created_at INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS vehicles (id TEXT PRIMARY KEY, parking_id TEXT, vehicle_type TEXT, vehicle_number TEXT, entry_time INTEGER, exit_time INTEGER, duration REAL, price REAL, status TEXT)");
});

// =======================
// 1. AUTHENTICATION
// =======================
app.post('/api/auth/signup', (req, res) => {
    const { name, email, password } = req.body;
    if(!name || !email || !password) return res.status(400).json({error: "Missing fields"});

    db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
        if (row) return res.status(400).json({ error: "Email already registered" });
        
        const userId = "OWN_" + Date.now();
        db.run("INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)", [userId, name, email, password], (err) => {
            if (err) return res.status(500).json({ error: "DB Error" });
            res.json({ id: userId, name, email });
        });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get("SELECT id, name, email, password FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) return res.status(404).json({ error: "Account not found" });
        if (user.password !== password) return res.status(401).json({ error: "Invalid password" });
        
        res.json({ id: user.id, name: user.name, email: user.email });
    });
});

// =======================
// 2. PARKING MANAGEMENT
// =======================
// Get all parking lots for an owner
app.get('/api/parking/owner/:ownerId', (req, res) => {
    const ownerId = req.params.ownerId;
    db.all("SELECT * FROM parking WHERE owner_id = ? ORDER BY created_at DESC", [ownerId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// Get SINGLE parking lot details
app.get('/api/parking/:id', (req, res) => {
    db.get("SELECT * FROM parking WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Lot not found" });
        res.json(row);
    });
});

// Add new parking lot
app.post('/api/parking', (req, res) => {
    const { owner_id, name, location, total_slots, price_per_hour } = req.body;
    if (!owner_id || !name || !location || total_slots == null) return res.status(400).json({ error: "Missing required fields" });

    const lotId = "PRK_" + Date.now();
    db.run(`INSERT INTO parking (id, owner_id, name, location, total_slots, available_slots, price_per_hour, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
        [lotId, owner_id, name, location, total_slots, total_slots, price_per_hour || 0, Date.now()], 
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: lotId });
        }
    );
});

app.delete('/api/parking/:id', (req, res) => {
    db.run("DELETE FROM parking WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// =======================
// 3. VEHICLE TRACKING + RECEIPT CALCULATION
// =======================

// Get active vehicles for a specific lot
app.get('/api/parking/:id/vehicles', (req, res) => {
    db.all("SELECT * FROM vehicles WHERE parking_id = ? AND status = 'active' ORDER BY entry_time DESC", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// Vehicle Entry
app.post('/api/parking/:id/vehicles/enter', (req, res) => {
    const { vehicle_type, vehicle_number } = req.body;
    const parking_id = req.params.id;

    db.get("SELECT total_slots, available_slots FROM parking WHERE id = ?", [parking_id], (err, lot) => {
        if (!lot) return res.status(404).json({ error: "Lot not found" });
        if (lot.available_slots <= 0) return res.status(400).json({ error: "Parking is fully occupied." });

        const vid = "VEH_" + Date.now();
        db.run("INSERT INTO vehicles (id, parking_id, vehicle_type, vehicle_number, entry_time, exit_time, duration, price, status) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 'active')", 
            [vid, parking_id, vehicle_type, vehicle_number || "", Date.now()], 
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                db.run("UPDATE parking SET available_slots = available_slots - 1 WHERE id = ?", [parking_id], (err) => {
                    res.json({ success: true, vehicle_id: vid });
                });
            }
        );
    });
});

// Vehicle Exit + Receipt
app.post('/api/parking/:id/vehicles/:vid/exit', (req, res) => {
    const { id, vid } = req.params;

    db.get("SELECT * FROM vehicles WHERE id = ?", [vid], (err, vehicle) => {
        if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
        if (vehicle.status === 'exited') return res.status(400).json({ error: "Vehicle already exited" });

        db.get("SELECT name, price_per_hour FROM parking WHERE id = ?", [id], (err, lot) => {
            if (!lot) return res.status(404).json({ error: "Lot detached" });

            const exit_time = Date.now();
            let durationHours = (exit_time - vehicle.entry_time) / (1000 * 60 * 60);

            // Floor duration to prevent edge cases, min 1 hour charge for test purposes or raw exact.
            if(durationHours < 1) durationHours = 1;

            const total_price = durationHours * lot.price_per_hour;

            db.run("UPDATE vehicles SET exit_time = ?, duration = ?, price = ?, status = 'exited' WHERE id = ?", [exit_time, durationHours, total_price, vid], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                
                db.run("UPDATE parking SET available_slots = available_slots + 1 WHERE id = ?", [id], (err) => {
                    // Provide Receipt
                    res.json({ 
                        success: true, 
                        receipt: {
                            lot_name: lot.name,
                            vehicle_type: vehicle.vehicle_type,
                            vehicle_number: vehicle.vehicle_number,
                            entry_time: vehicle.entry_time,
                            exit_time: exit_time,
                            durationHours: durationHours,
                            total_price: total_price
                        }
                    });
                });
            });
        });
    });
});

app.listen(3001, () => {
    console.log("Single-Role Owner Backend running on http://localhost:3001");
});

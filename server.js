const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, phone TEXT UNIQUE, password TEXT, role TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS parking (id TEXT PRIMARY KEY, owner_id TEXT, name TEXT, location TEXT, total_slots INTEGER, available_slots INTEGER, rate REAL)");
    db.run("CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, user_id TEXT, parking_id TEXT, time_duration INTEGER, plate TEXT, type TEXT)");
});

// AUTH MODULE
app.post('/api/auth/signup', (req, res) => {
    const { name, phone, password, role, parkingName, parkingLoc, parkingCap, parkingRate } = req.body;
    
    db.get("SELECT id FROM users WHERE phone = ?", [phone], (err, row) => {
        if (row) return res.status(400).json({ error: "IDENTITY ALREADY EXISTS WITH THIS PHONE" });
        
        const userId = "USR_" + Date.now();
        db.run("INSERT INTO users (id, name, phone, password, role) VALUES (?, ?, ?, ?, ?)", [userId, name, phone, password, role], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (role === 'owner') {
                const lotId = "LT_" + Date.now();
                db.run("INSERT INTO parking (id, owner_id, name, location, total_slots, available_slots, rate) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                    [lotId, userId, parkingName || "Terminal", parkingLoc || "LOCAL", parkingCap, parkingCap, parkingRate], 
                    (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        return res.json({ id: userId, role: role, message: "Owner constructed", activeLotId: lotId });
                    });
            } else {
                return res.json({ id: userId, role: role, message: "Customer constructed" });
            }
        });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { phone, password, requestedRole } = req.body;
    db.get("SELECT * FROM users WHERE phone = ?", [phone], (err, user) => {
        if (!user) return res.status(404).json({ error: "NO IDENTITY EXISTS" });
        if (user.password !== password) return res.status(401).json({ error: "INVALID PASSWORD" });
        if (user.role !== requestedRole) return res.status(403).json({ error: `This account is registered as ${user.role}. Please log in using the correct role.` });
        
        if (user.role === 'owner') {
            db.get("SELECT id FROM parking WHERE owner_id = ?", [user.id], (err, lot) => {
                res.json({ id: user.id, role: user.role, activeLotId: lot ? lot.id : null });
            });
        } else {
            res.json({ id: user.id, role: user.role });
        }
    });
});

// PARKING LIST FETCH (CUSTOMER)
app.get('/api/parking', (req, res) => {
    db.all("SELECT * FROM parking", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ lots: rows });
    });
});

// SINGLE LOT STATUS FETCH (OWNER)
app.get('/api/parking/:id', (req, res) => {
    db.get("SELECT * FROM parking WHERE id = ? OR owner_id = ?", [req.params.id, req.params.id], (err, lot) => {
        if (err || !lot) return res.status(404).json({ error: "Lot not found" });
        db.all("SELECT * FROM bookings WHERE parking_id = ?", [lot.id], (err, bookings) => {
            lot.bookings = bookings || [];
            res.json(lot);
        });
    });
});

// BOOKING POST (CUSTOMER & OWNER MANUAL INJECTION)
app.post('/api/bookings', (req, res) => {
    const { user_id, parking_id, time_duration, plate, type } = req.body;
    db.get("SELECT available_slots FROM parking WHERE id = ?", [parking_id], (err, lot) => {
        if (!lot || lot.available_slots <= 0) return res.status(400).json({ error: "FULL OR NOT FOUND" });
        
        // Ensure plate is not dup
        db.get("SELECT id FROM bookings WHERE parking_id = ? AND plate = ?", [parking_id, plate], (err, exist) => {
            if(exist) return res.status(400).json({ error: "VEHICLE ALREADY PARKED" });
            
            const bookingId = "BKG_" + Date.now();
            db.run("INSERT INTO bookings (id, user_id, parking_id, time_duration, plate, type) VALUES (?, ?, ?, ?, ?, ?)",
                [bookingId, user_id, parking_id, time_duration, plate, type], (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    db.run("UPDATE parking SET available_slots = available_slots - 1 WHERE id = ?", [parking_id], (err) => {
                        res.json({ success: true, bookingId });
                    });
                });
        });
    });
});

// REMOVE BOOKING (OWNER MANUAL REMOVE)
app.post('/api/bookings/remove', (req, res) => {
    const { parking_id, plate } = req.body;
    db.get("SELECT id FROM bookings WHERE parking_id = ? AND plate = ?", [parking_id, plate], (err, booking) => {
        if (!booking) return res.status(404).json({ error: "VEHICLE NOT FOUND" });
        
        db.run("DELETE FROM bookings WHERE id = ?", [booking.id], (err) => {
            db.run("UPDATE parking SET available_slots = available_slots + 1 WHERE id = ?", [parking_id], (err) => {
                res.json({ success: true });
            });
        });
    });
});

app.listen(3000, () => {
    console.log("ParkAI Real Database Backend running on http://localhost:3000");
});

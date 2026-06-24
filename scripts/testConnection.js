require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

(async () => {
  try {
    const conn = await connectDB();

    // Touch the database so Atlas actually creates it, then clean up.
    const ping = await conn.connection.db.admin().ping();
    console.log('Ping:', ping);

    const Probe = mongoose.model('Probe', new mongoose.Schema({ createdAt: Date }));
    const doc = await Probe.create({ createdAt: new Date() });
    console.log('Wrote probe document:', doc._id.toString());
    await Probe.deleteOne({ _id: doc._id });
    console.log('Cleaned up probe document.');

    console.log('\n✅ Database "snooker" is reachable and writable.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Connection failed:', err.message);
    process.exit(1);
  }
})();

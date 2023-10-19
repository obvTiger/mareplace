const FileSystem = require("fs");
const SmartBuffer = require("smart-buffer").SmartBuffer;
const fs = require('fs');

function readEvents(path) {
    const events = [];

    const buf = SmartBuffer.fromBuffer(FileSystem.readFileSync(path));

    while (buf.remaining() > 0) {
        const x = buf.readUInt16BE();
        const y = buf.readUInt16BE();

        const color = buf.readBuffer(3).readUIntBE(0, 3);

        const userId = buf.readBigUInt64BE().toString();
        const timestamp = Number(buf.readBigUInt64BE());

        events.push({ x, y, color, userId, timestamp });
    }

    return events;
}

function writeEvents(events, path) {
    const buf = new SmartBuffer();

    for (const event of events) {
        buf.writeUInt16BE(event.x);
        buf.writeUInt16BE(event.y);

        const colorBuf = Buffer.alloc(3);
        colorBuf.writeUIntBE(event.color, 0, 3);
        buf.writeBuffer(colorBuf);

        buf.writeBigInt64BE(BigInt(event.userId));
        buf.writeBigUInt64BE(BigInt(event.timestamp));
    }

    FileSystem.writeFileSync(path, buf.toBuffer());
}

function generateCounters(events, topCount = 20) {
    const userCounters = {};

    events.forEach((event) => {
        const userId = event.userId;

        if (!userCounters[userId]) {
            userCounters[userId] = 1;
        } else {
            userCounters[userId]++;
        }
    });

    // Sort the counters by count in descending order
    const sortedCounters = Object.entries(userCounters)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topCount) // Limit to the top 20 counters
        .reduce((acc, [userId, count]) => {
            acc[userId] = count;
            return acc;
        }, {});
    console.log(sortedCounters)

    return sortedCounters;
}

// Example usage:
const events = readEvents("../canvas/current.hst"); // Read events from your file

console.log(events);

const counters = generateCounters(events, 20); // Limit to the top 20 counters

// Create a SmartBuffer instance
const smartBuffer = new SmartBuffer();

// Write the counters to the SmartBuffer
smartBuffer.writeString(JSON.stringify(counters), 'utf-8');

// Write the SmartBuffer to a binary file (e.g., 'counters.pony')
fs.writeFile('counters.pony', smartBuffer.toBuffer(), (err) => {
    if (err) {
        console.error('Error writing to the file:', err);
    } else {
        console.log('Top 20 counters saved to counters.pony');
    }
});

function editEventsArray(events, x1, y1, x2, y2) {
    // Filter out entries that are not within the specified range
    const editedEvents = events.filter((event) => {
        const { x, y } = event;
        return x < x1 || x > x2 || y < y1 || y > y2;
    });

    return editedEvents;
}

const FileSystem = require("fs");
const SmartBuffer = require("smart-buffer").SmartBuffer;
const PNG = require("pngjs").PNG;
const fs = require('fs');

// copied from canvas.js
function readEvents(path) {
    const events = [];

    const buf = SmartBuffer.fromBuffer(FileSystem.readFileSync(path));

    while (buf.remaining() > 0) {
        const x = buf.readUInt16BE();
        const y = buf.readUInt16BE();

        const color = buf.readBuffer(3).readUintBE(0, 3);

        const userId = buf.readBigUInt64BE().toString();
        const timestamp = Number(buf.readBigUInt64BE())

        events.push({ x, y, color, userId, timestamp });
    }

    return events;
}

// same
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

//deleteEntriesInArea("events.json", 0, 0, 26, 24);
//deleteEntriesInArea("events.json", 103, 3, 170, 53);

function editEventsArray(events, x1, y1, x2, y2) {
    // Filter out entries that are not within the specified range
    const editedEvents = events.filter((event) => {
        const { x, y } = event;
        return x < x1 || x > x2 || y < y1 || y > y2;
    });

    return editedEvents;
}

// Example usage:
const events = readEvents("../canvas/current.hst"); // Read events from your file
const editedEvents = editEventsArray(events, 0, 181, 3, 254); // Edit the array
//console.log(events)
// Write the edited events back to the file
writeEvents(editedEvents, "../canvas/current.hst");

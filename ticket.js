const fs = require("fs");

module.exports = {
  name: "ticket",

  execute(message) {
    const filePath = "./data.json";
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const userId = message.author.id;
    const user = data.users[userId];

    if (!user) {
      return message.reply("❌ You don't have a ticket yet.\nUse !bookcabin and !bookseat to get started 🚢");
    }

    const cabin = user.cabin || "Not booked";
    const seat = user.seat || "Not booked";

    // find if cabin/seat still valid in maps (extra safety)
    const cabinStatus = data.cabinMap[cabin] === userId ? "Confirmed" : "Invalid";
    const seatStatus = data.seatMap[seat] === userId ? "Confirmed" : "Invalid";

    message.reply(`
🎟️ **RO-12 BOARDING TICKET**

👤 Passenger: ${message.author.username}
🛏️ Cabin: ${cabin} (${cabinStatus})
💺 Seat: ${seat} (${seatStatus})

🌊 Status: Ready for boarding 🚢
`);
  }
};

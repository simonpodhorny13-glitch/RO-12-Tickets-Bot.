const fs = require("fs");

module.exports = {
  name: "bookseat",

  execute(message, args) {
    const seat = args[0];
    const filePath = "./data.json";

    if (!seat) {
      return message.reply("❌ Usage: !bookseat 12C");
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // check if seat exists already
    if (data.seatMap[seat]) {
      return message.reply("❌ That seat is already taken!");
    }

    const userId = message.author.id;

    // prevent double seat booking
    if (data.users[userId]?.seat) {
      return message.reply("❌ You already booked a seat!");
    }

    // save seat ownership
    data.seatMap[seat] = userId;

    if (!data.users[userId]) data.users[userId] = {};
    data.users[userId].seat = seat;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    message.reply(`💺 Seat **${seat}** booked successfully! 🚢`);
  }
};

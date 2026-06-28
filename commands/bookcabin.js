const fs = require("fs");

module.exports = {
  name: "bookcabin",

  execute(message, args) {
    const cabin = args[0];
    const filePath = "./data.json";

    if (!cabin) {
      return message.reply("❌ Usage: !bookcabin 1A");
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const userId = message.author.id;

    if (!data.users[userId]) {
      data.users[userId] = { balance: 0, spent: 0 };
    }

    if (data.users[userId].cabin) {
      return message.reply("❌ You already have a cabin!");
    }

    if (data.cabinMap[cabin]) {
      return message.reply("❌ That cabin is already taken!");
    }

    const voyageType = data.voyage?.type || "short";
    let price = 50;

    // cabin class pricing
    if (["1C", "1D", "2C", "2D"].includes(cabin)) price = 150;
    if (["3A", "3B", "3C", "3D"].includes(cabin)) price = 120;

    // multipliers
    if (voyageType === "medium") price *= 1.5;
    if (voyageType === "long") price *= 2;

    // balance check
    if (data.users[userId].balance < price) {
      return message.reply("❌ Not enough balance!");
    }

    // deduct
    data.users[userId].balance -= price;
    data.users[userId].spent += price;

    // assign
    data.users[userId].cabin = cabin;
    data.cabinMap[cabin] = userId;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    message.reply(`🛏️ Cabin ${cabin} booked! 💰-${price}`);
  }
};

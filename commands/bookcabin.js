const fs = require("fs");

module.exports = {
  name: "bookcabin",
  description: "Book a cabin for a voyage",

  async execute(interaction) {
    const location = interaction.options.getString("location");
    const voyageId = interaction.options.getString("voyage");

    const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
    const userId = interaction.user.id;

    const voyage = data.voyages[voyageId];

    if (!voyage) {
      return interaction.reply({ content: "❌ Voyage not found.", ephemeral: true });
    }

    if (!voyage.salesOpen) {
      return interaction.reply({ content: "❌ Sales are not open.", ephemeral: true });
    }

    if (voyage.cancelled) {
      return interaction.reply({ content: "❌ Voyage is cancelled.", ephemeral: true });
    }

    if (!data.users[userId]) {
      data.users[userId] = { balance: 0, bookings: {} };
    }

    const user = data.users[userId];
    if (!user.bookings) user.bookings = {};

    if (user.bookings[voyageId]) {
      return interaction.reply({ content: "❌ You already booked for this voyage.", ephemeral: true });
    }

    if (voyage.cabinMap[location]) {
      return interaction.reply({ content: "❌ Cabin already taken.", ephemeral: true });
    }

    // 💰 pricing
    let price = 50;

    if (["1C", "1D", "2C", "2D"].includes(location)) price = 150;
    if (["3A", "3B", "3C", "3D"].includes(location)) price = 120;

    if (voyage.length === 2) price *= 1.5;
    if (voyage.length === 3) price *= 2;

    if (user.balance < price) {
      return interaction.reply({ content: "❌ Not enough balance.", ephemeral: true });
    }

    user.balance -= price;

    user.bookings[voyageId] = {
      type: "cabin",
      location,
      paid: price
    };

    voyage.cabinMap[location] = userId;

    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

    interaction.reply({
      content: `🛏️ Cabin ${location} booked for ${voyageId}\n💰 Paid: $${price}`,
      ephemeral: true
    });
  }
};

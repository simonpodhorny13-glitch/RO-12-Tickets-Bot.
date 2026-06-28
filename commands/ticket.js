const fs = require("fs");
const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "ticket",
  description: "View your ticket for a voyage",

  async execute(interaction) {
    const voyageId = interaction.options.getString("voyage");

    const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
    const userId = interaction.user.id;

    const voyage = data.voyages[voyageId];

    if (!voyage) {
      return interaction.reply({
        content: "❌ Voyage not found.",
        ephemeral: true
      });
    }

    const user = data.users[userId];

    if (!user || !user.bookings || !user.bookings[voyageId]) {
      return interaction.reply({
        content: "❌ You don't have a ticket for this voyage.",
        ephemeral: true
      });
    }

    const b = user.bookings[voyageId];

    // 🚦 Status logic (expanded for realism)
    let status = "🟡 Pending";
    if (voyage.cancelled) status = "❌ Cancelled";
    else if (voyage.inProgress) status = "🟣 In Progress";
    else if (voyage.boarding) status = "🟠 Boarding";
    else if (voyage.salesOpen) status = "🟢 Active";

    const typeLabel = b.type === "cabin" ? "🏨 Cabin" : "💺 Seat";

    const embed = new EmbedBuilder()
      .setColor(voyage.cancelled ? 0xff3b3b : 0x2ecc71)
      .setTitle("🎟️ RO-12 BOARDING PASS")
      .setDescription(`Voyage **${voyageId}**`)
      .addFields(
        {
          name: "📍 Route",
          value: `${voyage.from} → ${voyage.to}`,
          inline: false
        },
        {
          name: "🚢 Ship",
          value: voyage.ship,
          inline: true
        },
        {
          name: "📅 Departure",
          value: `${voyage.date}, ${voyage.time}`,
          inline: true
        },
        {
          name: "🚦 Status",
          value: status,
          inline: false
        },
        {
          name: "🎫 Booking",
          value: `${typeLabel}: ${b.location}`,
          inline: true
        },
        {
          name: "💰 Payment",
          value: `$${b.paid}`,
          inline: true
        }
      )
      .setFooter({ text: "RO-12 Voyage System • Boarding Pass" })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};

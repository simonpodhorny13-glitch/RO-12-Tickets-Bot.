const fs = require("fs");
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("View your RO-12 ticket")
    .addStringOption(option =>
      option
        .setName("voyage")
        .setDescription("Voyage ID")
        .setRequired(true)
    ),

  async execute(interaction) {
    const voyageId = interaction.options.getString("voyage");

    const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
    const userId = interaction.user.id;

    const voyage = data.voyages?.[voyageId];

    if (!voyage) {
      return interaction.reply({
        content: "❌ Voyage not found.",
        ephemeral: true
      });
    }

 // 🔍 find booking
let bookingType = null;
let bookingLocation = null;

const cabin = Object.entries(voyage.cabinMap || {})
  .find(([, id]) => id === userId);

if (cabin) {
  bookingType = "🛏️ Cabin";
  bookingLocation = cabin[0];
}

const seat = Object.entries(voyage.seatMap || {})
  .find(([, id]) => id === userId);

if (seat) {
  bookingType = "💺 Seat";
  bookingLocation = seat[0];
}
    if (!bookingType) {
      return interaction.reply({
        content: "❌ You don't have a ticket for this voyage.",
        ephemeral: true
      });
    }

    // 🚦 status logic
    let status = "🟡 Preparing";

    if (voyage.cancelled) status = "❌ Cancelled";
    else if (voyage.salesOpen) status = "🟢 Sales Open";
    else if (voyage.gcDeadline) status = "🟠 Awaiting Crew Completion";

    const isCaptain = voyage.crew?.captain === userId;
    const isFO = voyage.crew?.fo === userId;
    const isGC = voyage.crew?.gc === userId;

    const role =
      isCaptain ? "👨‍✈️ Captain" :
      isFO ? "🧑‍✈️ First Officer" :
      isGC ? "🧰 Ground Crew" :
      "🧳 Passenger";

    const embed = new EmbedBuilder()
      .setColor(voyage.cancelled ? 0xff3b3b : 0x00bfff)
      .setTitle("🎟️ RO-12 BOARDING PASS")
      .setDescription(`Voyage **${voyageId}**`)
      .addFields(
        {
          name: "🗺 Route",
          value: `${voyage.from} → ${voyage.to}`,
          inline: false
        },
        {
          name: "🚢 Ship",
          value: voyage.ship,
          inline: true
        },
        {
          name: "⏱ Departure",
          value: voyage.departure || "TBA",
          inline: true
        },
        {
          name: "🚦 Status",
          value: status,
          inline: false
        },
        {
          name: "🎫 Booking",
          value: `${bookingType}: ${bookingLocation}`,
          inline: true
        },
        {
          name: "🧭 Role",
          value: role,
          inline: true
        },
        {
          name: "👥 Crew Status",
          value:
            `Captain: ${voyage.crew?.captain ? "✔" : "❌"}\n` +
            `FO: ${voyage.crew?.fo ? "✔" : "❌"}\n` +
            `GC: ${voyage.crew?.gc ? "✔" : "❌"}`
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
